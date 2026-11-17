import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import {
  GetInvoiceScannerStatusResponse,
  ScanInvoiceFileHeader,
  SavePurchaseInvoiceBody,
  SavePurchaseInvoiceResponse,
  ScanInvoiceFileResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";
import { completeWithOpenRouter, OpenRouterError } from "../lib/openrouter.ts";
import { extractNativeInvoiceFromPdf } from "../lib/pdf-invoice-text.ts";
import {
  buildInvoiceExtractionPrompt,
  extractOcrText,
  extractInvoiceFromOcrText,
  hasDetectedInvoiceValues,
  normalizeExtractedInvoice,
} from "../lib/invoice-ocr.ts";

const router: IRouter = Router();
const MAX_FILE_BYTES = 1_000_000;
const MAX_PDF_PAGES = 3;
const MAX_OCR_REQUESTS_PER_MINUTE = 4;
const DAILY_OCR_SOFT_LIMIT = 450;
const perUserRequests = new Map<string, number[]>();
let dailyRequestDate = "";
let dailyRequestCount = 0;

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
}

function accessTokenFrom(req: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get("authorization") ?? "");
  return match?.[1] ?? null;
}

function getSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return null;

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

type SupabaseRequestClient = NonNullable<ReturnType<typeof getSupabaseClient>>;
type OcrProviderResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};
type AuthenticatedUser = {
  client: SupabaseRequestClient;
  userId: string;
};

async function authenticatedUser(req: Request, res: Response): Promise<AuthenticatedUser | null> {
  const accessToken = accessTokenFrom(req);
  if (!accessToken) {
    sendError(res, 401, "Sign in to scan an invoice.");
    return null;
  }

  const client = getSupabaseClient(accessToken);
  if (!client) {
    sendError(res, 503, "Supabase is not configured on the server.");
    return null;
  }

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    sendError(res, 401, "Your session is invalid. Sign in again.");
    return null;
  }
  return { client, userId: data.user.id };
}

function allowPerUserRequest(userId: string): boolean {
  const now = Date.now();
  const recent = (perUserRequests.get(userId) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= MAX_OCR_REQUESTS_PER_MINUTE) {
    perUserRequests.set(userId, recent);
    return false;
  }
  recent.push(now);
  perUserRequests.set(userId, recent);
  if (perUserRequests.size > 10_000) {
    for (const [key, times] of perUserRequests) {
      if (!times.some((time) => now - time < 60_000)) perUserRequests.delete(key);
    }
  }
  return true;
}

function reserveDailyRequest(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyRequestDate) {
    dailyRequestDate = today;
    dailyRequestCount = 0;
  }
  if (dailyRequestCount >= DAILY_OCR_SOFT_LIMIT) return false;
  dailyRequestCount += 1;
  return true;
}

async function readLimitedBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.byteLength;
    if (byteLength > MAX_FILE_BYTES) {
      throw new RangeError("Invoice files must be 1 MB or smaller.");
    }
    chunks.push(buffer);
  }
  if (byteLength === 0) throw new Error("Choose an invoice file first.");
  return Buffer.concat(chunks, byteLength);
}

function detectFileType(bytes: Buffer, contentType: string): "image/jpeg" | "image/png" | "application/pdf" | null {
  if (
    contentType === "image/jpeg"
    && bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) return "image/jpeg";
  if (
    contentType === "image/png"
    && bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "image/png";
  if (contentType === "application/pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

function safeFilename(value: string | undefined, type: "image/jpeg" | "image/png" | "application/pdf"): string {
  const extension = type === "application/pdf" ? ".pdf" : type === "image/png" ? ".png" : ".jpg";
  let decoded = value ?? "";
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = "";
  }
  const name = decoded
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}._ -]/gu, "")
    .trim()
    .slice(0, 100);
  const baseName = name?.replace(/\.[^.]*$/, "").replace(/[. ]+$/g, "").trim();
  return `${baseName || "invoice"}${extension}`;
}

function parseEngine(value: string | undefined): 2 | 3 | null {
  if (value === undefined || value === "2") return 2;
  if (value === "3") return 3;
  return null;
}

router.post("/invoice-scanner/scan", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;

  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    sendError(res, 503, "Invoice scanning is not configured. Add OCR_SPACE_API_KEY to Replit Secrets.");
    return;
  }

  const header = ScanInvoiceFileHeader.safeParse({
    "X-OCR-Engine": Number(req.get("x-ocr-engine")),
    "X-File-Name": req.get("x-file-name") ?? undefined,
  });
  const engine = header.success ? header.data["X-OCR-Engine"] : parseEngine(req.get("x-ocr-engine"));
  if (!header.success && req.get("x-file-name")) {
    sendError(res, 400, "Invoice file headers are invalid.");
    return;
  }
  if (!engine) {
    sendError(res, 400, "Choose OCR Engine 2 or 3.");
    return;
  }
  if (!allowPerUserRequest(user.userId)) {
    sendError(res, 429, "Too many invoice scans. Wait a minute before trying again.");
    return;
  }
  const contentType = (req.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "application/pdf"].includes(contentType)) {
    sendError(res, 415, "Use a JPG, PNG, or PDF invoice.");
    return;
  }
  const declaredLength = Number(req.get("content-length") ?? 0);
  if (declaredLength > MAX_FILE_BYTES) {
    sendError(res, 413, "The free OCR plan accepts files up to 1 MB. Compress the file and try again.");
    return;
  }

  let file: Buffer;
  try {
    file = await readLimitedBody(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    sendError(res, error instanceof RangeError ? 413 : 400, message || "The invoice file could not be read.");
    return;
  }

  const fileType = detectFileType(file, contentType);
  if (!fileType) {
    sendError(res, 415, "The file contents do not match a supported JPG, PNG, or PDF file.");
    return;
  }

  let pageCount = 1;
  if (fileType === "application/pdf") {
    try {
      const pdf = await PDFDocument.load(file, { updateMetadata: false });
      pageCount = pdf.getPageCount();
    } catch {
      sendError(res, 400, "This PDF could not be opened. Remove its password or export it again, then retry.");
      return;
    }
    if (pageCount < 1 || pageCount > MAX_PDF_PAGES) {
      sendError(res, 413, "The free OCR plan supports PDFs with up to 3 pages. Split the invoice without removing pages and retry.");
      return;
    }

    try {
      const nativePdf = await extractNativeInvoiceFromPdf(file);
      if (nativePdf) {
        res.json(ScanInvoiceFileResponse.parse({
          invoice: nativePdf.invoice,
          extractedText: nativePdf.text,
          engine,
          pageCount: nativePdf.pageCount,
          parseWarning: null,
        }));
        return;
      }
    } catch (error) {
      req.log.warn({ err: error }, "Could not read the PDF text layer; falling back to OCR");
    }
  }

  if (!reserveDailyRequest()) {
    sendError(res, 429, "Daftarik has reached its daily OCR safety limit. Try again tomorrow.");
    return;
  }

  const formData = new FormData();
  const fileBytes = new Uint8Array(file.byteLength);
  file.copy(fileBytes);
  formData.append("file", new Blob([fileBytes.buffer], { type: fileType }), safeFilename(req.get("x-file-name"), fileType));
  formData.append("OCREngine", String(engine));
  formData.append("isTable", "true");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");

  let providerResponse: OcrProviderResponse;
  try {
    // Vercel's Express type pass assigns a conflicting Response type to fetch.
    // Node's runtime fetch still returns the standard response shape used here.
    providerResponse = (await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: apiKey },
      body: formData,
      signal: AbortSignal.timeout(60_000),
    })) as unknown as OcrProviderResponse;
  } catch {
    sendError(res, 502, "OCR.Space could not be reached. Try again shortly.");
    return;
  }

  if (!providerResponse.ok) {
    req.log.warn({ status: providerResponse.status }, "OCR provider rejected an invoice scan");
    if (providerResponse.status === 429) {
      sendError(res, 429, "OCR.Space's free request quota is temporarily unavailable. Try again later.");
      return;
    }
    if (providerResponse.status === 401 || providerResponse.status === 403) {
      sendError(res, 503, "The saved OCR.Space key was rejected. Check the secret and try again.");
      return;
    }
    sendError(res, 502, "OCR.Space could not read this invoice. Try a clearer file.");
    return;
  }

  let ocrText: string;
  try {
    const payload: unknown = await providerResponse.json();
    const result = extractOcrText(payload);
    ocrText = result.text;
  } catch (error) {
    sendError(
      res,
      422,
      error instanceof Error
        ? error.message
        : "OCR.Space could not read this document. Try a clearer image or enter the invoice manually.",
    );
    return;
  }

  try {
    const parsedText = await completeWithOpenRouter([
      {
        role: "system",
        content: "You extract invoice data faithfully. Never infer values that are not present. Return only the requested JSON.",
      },
      { role: "user", content: buildInvoiceExtractionPrompt(ocrText) },
    ]);
    const invoice = normalizeExtractedInvoice(parsedText);
    res.json(ScanInvoiceFileResponse.parse({
      invoice,
      extractedText: ocrText,
      engine,
      pageCount,
      parseWarning: null,
    }));
  } catch (error) {
    const status = error instanceof OpenRouterError ? error.status : 502;
    req.log.warn({ status }, "Invoice text could not be structured by the AI model");
    const locallyExtractedInvoice = extractInvoiceFromOcrText(ocrText);
    const fallbackInvoice = hasDetectedInvoiceValues(locallyExtractedInvoice) ? locallyExtractedInvoice : null;
    res.json(ScanInvoiceFileResponse.parse({
      invoice: fallbackInvoice,
      extractedText: ocrText,
      engine,
      pageCount,
      parseWarning: fallbackInvoice
        ? "Some fields were filled from the recognized text. Review all details before saving."
        : "The text was read, but automatic field detection is unavailable. Review and enter the invoice fields manually.",
    }));
  }
});

router.get("/invoice-scanner/status", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;
  res.json(GetInvoiceScannerStatusResponse.parse({
    ocrConfigured: Boolean(process.env.OCR_SPACE_API_KEY),
    aiParserConfigured: Boolean(process.env.OPENROUTER_API_KEY),
  }));
});

router.post("/purchase-invoices", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    sendError(res, 400, "Invoice details are invalid.");
    return;
  }
  const parsed = SavePurchaseInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "Invoice details are invalid.");
    return;
  }

  const rpcClient = user.client as unknown as {
    rpc(
      functionName: string,
      args: Record<string, unknown>,
    ): Promise<{ data: unknown; error: { code: string; message: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc("save_purchase_invoice", {
    p_invoice: parsed.data as unknown as Record<string, unknown>,
  });
  if (error) {
    const isDuplicate = error.code === "23505";
    const isConflict =
      error.message.includes("already exists")
      || error.message.includes("already in your account")
      || isDuplicate;
    req.log.warn({ code: error.code }, "Could not save a purchase invoice");
    sendError(
      res,
      isConflict ? 409 : error.message.includes("Authentication required") ? 401 : 400,
      isDuplicate
        ? "This supplier invoice number is already saved for your account."
        : isConflict
          ? error.message
          : error.message || "The invoice could not be saved.",
    );
    return;
  }
  res.status(201).json(SavePurchaseInvoiceResponse.parse(data));
});

export default router;

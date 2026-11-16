export type InvoiceFieldConfidence = "high" | "medium" | "low" | "missing";

export type ExtractedInvoiceItem = {
  productName: string;
  description: string;
  sku: string;
  quantity: string | null;
  unitOfMeasure: string;
  unitPurchasePrice: string | null;
  lineTotal: string | null;
  discount: string | null;
  confidence: InvoiceFieldConfidence;
};

export type ExtractedInvoice = {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  supplierName: string | null;
  supplierPhone: string | null;
  supplierEmail: string | null;
  currencyCode: string | null;
  subtotal: string | null;
  discount: string | null;
  tax: string | null;
  shippingFee: string | null;
  otherCharges: string | null;
  total: string | null;
  items: ExtractedInvoiceItem[];
  warnings: string[];
};

const MAX_ITEMS = 100;
const MAX_TEXT_LENGTH = 40_000;
const CURRENCIES = new Set(["KWD", "SAR", "AED", "BHD", "QAR", "OMR", "USD"]);

function boundedText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalText(value: unknown, maxLength: number): string | null {
  const text = boundedText(value, maxLength);
  return text.length > 0 ? text : null;
}

function amountText(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value)
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٫]/g, ".")
    .replace(/[٬,]/g, "")
    .replace(/[^\d.-]/g, "");
  if (!/^-?\d{1,11}(?:\.\d{1,3})?$/.test(text)) return null;
  return text;
}

function confidence(value: unknown): InvoiceFieldConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "missing";
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI response did not contain a JSON object.");
  const value: unknown = JSON.parse(withoutFence.slice(start, end + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The AI response was not a JSON object.");
  }
  return value as Record<string, unknown>;
}

export function buildInvoiceExtractionPrompt(ocrText: string): string {
  return [
    "Extract fields from this supplier invoice or receipt into one JSON object.",
    "Do not invent missing values. Use null for missing invoice fields and an empty array when no line items are visible.",
    "Keep supplier/product names in their original language. Return amounts as decimal strings without currency symbols or thousands separators.",
    "Use ISO date YYYY-MM-DD only when the date is unambiguous. Currency must be one of KWD, SAR, AED, BHD, QAR, OMR, USD or null.",
    "For each item return productName, description, sku, quantity, unitOfMeasure, unitPurchasePrice, lineTotal, discount, confidence.",
    "For confidence use high, medium, or low. Add short warnings for unclear totals, dates, or possible duplicate totals.",
    "Return JSON only, with keys: invoiceNumber, invoiceDate, supplierName, supplierPhone, supplierEmail, currencyCode, subtotal, discount, tax, shippingFee, otherCharges, total, items, warnings.",
    "",
    "Invoice OCR text:",
    ocrText.slice(0, MAX_TEXT_LENGTH),
  ].join("\n");
}

export function normalizeExtractedInvoice(raw: string): ExtractedInvoice {
  const value = parseJsonObject(raw);
  const rawItems = Array.isArray(value.items) ? value.items.slice(0, MAX_ITEMS) : [];
  const items = rawItems.flatMap((rawItem): ExtractedInvoiceItem[] => {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return [];
    const item = rawItem as Record<string, unknown>;
    const productName = boundedText(item.productName, 160);
    if (!productName) return [];
    return [{
      productName,
      description: boundedText(item.description, 500),
      sku: boundedText(item.sku, 100),
      quantity: amountText(item.quantity),
      unitOfMeasure: boundedText(item.unitOfMeasure, 32),
      unitPurchasePrice: amountText(item.unitPurchasePrice),
      lineTotal: amountText(item.lineTotal),
      discount: amountText(item.discount),
      confidence: confidence(item.confidence),
    }];
  });
  const rawCurrency = boundedText(value.currencyCode, 3).toUpperCase();
  const warnings = Array.isArray(value.warnings)
    ? value.warnings
        .filter((warning): warning is string => typeof warning === "string")
        .map((warning) => warning.trim().slice(0, 240))
        .filter(Boolean)
        .slice(0, 12)
    : [];

  return {
    invoiceNumber: optionalText(value.invoiceNumber, 100),
    invoiceDate: optionalText(value.invoiceDate, 10),
    supplierName: optionalText(value.supplierName, 160),
    supplierPhone: optionalText(value.supplierPhone, 40),
    supplierEmail: optionalText(value.supplierEmail, 254),
    currencyCode: CURRENCIES.has(rawCurrency) ? rawCurrency : null,
    subtotal: amountText(value.subtotal),
    discount: amountText(value.discount),
    tax: amountText(value.tax),
    shippingFee: amountText(value.shippingFee),
    otherCharges: amountText(value.otherCharges),
    total: amountText(value.total),
    items,
    warnings,
  };
}

export function extractOcrText(payload: unknown): { text: string; pageCount: number } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("OCR.Space returned an invalid response.");
  }
  const response = payload as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
    ParsedResults?: Array<{ ParsedText?: string; FileParseExitCode?: number }>;
  };
  const parsedResults = Array.isArray(response.ParsedResults) ? response.ParsedResults : [];
  const text = parsedResults
    .map((result) => typeof result?.ParsedText === "string" ? result.ParsedText.trim() : "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TEXT_LENGTH);
  if (response.IsErroredOnProcessing || text.length === 0) {
    throw new Error("OCR.Space could not read this document. Try a clearer image or enter the invoice manually.");
  }
  return { text, pageCount: parsedResults.length };
}

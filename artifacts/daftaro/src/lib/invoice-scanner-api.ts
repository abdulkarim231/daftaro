import "./api-client-config";
import { supabase } from "./supabase";
import {
  getInvoiceScannerStatus as requestInvoiceScannerStatus,
  savePurchaseInvoice as requestSavePurchaseInvoice,
  scanInvoiceFile as requestScanInvoiceFile,
} from "@workspace/api-client-react";
import type {
  ExtractedInvoice,
  ExtractedInvoiceItem,
  InvoiceScanResult,
  InvoiceScannerStatus,
  PurchaseInvoiceInput,
  PurchaseInvoiceItemInput,
  PurchaseInvoiceResult,
} from "@workspace/api-client-react";

export type InvoiceScanEngine = InvoiceScanResult["engine"];
export type InvoiceSaveEngine = PurchaseInvoiceInput["ocrEngine"];
export type InvoiceFieldConfidence = PurchaseInvoiceItemInput["confidence"];
export type InvoiceProductAction = PurchaseInvoiceItemInput["action"];
export type InvoiceItemDraft = PurchaseInvoiceItemInput;
export type InvoiceDraft = Omit<PurchaseInvoiceInput, "ocrEngine" | "items" | "currencyCode"> & {
  currencyCode: string;
  items: InvoiceItemDraft[];
};
export type SavePurchaseInvoiceInput = PurchaseInvoiceInput;
export type SavePurchaseInvoiceResult = PurchaseInvoiceResult;
export type { ExtractedInvoice, ExtractedInvoiceItem, InvoiceScanResult, InvoiceScannerStatus };

async function requireAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to scan and save invoices.");
  return token;
}

export async function scanInvoice(
  file: File,
  engine: InvoiceScanEngine,
): Promise<InvoiceScanResult> {
  const accessToken = await requireAccessToken();
  const contentType = file.type || (
    /\.pdf$/i.test(file.name) ? "application/pdf"
      : /\.png$/i.test(file.name) ? "image/png"
        : "image/jpeg"
  );
  const encodedFilename = encodeURIComponent(file.name);
  return requestScanInvoiceFile(file, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
      "X-OCR-Engine": String(engine),
      ...(encodedFilename.length <= 180 ? { "X-File-Name": encodedFilename } : {}),
    },
    cache: "no-store",
  });
}

export async function getInvoiceScannerStatus(): Promise<InvoiceScannerStatus> {
  const accessToken = await requireAccessToken();
  return requestInvoiceScannerStatus({
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

export async function savePurchaseInvoice(
  input: SavePurchaseInvoiceInput,
): Promise<SavePurchaseInvoiceResult> {
  const accessToken = await requireAccessToken();
  return requestSavePurchaseInvoice(input, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

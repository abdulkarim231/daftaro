import {
  extractInvoiceFromPdfTextItems,
  hasDetectedInvoiceValues,
  type PositionedPdfTextItem,
} from "./invoice-ocr.ts";

const MIN_PDF_TEXT_LENGTH = 50;
const MIN_PDF_LETTERS = 16;

export async function extractNativeInvoiceFromPdf(file: Uint8Array): Promise<{
  invoice: ReturnType<typeof extractInvoiceFromPdfTextItems>["invoice"];
  text: string;
  pageCount: number;
} | null> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(file),
    disableFontFace: true,
    useSystemFonts: true,
    verbosity: 0,
  });

  try {
    const document = await loadingTask.promise;
    if (document.numPages !== 1) return null;
    const items: PositionedPdfTextItem[] = [];

    const page = await document.getPage(1);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      items.push({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
      });
    }

    const extracted = extractInvoiceFromPdfTextItems(items);
    const letterCount = extracted.text.match(/\p{L}/gu)?.length ?? 0;
    if (
      extracted.text.length < MIN_PDF_TEXT_LENGTH
      || letterCount < MIN_PDF_LETTERS
      || !hasDetectedInvoiceValues(extracted.invoice)
    ) {
      return null;
    }

    return {
      ...extracted,
      pageCount: document.numPages,
    };
  } finally {
    await loadingTask.destroy();
  }
}

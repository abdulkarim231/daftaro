export const MAX_INVOICE_FILE_BYTES = 1_000_000;
export const MAX_INVOICE_PDF_PAGES = 3;

export type InvoiceFileInfo = {
  type: "image/jpeg" | "image/png" | "application/pdf";
  pageCount: number;
};

function typeFromFile(file: File): InvoiceFileInfo["type"] | null {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "image/jpeg";
  if (type === "image/png") return "image/png";
  if (type === "application/pdf") return "application/pdf";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "pdf") return "application/pdf";
  return null;
}

export async function inspectInvoiceFile(file: File): Promise<InvoiceFileInfo> {
  const type = typeFromFile(file);
  if (!type) throw new Error("Use a JPG, PNG, or PDF invoice.");
  if (file.size === 0) throw new Error("The selected file is empty.");
  if (type !== "application/pdf") return { type, pageCount: 1 };

  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(await file.arrayBuffer(), {
      updateMetadata: false,
    });
    const pageCount = pdf.getPageCount();
    if (pageCount < 1) throw new Error("The PDF has no pages.");
    if (pageCount > MAX_INVOICE_PDF_PAGES) {
      throw new Error("The free OCR plan supports PDFs with up to 3 pages. Split the invoice without removing pages, then try again.");
    }
    return { type, pageCount };
  } catch (error) {
    if (error instanceof Error && error.message.includes("supports PDFs")) throw error;
    throw new Error("This PDF could not be opened. Remove its password or export it again, then retry.");
  }
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: "image/jpeg" | "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("This image could not be compressed in your browser."));
    }, type, quality);
  });
}

async function compressImage(file: File, outputType: "image/jpeg" | "image/png"): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened. Choose another image or export it again.");
  }

  try {
    const maxDimension = 2200;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: outputType === "image/png" });
    if (!context) throw new Error("Image compression is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const qualities = outputType === "image/jpeg" ? [0.86, 0.74, 0.62, 0.52] : [undefined];
    for (const quality of qualities) {
      const blob = await canvasBlob(canvas, outputType, quality);
      if (blob.size <= MAX_INVOICE_FILE_BYTES) {
        const name = file.name.replace(/\.[^.]+$/, "") + (outputType === "image/png" ? ".png" : ".jpg");
        return new File([blob], name, { type: outputType, lastModified: Date.now() });
      }
    }
    throw new Error("The image is still over 1 MB after compression. Choose a smaller or lower-resolution image.");
  } finally {
    bitmap.close();
  }
}

async function compressPdf(file: File): Promise<File> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  const source = await loadingTask.promise;
  if (source.numPages > MAX_INVOICE_PDF_PAGES) {
    await loadingTask.destroy();
    throw new Error("The free OCR plan supports PDFs with up to 3 pages. Split the invoice without removing pages, then try again.");
  }

  try {
    const { PDFDocument } = await import("pdf-lib");
    const attempts = [
      { maxDimension: 1800, quality: 0.78 },
      { maxDimension: 1500, quality: 0.66 },
      { maxDimension: 1200, quality: 0.56 },
    ];

    for (const attempt of attempts) {
      const output = await PDFDocument.create();
      for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
        const sourcePage = await source.getPage(pageNumber);
        const originalViewport = sourcePage.getViewport({ scale: 1 });
        const scale = Math.min(attempt.maxDimension / Math.max(originalViewport.width, originalViewport.height), 1.5);
        const viewport = sourcePage.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("PDF compression is unavailable in this browser.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await sourcePage.render({ canvas, canvasContext: context, viewport }).promise;
        const jpeg = await canvasBlob(canvas, "image/jpeg", attempt.quality);
        const jpegBytes = new Uint8Array(await jpeg.arrayBuffer());
        const embeddedImage = await output.embedJpg(jpegBytes);
        const page = output.addPage([originalViewport.width, originalViewport.height]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: originalViewport.width,
          height: originalViewport.height,
        });
        canvas.width = 1;
        canvas.height = 1;
      }

      const saved = await output.save({ useObjectStreams: true });
      if (saved.byteLength <= MAX_INVOICE_FILE_BYTES) {
        const bytes = new Uint8Array(saved.byteLength);
        bytes.set(saved);
        const name = file.name.replace(/\.pdf$/i, "") + "-compressed.pdf";
        return new File([bytes.buffer], name, { type: "application/pdf", lastModified: Date.now() });
      }
    }
    throw new Error("The PDF is still over 1 MB after compression. Export it at a lower resolution and try again.");
  } finally {
    await loadingTask.destroy();
  }
}

export async function compressInvoiceFile(file: File): Promise<File> {
  const info = await inspectInvoiceFile(file);
  if (info.type === "application/pdf") return compressPdf(file);
  return compressImage(file, info.type);
}


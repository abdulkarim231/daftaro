import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoiceExtractionPrompt,
  extractInvoiceFromOcrText,
  extractOcrText,
  hasDetectedInvoiceValues,
  normalizeExtractedInvoice,
} from "../src/lib/invoice-ocr.ts";

test("normalizes an invoice extraction while preserving Arabic names and digits", () => {
  const invoice = normalizeExtractedInvoice([
    "```json",
    JSON.stringify({
      invoiceNumber: "INV-2026-4",
      invoiceDate: "2026-11-16",
      supplierName: "مورد العطور",
      supplierPhone: "+965 5555 0101",
      supplierEmail: "sales@example.test",
      currencyCode: "kwd",
      subtotal: "١٢٫٥٠٠ KWD",
      discount: "0",
      tax: null,
      shippingFee: null,
      otherCharges: null,
      total: "١٢٫٥٠٠",
      items: [{
        productName: "ورد دمشقي",
        description: "عبوة كبيرة",
        sku: "ROSE-01",
        quantity: "2",
        unitOfMeasure: "عبوة",
        unitPurchasePrice: "6.250",
        lineTotal: "12.500",
        discount: "0",
        confidence: "high",
      }],
      warnings: ["تحقق من الإجمالي"],
    }),
    "```",
  ].join("\n"));

  assert.equal(invoice.supplierName, "مورد العطور");
  assert.equal(invoice.currencyCode, "KWD");
  assert.equal(invoice.subtotal, "12.500");
  assert.equal(invoice.items[0].productName, "ورد دمشقي");
  assert.equal(invoice.items[0].unitPurchasePrice, "6.250");
  assert.deepEqual(invoice.warnings, ["تحقق من الإجمالي"]);
});

test("drops invalid items and unsupported currencies instead of guessing", () => {
  const invoice = normalizeExtractedInvoice(JSON.stringify({
    currencyCode: "EUR",
    total: "3.25",
    items: [
      { productName: "Valid", quantity: "1", unitPurchasePrice: "3.25", lineTotal: "3.25" },
      { productName: " ", quantity: "2" },
      null,
    ],
  }));

  assert.equal(invoice.currencyCode, null);
  assert.equal(invoice.total, "3.25");
  assert.equal(invoice.items.length, 1);
  assert.equal(invoice.items[0].confidence, "missing");
});

test("rejects non-JSON model output", () => {
  assert.throws(() => normalizeExtractedInvoice("I could not read the invoice."), /JSON/);
});

test("extracts OCR text without logging or retaining the source document", () => {
  assert.deepEqual(
    extractOcrText({
      ParsedResults: [
        { ParsedText: "Supplier: Aroma House" },
        { ParsedText: "Total: 12.500 KWD" },
      ],
    }),
    { text: "Supplier: Aroma House\n\nTotal: 12.500 KWD", pageCount: 2 },
  );
  assert.throws(
    () => extractOcrText({ IsErroredOnProcessing: true, ParsedResults: [] }),
    /could not read/,
  );
});

test("keeps the prompt constrained to extracted text and no invented values", () => {
  const prompt = buildInvoiceExtractionPrompt("Total 12.500 KWD");
  assert.match(prompt, /Do not invent missing values/);
  assert.match(prompt, /may be in Arabic or English/);
  assert.match(prompt, /Total 12\.500 KWD/);
});

test("falls back to labeled English invoice fields and simple table rows", () => {
  const invoice = extractInvoiceFromOcrText([
    "Invoice No: INV-221",
    "Invoice Date: 2026-11-10",
    "Supplier: Aroma House",
    "Supplier Phone: +965 5555 0101",
    "Supplier Email: sales@example.test",
    "Currency: KWD",
    "Subtotal: 12.500 KWD",
    "Tax: 0.625 KWD",
    "Grand Total: 13.125 KWD",
    "Damask rose 2 6.250 12.500",
  ].join("\n"));

  assert.equal(invoice.invoiceNumber, "INV-221");
  assert.equal(invoice.invoiceDate, "2026-11-10");
  assert.equal(invoice.supplierName, "Aroma House");
  assert.equal(invoice.supplierPhone, "+965 5555 0101");
  assert.equal(invoice.supplierEmail, "sales@example.test");
  assert.equal(invoice.currencyCode, "KWD");
  assert.equal(invoice.subtotal, "12.500");
  assert.equal(invoice.tax, "0.625");
  assert.equal(invoice.total, "13.125");
  assert.deepEqual(
    { name: invoice.items[0].productName, quantity: invoice.items[0].quantity, price: invoice.items[0].unitPurchasePrice, total: invoice.items[0].lineTotal },
    { name: "Damask rose", quantity: "2", price: "6.250", total: "12.500" },
  );
  assert.equal(hasDetectedInvoiceValues(invoice), true);
});

test("falls back to Arabic invoice labels and leaves ambiguous dates blank", () => {
  const invoice = extractInvoiceFromOcrText([
    "اسم المورد: مورد العطور",
    "رقم الفاتورة: ١٢٣٤",
    "التاريخ: ٠١/٠٢/٢٠٢٦",
    "المجموع الفرعي: ١٢٫٥٠٠ د.ك",
    "الإجمالي النهائي: ١٣٫٠٠٠ د.ك",
    "ورد دمشقي ٢ ٦٫٢٥٠ ١٢٫٥٠٠",
  ].join("\n"));

  assert.equal(invoice.invoiceNumber, "١٢٣٤");
  assert.equal(invoice.invoiceDate, null);
  assert.equal(invoice.supplierName, "مورد العطور");
  assert.equal(invoice.currencyCode, "KWD");
  assert.equal(invoice.subtotal, "12.500");
  assert.equal(invoice.total, "13.000");
  assert.equal(invoice.items[0].productName, "ورد دمشقي");
  assert.equal(invoice.items[0].quantity, "2");
});

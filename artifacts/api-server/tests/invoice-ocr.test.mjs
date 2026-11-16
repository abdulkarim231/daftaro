import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoiceExtractionPrompt,
  extractInvoiceFromOcrText,
  extractInvoiceFromPdfTextItems,
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

test("extracts Arabic invoice fields and table columns from positioned PDF text", () => {
  const text = [
    ["INV-2026-0147", 52, 659], ["رقم الفاتورة", 231, 659],
    ["شركة الأريج للعطور", 318, 659], ["اسم المورد", 501, 659],
    ["2026-11-16", 52, 643], ["تاريخ الفاتورة", 228, 643],
    ["+965 2245 1234", 318, 643], ["هاتف المورد", 498, 643],
    ["KWD", 52, 627], ["عملة الفاتورة", 228, 627],
    ["sales@areej-perfumes.example", 318, 627], ["بريد المورد", 502, 627],
    ["المنتج", 521, 577], ["الرمز", 339, 577], ["الكمية", 274, 577],
    ["سعر الوحدة", 199, 577], ["الخصم", 148, 577], ["الإجمالي", 69, 577],
    ["عطر عود ملكي 100مل", 458, 549], ["PF-001", 335, 549], ["12", 282, 549],
    ["8.500", 212, 549], ["0.000", 150, 549], ["102.000", 69, 549],
    ["عطر مسك الطهارة 50مل", 449, 525], ["PF-014", 335, 525], ["20", 282, 525],
    ["3.750", 212, 525], ["0.000", 150, 525], ["75.000", 72, 525],
    ["عطر ورد طائفي 75مل", 461, 501], ["PF-022", 335, 501], ["10", 282, 501],
    ["6.250", 212, 501], ["2.000", 150, 501], ["60.500", 72, 501],
    ["دهن عود كمبودي 12مل", 458, 477], ["OD-005", 333, 477], ["6", 285, 477],
    ["11.000", 210, 477], ["0.000", 150, 477], ["66.000", 72, 477],
    ["بخور فاخر", 510, 453], ["BK-031", 334, 453], ["15", 282, 453],
    ["2.500", 212, 453], ["0.000", 150, 453], ["37.500", 72, 453],
    ["341.000 KWD", 343, 409], ["المجموع قبل الإضافات", 453, 409],
    ["-5.000 KWD", 343, 389], ["الخصم", 520, 389],
    ["0.000 KWD", 343, 369], ["الضريبة", 516, 369],
    ["3.500 KWD", 343, 349], ["الشحن", 518, 349],
    ["0.000 KWD", 343, 329], ["رسوم أخرى", 497, 329],
    ["339.500 KWD", 347, 295], ["الإجمالي النهائي", 454, 295],
  ].map(([value, x, y]) => ({ text: value, x, y }));

  const result = extractInvoiceFromPdfTextItems(text);
  assert.equal(result.invoice.invoiceNumber, "INV-2026-0147");
  assert.equal(result.invoice.invoiceDate, "2026-11-16");
  assert.equal(result.invoice.supplierName, "شركة الأريج للعطور");
  assert.equal(result.invoice.supplierPhone, "+965 2245 1234");
  assert.equal(result.invoice.supplierEmail, "sales@areej-perfumes.example");
  assert.equal(result.invoice.currencyCode, "KWD");
  assert.equal(result.invoice.subtotal, "343.000");
  assert.equal(result.invoice.discount, "5.000");
  assert.equal(result.invoice.tax, "0.000");
  assert.equal(result.invoice.shippingFee, "3.500");
  assert.equal(result.invoice.otherCharges, "0.000");
  assert.equal(result.invoice.total, "339.500");
  assert.deepEqual(
    result.invoice.items.map((item) => ({
      name: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      price: item.unitPurchasePrice,
      discount: item.discount,
      total: item.lineTotal,
    })),
    [
      { name: "عطر عود ملكي 100مل", sku: "PF-001", quantity: "12", price: "8.500", discount: "0.000", total: "102.000" },
      { name: "عطر مسك الطهارة 50مل", sku: "PF-014", quantity: "20", price: "3.750", discount: "0.000", total: "75.000" },
      { name: "عطر ورد طائفي 75مل", sku: "PF-022", quantity: "10", price: "6.250", discount: "2.000", total: "62.500" },
      { name: "دهن عود كمبودي 12مل", sku: "OD-005", quantity: "6", price: "11.000", discount: "0.000", total: "66.000" },
      { name: "بخور فاخر", sku: "BK-031", quantity: "15", price: "2.500", discount: "0.000", total: "37.500" },
    ],
  );
  assert.match(result.text, /INV-2026-0147/);
});

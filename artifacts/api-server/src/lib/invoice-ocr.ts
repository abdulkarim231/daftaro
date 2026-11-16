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

export type PositionedPdfTextItem = {
  text: string;
  x: number;
  y: number;
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
    "The invoice may be in Arabic or English. Map equivalent labels in either language to the requested fields.",
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

function normalizeOcrDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٫]/g, ".")
    .replace(/[٬]/g, ",");
}

function normalizeOcrLabel(text: string): string {
  return normalizeOcrDigits(text)
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function escapedRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchingLabel(line: string, labels: string[]): string | null {
  const labelPart = line.split(/[:：]/, 1)[0] ?? line;
  const normalizedLine = normalizeOcrLabel(labelPart);
  return labels
    .slice()
    .sort((left, right) => normalizeOcrLabel(right).length - normalizeOcrLabel(left).length)
    .find((label) => {
      const normalizedLabel = normalizeOcrLabel(label);
      return normalizedLine === normalizedLabel || normalizedLine.startsWith(`${normalizedLabel} `);
    }) ?? null;
}

function valueAfterLabel(line: string, label: string): string {
  const separator = line.search(/[:：]/);
  if (separator >= 0) return line.slice(separator + 1).trim();
  const prefix = new RegExp(`^\\s*${escapedRegExp(label)}\\s*`, "i");
  return line.replace(prefix, "").trim();
}

function amountTokens(line: string): Array<{ value: string; index: number }> {
  const normalized = normalizeOcrDigits(line);
  const matcher = /\d+(?:,\d{3})*(?:\.\d{1,3})?/g;
  return Array.from(normalized.matchAll(matcher), (match) => ({
    value: match[0],
    index: match.index ?? 0,
  }));
}

function amountFromLine(line: string): string | null {
  const tokens = amountTokens(line);
  return tokens.length ? amountText(tokens[tokens.length - 1]?.value) : null;
}

function parseOcrDate(value: string): string | null {
  const normalized = normalizeOcrDigits(value);
  const dateParts = normalized.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (dateParts) {
    const [, yearText, monthText, dayText] = dateParts;
    return toIsoDate(Number(yearText), Number(monthText), Number(dayText));
  }

  const dayFirst = normalized.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (dayFirst) {
    const [, firstText, secondText, yearText] = dayFirst;
    const first = Number(firstText);
    const second = Number(secondText);
    if (first <= 12 && second <= 12 && first !== second) return null;
    return first > 12
      ? toIsoDate(Number(yearText), second, first)
      : toIsoDate(Number(yearText), first, second);
  }

  const namedMonth = normalized.match(/\b(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})\b/i);
  if (!namedMonth) return null;
  const months: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9,
    september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const month = months[namedMonth[2].toLowerCase()];
  return month ? toIsoDate(Number(namedMonth[3]), month, Number(namedMonth[1])) : null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const INVOICE_NUMBER_LABELS = [
  "invoice number", "invoice no", "receipt number", "receipt no", "رقم الفاتورة",
  "رقم الفاتوره", "رقم الايصال", "رقم السند",
];
const DATE_LABELS = ["invoice date", "date", "تاريخ الفاتورة", "تاريخ الفاتوره", "التاريخ"];
const SUPPLIER_LABELS = [
  "supplier name", "supplier", "vendor name", "vendor", "merchant", "اسم المورد", "المورد",
  "اسم الشركة", "البائع",
];
const PHONE_LABELS = ["supplier phone", "phone", "telephone", "mobile", "هاتف المورد", "رقم الهاتف", "الهاتف", "الجوال"];
const EMAIL_LABELS = ["supplier email", "email", "e-mail", "بريد المورد", "البريد الالكتروني", "البريد الإلكتروني"];
const SUBTOTAL_LABELS = [
  "subtotal", "sub total", "net amount", "before tax", "المجموع الفرعي", "قبل الضريبة", "الاجمالي قبل الضريبة",
  "المجموع قبل الاضافات", "المجموع قبل الاضافة",
];
const DISCOUNT_LABELS = ["discount", "خصم", "الخصم", "اجمالي الخصم", "إجمالي الخصم"];
const TAX_LABELS = ["tax", "vat", "sales tax", "ضريبة", "الضريبة", "ضريبة القيمة المضافة"];
const SHIPPING_LABELS = ["shipping fee", "shipping", "delivery fee", "delivery", "freight", "الشحن", "رسوم التوصيل", "التوصيل"];
const OTHER_CHARGE_LABELS = ["other charges", "service charge", "fees", "رسوم اخرى", "رسوم أخرى", "رسوم اضافية", "رسوم إضافية"];
const TOTAL_LABELS = [
  "grand total", "invoice total", "total due", "amount due", "total amount", "total",
  "المجموع النهائي", "المجموع الكلي", "الاجمالي النهائي", "الإجمالي النهائي", "الإجمالي",
  "الاجمالي", "المبلغ المستحق", "المجموع",
];
const SUMMARY_LABELS = [
  ...SUBTOTAL_LABELS, ...DISCOUNT_LABELS, ...TAX_LABELS, ...SHIPPING_LABELS, ...OTHER_CHARGE_LABELS,
  ...TOTAL_LABELS, "balance due", "amount paid", "paid", "change", "الرصيد المستحق", "المدفوع", "الباقي",
];

function firstLabeledValue(lines: string[], labels: string[]): string | null {
  for (const line of lines) {
    const label = matchingLabel(line, labels);
    if (!label) continue;
    const value = valueAfterLabel(line, label).replace(/^[\s:：#-]+/, "").trim();
    if (value) return value;
  }
  return null;
}

function firstLabeledAmount(lines: string[], labels: string[]): string | null {
  for (const line of lines) {
    if (labels === TOTAL_LABELS && matchingLabel(line, SUBTOTAL_LABELS)) continue;
    if (matchingLabel(line, labels)) {
      const amount = amountFromLine(line);
      if (amount) return amount;
    }
  }
  return null;
}

function detectCurrency(text: string): string | null {
  const normalized = normalizeOcrLabel(text);
  if (/\bkwd\b/.test(normalized) || normalized.includes("دينار كويتي") || normalized.includes("د ك")) return "KWD";
  if (/\bsar\b/.test(normalized) || normalized.includes("ريال سعودي")) return "SAR";
  if (/\baed\b/.test(normalized) || normalized.includes("درهم اماراتي")) return "AED";
  if (/\bbhd\b/.test(normalized) || normalized.includes("دينار بحريني")) return "BHD";
  if (/\bqar\b/.test(normalized) || normalized.includes("ريال قطري")) return "QAR";
  if (/\bomr\b/.test(normalized) || normalized.includes("ريال عماني")) return "OMR";
  if (/\busd\b/.test(normalized) || normalized.includes("دولار امريكي")) return "USD";
  return null;
}

function extractInvoiceItems(lines: string[]): ExtractedInvoiceItem[] {
  return lines.flatMap((line): ExtractedInvoiceItem[] => {
    const normalizedLine = normalizeOcrLabel(line);
    const nonItemLabels = [
      ...SUMMARY_LABELS,
      ...INVOICE_NUMBER_LABELS,
      ...DATE_LABELS,
      ...SUPPLIER_LABELS,
      ...PHONE_LABELS,
      ...EMAIL_LABELS,
    ];
    if (nonItemLabels.some((label) => {
      const normalizedLabel = normalizeOcrLabel(label);
      return normalizedLine === normalizedLabel || normalizedLine.startsWith(`${normalizedLabel} `);
    })) return [];

    const tokens = amountTokens(line);
    if (tokens.length < 3) return [];
    const trailing = tokens.slice(-3);
    const quantity = amountText(trailing[0]?.value);
    const unitPurchasePrice = amountText(trailing[1]?.value);
    const lineTotal = amountText(trailing[2]?.value);
    if (!quantity || !unitPurchasePrice || !lineTotal) return [];

    const productName = line.slice(0, trailing[0]?.index).replace(/^[\s*•\-|]+|[\s|]+$/g, "").trim();
    if (!productName || !/\p{L}/u.test(productName)) return [];
    return [{
      productName: productName.slice(0, 160),
      description: "",
      sku: "",
      quantity,
      unitOfMeasure: "",
      unitPurchasePrice,
      lineTotal,
      discount: null,
      confidence: "medium",
    }];
  }).slice(0, MAX_ITEMS);
}

export function extractInvoiceFromOcrText(ocrText: string): ExtractedInvoice {
  const lines = ocrText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const invoiceNumber = firstLabeledValue(lines, INVOICE_NUMBER_LABELS);
  const rawDate = firstLabeledValue(lines, DATE_LABELS);
  const rawSupplierName = firstLabeledValue(lines, SUPPLIER_LABELS);
  const rawPhone = firstLabeledValue(lines, PHONE_LABELS);
  const rawEmail = firstLabeledValue(lines, EMAIL_LABELS);

  return {
    invoiceNumber: optionalText(invoiceNumber, 100),
    invoiceDate: rawDate ? parseOcrDate(rawDate) : null,
    supplierName: optionalText(rawSupplierName?.split(/\s{2,}/)[0], 160),
    supplierPhone: optionalText(rawPhone, 40),
    supplierEmail: optionalText(rawEmail?.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0], 254),
    currencyCode: detectCurrency(ocrText),
    subtotal: firstLabeledAmount(lines, SUBTOTAL_LABELS),
    discount: firstLabeledAmount(lines, DISCOUNT_LABELS),
    tax: firstLabeledAmount(lines, TAX_LABELS),
    shippingFee: firstLabeledAmount(lines, SHIPPING_LABELS),
    otherCharges: firstLabeledAmount(lines, OTHER_CHARGE_LABELS),
    total: firstLabeledAmount(lines, TOTAL_LABELS),
    items: extractInvoiceItems(lines),
    warnings: [],
  };
}

export function hasDetectedInvoiceValues(invoice: ExtractedInvoice): boolean {
  return Boolean(
    invoice.invoiceNumber
    || invoice.invoiceDate
    || invoice.supplierName
    || invoice.supplierPhone
    || invoice.supplierEmail
    || invoice.currencyCode
    || invoice.subtotal
    || invoice.discount
    || invoice.tax
    || invoice.shippingFee
    || invoice.otherCharges
    || invoice.total
    || invoice.items.length,
  );
}

function cleanPdfText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200e-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim();
}

function groupPositionedPdfText(items: PositionedPdfTextItem[]): Array<{
  y: number;
  items: PositionedPdfTextItem[];
}> {
  const lines: Array<{ y: number; items: PositionedPdfTextItem[] }> = [];
  const sortedItems = items
    .map((item) => ({ ...item, text: cleanPdfText(item.text) }))
    .filter((item) => item.text)
    .sort((left, right) => right.y - left.y || left.x - right.x);

  for (const item of sortedItems) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
    if (line) {
      line.items.push(item);
      line.y = line.items.reduce((sum, lineItem) => sum + lineItem.y, 0) / line.items.length;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  return lines
    .map((line) => ({
      ...line,
      items: line.items.sort((left, right) => left.x - right.x),
    }))
    .sort((left, right) => right.y - left.y);
}

const PDF_TABLE_COLUMNS = [
  { key: "product", labels: ["product", "product name", "item", "description", "المنتج", "الصنف"] },
  { key: "sku", labels: ["sku", "item code", "product code", "code", "الرمز", "رمز الصنف"] },
  { key: "quantity", labels: ["quantity", "qty", "الكمية", "العدد"] },
  { key: "unitPrice", labels: ["unit price", "price per unit", "سعر الوحدة"] },
  { key: "discount", labels: ["discount", "الخصم", "خصم"] },
  { key: "lineTotal", labels: ["line total", "amount", "total", "الإجمالي", "الاجمالي"] },
] as const;

const ALL_POSITIONED_LABELS = [
  ...INVOICE_NUMBER_LABELS,
  ...DATE_LABELS,
  ...SUPPLIER_LABELS,
  ...PHONE_LABELS,
  ...EMAIL_LABELS,
  ...SUBTOTAL_LABELS,
  ...DISCOUNT_LABELS,
  ...TAX_LABELS,
  ...SHIPPING_LABELS,
  ...OTHER_CHARGE_LABELS,
  ...TOTAL_LABELS,
  ...PDF_TABLE_COLUMNS.flatMap((column) => column.labels),
  "بيانات الفاتورة", "بيانات المورد",
];

function isPositionedLabel(text: string): boolean {
  return ALL_POSITIONED_LABELS.some((label) => matchingLabel(text, [label]) !== null);
}

function positionedValueForLabel(
  labelItem: PositionedPdfTextItem,
  lineItems: PositionedPdfTextItem[],
): string | null {
  const label = matchingLabel(labelItem.text, ALL_POSITIONED_LABELS);
  if (!label) return null;

  const inlineValue = valueAfterLabel(labelItem.text, label)
    .replace(/^[\s:：#-]+/, "")
    .trim();
  if (inlineValue && normalizeOcrLabel(inlineValue) !== normalizeOcrLabel(labelItem.text)) {
    return inlineValue;
  }

  const isArabicLabel = /[\u0600-\u06ff]/u.test(labelItem.text);
  const preferredSide = lineItems.filter((item) => {
    if (item === labelItem || isPositionedLabel(item.text)) return false;
    return isArabicLabel ? item.x < labelItem.x : item.x > labelItem.x;
  });
  const otherSide = lineItems.filter((item) => {
    if (item === labelItem || isPositionedLabel(item.text)) return false;
    return isArabicLabel ? item.x > labelItem.x : item.x < labelItem.x;
  });
  const candidates = preferredSide.length ? preferredSide : otherSide;
  return candidates
    .slice()
    .sort((left, right) => Math.abs(left.x - labelItem.x) - Math.abs(right.x - labelItem.x))[0]?.text ?? null;
}

function positionedFieldValue(
  lines: Array<{ y: number; items: PositionedPdfTextItem[] }>,
  labels: string[],
): string | null {
  for (const line of lines) {
    for (const item of line.items) {
      if (matchingLabel(item.text, labels)) {
        const value = positionedValueForLabel(item, line.items);
        if (value) return value;
      }
    }
  }
  return null;
}

function positionedAmountValue(
  lines: Array<{ y: number; items: PositionedPdfTextItem[] }>,
  labels: string[],
  options: { skipSubtotal?: boolean } = {},
): string | null {
  for (const line of lines) {
    for (const item of line.items) {
      if (!matchingLabel(item.text, labels)) continue;
      if (options.skipSubtotal && matchingLabel(item.text, SUBTOTAL_LABELS)) continue;
      const value = positionedValueForLabel(item, line.items);
      if (!value) continue;
      const amount = amountFromLine(value);
      if (amount) return amount;
    }
  }
  return null;
}

function tableColumnForText(text: string): string | null {
  for (const column of PDF_TABLE_COLUMNS) {
    if (matchingLabel(text, [...column.labels])) return column.key;
  }
  return null;
}

function parseAmountMilli(value: string | null | undefined): bigint | null {
  const normalized = amountText(value);
  if (!normalized) return null;
  const match = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(normalized);
  if (!match) return null;
  const magnitude = BigInt(match[2]) * 1_000n + BigInt((match[3] ?? "").padEnd(3, "0") || "0");
  return match[1] === "-" ? -magnitude : magnitude;
}

function formatAmountMilli(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const magnitude = value < 0n ? -value : value;
  return `${sign}${magnitude / 1_000n}.${String(magnitude % 1_000n).padStart(3, "0")}`;
}

function grossLineTotal(quantity: string, unitPrice: string): string | null {
  const quantityMilli = parseAmountMilli(quantity);
  const unitPriceMilli = parseAmountMilli(unitPrice);
  if (quantityMilli === null || unitPriceMilli === null) return null;
  return formatAmountMilli((quantityMilli * unitPriceMilli + 500n) / 1_000n);
}

function extractPdfTableItems(
  lines: Array<{ y: number; items: PositionedPdfTextItem[] }>,
): ExtractedInvoiceItem[] {
  const headerCandidates = lines.flatMap((line) => {
    const columns = line.items.flatMap((item) => {
      const key = tableColumnForText(item.text);
      return key ? [{ key, x: item.x }] : [];
    });
    const required = ["product", "quantity", "unitPrice", "lineTotal"];
    return required.every((key) => columns.some((column) => column.key === key)) && columns.length >= 4
      ? [{ y: line.y, columns }]
      : [];
  });
  const header = headerCandidates[0];
  if (!header) return [];

  const items: ExtractedInvoiceItem[] = [];
  for (const line of lines.filter((candidate) => candidate.y < header.y)) {
    const values = new Map<string, string>();
    for (const column of header.columns) {
      const nearest = line.items
        .map((item) => ({ item, distance: Math.abs(item.x - column.x) }))
        .filter(({ item, distance }) => distance <= 90 && !tableColumnForText(item.text))
        .sort((left, right) => left.distance - right.distance)[0]?.item;
      if (nearest && !values.has(column.key)) values.set(column.key, nearest.text);
    }

    const productName = values.get("product")?.trim() ?? "";
    const quantity = amountText(values.get("quantity"));
    const unitPurchasePrice = amountText(values.get("unitPrice"));
    const printedLineTotal = amountText(values.get("lineTotal"));
    const lineTotal = quantity && unitPurchasePrice ? grossLineTotal(quantity, unitPurchasePrice) : null;
    if (
      !productName
      || !/\p{L}/u.test(productName)
      || !quantity
      || !unitPurchasePrice
      || !printedLineTotal
      || !lineTotal
    ) continue;

    items.push({
      productName: productName.slice(0, 160),
      description: "",
      sku: boundedText(values.get("sku"), 100),
      quantity,
      unitOfMeasure: "",
      unitPurchasePrice,
      lineTotal,
      discount: amountText(values.get("discount")),
      confidence: "high",
    });
  }

  return items.slice(0, MAX_ITEMS);
}

function grossSubtotalFromItems(items: ExtractedInvoiceItem[]): string | null {
  const lineTotals = items.map((item) => parseAmountMilli(item.lineTotal));
  if (!lineTotals.length || lineTotals.some((value) => value === null)) return null;
  let subtotal = 0n;
  for (const lineTotal of lineTotals) {
    if (lineTotal === null) return null;
    subtotal += lineTotal;
  }
  return formatAmountMilli(subtotal);
}

export function extractInvoiceFromPdfTextItems(items: PositionedPdfTextItem[]): {
  invoice: ExtractedInvoice;
  text: string;
} {
  const lines = groupPositionedPdfText(items);
  const text = lines
    .map((line) => line.items.map((item) => item.text).join("    "))
    .join("\n")
    .slice(0, MAX_TEXT_LENGTH);
  const invoiceNumber = positionedFieldValue(lines, INVOICE_NUMBER_LABELS);
  const invoiceDate = positionedFieldValue(lines, DATE_LABELS);
  const supplierName = positionedFieldValue(lines, SUPPLIER_LABELS);
  const supplierPhone = positionedFieldValue(lines, PHONE_LABELS);
  const supplierEmail = positionedFieldValue(lines, EMAIL_LABELS);
  const invoiceItems = extractPdfTableItems(lines);

  return {
    text,
    invoice: {
      invoiceNumber: optionalText(invoiceNumber, 100),
      invoiceDate: invoiceDate ? parseOcrDate(invoiceDate) : null,
      supplierName: optionalText(supplierName, 160),
      supplierPhone: optionalText(supplierPhone, 40),
      supplierEmail: optionalText(supplierEmail?.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0], 254),
      currencyCode: detectCurrency(text),
      subtotal: grossSubtotalFromItems(invoiceItems) ?? positionedAmountValue(lines, SUBTOTAL_LABELS),
      discount: positionedAmountValue(lines, DISCOUNT_LABELS),
      tax: positionedAmountValue(lines, TAX_LABELS),
      shippingFee: positionedAmountValue(lines, SHIPPING_LABELS),
      otherCharges: positionedAmountValue(lines, OTHER_CHARGE_LABELS),
      total: positionedAmountValue(lines, TOTAL_LABELS, { skipSubtotal: true }),
      items: invoiceItems,
      warnings: [],
    },
  };
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

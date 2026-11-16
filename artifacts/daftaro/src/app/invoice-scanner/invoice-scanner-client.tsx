"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileImage,
  FileText,
  LoaderCircle,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AppHeader } from "../../components/app-header";
import { useAppLanguage, type AppLanguage } from "../../hooks/use-app-language";
import { usePageReturnRefresh } from "../../hooks/use-page-return-refresh";
import {
  compressInvoiceFile,
  inspectInvoiceFile,
  MAX_INVOICE_FILE_BYTES,
  MAX_INVOICE_PDF_PAGES,
  type InvoiceFileInfo,
} from "../../lib/invoice-file";
import {
  getInvoiceScannerStatus,
  savePurchaseInvoice,
  scanInvoice,
  type ExtractedInvoiceItem,
  type InvoiceDraft,
  type InvoiceItemDraft,
  type InvoiceProductAction,
  type InvoiceSaveEngine,
  type InvoiceScanEngine,
  type InvoiceScanResult,
  type SavePurchaseInvoiceInput,
  type SavePurchaseInvoiceResult,
} from "../../lib/invoice-scanner-api";
import { supabase } from "../../lib/supabase";
import { normalizeMoneyInput, parseAmountToMilli } from "../../lib/money";

type Product = {
  id: string;
  name: string;
  selling_price: string | number;
  materials_cost: string | number;
  available_quantity: number;
  currency_code: string;
};

type PurchaseInvoiceHistoryItem = {
  id: string;
  product_name_snapshot: string;
  quantity: string | number;
  unit_of_measurement: string | null;
  unit_purchase_price: string | number;
  line_total: string | number;
  product_action: "matched" | "created" | "skipped";
  stock_updated: boolean;
};

type PurchaseInvoiceHistory = {
  id: string;
  invoice_number: string | null;
  supplier_name: string | null;
  invoice_date: string;
  currency_code: string;
  total: string | number;
  created_at: string;
  items: PurchaseInvoiceHistoryItem[];
};

const CURRENCIES = ["KWD", "SAR", "AED", "BHD", "QAR", "OMR", "USD"] as const;

const copy = {
  ar: {
    section: "المشتريات والمخزون",
    title: "قراءة الفواتير",
    subtitle: "استخرج بيانات فاتورة المورد، راجعها بنفسك، ثم أضف الكمية للمخزون بعد التأكيد.",
    privacyTitle: "ملفاتك لا تُحفظ",
    privacyText: "تُرسل الصورة أو PDF إلى OCR.Space لقراءة النص، ويُحلل النص لاستخراج الحقول. لا يحتفظ دفترُك بالملف الأصلي.",
    freeLimits: "الخطة المجانية: ملف حتى 1 ميغابايت، وPDF حتى 3 صفحات. المحرك 2 هو الافتراضي؛ المحرك 3 له حصة مجانية منفصلة قدرها 1,000 قراءة شهريًا.",
    uploadTitle: "ارفع فاتورة أو صوّرها",
    uploadText: "اسحب ملف JPG أو PNG أو PDF إلى هنا، أو اختره من جهازك.",
    chooseFile: "اختيار ملف",
    camera: "تصوير الفاتورة",
    supported: "JPG وPNG وPDF",
    dropHere: "أفلت الملف هنا",
    selectedFile: "الملف المحدد",
    removeFile: "إزالة ملف الفاتورة",
    originalInvoice: "معاينة الفاتورة الأصلية",
    compress: "ضغط الملف إلى أقل من 1 ميغابايت",
    compressing: "جارٍ ضغط الملف محليًا…",
    compressed: "تم ضغط الملف في متصفحك. لم يُرسل للمسح بعد.",
    scan: "قراءة الفاتورة",
    scanning: "جارٍ إرسال الملف وقراءة الفاتورة…",
    scanProgress: "جارٍ إرسال الملف وقراءة محتواه واستخراج البيانات.",
    engine: "محرك القراءة",
    engine2: "المحرك 2",
    engine3: "المحرك 3",
    engine3Note: "قد يكون أدق للجداول المعقدة ويستهلك حصته المجانية المنفصلة.",
    noOcrKey: "لم يُضف مفتاح OCR.Space بعد. يمكنك إدخال الفاتورة يدويًا، أو إضافة OCR_SPACE_API_KEY في أسرار Replit لتفعيل القراءة التلقائية.",
    aiUnavailable: "القراءة متاحة، لكن استخراج الحقول تلقائيًا غير مهيأ. راجع النص وأدخل البيانات يدويًا.",
    statusUnavailable: "تعذر التحقق من إعدادات خدمة القراءة. يمكنك إدخال الفاتورة يدويًا والمحاولة لاحقًا.",
    manualEntry: "إدخال فاتورة يدويًا",
    manualMode: "إدخال يدوي",
    reviewTitle: "راجع بيانات الفاتورة",
    reviewText: "قد يخطئ OCR في الأرقام أو الأسماء. صحّحها قبل الحفظ؛ لا يتغير المخزون حتى تؤكد.",
    invoiceNumber: "رقم الفاتورة",
    invoiceDate: "تاريخ الفاتورة",
    supplier: "اسم المورد",
    supplierPhone: "هاتف المورد",
    supplierEmail: "بريد المورد",
    currency: "عملة الفاتورة",
    chooseCurrency: "اختر العملة",
    currencyNotDetected: "لم تُكتشف العملة. اختر العملة الظاهرة على الفاتورة قبل الحفظ.",
    currencyRequired: "اختر عملة الفاتورة قبل الحفظ.",
    subtotal: "المجموع قبل الإضافات",
    discount: "الخصم",
    tax: "الضريبة",
    shipping: "الشحن",
    otherCharges: "رسوم أخرى",
    total: "الإجمالي النهائي",
    items: "المنتجات في الفاتورة",
    itemName: "اسم المنتج",
    description: "الوصف",
    sku: "رمز المنتج",
    quantity: "الكمية",
    unit: "الوحدة",
    purchasePrice: "سعر الشراء للوحدة",
    lineTotal: "إجمالي السطر قبل الخصم",
    lineDiscount: "خصم البند",
    productAction: "الإجراء على المنتج",
    matchExisting: "ربط بمنتج موجود",
    createProduct: "إنشاء منتج جديد",
    skipStock: "حفظ دون إضافة للمخزون",
    chooseProduct: "اختر منتجًا",
    noProducts: "لا توجد منتجات لمطابقتها",
    sellingPrice: "سعر البيع المطلوب",
    sellingPriceNote: "لا نستخدم سعر الشراء كسعر بيع.",
    currentProduct: "بيانات المنتج الحالي",
    currentStock: "المخزون الحالي",
    currentSellingPrice: "سعر البيع الحالي",
    currentMaterialsCost: "تكلفة المواد الحالية",
    updateCost: "تحديث تكلفة المواد إلى سعر الشراء",
    updateCostNote: "هذا الخيار يحدّث تكلفة المنتج الحالية فقط بعد تأكيدك. يبقى سعر البيع كما هو.",
    newProductCostNote: "للمنتج الجديد، تُسجل تكلفة الوحدة من الفاتورة إذا كانت العملة مطابقة لعملة نشاطك.",
    currencyWarning: "عملة الفاتورة تختلف عن عملة النشاط. سنحفظ التكلفة بعملة الفاتورة دون تحويل، ولن نغيّر تكلفة المنتج الحالية.",
    addItem: "إضافة سطر",
    calculateTotals: "حساب الإجماليات",
    removeItem: "حذف السطر",
    extractedText: "النص المستخرج للمراجعة",
    warnings: "ملاحظات القراءة",
    saveInvoice: "حفظ الفاتورة وتحديث المخزون",
    saving: "جارٍ الحفظ…",
    backToUpload: "العودة للملف",
    historyTitle: "الفواتير المحفوظة",
    historyText: "سجل مشترياتك وتكاليف الشراء، مع توضيح الكميات التي أُضيفت للمخزون.",
    emptyHistory: "لا توجد فواتير محفوظة بعد.",
    itemCount: "عدد البنود",
    stockAdded: "أُضيف للمخزون",
    saved: "تم حفظ الفاتورة وتحديث الكميات المحددة.",
    savedDetails: "رقم السجل",
    successTitle: "تم الحفظ",
    continue: "إدخال فاتورة أخرى",
    databaseMissing: "جداول سجل الشراء غير مفعلة بعد. طبّق تحديث قاعدة Supabase ثم أعد تحميل الصفحة.",
    loadError: "تعذر تحميل المنتجات أو سجل الفواتير. تحقق من الاتصال ثم أعد المحاولة.",
    retry: "إعادة المحاولة",
    signIn: "سجّل الدخول لاستخدام قارئ الفواتير.",
    missingProfile: "أكمل ملف النشاط أولًا.",
    invalidType: "اختر صورة JPG أو PNG أو ملف PDF.",
    oversized: "حجم الملف أكبر من 1 ميغابايت. اضغطه محليًا قبل إرساله.",
    tooManyPages: `تدعم الخطة المجانية ملفات PDF حتى ${MAX_INVOICE_PDF_PAGES} صفحات. لن نحذف أي صفحة تلقائيًا.`,
    scanError: "تعذرت قراءة الملف. حاول بصورة أوضح.",
    parseWarning: "تم استخراج النص، لكن تعذر ترتيب الحقول تلقائيًا. أدخلها وراجعها قبل الحفظ.",
    requiredName: "أدخل اسمًا لكل منتج.",
    invalidDate: "أدخل تاريخًا صحيحًا للفاتورة.",
    invalidAmount: "تحقق من مبالغ الفاتورة؛ استخدم أرقامًا موجبة وبحد أقصى 3 خانات عشرية.",
    invalidTotal: "أدخل إجماليًا نهائيًا أكبر من صفر.",
    balanceMismatch: "المبالغ لا تتطابق: راجع إجمالي البنود والخصومات والضريبة والرسوم والإجمالي النهائي.",
    balanceWarning: "هناك اختلاف بين مبالغ البنود أو المجموع أو الإجمالي النهائي. راجع الأرقام المظللة؛ لم نغيّر أي مبلغ تلقائيًا.",
    invalidQuantity: "أدخل كمية أكبر من صفر لكل بند.",
    integerQuantity: "إضافة المخزون تتطلب كمية صحيحة من دون كسور. يمكنك حفظ هذا البند دون إضافته للمخزون.",
    selectProduct: "اختر منتجًا موجودًا أو غيّر الإجراء.",
    sellingRequired: "أدخل سعر البيع قبل إنشاء المنتج؛ لن ننسخ سعر الشراء إليه.",
    costCurrency: "لا يمكن تحديث تكلفة المنتج ما دامت عملة الفاتورة مختلفة.",
    itemsRequired: "أضف بندًا واحدًا على الأقل.",
    duplicateInvoice: "رقم هذه الفاتورة محفوظ سابقًا لهذا المورد.",
    duplicateProduct: "يوجد منتج بهذا الاسم. اربط البند به بدل إنشاء نسخة مكررة.",
    migrationError: "جداول سجل الشراء غير مفعلة بعد. شغّل تحديث قاعدة Supabase ثم أعد تحميل الصفحة.",
    savedError: "تعذر حفظ الفاتورة. لم يتم تغيير المخزون.",
    copiedName: "فاتورة مشتريات",
    count: "بند",
    units: "وحدة",
    matchStatus: "مطابق",
    createStatus: "منتج جديد",
    skippedStatus: "بدون تحديث مخزون",
    loading: "جارٍ تجهيز الصفحة…",
    cancel: "إلغاء",
    confirmTitle: "تأكيد حفظ الفاتورة",
    confirmText: "سيُحفظ سجل الفاتورة، وستُضاف كميات البنود المرتبطة للمخزون. لن يتغير سعر البيع.",
    confirm: "تأكيد الحفظ",
    privateInfo: "بيانات الفاتورة خاصة بحسابك",
    manualExtraction: "أدخل البنود يدويًا",
  },
  en: {
    section: "PURCHASES & INVENTORY",
    title: "Invoice reader",
    subtitle: "Read a supplier invoice, review the extracted details, then add stock only after confirmation.",
    privacyTitle: "Your files are not stored",
    privacyText: "The image or PDF is sent to OCR.Space for text recognition, and the extracted text is analyzed for invoice fields. Daftaro does not keep the original file.",
    freeLimits: "Free plan: files up to 1 MB and PDFs up to 3 pages. Engine 2 is the default; Engine 3 has a separate free allowance of 1,000 scans per month.",
    uploadTitle: "Upload or photograph an invoice",
    uploadText: "Drop a JPG, PNG, or PDF here, or choose it from your device.",
    chooseFile: "Choose a file",
    camera: "Photograph invoice",
    supported: "JPG, PNG, and PDF",
    dropHere: "Drop the file here",
    selectedFile: "Selected file",
    removeFile: "Remove invoice file",
    originalInvoice: "Original invoice preview",
    compress: "Compress to under 1 MB",
    compressing: "Compressing locally…",
    compressed: "Compressed in your browser. It has not been sent for scanning.",
    scan: "Read invoice",
    scanning: "Sending file and reading invoice…",
    scanProgress: "Uploading the file, reading it, and extracting invoice details.",
    engine: "OCR engine",
    engine2: "Engine 2",
    engine3: "Engine 3",
    engine3Note: "May help with complex tables and uses its separate free allowance.",
    noOcrKey: "OCR.Space is not configured yet. Enter the invoice manually, or add OCR_SPACE_API_KEY in Replit Secrets to enable scanning.",
    aiUnavailable: "OCR is available, but automatic field extraction is not configured. Review the text and enter the fields manually.",
    statusUnavailable: "Scanning setup could not be checked. You can enter the invoice manually and try scanning later.",
    manualEntry: "Enter invoice manually",
    manualMode: "Manual entry",
    reviewTitle: "Review invoice details",
    reviewText: "OCR can misread numbers and names. Correct them before saving; stock does not change until you confirm.",
    invoiceNumber: "Invoice number",
    invoiceDate: "Invoice date",
    supplier: "Supplier name",
    supplierPhone: "Supplier phone",
    supplierEmail: "Supplier email",
    currency: "Invoice currency",
    chooseCurrency: "Choose currency",
    currencyNotDetected: "The invoice currency was not detected. Choose the currency printed on the invoice before saving.",
    currencyRequired: "Choose the invoice currency before saving.",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    shipping: "Shipping",
    otherCharges: "Other charges",
    total: "Final total",
    items: "Invoice items",
    itemName: "Product name",
    description: "Description",
    sku: "SKU",
    quantity: "Quantity",
    unit: "Unit",
    purchasePrice: "Purchase price / unit",
    lineTotal: "Line total before discount",
    lineDiscount: "Item discount",
    productAction: "Product action",
    matchExisting: "Match existing product",
    createProduct: "Create new product",
    skipStock: "Save without stock update",
    chooseProduct: "Choose a product",
    noProducts: "No products to match",
    sellingPrice: "Required selling price",
    sellingPriceNote: "Purchase price is never used as the selling price.",
    currentProduct: "Current product details",
    currentStock: "Current stock",
    currentSellingPrice: "Current selling price",
    currentMaterialsCost: "Current materials cost",
    updateCost: "Update materials cost to purchase price",
    updateCostNote: "This updates the current product cost only after you confirm. The selling price stays unchanged.",
    newProductCostNote: "For a new product, the invoice unit cost is saved as its materials cost when currencies match.",
    currencyWarning: "Invoice currency differs from your business currency. We will keep purchase cost in the invoice currency without conversion and will not change product costs.",
    addItem: "Add item",
    calculateTotals: "Calculate totals",
    removeItem: "Remove item",
    extractedText: "Extracted text for review",
    warnings: "Reading notes",
    saveInvoice: "Save invoice and update stock",
    saving: "Saving…",
    backToUpload: "Back to file",
    historyTitle: "Saved invoices",
    historyText: "Purchase history and costs, including which quantities were added to stock.",
    emptyHistory: "No invoices saved yet.",
    itemCount: "Items",
    stockAdded: "Added to stock",
    saved: "Invoice saved and selected quantities updated.",
    savedDetails: "Record",
    successTitle: "Saved",
    continue: "Enter another invoice",
    databaseMissing: "Purchase-history tables are not active yet. Apply the Supabase database update, then reload.",
    loadError: "Products or invoice history could not be loaded. Check your connection and try again.",
    retry: "Try again",
    signIn: "Sign in to use the invoice reader.",
    missingProfile: "Complete your business profile first.",
    invalidType: "Choose a JPG or PNG image, or a PDF.",
    oversized: "The file is over 1 MB. Compress it locally before sending.",
    tooManyPages: `The free plan supports PDFs with up to ${MAX_INVOICE_PDF_PAGES} pages. No page will be removed automatically.`,
    scanError: "The file could not be read. Try a clearer image.",
    parseWarning: "Text was extracted, but fields could not be arranged automatically. Enter and review them before saving.",
    requiredName: "Enter a name for each item.",
    invalidDate: "Enter a valid invoice date.",
    invalidAmount: "Check invoice amounts; use positive values with up to 3 decimal places.",
    invalidTotal: "Enter a final total greater than zero.",
    balanceMismatch: "The amounts do not balance. Check item totals, discounts, tax, charges, and the final total.",
    balanceWarning: "Invoice amounts do not balance. Review the highlighted line, subtotal, or final total; no amount was changed automatically.",
    invalidQuantity: "Enter a quantity greater than zero for each item.",
    integerQuantity: "Stock updates require a whole-number quantity. You can save this item without adding stock.",
    selectProduct: "Choose an existing product or change the action.",
    sellingRequired: "Enter a selling price before creating a product; purchase price will not be copied.",
    costCurrency: "Product cost cannot be updated while invoice and business currencies differ.",
    itemsRequired: "Add at least one item.",
    duplicateInvoice: "An invoice with this number is already saved for this supplier.",
    duplicateProduct: "A product with this name already exists. Match it instead of creating a duplicate.",
    migrationError: "Purchase-history tables are not active yet. Apply the Supabase database update, then reload.",
    savedError: "The invoice could not be saved. Stock was not changed.",
    copiedName: "Purchase invoice",
    count: "items",
    units: "units",
    matchStatus: "Matched",
    createStatus: "New product",
    skippedStatus: "No stock update",
    loading: "Preparing the page…",
    cancel: "Cancel",
    confirmTitle: "Confirm invoice save",
    confirmText: "The invoice will be saved and linked item quantities added to stock. Selling prices will not change.",
    confirm: "Confirm save",
    privateInfo: "Invoice data is private to your account",
    manualExtraction: "Enter items manually",
  },
} as const satisfies Record<AppLanguage, Record<string, string>>;

const fieldClass =
  "w-full rounded-[13px] border border-[#dfe5e8] bg-[#fffefa] px-3.5 py-3 text-sm text-[#1d2c3d] outline-none transition placeholder:text-[#a3acb5] focus:border-[#168d78] focus:ring-4 focus:ring-[#168d78]/10 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "mb-1.5 block text-xs font-bold text-[#556376]";
const panelClass = "rounded-[22px] border border-[#e5e8e2] bg-[#fffefa] shadow-[0_12px_40px_rgba(28,42,54,0.04)]";

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeAmountInput(value: string | null | undefined) {
  if (!value) return "";
  return normalizeMoneyInput(value)
    .replace(/[٬, ]/g, "")
    .replace(/[٫]/g, ".");
}

function blankItem(): InvoiceItemDraft {
  return {
    productName: "",
    description: "",
    sku: "",
    quantity: "",
    unitOfMeasure: "",
    unitPurchasePrice: "",
    lineTotal: "",
    discount: "0",
    confidence: "missing",
    action: "skip",
    productId: null,
    sellingPrice: "",
    updateMaterialsCost: false,
  };
}

function blankInvoice(currency: string, engine: InvoiceSaveEngine = 0): InvoiceDraft & { ocrEngine: InvoiceSaveEngine } {
  return {
    invoiceNumber: "",
    invoiceDate: "",
    supplierName: "",
    supplierPhone: "",
    supplierEmail: "",
    currencyCode: currency,
    subtotal: "",
    discount: "0",
    tax: "0",
    shippingFee: "0",
    otherCharges: "0",
    total: "",
    items: [blankItem()],
    ocrEngine: engine,
  };
}

function amountProduct(quantity: string, unitPrice: string): string {
  const quantityMilli = parseAmountToMilli(normalizeAmountInput(quantity));
  const priceMilli = parseAmountToMilli(normalizeAmountInput(unitPrice));
  if (quantityMilli === null || priceMilli === null) return "";
  const productMilli = (quantityMilli * priceMilli + 500n) / 1000n;
  const whole = productMilli / 1000n;
  const fraction = String(productMilli % 1000n).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function sumItemAmounts(items: InvoiceItemDraft[]): string {
  const total = items.reduce((sum, item) => {
    const lineTotal = parseAmountToMilli(normalizeAmountInput(item.lineTotal))
      ?? parseAmountToMilli(amountProduct(item.quantity, item.unitPurchasePrice));
    return sum + (lineTotal ?? 0n);
  }, 0n);
  const whole = total / 1000n;
  const fraction = String(total % 1000n).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function absoluteDifference(left: bigint, right: bigint) {
  return left >= right ? left - right : right - left;
}

function itemDiscountMilli(items: InvoiceItemDraft[]) {
  return items.reduce((sum, item) => sum + (parseAmountToMilli(normalizeAmountInput(item.discount || "0")) ?? 0n), 0n);
}

function expectedInvoiceTotalMilli(draft: InvoiceDraft) {
  const subtotal = parseAmountToMilli(normalizeAmountInput(draft.subtotal)) ?? parseAmountToMilli(sumItemAmounts(draft.items));
  const headerDiscount = parseAmountToMilli(normalizeAmountInput(draft.discount || "0"));
  const tax = parseAmountToMilli(normalizeAmountInput(draft.tax || "0"));
  const shipping = parseAmountToMilli(normalizeAmountInput(draft.shippingFee || "0"));
  const other = parseAmountToMilli(normalizeAmountInput(draft.otherCharges || "0"));
  if (subtotal === null || headerDiscount === null || tax === null || shipping === null || other === null) return null;
  return subtotal - headerDiscount - itemDiscountMilli(draft.items) + tax + shipping + other;
}

function invoiceLineAmountsBalance(item: InvoiceItemDraft): boolean | null {
  const quantity = parseAmountToMilli(normalizeAmountInput(item.quantity));
  const unitPrice = parseAmountToMilli(normalizeAmountInput(item.unitPurchasePrice));
  const lineTotal = parseAmountToMilli(normalizeAmountInput(item.lineTotal))
    ?? parseAmountToMilli(amountProduct(item.quantity, item.unitPurchasePrice));
  if (quantity === null || unitPrice === null || lineTotal === null) return null;
  const calculatedLine = (quantity * unitPrice + 500n) / 1000n;
  return absoluteDifference(calculatedLine, lineTotal) <= 1n;
}

function invoiceSubtotalBalances(draft: InvoiceDraft): boolean | null {
  const subtotal = parseAmountToMilli(normalizeAmountInput(draft.subtotal));
  const lineTotals = draft.items.map((item) => {
    const lineTotal = parseAmountToMilli(normalizeAmountInput(item.lineTotal))
      ?? parseAmountToMilli(amountProduct(item.quantity, item.unitPurchasePrice));
    return lineTotal;
  });
  const validLineTotals = lineTotals.filter((lineTotal): lineTotal is bigint => lineTotal !== null);
  if (subtotal === null || validLineTotals.length !== draft.items.length) return null;
  const sumLines = validLineTotals.reduce((sum, lineTotal) => sum + lineTotal, 0n);
  return absoluteDifference(subtotal, sumLines) <= 1n;
}

function invoiceFinalTotalBalances(draft: InvoiceDraft): boolean | null {
  const expectedTotal = expectedInvoiceTotalMilli(draft);
  const invoiceTotal = parseAmountToMilli(normalizeAmountInput(draft.total));
  if (expectedTotal === null || invoiceTotal === null) return null;
  return expectedTotal >= 0n && absoluteDifference(expectedTotal, invoiceTotal) <= 1n;
}

function invoiceAmountsBalance(draft: InvoiceDraft) {
  return draft.items.length > 0
    && draft.items.every((item) => invoiceLineAmountsBalance(item) === true)
    && invoiceSubtotalBalances(draft) !== false
    && invoiceFinalTotalBalances(draft) === true;
}

function parseEngineDraft(result: InvoiceScanResult, products: Product[]) {
  const items: InvoiceItemDraft[] = result.invoice?.items.map((item: ExtractedInvoiceItem) => {
    const exact = products.find((product) => normalizeProductName(product.name) === normalizeProductName(item.productName));
    return {
      productName: item.productName,
      description: item.description,
      sku: item.sku,
      quantity: normalizeAmountInput(item.quantity),
      unitOfMeasure: item.unitOfMeasure,
      unitPurchasePrice: normalizeAmountInput(item.unitPurchasePrice),
      lineTotal: normalizeAmountInput(item.lineTotal),
      discount: normalizeAmountInput(item.discount) || "0",
      confidence: item.confidence,
      action: exact ? "match" : "skip",
      productId: exact?.id ?? null,
      sellingPrice: "",
      updateMaterialsCost: false,
    };
  }) ?? [blankItem()];
  const currencyCode = result.invoice?.currencyCode && CURRENCIES.includes(result.invoice.currencyCode as (typeof CURRENCIES)[number])
    ? result.invoice.currencyCode
    : "";
  const subtotal = normalizeAmountInput(result.invoice?.subtotal) || sumItemAmounts(items);
  const discount = normalizeAmountInput(result.invoice?.discount) || "0";
  const tax = normalizeAmountInput(result.invoice?.tax) || "0";
  const shippingFee = normalizeAmountInput(result.invoice?.shippingFee) || "0";
  const otherCharges = normalizeAmountInput(result.invoice?.otherCharges) || "0";
  const subtotalMilli = parseAmountToMilli(subtotal) ?? 0n;
  const discountMilli = parseAmountToMilli(discount) ?? 0n;
  const taxMilli = parseAmountToMilli(tax) ?? 0n;
  const shippingMilli = parseAmountToMilli(shippingFee) ?? 0n;
  const otherMilli = parseAmountToMilli(otherCharges) ?? 0n;
  const calculatedTotal = subtotalMilli - discountMilli - itemDiscountMilli(items) + taxMilli + shippingMilli + otherMilli;
  const calculatedText = calculatedTotal > 0n
    ? `${calculatedTotal / 1000n}.${String(calculatedTotal % 1000n).padStart(3, "0").replace(/0+$/, "")}`.replace(/\.$/, "")
    : "";
  return {
    invoiceNumber: result.invoice?.invoiceNumber ?? "",
    invoiceDate: result.invoice?.invoiceDate && isValidIsoDate(result.invoice.invoiceDate)
      ? result.invoice.invoiceDate
      : "",
    supplierName: result.invoice?.supplierName ?? "",
    supplierPhone: result.invoice?.supplierPhone ?? "",
    supplierEmail: result.invoice?.supplierEmail ?? "",
    currencyCode,
    subtotal,
    discount,
    tax,
    shippingFee,
    otherCharges,
    total: normalizeAmountInput(result.invoice?.total) || calculatedText,
    items,
    ocrEngine: result.engine,
  };
}

function normalizeProductName(name: string) {
  return name
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeProductWords(name: string) {
  return name
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function editDistance(left: string, right: string) {
  const leftChars = Array.from(left);
  const rightChars = Array.from(right);
  let previous = Array.from({ length: rightChars.length + 1 }, (_, index) => index);
  for (let row = 1; row <= leftChars.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= rightChars.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (leftChars[row - 1] === rightChars[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[rightChars.length];
}

function productNameSimilarity(query: string, productName: string) {
  const left = normalizeProductName(query);
  const right = normalizeProductName(productName);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftWords = new Set(normalizeProductWords(query).split(" ").filter(Boolean));
  const rightWords = new Set(normalizeProductWords(productName).split(" ").filter(Boolean));
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  const tokenScore = union ? shared / union : 0;
  const editScore = 1 - editDistance(left, right) / Math.max(left.length, right.length);
  return Math.max(tokenScore, editScore);
}

function getProductSuggestions(name: string, products: Product[]) {
  return products
    .map((product) => ({ product, similarity: productNameSimilarity(name, product.name) }))
    .filter((entry) => entry.similarity >= 0.34)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 4)
    .map((entry) => entry.product);
}

function formatCurrency(value: string | number, currency: string, language: AppLanguage) {
  const number = Number(value);
  if (!Number.isFinite(number)) return `${value} ${currency}`;
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    return `${new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", { maximumFractionDigits: 3 }).format(number)} ${currency}`;
  }
  return new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", {
    style: "currency",
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(number);
}

function localizedError(message: string, language: AppLanguage, text: (typeof copy)[AppLanguage]) {
  if (language === "en") return message || text.scanError;
  if (/OCR_SPACE_API_KEY|OCR.Space key|OCR is not configured/i.test(message)) return text.noOcrKey;
  if (/already saved|already exists/i.test(message)) return text.duplicateInvoice;
  if (/product with this name|duplicate/i.test(message)) return text.duplicateProduct;
  if (/1 MB|1 MB|compress/i.test(message)) return text.oversized;
  if (/3 pages/i.test(message)) return text.tooManyPages;
  if (/line total|item totals|invoice total/i.test(message)) return text.balanceMismatch;
  if (/sign in|session/i.test(message)) return text.signIn;
  return text.scanError;
}

function migrationMissing(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return ["42P01", "PGRST205", "PGRST200"].includes(error.code ?? "")
    || /purchase_invoices|purchase_invoice_items|relation.*does not exist|schema cache/i.test(error.message ?? "");
}

export default function InvoiceScannerClient() {
  const router = useRouter();
  const [language, setLanguage] = useAppLanguage();
  const text = copy[language];
  const rtl = language === "ar";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("KWD");
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<PurchaseInvoiceHistory[]>([]);
  const [scannerStatus, setScannerStatus] = useState<{ ocrConfigured: boolean; aiParserConfigured: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [databaseNotReady, setDatabaseNotReady] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<InvoiceFileInfo | null>(null);
  const [fileError, setFileError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanEngine, setScanEngine] = useState<InvoiceScanEngine>(2);
  const [draft, setDraft] = useState<(InvoiceDraft & { ocrEngine: InvoiceSaveEngine }) | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [savedResult, setSavedResult] = useState<SavePurchaseInvoiceResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("arabic", rtl);
  }, [language, rtl]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const loadHistory = useCallback(async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("purchase_invoices")
      .select("id,invoice_number,supplier_name,invoice_date,currency_code,total,created_at,items:purchase_invoice_items(id,product_name_snapshot,quantity,unit_of_measurement,unit_purchase_price,line_total,product_action,stock_updated)")
      .eq("user_id", currentUserId)
      .order("invoice_date", { ascending: false })
      .limit(30);
    if (error) {
      if (migrationMissing(error)) setDatabaseNotReady(true);
      throw error;
    }
    setHistory((data ?? []) as unknown as PurchaseInvoiceHistory[]);
    setDatabaseNotReady(false);
  }, []);

  const initialize = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      const currentUser = data.session.user;
      setUserId(currentUser.id);
      const [{ data: profile, error: profileError }, { data: productRows, error: productsError }] = await Promise.all([
        supabase
          .from("business_profiles")
          .select("currency_code")
          .eq("user_id", currentUser.id)
          .maybeSingle(),
        supabase
          .from("business_products")
          .select("id,name,selling_price,materials_cost,available_quantity,currency_code")
          .eq("user_id", currentUser.id)
          .order("name", { ascending: true }),
      ]);
      if (profileError) throw profileError;
      if (!profile) {
        router.replace("/auth/complete");
        return;
      }
      if (productsError) throw productsError;
      setCurrency(profile.currency_code);
      setProducts((productRows ?? []) as Product[]);
      try {
        await loadHistory(currentUser.id);
      } catch (error) {
        if (!migrationMissing(error as { code?: string; message?: string })) throw error;
      }
      try {
        setScannerStatus(await getInvoiceScannerStatus());
      } catch {
        setScannerStatus(null);
      }
      setLoadError(false);
    } catch {
      if (!quiet) setLoadError(true);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [loadHistory, router]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  usePageReturnRefresh(() => {
    void initialize(true);
  });

  const stockUpdateCount = useMemo(
    () => draft?.items.filter((item) => item.action !== "skip").length ?? 0,
    [draft],
  );
  const newProductCount = useMemo(
    () => draft?.items.filter((item) => item.action === "create").length ?? 0,
    [draft],
  );
  const subtotalBalances = draft ? invoiceSubtotalBalances(draft) : null;
  const finalTotalBalances = draft ? invoiceFinalTotalBalances(draft) : null;
  const invoiceHasAmountMismatch = Boolean(
    draft
    && (draft.items.some((item) => invoiceLineAmountsBalance(item) === false)
      || subtotalBalances === false
      || finalTotalBalances === false),
  );

  async function selectFile(selected: File | undefined) {
    if (!selected) return;
    setNotice(null);
    setFileError("");
    setFileInfo(null);
    setFile(selected);
    setReviewOpen(false);
    setDraft(null);
    setSavedResult(null);
    try {
      const info = await inspectInvoiceFile(selected);
      setFileInfo(info);
      if (selected.size > MAX_INVOICE_FILE_BYTES) {
        setFileError(text.oversized);
      }
    } catch (error) {
      setFileError(localizedError(error instanceof Error ? error.message : "", language, text));
    }
  }

  async function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    await selectFile(selected);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    await selectFile(event.dataTransfer.files?.[0]);
  }

  async function compressSelectedFile() {
    if (!file) return;
    setCompressing(true);
    setNotice(null);
    setFileError("");
    try {
      const compressed = await compressInvoiceFile(file);
      const info = await inspectInvoiceFile(compressed);
      setFile(compressed);
      setFileInfo(info);
      setFileError("");
      setNotice({ kind: "success", message: text.compressed });
    } catch (error) {
      setFileError(localizedError(error instanceof Error ? error.message : "", language, text));
    } finally {
      setCompressing(false);
    }
  }

  function startManualEntry() {
    setNotice(null);
    setFileError("");
    setExtractedText("");
    setParseWarnings([]);
    setDraft(blankInvoice(currency));
    setReviewOpen(true);
  }

  async function scanSelectedFile() {
    if (!file || !fileInfo || fileError || !scannerStatus?.ocrConfigured) return;
    if (file.size > MAX_INVOICE_FILE_BYTES) {
      setFileError(text.oversized);
      return;
    }
    setScanning(true);
    setNotice(null);
    setFileError("");
    try {
      const result = await scanInvoice(file, scanEngine);
      setExtractedText(result.extractedText);
      const warnings = [...(result.invoice?.warnings ?? [])];
      if (!result.invoice?.currencyCode) warnings.push(text.currencyNotDetected);
      if (result.parseWarning) warnings.push(result.parseWarning);
      setParseWarnings(warnings);
      const nextDraft = parseEngineDraft(result, products);
      setDraft(nextDraft);
      setReviewOpen(true);
      if (result.parseWarning) {
        setNotice({ kind: "error", message: language === "ar" ? text.parseWarning : result.parseWarning });
      }
    } catch (error) {
      setFileError(localizedError(error instanceof Error ? error.message : "", language, text));
    } finally {
      setScanning(false);
    }
  }

  function updateHeader(field: keyof Omit<InvoiceDraft, "items">, value: string) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function updateItem(index: number, field: keyof InvoiceItemDraft, value: string | boolean | null) {
    setDraft((current) => {
      if (!current) return current;
      const items = [...current.items];
      const previous = items[index];
      if (!previous) return current;
      const next = { ...previous, [field]: value } as InvoiceItemDraft;
      if (field === "productName") {
        const exact = products.find((product) => normalizeProductName(product.name) === normalizeProductName(String(value)));
        if (exact) {
          next.action = "match";
          next.productId = exact.id;
        }
      }
      items[index] = next;
      return { ...current, items };
    });
  }

  function changeAction(index: number, action: InvoiceProductAction) {
    setDraft((current) => {
      if (!current) return current;
      const items = [...current.items];
      const oldItem = items[index];
      if (!oldItem) return current;
      items[index] = {
        ...oldItem,
        action,
        productId: action === "match" ? oldItem.productId : null,
        updateMaterialsCost: action === "match" ? oldItem.updateMaterialsCost : false,
      };
      return { ...current, items };
    });
  }

  function selectProduct(index: number, productId: string) {
    setDraft((current) => {
      if (!current) return current;
      const items = [...current.items];
      const oldItem = items[index];
      if (!oldItem) return current;
      items[index] = {
        ...oldItem,
        action: "match",
        productId: productId || null,
        updateMaterialsCost: false,
      };
      return { ...current, items };
    });
  }

  function addItem() {
    setDraft((current) => current ? { ...current, items: [...current.items, blankItem()] } : current);
  }

  function calculateTotals() {
    setDraft((current) => {
      if (!current) return current;
      const items = current.items.map((item) => ({
        ...item,
        lineTotal: amountProduct(item.quantity, item.unitPurchasePrice) || item.lineTotal,
      }));
      const subtotal = sumItemAmounts(items);
      const nextDraft = { ...current, items, subtotal };
      const total = expectedInvoiceTotalMilli(nextDraft);
      if (total === null || total < 0n) return nextDraft;
      const whole = total / 1000n;
      const fraction = String(total % 1000n).padStart(3, "0").replace(/0+$/, "");
      return { ...nextDraft, total: fraction ? `${whole}.${fraction}` : String(whole) };
    });
    setNotice(null);
  }

  function removeItem(index: number) {
    setDraft((current) => current
      ? { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }
      : current);
  }

  function validateDraft(): string | null {
    if (!draft) return text.itemsRequired;
    if (!isValidIsoDate(draft.invoiceDate)) {
      return text.invalidDate;
    }
    if (!CURRENCIES.includes(draft.currencyCode as (typeof CURRENCIES)[number])) return text.currencyRequired;
    if (!draft.items.length) return text.itemsRequired;
    const amountFields = [draft.subtotal, draft.discount, draft.tax, draft.shippingFee, draft.otherCharges, draft.total];
    if (amountFields.some((value) => value.trim() !== "" && (parseAmountToMilli(normalizeAmountInput(value)) === null || parseAmountToMilli(normalizeAmountInput(value))! < 0n))) {
      return text.invalidAmount;
    }
    const totalMilli = parseAmountToMilli(normalizeAmountInput(draft.total));
    if (totalMilli === null || totalMilli <= 0n) return text.invalidTotal;
    for (const item of draft.items) {
      if (!item.productName.trim()) return text.requiredName;
      const quantityMilli = parseAmountToMilli(normalizeAmountInput(item.quantity));
      const priceMilli = parseAmountToMilli(normalizeAmountInput(item.unitPurchasePrice));
      const lineMilli = parseAmountToMilli(normalizeAmountInput(item.lineTotal));
      const discountMilli = parseAmountToMilli(normalizeAmountInput(item.discount || "0"));
      if (quantityMilli === null || quantityMilli <= 0n) return text.invalidQuantity;
      if (priceMilli === null || priceMilli < 0n || (item.lineTotal.trim() && (lineMilli === null || lineMilli < 0n)) || discountMilli === null || discountMilli < 0n) {
        return text.invalidAmount;
      }
      const effectiveLineTotal = lineMilli ?? parseAmountToMilli(amountProduct(item.quantity, item.unitPurchasePrice));
      if (effectiveLineTotal !== null && discountMilli > effectiveLineTotal) return text.invalidAmount;
      if (item.action !== "skip" && quantityMilli % 1000n !== 0n) return text.integerQuantity;
      if (item.action === "match" && !item.productId) return text.selectProduct;
      if (item.action === "create") {
        const sellingPrice = parseAmountToMilli(normalizeAmountInput(item.sellingPrice));
        if (sellingPrice === null || sellingPrice <= 0n) return text.sellingRequired;
      }
      if (item.action === "match" && item.updateMaterialsCost && draft.currencyCode !== currency) return text.costCurrency;
    }
    if (!invoiceAmountsBalance(draft)) return text.balanceMismatch;
    return null;
  }

  async function saveConfirmedInvoice() {
    if (!draft || !userId) {
      router.replace("/auth");
      return;
    }
    const validationError = validateDraft();
    if (validationError) {
      setNotice({ kind: "error", message: validationError });
      setConfirmSave(false);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const invoice: SavePurchaseInvoiceInput = {
        ...draft,
        currencyCode: draft.currencyCode as SavePurchaseInvoiceInput["currencyCode"],
        invoiceNumber: draft.invoiceNumber.trim(),
        supplierName: draft.supplierName.trim(),
        supplierPhone: draft.supplierPhone.trim(),
        supplierEmail: draft.supplierEmail.trim(),
        subtotal: normalizeAmountInput(draft.subtotal) || sumItemAmounts(draft.items),
        discount: normalizeAmountInput(draft.discount || "0") || "0",
        tax: normalizeAmountInput(draft.tax || "0") || "0",
        shippingFee: normalizeAmountInput(draft.shippingFee || "0") || "0",
        otherCharges: normalizeAmountInput(draft.otherCharges || "0") || "0",
        total: normalizeAmountInput(draft.total),
        items: draft.items.map((item) => ({
          ...item,
          productName: item.productName.trim(),
          quantity: normalizeAmountInput(item.quantity),
          unitPurchasePrice: normalizeAmountInput(item.unitPurchasePrice),
          lineTotal: normalizeAmountInput(item.lineTotal) || amountProduct(item.quantity, item.unitPurchasePrice),
          discount: normalizeAmountInput(item.discount || "0") || "0",
          description: item.description.trim(),
          sku: item.sku.trim(),
          unitOfMeasure: item.unitOfMeasure.trim(),
          sellingPrice: normalizeAmountInput(item.sellingPrice),
        })),
      };
      const result = await savePurchaseInvoice(invoice);
      setSavedResult(result);
      setConfirmSave(false);
      setNotice({ kind: "success", message: text.saved });
      setDraft(null);
      setFile(null);
      setFileInfo(null);
      setExtractedText("");
      setReviewOpen(false);
      setParseWarnings([]);
      try {
        await Promise.all([
          loadHistory(userId),
          supabase
            .from("business_products")
            .select("id,name,selling_price,materials_cost,available_quantity,currency_code")
            .eq("user_id", userId)
            .order("name", { ascending: true })
            .then(({ data, error }) => {
              if (error) throw error;
              setProducts((data ?? []) as Product[]);
            }),
        ]);
      } catch {
        setNotice({ kind: "success", message: text.saved });
      }
    } catch (error) {
      setNotice({
        kind: "error",
        message: localizedError(error instanceof Error ? error.message : "", language, text)
          || text.savedError,
      });
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/");
    } catch {
      setNotice({ kind: "error", message: text.loadError });
    } finally {
      setSigningOut(false);
    }
  }

  function resetScanner() {
    setFile(null);
    setFileInfo(null);
    setFileError("");
    setDraft(null);
    setReviewOpen(false);
    setExtractedText("");
    setParseWarnings([]);
    setSavedResult(null);
    setNotice(null);
    setConfirmSave(false);
  }

  const pageDirection = rtl ? "rtl" : "ltr";

  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-[#f2f5f2] px-4 py-8 text-[#152238]" dir={pageDirection}>
        <div className="mx-auto flex max-w-[1320px] items-center justify-center gap-3 py-28 text-sm text-[#6a7888]">
          <LoaderCircle className="animate-spin" size={18} />
          {text.loading}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f2f5f2] text-[#152238]" dir={pageDirection}>
      <AppHeader
        language={language}
        onLanguageChange={() => setLanguage(language === "ar" ? "en" : "ar")}
        onSignOut={() => void signOut()}
        signingOut={signingOut}
      />
      <main className="invoice-workspace mx-auto max-w-[1320px] space-y-7 px-4 py-6 sm:px-7 sm:py-9">
        <section className="invoice-masthead relative flex flex-wrap items-end justify-between gap-5 overflow-hidden rounded-[26px] border border-[#d8e1da] bg-[#f9faf6] px-5 py-6 sm:px-8 sm:py-8">
          <div className="relative z-10 max-w-3xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e6d9bb] bg-[#fbf4e5] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[#826a3f]">
              <span className="size-1.5 rounded-full bg-[#c89a48]" />
              {text.section}
            </p>
            <h1 className="font-display text-3xl font-black leading-tight tracking-[-0.045em] text-[#152238] sm:text-[42px]">{text.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#657386]">{text.subtitle}</p>
          </div>
          <div className="relative z-10 flex items-center gap-2 rounded-2xl border border-[#e1e6df] bg-white/80 px-4 py-3 text-xs font-bold text-[#586879] shadow-sm">
            <ShieldCheck size={16} className="text-[#167b70]" />
            <span>{text.privateInfo}</span>
          </div>
          <div aria-hidden="true" className="invoice-masthead-mark absolute -bottom-16 end-8 select-none font-display text-[220px] font-black leading-none text-[#167b70]/[0.045]">د</div>
          <div className="absolute inset-y-0 end-0 w-1.5 bg-[#167b70]" />
        </section>

        <section aria-label={text.title} className="invoice-step-rail grid grid-cols-2 overflow-hidden rounded-2xl border border-[#e0e5dd] bg-[#fbfcf9] sm:max-w-[540px]">
          <div className={`flex items-center gap-3 px-4 py-3 ${!reviewOpen && !savedResult ? "bg-[#e6f1eb]" : ""}`}>
            <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${!reviewOpen && !savedResult ? "bg-[#167b70] text-white" : "bg-[#e9ede8] text-[#7c8992]"}`}>01</span>
            <span className={`text-xs font-bold sm:text-sm ${!reviewOpen && !savedResult ? "text-[#1c6559]" : "text-[#7d8992]"}`}>{text.uploadTitle}</span>
          </div>
          <div className={`flex items-center gap-3 border-s border-[#e5e9e3] px-4 py-3 ${reviewOpen || savedResult ? "bg-[#e6f1eb]" : ""}`}>
            <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${reviewOpen || savedResult ? "bg-[#167b70] text-white" : "bg-[#e9ede8] text-[#7c8992]"}`}>02</span>
            <span className={`text-xs font-bold sm:text-sm ${reviewOpen || savedResult ? "text-[#1c6559]" : "text-[#7d8992]"}`}>{text.reviewTitle}</span>
          </div>
        </section>

        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="sr-only"><h2>{text.title}</h2></div>
          {reviewOpen && draft ? (
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dfe5e7] bg-white px-4 py-3 text-sm font-bold text-[#344156] transition hover:border-[#168d78]"
              data-testid="button-back-to-upload"
            >
              {rtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
              {text.backToUpload}
            </button>
          ) : (
            <button
              type="button"
              onClick={startManualEntry}
              className="inline-flex items-center gap-2 rounded-xl bg-[#101b30] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a2a46]"
              data-testid="button-manual-invoice"
            >
              <Plus size={16} />
              {text.manualEntry}
            </button>
          )}
        </section>

        {notice && (
          <div
            role="status"
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${
              notice.kind === "success"
                ? "border-[#c9e3d9] bg-[#edf8f2] text-[#22644f]"
                : "border-[#f0d3cc] bg-[#fff2ee] text-[#934c40]"
            }`}
            data-testid="status-invoice-scanner"
          >
            {notice.kind === "success" ? <CheckCircle2 size={18} className="mt-1 shrink-0" /> : <AlertCircle size={18} className="mt-1 shrink-0" />}
            <span>{notice.message}</span>
          </div>
        )}

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0d3cc] bg-[#fff2ee] px-4 py-3 text-sm text-[#934c40]">
            <span>{text.loadError}</span>
            <button type="button" onClick={() => void initialize()} className="rounded-lg border border-[#e5b8ad] px-3 py-2 font-bold" data-testid="button-retry-invoice-load">{text.retry}</button>
          </div>
        )}

        {databaseNotReady && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-[#eddfba] bg-[#fff9e9] px-4 py-4 text-sm leading-6 text-[#7a6333]" data-testid="status-purchase-migration">
            <AlertCircle size={18} className="mt-1 shrink-0" />
            <span>{text.databaseMissing}</span>
          </div>
        )}

        {scannerStatus && !scannerStatus.ocrConfigured && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#eddfba] bg-[#fff9e9] px-4 py-4 text-sm leading-6 text-[#7a6333]" data-testid="status-ocr-key">
            <AlertCircle size={18} className="mt-1 shrink-0" />
            <span>{text.noOcrKey}</span>
          </div>
        )}
        {scannerStatus === null && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#eddfba] bg-[#fff9e9] px-4 py-4 text-sm leading-6 text-[#7a6333]" data-testid="status-ocr-unavailable">
            <AlertCircle size={18} className="mt-1 shrink-0" />
            <span>{text.statusUnavailable}</span>
          </div>
        )}

        {!reviewOpen && !savedResult && (
          <section className={`${panelClass} invoice-panel grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]`}>
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#e8f3f0] text-[#167b70]"><ScanLine size={20} /></span>
                <div>
                  <h2 className="text-lg font-extrabold text-[#142137]">{text.uploadTitle}</h2>
                  <p className="text-sm text-[#718091]">{text.uploadText}</p>
                </div>
              </div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(event) => void handleDrop(event)}
                className={`invoice-dropzone rounded-[20px] border-2 border-dashed p-5 transition sm:p-8 ${
                  dragActive ? "border-[#168d78] bg-[#edf8f3]" : "border-[#d6dfdf] bg-[#fbfcfa]"
                }`}
                data-testid="dropzone-invoice-file"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  capture="environment"
                  onChange={(event) => void handleFileInput(event)}
                  className="sr-only"
                  data-testid="input-invoice-file"
                />
                <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                  <span className="mb-3 grid size-14 place-items-center rounded-2xl bg-white text-[#167b70] shadow-sm">
                    {file?.type === "application/pdf" ? <FileText size={25} /> : <FileImage size={25} />}
                  </span>
                  <p className="font-bold text-[#26364a]">{dragActive ? text.dropHere : text.supported}</p>
                  <p className="mt-1 text-xs text-[#82909d]">{text.uploadText}</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#101b30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a2a46]"
                      data-testid="button-choose-invoice-file"
                    >
                      <Upload size={15} /> {text.chooseFile}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#dfe5e7] bg-white px-4 py-2.5 text-sm font-bold text-[#344156] transition hover:border-[#168d78] md:hidden"
                      data-testid="button-camera-invoice"
                    >
                      <FileImage size={15} /> {text.camera}
                    </button>
                  </div>
                </div>
              </div>
              {file && (
                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="rounded-2xl border border-[#e3e8e3] bg-[#f8faf7] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#637285]">
                          {fileInfo?.type === "application/pdf" ? <FileText size={18} /> : <FileImage size={18} />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#80909c]">{text.selectedFile}</p>
                          <p className="truncate text-sm font-bold text-[#29394b]" title={file.name}>{file.name}</p>
                          <p className="text-xs text-[#718091]">
                            {(file.size / 1024).toFixed(0)} KB
                            {fileInfo?.type === "application/pdf" ? ` · ${fileInfo.pageCount} ${language === "ar" ? "صفحات" : "pages"}` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={resetScanner}
                        className="grid size-9 shrink-0 place-items-center rounded-lg text-[#7c8996] hover:bg-white hover:text-[#9d403d]"
                        aria-label={text.removeFile}
                        data-testid="button-remove-invoice-file"
                      >
                        <X size={17} />
                      </button>
                    </div>
                    {file.size > MAX_INVOICE_FILE_BYTES && fileInfo?.pageCount !== undefined && fileInfo.pageCount <= MAX_INVOICE_PDF_PAGES && (
                      <button
                        type="button"
                        onClick={() => void compressSelectedFile()}
                        disabled={compressing}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#d9e4df] bg-white px-3 py-2.5 text-xs font-bold text-[#236757] disabled:opacity-60"
                        data-testid="button-compress-invoice"
                      >
                        {compressing ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        {compressing ? text.compressing : text.compress}
                      </button>
                    )}
                  </div>
                  {previewUrl && fileInfo?.type === "application/pdf" ? (
                    <iframe title={text.selectedFile} src={previewUrl} className="h-64 w-full rounded-2xl border border-[#e3e8e3] bg-white" data-testid="preview-invoice-pdf" />
                  ) : previewUrl ? (
                    // The selected image is only previewed locally and is not uploaded until the user starts scanning.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={text.selectedFile} className="h-64 w-full rounded-2xl border border-[#e3e8e3] bg-white object-contain p-2" data-testid="preview-invoice-image" />
                  ) : null}
                </div>
              )}
              {fileError && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-[#9a4b40]" data-testid="error-invoice-file"><AlertCircle size={15} />{fileError}</p>}
              <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(160px,0.5fr)_1fr]">
                <label>
                  <span className={labelClass}>{text.engine}</span>
                  <select
                    value={scanEngine}
                    onChange={(event) => setScanEngine(Number(event.target.value) as InvoiceScanEngine)}
                    className={fieldClass}
                    data-testid="select-ocr-engine"
                  >
                    <option value={2}>{text.engine2}</option>
                    <option value={3}>{text.engine3}</option>
                  </select>
                </label>
                <p className="self-end pb-1 text-xs leading-5 text-[#738192]">{scanEngine === 3 ? text.engine3Note : text.freeLimits}</p>
              </div>
              <button
                type="button"
                onClick={() => void scanSelectedFile()}
                disabled={!file || !fileInfo || Boolean(fileError) || scanning || compressing || !scannerStatus?.ocrConfigured || file.size > MAX_INVOICE_FILE_BYTES}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#167b70] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#12685f] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                data-testid="button-scan-invoice"
              >
                {scanning ? <LoaderCircle size={16} className="animate-spin" /> : <ScanLine size={16} />}
                {scanning ? text.scanning : text.scan}
              </button>
              {scanning && (
                <div
                  role="progressbar"
                  aria-label={text.scan}
                  aria-valuetext={text.scanProgress}
                  className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#e4ece7]"
                  data-testid="progress-scan-invoice"
                >
                  <div className="h-full w-2/5 animate-pulse rounded-full bg-[#167b70]" />
                </div>
              )}
            </div>
            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#dbe8e2] bg-[#f3f8f4] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#24685a]">
                  <ShieldCheck size={16} /> {text.privacyTitle}
                </div>
                <p className="text-xs leading-6 text-[#63766f]">{text.privacyText}</p>
              </div>
              <div className="rounded-2xl border border-[#e7e8e2] bg-[#fafbf8] p-4">
                <p className="mb-2 text-sm font-bold text-[#344156]">{text.freeLimits}</p>
                <p className="text-xs leading-6 text-[#718091]">
                  {language === "ar"
                    ? "لا نحذف صفحات تلقائيًا. إذا كان PDF كبيرًا، اضغطه داخل المتصفح؛ لا يُرسل الملف حتى تضغط قراءة الفاتورة."
                    : "Pages are never removed automatically. Large PDFs can be compressed in your browser; nothing is sent until you choose Read invoice."}
                </p>
              </div>
              {!scannerStatus?.aiParserConfigured && scannerStatus?.ocrConfigured && (
                <div className="rounded-2xl border border-[#eddfba] bg-[#fff9e9] p-4 text-xs leading-6 text-[#7a6333]">{text.aiUnavailable}</div>
              )}
            </aside>
          </section>
        )}

        {reviewOpen && draft && (
          <section className={`${panelClass} invoice-panel space-y-6 p-5 sm:p-7`} data-testid="section-invoice-review">
            <div className="invoice-review-heading flex flex-wrap items-start justify-between gap-5 rounded-2xl border border-[#dce7df] bg-[#f5f8f3] p-4 sm:p-5">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#8b7956]">{text.section}</p>
                <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-[#142137] sm:text-2xl">{text.reviewTitle}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[#708092]">{text.reviewText}</p>
              </div>
              <div className="flex min-w-[170px] flex-col items-start rounded-xl border border-[#e5d7b7] bg-[#fffaf0] px-4 py-3 sm:items-end">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#89764f]">{text.total}</span>
                <strong className="mt-1 font-display text-xl font-black tracking-tight text-[#152238]">{draft.currencyCode ? formatCurrency(draft.total || "0", draft.currencyCode, language) : draft.total || "—"}</strong>
              </div>
              {draft.ocrEngine === 0 && (
                <span className="rounded-full bg-[#eef1f3] px-3 py-1.5 text-xs font-bold text-[#596a7b]">{text.manualMode}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#e8ebe6] pb-4 text-xs font-semibold text-[#68788a]">
              <span>{draft.items.length} {text.count}</span>
              <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#167b70]" />{stockUpdateCount} {text.stockAdded}</span>
              <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#c89a48]" />{newProductCount} {text.createStatus}</span>
              <span className="ms-auto inline-flex items-center gap-1.5 text-[#8c6334]"><ShieldCheck size={14} />{language === "ar" ? "لن يتغير المخزون قبل التأكيد" : "Stock stays unchanged until confirmation"}</span>
            </div>
            {parseWarnings.length > 0 && (
              <div className="rounded-2xl border border-[#eddfba] bg-[#fff9e9] p-4 text-sm leading-6 text-[#7a6333]" data-testid="warning-invoice-parse">
                <p className="mb-1 font-bold">{text.warnings}</p>
                <ul className="list-inside list-disc">
                  {parseWarnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
                </ul>
              </div>
            )}
            {draft.currencyCode && draft.currencyCode !== currency && (
              <div className="rounded-2xl border border-[#eddfba] bg-[#fff9e9] px-4 py-3 text-sm leading-6 text-[#7a6333]" data-testid="warning-invoice-currency">{text.currencyWarning}</div>
            )}
            {invoiceHasAmountMismatch && (
              <div role="alert" className="flex items-start gap-3 rounded-2xl border border-[#f0c6bc] bg-[#fff2ee] px-4 py-3 text-sm leading-6 text-[#934c40]" data-testid="warning-invoice-amount-mismatch">
                <AlertCircle size={18} className="mt-1 shrink-0" />
                <span>{text.balanceWarning}</span>
              </div>
            )}
            {file && previewUrl && (
              <details className="rounded-2xl border border-[#e5e9e4] bg-[#fbfcfa] p-4" data-testid="details-original-invoice-preview">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[#45556a]">
                  {text.originalInvoice}<ChevronDown size={16} />
                </summary>
                <div className="mt-3">
                  {fileInfo?.type === "application/pdf" ? (
                    <iframe title={text.originalInvoice} src={previewUrl} className="h-72 w-full rounded-xl border border-[#e3e8e3] bg-white" data-testid="preview-original-invoice-pdf" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={text.originalInvoice} className="max-h-[480px] w-full rounded-xl border border-[#e3e8e3] bg-white object-contain p-2" data-testid="preview-original-invoice-image" />
                  )}
                </div>
              </details>
            )}
              <div className="invoice-fields grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label><span className={labelClass}>{text.invoiceNumber}</span><input value={draft.invoiceNumber} onChange={(event) => updateHeader("invoiceNumber", event.target.value)} className={fieldClass} maxLength={100} data-testid="input-invoice-number" /></label>
              <label><span className={labelClass}>{text.invoiceDate}</span><input type="date" value={draft.invoiceDate} onChange={(event) => updateHeader("invoiceDate", event.target.value)} className={fieldClass} data-testid="input-invoice-date" /></label>
              <label><span className={labelClass}>{text.supplier}</span><input value={draft.supplierName} onChange={(event) => updateHeader("supplierName", event.target.value)} className={fieldClass} maxLength={160} data-testid="input-supplier-name" /></label>
              <label><span className={labelClass}>{text.currency}</span><select value={draft.currencyCode} onChange={(event) => updateHeader("currencyCode", event.target.value)} className={fieldClass} data-testid="select-invoice-currency"><option value="" disabled>{text.chooseCurrency}</option>{CURRENCIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span className={labelClass}>{text.supplierPhone}</span><input value={draft.supplierPhone} onChange={(event) => updateHeader("supplierPhone", event.target.value)} className={fieldClass} maxLength={40} data-testid="input-supplier-phone" /></label>
              <label><span className={labelClass}>{text.supplierEmail}</span><input type="email" value={draft.supplierEmail} onChange={(event) => updateHeader("supplierEmail", event.target.value)} className={fieldClass} maxLength={254} data-testid="input-supplier-email" /></label>
              <label><span className={labelClass}>{text.subtotal}</span><input inputMode="decimal" value={draft.subtotal} onChange={(event) => updateHeader("subtotal", event.target.value)} className={`${fieldClass} ${subtotalBalances === false ? "border-[#c45a4d] bg-[#fff3ef] text-[#90453b]" : ""}`} aria-invalid={subtotalBalances === false} data-testid="input-invoice-subtotal" /></label>
              <label><span className={labelClass}>{text.discount}</span><input inputMode="decimal" value={draft.discount} onChange={(event) => updateHeader("discount", event.target.value)} className={fieldClass} data-testid="input-invoice-discount" /></label>
              <label><span className={labelClass}>{text.tax}</span><input inputMode="decimal" value={draft.tax} onChange={(event) => updateHeader("tax", event.target.value)} className={fieldClass} data-testid="input-invoice-tax" /></label>
              <label><span className={labelClass}>{text.shipping}</span><input inputMode="decimal" value={draft.shippingFee} onChange={(event) => updateHeader("shippingFee", event.target.value)} className={fieldClass} data-testid="input-invoice-shipping" /></label>
              <label><span className={labelClass}>{text.otherCharges}</span><input inputMode="decimal" value={draft.otherCharges} onChange={(event) => updateHeader("otherCharges", event.target.value)} className={fieldClass} data-testid="input-invoice-other-charges" /></label>
              <label><span className={labelClass}>{text.total}</span><input inputMode="decimal" value={draft.total} onChange={(event) => updateHeader("total", event.target.value)} className={`${fieldClass} border-[#c8d9d2] font-extrabold ${finalTotalBalances === false ? "border-[#c45a4d] bg-[#fff3ef] text-[#90453b]" : ""}`} aria-invalid={finalTotalBalances === false} data-testid="input-invoice-total" /></label>
            </div>

            <div className="space-y-4 border-t border-[#e8ebe6] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-[#142137]">{text.items}</h3>
                  <p className="mt-1 text-xs text-[#768596]">{text.newProductCostNote}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={calculateTotals} className="rounded-xl border border-[#d9e5df] bg-white px-3.5 py-2.5 text-sm font-bold text-[#286c5e]" data-testid="button-calculate-invoice-totals">{text.calculateTotals}</button>
                  <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border border-[#d9e5df] bg-white px-3.5 py-2.5 text-sm font-bold text-[#286c5e]" data-testid="button-add-invoice-item">
                    <Plus size={15} /> {text.addItem}
                  </button>
                </div>
              </div>
              {draft.items.map((item, index) => {
                const suggestions = getProductSuggestions(item.productName, products);
                const quantityMilli = parseAmountToMilli(normalizeAmountInput(item.quantity));
                const matchedProduct = products.find((product) => product.id === item.productId);
                const lineBalances = invoiceLineAmountsBalance(item);
                return (
                  <article key={`invoice-item-${index}`} className="invoice-line-card rounded-2xl border border-[#e1e7df] bg-[#fbfcfa] p-4 sm:p-5" data-testid={`card-invoice-item-${index}`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-extrabold text-[#425166]">{text.items} {index + 1}</p>
                      <button type="button" onClick={() => removeItem(index)} disabled={draft.items.length <= 1} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#9b5650] hover:bg-[#fff0ed] disabled:opacity-40" data-testid={`button-remove-invoice-item-${index}`}>
                        <Trash2 size={14} /> {text.removeItem}
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="sm:col-span-2">
                        <span className={labelClass}>{text.itemName}</span>
                        <input value={item.productName} onChange={(event) => updateItem(index, "productName", event.target.value)} className={fieldClass} maxLength={160} data-testid={`input-invoice-item-name-${index}`} />
                        {suggestions.length > 0 && item.action !== "match" && (
                          <span className="mt-2 flex flex-wrap gap-1.5" data-testid={`suggestions-invoice-products-${index}`}>
                            {suggestions.map((product) => (
                              <button key={product.id} type="button" onClick={() => selectProduct(index, product.id)} className="rounded-full border border-[#dbe7e0] bg-white px-2.5 py-1 text-[10px] font-bold text-[#397567] hover:border-[#168d78]" data-testid={`button-match-suggested-product-${index}-${product.id}`}>
                                {product.name}
                              </button>
                            ))}
                          </span>
                        )}
                      </label>
                      <label><span className={labelClass}>{text.sku}</span><input value={item.sku} onChange={(event) => updateItem(index, "sku", event.target.value)} className={fieldClass} maxLength={100} data-testid={`input-invoice-item-sku-${index}`} /></label>
                      <label><span className={labelClass}>{text.description}</span><input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} className={fieldClass} maxLength={500} data-testid={`input-invoice-item-description-${index}`} /></label>
                      <label><span className={labelClass}>{text.quantity}</span><input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} className={fieldClass} data-testid={`input-invoice-item-quantity-${index}`} /></label>
                      <label><span className={labelClass}>{text.unit}</span><input value={item.unitOfMeasure} onChange={(event) => updateItem(index, "unitOfMeasure", event.target.value)} className={fieldClass} maxLength={32} data-testid={`input-invoice-item-unit-${index}`} /></label>
                      <label><span className={labelClass}>{text.purchasePrice}</span><input inputMode="decimal" value={item.unitPurchasePrice} onChange={(event) => updateItem(index, "unitPurchasePrice", event.target.value)} className={fieldClass} data-testid={`input-invoice-item-price-${index}`} /></label>
                       <label><span className={labelClass}>{text.lineTotal}</span><input inputMode="decimal" value={item.lineTotal} onChange={(event) => updateItem(index, "lineTotal", event.target.value)} className={`${fieldClass} ${lineBalances === false ? "border-[#c45a4d] bg-[#fff3ef] text-[#90453b]" : ""}`} aria-invalid={lineBalances === false} data-testid={`input-invoice-item-total-${index}`} /></label>
                      <label><span className={labelClass}>{text.lineDiscount}</span><input inputMode="decimal" value={item.discount} onChange={(event) => updateItem(index, "discount", event.target.value)} className={fieldClass} data-testid={`input-invoice-item-discount-${index}`} /></label>
                      <label className="sm:col-span-2"><span className={labelClass}>{text.productAction}</span><select value={item.action} onChange={(event) => changeAction(index, event.target.value as InvoiceProductAction)} className={fieldClass} data-testid={`select-invoice-item-action-${index}`}><option value="match">{text.matchExisting}</option><option value="create">{text.createProduct}</option><option value="skip">{text.skipStock}</option></select></label>
                      {item.action === "match" && (
                        <>
                          <label className="sm:col-span-2"><span className={labelClass}>{text.chooseProduct}</span><select value={item.productId ?? ""} onChange={(event) => selectProduct(index, event.target.value)} className={fieldClass} data-testid={`select-invoice-item-product-${index}`}><option value="">{products.length ? text.chooseProduct : text.noProducts}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.available_quantity} {text.units}</option>)}</select></label>
                           {matchedProduct && (
                             <div className="rounded-xl border border-[#dce8df] bg-[#f2f7f2] p-3 sm:col-span-4" data-testid={`details-matched-product-${index}`}>
                               <p className="mb-2 text-xs font-extrabold text-[#315f54]">{text.currentProduct}: {matchedProduct.name}</p>
                               <div className="grid gap-2 text-xs sm:grid-cols-3">
                                 <p className="rounded-lg bg-white px-3 py-2 text-[#657386]"><span className="block">{text.currentStock}</span><strong className="mt-1 block text-[#26384a]">{new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", { maximumFractionDigits: 3 }).format(Number(matchedProduct.available_quantity) || 0)} {text.units}</strong></p>
                                 <p className="rounded-lg bg-white px-3 py-2 text-[#657386]"><span className="block">{text.currentSellingPrice}</span><strong className="mt-1 block text-[#26384a]">{formatCurrency(matchedProduct.selling_price, matchedProduct.currency_code || currency, language)}</strong></p>
                                 <p className="rounded-lg bg-white px-3 py-2 text-[#657386]"><span className="block">{text.currentMaterialsCost}</span><strong className="mt-1 block text-[#26384a]">{formatCurrency(matchedProduct.materials_cost, matchedProduct.currency_code || currency, language)}</strong></p>
                               </div>
                             </div>
                           )}
                          <label className={`flex items-start gap-2 rounded-xl border border-[#e5e9e4] bg-white p-3 text-xs leading-5 text-[#59697c] sm:col-span-2 ${draft.currencyCode !== currency ? "opacity-60" : ""}`}>
                            <input type="checkbox" checked={item.updateMaterialsCost} disabled={draft.currencyCode !== currency} onChange={(event) => updateItem(index, "updateMaterialsCost", event.target.checked)} className="mt-1 accent-[#167b70]" data-testid={`checkbox-update-product-cost-${index}`} />
                            <span><strong className="block text-[#35465a]">{text.updateCost}</strong>{text.updateCostNote}</span>
                          </label>
                        </>
                      )}
                      {item.action === "create" && (
                        <>
                          <label><span className={labelClass}>{text.sellingPrice}</span><input inputMode="decimal" value={item.sellingPrice} onChange={(event) => updateItem(index, "sellingPrice", event.target.value)} className={fieldClass} data-testid={`input-new-product-selling-price-${index}`} /></label>
                          <p className="self-end pb-2 text-xs leading-5 text-[#6f7d8c]">{text.sellingPriceNote}</p>
                        </>
                      )}
                      {item.action !== "skip" && quantityMilli !== null && quantityMilli % 1000n !== 0n && (
                        <p className="flex items-start gap-2 rounded-xl border border-[#f0d3cc] bg-[#fff2ee] p-3 text-xs leading-5 text-[#934c40] sm:col-span-4" data-testid={`warning-noninteger-stock-${index}`}>
                          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {text.integerQuantity}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {extractedText && (
              <details className="rounded-2xl border border-[#e5e9e4] bg-[#fbfcfa] p-4" data-testid="details-extracted-invoice-text">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[#45556a]">
                  {text.extractedText}<ChevronDown size={16} />
                </summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-6 text-[#5c6b7d]">{extractedText}</pre>
              </details>
            )}
            <div className="invoice-save-bar flex flex-wrap items-center justify-between gap-3 border-t border-[#e8ebe6] pt-5">
              <p className="text-xs leading-5 text-[#748191]">{text.privateInfo} · {stockUpdateCount} {text.stockAdded} · {newProductCount} {text.createStatus}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setReviewOpen(false)} className="rounded-xl border border-[#dfe5e7] bg-white px-4 py-2.5 text-sm font-bold text-[#586779]" data-testid="button-cancel-invoice-review">{text.cancel}</button>
                <button type="button" onClick={() => {
                  const validationError = validateDraft();
                  if (validationError) setNotice({ kind: "error", message: validationError });
                  else setConfirmSave(true);
                }} disabled={saving || databaseNotReady} className="inline-flex items-center gap-2 rounded-xl bg-[#101b30] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a2a46] disabled:opacity-50" data-testid="button-save-purchase-invoice">
                  <Check size={16} /> {text.saveInvoice}
                </button>
              </div>
            </div>
          </section>
        )}

        {savedResult && (
          <section className={`${panelClass} flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6`} data-testid="section-invoice-saved">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-[#e8f3f0] text-[#167b70]"><CheckCircle2 size={22} /></span>
              <div>
                <h2 className="font-extrabold text-[#142137]">{text.successTitle}</h2>
                <p className="mt-1 text-sm text-[#6d7c8b]">{text.saved} · {text.savedDetails}: {savedResult.invoiceId.slice(0, 8)}</p>
              </div>
            </div>
            <button type="button" onClick={() => { resetScanner(); startManualEntry(); }} className="inline-flex items-center gap-2 rounded-xl bg-[#101b30] px-4 py-2.5 text-sm font-bold text-white" data-testid="button-new-purchase-invoice"><Plus size={15} />{text.continue}</button>
          </section>
        )}

          <section className={`${panelClass} invoice-panel p-5 sm:p-7`}>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e8ebe6] pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#142137]">{text.historyTitle}</h2>
              <p className="mt-1 text-sm text-[#758394]">{text.historyText}</p>
            </div>
            <span className="rounded-full bg-[#eef4f0] px-3 py-1.5 text-xs font-bold text-[#397567]">{text.privateInfo}</span>
          </div>
          {history.length === 0 ? (
            <div className="invoice-empty-state py-12 text-center text-sm text-[#7b8997]" data-testid="empty-purchase-invoice-history">
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl border border-[#e4e9e1] bg-[#f5f8f3] text-[#8b7956]"><FileText size={20} /></span>
              {text.emptyHistory}
            </div>
          ) : (
            <div className="divide-y divide-[#edf0ec]">
              {history.map((invoice) => {
                const expanded = expandedInvoiceId === invoice.id;
                return (
                  <article key={invoice.id} className="py-4" data-testid={`row-purchase-invoice-${invoice.id}`}>
                    <button type="button" onClick={() => setExpandedInvoiceId(expanded ? null : invoice.id)} className="grid w-full gap-3 text-start sm:grid-cols-[1.2fr_1fr_0.8fr_auto] sm:items-center">
                      <span><strong className="block text-sm text-[#29394b]">{invoice.supplier_name || text.copiedName}</strong><small className="text-xs text-[#81909e]">{invoice.invoice_number || invoice.invoice_date}</small></span>
                      <span className="text-xs text-[#68788a]">{invoice.invoice_date} · {invoice.items.length} {text.count}</span>
                      <strong className="text-sm text-[#223248]">{formatCurrency(invoice.total, invoice.currency_code, language)}</strong>
                      <span className="flex items-center gap-2 text-xs text-[#6c7c8e]">{invoice.items.filter((item) => item.stock_updated).length} {text.stockAdded}<ChevronDown size={15} className={`transition ${expanded ? "rotate-180" : ""}`} /></span>
                    </button>
                    {expanded && (
                      <div className="mt-4 overflow-x-auto rounded-xl border border-[#e7ebe6]">
                        <table className="w-full min-w-[600px] text-sm">
                          <thead className="bg-[#f5f7f4] text-xs text-[#708092]">
                            <tr><th className="px-3 py-2 text-start">{text.itemName}</th><th className="px-3 py-2 text-start">{text.quantity}</th><th className="px-3 py-2 text-start">{text.purchasePrice}</th><th className="px-3 py-2 text-start">{text.lineTotal}</th><th className="px-3 py-2 text-start">{text.productAction}</th></tr>
                          </thead>
                          <tbody className="divide-y divide-[#edf0ec]">
                            {invoice.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-3 py-2.5 font-bold text-[#344156]">{item.product_name_snapshot}</td>
                                <td className="px-3 py-2.5 text-[#667689]">{item.quantity} {item.unit_of_measurement || text.units}</td>
                                <td className="px-3 py-2.5 text-[#667689]">{formatCurrency(item.unit_purchase_price, invoice.currency_code, language)}</td>
                                <td className="px-3 py-2.5 text-[#667689]">{formatCurrency(item.line_total, invoice.currency_code, language)}</td>
                                <td className="px-3 py-2.5 text-xs text-[#667689]">{item.product_action === "matched" ? text.matchStatus : item.product_action === "created" ? text.createStatus : text.skippedStatus}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {confirmSave && draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#101b30]/45 p-4" role="presentation" onClick={(event) => {
          if (event.target === event.currentTarget && !saving) setConfirmSave(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="confirm-invoice-title" className="invoice-confirm-dialog w-full max-w-lg rounded-[24px] border border-[#e5e8e2] bg-[#fffefa] p-6 shadow-2xl" data-testid="dialog-confirm-purchase-invoice">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#e8f3f0] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#236c60]"><ShieldCheck size={12} />{text.privateInfo}</p>
                <h2 id="confirm-invoice-title" className="font-display text-xl font-extrabold tracking-[-0.025em] text-[#142137] sm:text-2xl">{text.confirmTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-[#69798b]">{text.confirmText}</p>
              </div>
              <button type="button" onClick={() => setConfirmSave(false)} disabled={saving} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#708092] hover:bg-[#f3f5f1]" aria-label={text.cancel} data-testid="button-close-invoice-confirmation"><X size={18} /></button>
            </div>
            <div className="my-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#e6e9e3] bg-[#f7f8f4] p-3">
                <p className="text-xs text-[#768596]">{text.total}</p>
                <p className="mt-1 font-extrabold text-[#203249]">{formatCurrency(draft.total || "0", draft.currencyCode, language)}</p>
              </div>
              <div className="rounded-xl border border-[#e6e9e3] bg-[#f7f8f4] p-3">
                <p className="text-xs text-[#768596]">{text.stockAdded}</p>
                <p className="mt-1 font-extrabold text-[#203249]">{stockUpdateCount} · {newProductCount} {text.createStatus}</p>
              </div>
            </div>
            {notice?.kind === "error" && <p role="alert" className="mb-4 rounded-xl border border-[#f0d3cc] bg-[#fff2ee] px-3 py-2 text-sm text-[#9a4b40]">{notice.message}</p>}
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button type="button" onClick={() => setConfirmSave(false)} disabled={saving} className="rounded-xl border border-[#dfe5e7] bg-white px-4 py-2.5 text-sm font-bold text-[#586779]" data-testid="button-cancel-invoice-save">{text.cancel}</button>
              <button type="button" onClick={() => void saveConfirmedInvoice()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#167b70] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" data-testid="button-confirm-invoice-save">
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
                {saving ? text.saving : text.confirm}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

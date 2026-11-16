"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Check, CircleAlert, Clipboard, FileText, PackagePlus,
  Pencil, Plus, Printer, Search, UserRound, Users, X,
} from "lucide-react";
import {
  getBusinessProfile, getCustomers, getCustomerOrderHistory, getInvoiceForOrder,
  getInvoiceTokenForOrder, getOrderableProducts, getOrderDetails, getOrders,
  getPublicInvoice, requireCurrentUserId, saveCustomer, saveOrder, updateOrderStatus,
  type BusinessProduct, type Customer, type OrderDetails, type OrderStatus,
  type OrderSummary, type PaymentStatus, type PublicInvoice,
} from "../lib/orders-api";
import {
  formatMilliAmount, milliToDatabaseValue, normalizeMoneyInput, parseAmountToMilli,
} from "../lib/money";
import { AppHeader } from "../components/app-header";
import { useAppLanguage } from "../hooks/use-app-language";
import { supabase } from "../lib/supabase";

type Lang = "ar" | "en";
type Screen = "customers" | "orders" | "create-order" | "order-details" | "invoice";

const C = {
  ar: {
    brand: "دفترُك", customers: "العملاء", orders: "الطلبات", dashboard: "لوحة التحكم",
    transactions: "الحركات", addCustomer: "عميل جديد",
    titleCustomers: "عملاؤك، في مكان واحد", subCustomers: "احتفظ بتفاصيل العملاء وتابع طلباتهم بسهولة.",
    titleOrders: "الطلبات", subOrders: "تابع كل طلب ومدفوعاته من لحظة التأكيد حتى التسليم.",
    searchCustomer: "ابحث بالاسم أو الهاتف أو البريد", searchOrder: "ابحث برقم الطلب أو اسم العميل",
    emptyCustomers: "لا يوجد عملاء بعد", emptyCustomersSub: "أضف أول عميل لتبدأ بحفظ طلباته ومعلومات التواصل.",
    emptyOrders: "لا توجد طلبات بعد", emptyOrdersSub: "أنشئ طلبك الأول واجمع تفاصيله وفاتورته في مكان واحد.",
    addOrder: "إنشاء طلب", status: "حالة الطلب", payment: "حالة الدفع", date: "التاريخ", all: "الكل",
    new: "جديد", processing: "قيد التجهيز", completed: "مكتمل", cancelled: "ملغي",
    unpaid: "غير مدفوع", pending: "قيد الانتظار", paid: "مدفوع", failed: "فشل", refunded: "مسترد",
    customer: "العميل", phone: "رقم الهاتف", email: "البريد الإلكتروني", notes: "ملاحظات",
    save: "حفظ", saving: "جارٍ الحفظ…", customerSaved: "تم حفظ بيانات العميل.", cancel: "إلغاء", edit: "تعديل", history: "سجل الطلبات",
    noHistory: "لا توجد طلبات لهذا العميل بعد.", customerForm: "بيانات العميل", name: "الاسم",
    required: "تحقق من الاسم ورقم الهاتف والبريد الإلكتروني والملاحظات.", noResults: "لا توجد نتائج مطابقة", noResultsSub: "جرّب تغيير كلمات البحث أو عوامل التصفية.", loadError: "تعذر تحميل البيانات. تحقق من اتصالك وحاول مجددًا.",
    retry: "إعادة المحاولة", saveError: "تعذر الحفظ. يرجى المحاولة مرة أخرى.", loading: "جارٍ تحميل البيانات…",
    order: "الطلب", createTitle: "طلب جديد", editTitle: "تعديل الطلب", chooseCustomer: "اختر العميل",
    products: "المنتجات", quantity: "الكمية", addProduct: "إضافة منتج", noProducts: "لا توجد منتجات قابلة للطلب بهذه العملة.",
    discount: "الخصم", shipping: "رسوم التوصيل", orderDate: "تاريخ الطلب", create: "حفظ الطلب",
    subtotal: "المجموع الفرعي", total: "الإجمالي", item: "المنتج", unitPrice: "سعر الوحدة",
    chooseProduct: "اختر منتجًا", validationOrder: "اختر عميلًا وأكمل المنتجات بكميات من ١ إلى ٩٩، دون تكرار المنتج.",
    validationMoney: "تحقق من الخصم ورسوم التوصيل؛ استخدم أرقامًا صحيحة حتى ثلاث خانات عشرية.",
    previewNote: "هذا تقدير من الأسعار الحالية؛ تُحسب الفاتورة النهائية من بيانات المنتجات المحفوظة.",
    orderSaved: "تم حفظ الطلب.", details: "تفاصيل الطلب", invoice: "الفاتورة", viewInvoice: "عرض الفاتورة",
    updateStatus: "تحديث الحالة", cancelOrder: "إلغاء الطلب", confirmCancel: "هل تريد إلغاء هذا الطلب؟",
    saveStatus: "حفظ الحالة", statusSaved: "تم تحديث حالة الطلب.", notFound: "لم يتم العثور على الطلب.",
    invoiceTitle: "فاتورة", publicInvoice: "فاتورة إلكترونية", business: "النشاط التجاري",
    issued: "تاريخ الإصدار", invoiceNo: "رقم الفاتورة", orderNo: "رقم الطلب", billTo: "فاتورة إلى",
    paymentLink: "رابط الدفع", copy: "نسخ الرابط", copied: "تم نسخ الرابط", whatsapp: "مشاركة عبر واتساب",
    print: "طباعة أو حفظ PDF", publicMissing: "تعذر العثور على الفاتورة أو أن الرابط غير صالح.",
    ownerInvoice: "معاينة الفاتورة", totalDue: "الإجمالي المستحق", tryAgain: "إعادة المحاولة",
    toOrders: "العودة إلى الطلبات", back: "رجوع", language: "EN", private: "بياناتك محفوظة بأمان",
    signOutError: "تعذر تسجيل الخروج. أعد المحاولة.",
    dateFrom: "من تاريخ", dateTo: "إلى تاريخ", clear: "مسح", lineItems: "تفاصيل المنتجات",
  },
  en: {
    brand: "Daftaro", customers: "Customers", orders: "Orders", dashboard: "Dashboard",
    transactions: "Transactions", addCustomer: "New customer",
    titleCustomers: "Your customers, together", subCustomers: "Keep customer details close and their order history easy to follow.",
    titleOrders: "Orders", subOrders: "Follow every order and payment from confirmation through delivery.",
    searchCustomer: "Search name, phone, or email", searchOrder: "Search order number or customer",
    emptyCustomers: "No customers yet", emptyCustomersSub: "Add your first customer to keep their details and orders together.",
    emptyOrders: "No orders yet", emptyOrdersSub: "Create your first order and keep its details and invoice in one place.",
    addOrder: "Create order", status: "Order status", payment: "Payment status", date: "Date", all: "All",
    new: "New", processing: "Processing", completed: "Completed", cancelled: "Cancelled",
    unpaid: "Unpaid", pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded",
    customer: "Customer", phone: "Phone number", email: "Email", notes: "Notes",
    save: "Save", saving: "Saving…", customerSaved: "Customer details saved.", cancel: "Cancel", edit: "Edit", history: "Order history",
    noHistory: "This customer has no orders yet.", customerForm: "Customer details", name: "Name",
    required: "Check the name, phone number, email, and notes.", noResults: "No matching results", noResultsSub: "Try changing the search or filters.", loadError: "We couldn't load the data. Check your connection and try again.",
    retry: "Try again", saveError: "We couldn't save this. Please try again.", loading: "Loading your data…",
    order: "Order", createTitle: "New order", editTitle: "Edit order", chooseCustomer: "Choose a customer",
    products: "Products", quantity: "Quantity", addProduct: "Add product", noProducts: "No orderable products in this currency.",
    discount: "Discount", shipping: "Shipping fee", orderDate: "Order date", create: "Save order",
    subtotal: "Subtotal", total: "Total", item: "Product", unitPrice: "Unit price",
    chooseProduct: "Choose a product", validationOrder: "Choose a customer and complete each product with a quantity from 1 to 99. Products cannot repeat.",
    validationMoney: "Check the discount and shipping fee; use valid amounts with up to three decimal places.",
    previewNote: "This is an estimate from current prices. The final invoice uses saved product data.",
    orderSaved: "Order saved.", details: "Order details", invoice: "Invoice", viewInvoice: "View invoice",
    updateStatus: "Update status", cancelOrder: "Cancel order", confirmCancel: "Cancel this order?",
    saveStatus: "Save status", statusSaved: "Order status updated.", notFound: "Order not found.",
    invoiceTitle: "Invoice", publicInvoice: "Digital invoice", business: "Business",
    issued: "Issued", invoiceNo: "Invoice number", orderNo: "Order number", billTo: "Bill to",
    paymentLink: "Payment link", copy: "Copy link", copied: "Link copied", whatsapp: "Share on WhatsApp",
    print: "Print or save PDF", publicMissing: "Invoice not found, or this link is invalid.",
    ownerInvoice: "Invoice preview", totalDue: "Total due", tryAgain: "Try again",
    toOrders: "Back to orders", back: "Back", language: "العربية", private: "Your records stay private",
    signOutError: "We couldn't sign you out. Please try again.",
    dateFrom: "From date", dateTo: "To date", clear: "Clear", lineItems: "Items",
  },
} as const;

const orderStatuses: OrderStatus[] = ["New", "Processing", "Completed", "Cancelled"];
const paymentStatuses: PaymentStatus[] = ["Unpaid", "Pending", "Paid", "Failed", "Refunded"];
const statusWords: Record<string, keyof typeof C.ar> = {
  New: "new", Processing: "processing", Completed: "completed", Cancelled: "cancelled",
  Unpaid: "unpaid", Pending: "pending", Paid: "paid", Failed: "failed", Refunded: "refunded",
};

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function money(value: string | number, currency: string, lang: Lang) {
  const n = Number(value);
  const shown = Number.isFinite(n) ? new Intl.NumberFormat(lang === "ar" ? "ar-KW" : "en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n) : String(value);
  return <span dir="ltr">{shown} <span className="text-[.72em] font-semibold text-[#788493]">{currency}</span></span>;
}
function exactMoney(value: bigint, currency: string, lang: Lang) {
  return <span dir="ltr">{formatMilliAmount(value, lang)} <span className="text-[.72em] font-semibold text-[#788493]">{currency}</span></span>;
}
function normalizePhone(value: string) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)));
}
function dateLabel(value: string, lang: Lang) {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(lang === "ar" ? "ar-KW" : "en-KW", { day: "numeric", month: "short", year: "numeric" });
}
function labelFor(value: string, lang: Lang) {
  const key = statusWords[value];
  return key ? C[lang][key] : value;
}

export default function OrdersUI({ screen }: { screen: Screen }) {
  const router = useRouter();
  const [lang, setLang] = useAppLanguage();
  const [params, setParams] = useState<{ id: string; token: string }>({ id: "", token: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [profile, setProfile] = useState<{ business_name: string; currency_code: string }>({ business_name: "", currency_code: "KWD" });
  const [products, setProducts] = useState<BusinessProduct[]>([]);
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [invoiceData, setInvoiceData] = useState<PublicInvoice | null>(null);
  const [invoiceToken, setInvoiceToken] = useState("");
  const [history, setHistory] = useState<OrderSummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerModal, setCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [orderDraft, setOrderDraft] = useState({ customer_id: "", items: [{ product_id: "", quantity: 1 }], discount: "0", shipping_fee: "0", order_date: localDate(), order_status: "New" as OrderStatus, payment_status: "Unpaid" as PaymentStatus });
  const [statusDraft, setStatusDraft] = useState<{ order_status: OrderStatus; payment_status: PaymentStatus }>({ order_status: "New", payment_status: "Unpaid" });
  const t = C[lang];
  const rtl = lang === "ar";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("arabic", rtl);
  }, [lang, rtl]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setParams({
      id: query.get("id") ?? query.get("order") ?? "",
      token: query.get("token") ?? "",
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      if (screen === "invoice") {
        const query = new URLSearchParams(window.location.search);
        const token = query.get("token");
        const orderId = query.get("order");
        if (token) {
          setInvoiceToken(token);
          setInvoiceData(await getPublicInvoice(token));
        } else if (orderId) {
          await requireCurrentUserId();
          const [result, ownerToken] = await Promise.all([
            getInvoiceForOrder(orderId),
            getInvoiceTokenForOrder(orderId),
          ]);
          setInvoiceData(result);
          setInvoiceToken(ownerToken ?? "");
        } else {
          await requireCurrentUserId();
          setInvoiceData(null);
          setInvoiceToken("");
        }
      } else if (screen === "customers") {
        await requireCurrentUserId();
        const rows = await getCustomers(); setCustomers(rows);
      } else if (screen === "orders") {
        await requireCurrentUserId();
        const rows = await getOrders(); setOrders(rows);
      } else if (screen === "create-order") {
        await requireCurrentUserId();
        const [business, customerRows] = await Promise.all([getBusinessProfile(), getCustomers()]);
        setProfile(business); setCustomers(customerRows);
        const productRows = await getOrderableProducts(business.currency_code); setProducts(productRows);
        const query = new URLSearchParams(window.location.search); const id = query.get("id");
        if (id) {
          const record = await getOrderDetails(id);
          if (record) {
            setDetails(record);
            setOrderDraft({ customer_id: record.customer_id, items: record.items.map((item) => ({ product_id: item.product_id ?? "", quantity: item.quantity })), discount: String(record.discount), shipping_fee: String(record.shipping_fee), order_date: record.order_date.slice(0, 10), order_status: record.order_status, payment_status: record.payment_status });
          }
        }
      } else if (screen === "order-details") {
        await requireCurrentUserId();
        const id = new URLSearchParams(window.location.search).get("id");
        const record = id ? await getOrderDetails(id) : null;
        setDetails(record);
        if (record) setStatusDraft({ order_status: record.order_status, payment_status: record.payment_status });
      }
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "Authentication required.") {
        router.replace("/auth");
        return;
      }
      if (loadError instanceof Error && loadError.message === "Complete your business profile first.") {
        router.replace("/auth/complete");
        return;
      }
      setError(true);
    } finally { setLoading(false); }
  }, [router, screen]);
  useEffect(() => { void load(); }, [load]);

  const filteredCustomers = useMemo(() => customers.filter((customer) =>
    `${customer.name} ${customer.phone}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [customers, search]);
  const filteredOrders = useMemo(() => orders.filter((order) =>
    `${order.order_number} ${order.customer_name_snapshot} ${order.customer_phone_snapshot}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())
    && (!statusFilter || order.order_status === statusFilter)
    && (!paymentFilter || order.payment_status === paymentFilter)
    && (!fromDate || order.order_date >= fromDate)
    && (!toDate || order.order_date <= toDate)), [orders, search, statusFilter, paymentFilter, fromDate, toDate]);
  const orderPreview = useMemo(() => {
    let subtotal = 0n;
    let validItems = orderDraft.items.length > 0 && orderDraft.items.length <= 50;
    for (const item of orderDraft.items) {
      const quantity = Number(item.quantity);
      const product = products.find((candidate) => candidate.id === item.product_id);
      const price = product ? parseAmountToMilli(String(product.selling_price)) : null;
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || price === null) {
        validItems = false;
        continue;
      }
      subtotal += price * BigInt(quantity);
    }
    const discount = parseAmountToMilli(normalizeMoneyInput(orderDraft.discount.trim() || "0"));
    const shipping = parseAmountToMilli(normalizeMoneyInput(orderDraft.shipping_fee.trim() || "0"));
    const validAdjustments =
      discount !== null && shipping !== null && discount >= 0n && shipping >= 0n && discount <= subtotal;
    return {
      subtotal,
      discount,
      shipping,
      total: validAdjustments && discount !== null && shipping !== null
        ? subtotal - discount + shipping
        : null,
      valid: validItems && validAdjustments,
    };
  }, [orderDraft, products]);

  function openCustomer(customer?: Customer) {
    setEditingCustomer(customer ?? null);
    setCustomerForm(customer ? { name: customer.name, phone: customer.phone, email: customer.email ?? "", notes: customer.notes ?? "" } : { name: "", phone: "", email: "", notes: "" });
    setFormError(""); setCustomerModal(true);
  }
  async function submitCustomer(event: FormEvent) {
    event.preventDefault(); setFormError("");
    const name = customerForm.name.trim();
    const phone = normalizePhone(customerForm.phone);
    const phoneDigits = phone.replace(/\D/g, "").length;
    if (
      name.length < 1 || name.length > 120
      || !/^[+0-9() .-]{7,24}$/.test(phone)
      || phoneDigits < 7 || phoneDigits > 20
      || customerForm.email.trim().length > 254
      || customerForm.notes.trim().length > 1000
    ) { setFormError(t.required); return; }
    setBusy(true);
    try {
      const result = await saveCustomer({ ...(editingCustomer ? { id: editingCustomer.id } : {}), name, phone, email: customerForm.email || null, notes: customerForm.notes || null });
      setCustomers((old) => editingCustomer ? old.map((item) => item.id === result.id ? result : item) : [...old, result]);
      setCustomerModal(false); setNotice(t.customerSaved); setSelectedCustomer(result);
      try { setHistory(await getCustomerOrderHistory(result.id)); } catch { setError(true); }
    } catch { setFormError(t.saveError); } finally { setBusy(false); }
  }
  async function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer); setHistory([]); setLoading(true);
    try { setHistory(await getCustomerOrderHistory(customer.id)); } catch { setError(true); } finally { setLoading(false); }
  }
  async function submitOrder(event: FormEvent) {
    event.preventDefault(); setFormError("");
    const items = orderDraft.items.map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity) }));
    const productIds = items.map((item) => item.product_id);
    if (
      !orderDraft.customer_id || !items.length || items.length > 50
      || items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)
      || new Set(productIds).size !== productIds.length
    ) { setFormError(t.validationOrder); return; }
    const discount = parseAmountToMilli(normalizeMoneyInput(orderDraft.discount.trim() || "0"));
    const shipping = parseAmountToMilli(normalizeMoneyInput(orderDraft.shipping_fee.trim() || "0"));
    if (!orderPreview.valid || discount === null || shipping === null) { setFormError(t.validationMoney); return; }
    setBusy(true);
    try {
      const result = await saveOrder({ ...(details ? { order_id: details.id } : {}), customer_id: orderDraft.customer_id, items, discount: milliToDatabaseValue(discount), shipping_fee: milliToDatabaseValue(shipping), order_date: orderDraft.order_date, order_status: orderDraft.order_status, payment_status: orderDraft.payment_status });
      setNotice(t.orderSaved);
      router.push(`/order-details?id=${encodeURIComponent(result.order_id)}`);
    } catch { setFormError(t.saveError); } finally { setBusy(false); }
  }
  async function updateStatus(next?: OrderStatus) {
    if (!details) return;
    const order_status = next ?? statusDraft.order_status;
    if (next) setStatusDraft((old) => ({ ...old, order_status }));
    if (order_status === "Cancelled" && details.order_status !== "Cancelled" && !window.confirm(t.confirmCancel)) return;
    setBusy(true);
    try {
      await updateOrderStatus(details.id, order_status, statusDraft.payment_status);
      setDetails(await getOrderDetails(details.id));
      setNotice(t.statusSaved);
    } catch { setFormError(t.saveError); } finally { setBusy(false); }
  }

  async function signOut() {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) throw authError;
      router.replace("/auth");
    } catch {
      setSignOutError(true);
      setSigningOut(false);
    }
  }

  const control = "w-full rounded-[13px] border border-[#dfe5e8] bg-[#fffefa] px-3.5 py-3 text-sm text-[#1d2c3d] outline-none transition placeholder:text-[#a3acb5] focus:border-[#168d78] focus:ring-4 focus:ring-[#168d78]/10";
  const panel = "rounded-[22px] border border-[#e1e7e4] bg-[#fffefa] shadow-[0_12px_42px_rgba(28,48,56,.045)]";
  const header = (
    <AppHeader
      language={lang}
      onLanguageChange={() => setLang(rtl ? "en" : "ar")}
      onSignOut={() => void signOut()}
      signingOut={signingOut}
    />
  );
  const signOutErrorLine = signOutError && (
    <p role="alert" className="mx-auto mt-3 max-w-[1320px] px-4 text-sm text-[#a34d43] sm:px-7" data-testid="error-sign-out">
      {t.signOutError}
    </p>
  );
  const shell = (children: ReactNode) => <main dir={rtl ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[#f4f6f4] text-[#172639]">{header}{signOutErrorLine}<div className="mx-auto max-w-[1240px] px-4 pb-12 pt-7 sm:px-7 sm:pt-10">{children}</div></main>;
  const noticeLine = notice && <div role="status" aria-live="polite" className="mb-4 flex items-center gap-2 rounded-xl border border-[#cde7df] bg-[#eaf6f1] px-4 py-3 text-sm text-[#197360]" data-testid="status-notice"><Check size={16} />{notice}</div>;
  const errorBlock = <div className={`${panel} p-7 text-center`} role="alert" data-testid="state-load-error"><CircleAlert className="mx-auto mb-3 text-[#a34d43]" /><p className="text-sm font-semibold text-[#a34d43]">{t.loadError}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-[#101b30] px-4 py-2.5 text-sm font-bold text-white" data-testid="button-retry">{t.retry}</button></div>;
  const loadingBlock = <div role="status" aria-label={t.loading} className={`${panel} space-y-3 p-5`} data-testid="state-loading">{[1,2,3].map((x) => <div key={x} className="h-14 animate-pulse rounded-xl bg-[#f0f2ed]" />)}</div>;

  if (screen === "customers") return shell(<>
    <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="mb-2 text-[10px] font-extrabold tracking-[.16em] text-[#927a46]">{t.customers}</p><h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight tracking-[-.055em] text-[#101b30]">{t.titleCustomers}</h1><p className="mt-2 text-sm leading-6 text-[#738092]">{t.subCustomers}</p></div>
      <button type="button" onClick={() => openCustomer()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#101b30] px-5 text-sm font-bold text-white transition hover:bg-[#1b2c49]" data-testid="button-add-customer"><Plus size={17} />{t.addCustomer}</button>
    </div>
    {noticeLine}
    {selectedCustomer && <section className={`${panel} mb-5 overflow-hidden`} data-testid="section-customer-history">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[13px] bg-[#f2efe6] text-[#9a8050]"><UserRound size={18}/></span><div><h2 className="font-extrabold text-[#17283c]">{selectedCustomer.name}</h2><p dir="ltr" className="mt-1 text-start text-xs text-[#788493]">{selectedCustomer.phone}</p></div></div>
        <div className="flex gap-2"><button type="button" onClick={() => openCustomer(selectedCustomer)} className="rounded-xl border border-[#dfe5e7] px-3 py-2 text-xs font-bold text-[#526174]" aria-label={t.edit} data-testid={`button-edit-customer-${selectedCustomer.id}`}><Pencil size={14}/></button><button type="button" onClick={() => setSelectedCustomer(null)} className="rounded-xl border border-[#dfe5e7] px-3 py-2 text-xs font-bold text-[#526174]" aria-label={t.cancel} data-testid="button-close-history"><X size={14}/></button></div>
      </div>
      <div className="px-5 py-4 sm:px-6"><h3 className="mb-3 text-sm font-bold">{t.history}</h3>{loading ? <div className="h-12 animate-pulse rounded-xl bg-[#f0f2ed]"/> : history.length === 0 ? <p className="rounded-xl bg-[#f6f7f3] px-4 py-5 text-center text-sm text-[#788493]" data-testid="state-customer-history-empty">{t.noHistory}</p> : <div className="divide-y divide-[#edf0ed]">{history.map((order) => <Link key={order.id} href={`/order-details?id=${encodeURIComponent(order.id)}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm hover:text-[#167b70]" data-testid={`link-customer-order-${order.id}`}><span className="font-bold">{order.order_number} <span className="ms-2 text-xs font-normal text-[#788493]">{dateLabel(order.order_date, lang)}</span></span><span className="flex items-center gap-3">{money(order.total, order.currency_code, lang)}<span className="text-xs text-[#667486]">{labelFor(order.order_status, lang)}</span></span></Link>)}</div>}</div>
    </section>}
    <section className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[12px] bg-[#f1f3ed] text-[#68798a]"><Users size={18}/></span><h2 className="text-sm font-bold">{t.customers}</h2></div><label className="relative w-full sm:w-[300px]"><Search className="absolute start-3 top-1/2 -translate-y-1/2 text-[#8994a0]" size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} className={`${control} ps-10`} placeholder={t.searchCustomer} aria-label={t.searchCustomer} data-testid="input-search-customers"/></label></div>
      {loading ? <div className="space-y-3 p-5">{[1,2,3].map((x)=><div key={x} className="h-14 animate-pulse rounded-xl bg-[#f0f2ed]"/>)}</div> : error ? errorBlock : filteredCustomers.length === 0 ? <div className="px-6 py-14 text-center" data-testid="state-customers-empty"><span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-[#f2efe6] text-[#9a8050]"><Users size={20}/></span><h3 className="font-extrabold">{search ? t.noResults : t.emptyCustomers}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#788493]">{search ? t.noResultsSub : t.emptyCustomersSub}</p></div> :
      <div className="divide-y divide-[#edf0ed]">{filteredCustomers.map((customer) => <article key={customer.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6" data-testid={`row-customer-${customer.id}`}>
        <button type="button" onClick={() => void selectCustomer(customer)} className="flex min-w-0 flex-1 items-center gap-3 text-start" aria-label={`${t.history}: ${customer.name}`} data-testid={`button-customer-history-${customer.id}`}><span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[#eaf3ef] text-[#167b70]"><UserRound size={17}/></span><span className="min-w-0"><span className="block truncate text-sm font-extrabold text-[#24364a]">{customer.name}</span><span dir="ltr" className="mt-1 block text-start text-xs text-[#788493]">{customer.phone}</span></span></button>
        <div className="flex items-center gap-2"><span className="hidden text-xs text-[#788493] sm:block">{customer.email || ""}</span><button type="button" onClick={() => openCustomer(customer)} aria-label={`${t.edit}: ${customer.name}`} className="grid size-9 place-items-center rounded-xl border border-[#e3e8e5] text-[#647184] hover:border-[#d6b878]" data-testid={`button-edit-customer-${customer.id}`}><Pencil size={15}/></button></div>
      </article>)}</div>}
    </section>
    {customerModal && <div className="fixed inset-0 z-50 grid place-items-end bg-[#101b30]/35 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCustomerModal(false); }}><form onSubmit={(e) => void submitCustomer(e)} className="w-full max-w-lg rounded-t-[24px] border border-[#e1e7e4] bg-[#fffefa] p-5 shadow-2xl sm:rounded-[24px] sm:p-7" aria-label={t.customerForm} data-testid="form-customer">
      <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-extrabold tracking-[.16em] text-[#927a46]">{t.customers}</p><h2 className="mt-1 text-xl font-extrabold">{editingCustomer ? t.edit : t.addCustomer}</h2></div><button type="button" onClick={() => setCustomerModal(false)} aria-label={t.cancel} className="grid size-9 place-items-center rounded-full border border-[#e3e8e5]" data-testid="button-close-customer-form"><X size={16}/></button></div>
       <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-bold">{t.name}<input value={customerForm.name} onChange={(e)=>setCustomerForm({...customerForm,name:e.target.value})} className={control} required maxLength={120} aria-label={t.name} data-testid="input-customer-name"/></label><label className="grid gap-1.5 text-xs font-bold">{t.phone}<input type="tel" inputMode="tel" value={customerForm.phone} onChange={(e)=>setCustomerForm({...customerForm,phone:e.target.value})} className={control} required maxLength={24} dir="ltr" aria-label={t.phone} data-testid="input-customer-phone"/></label><label className="grid gap-1.5 text-xs font-bold">{t.email}<input type="email" maxLength={254} value={customerForm.email} onChange={(e)=>setCustomerForm({...customerForm,email:e.target.value})} className={control} dir="ltr" aria-label={t.email} data-testid="input-customer-email"/></label><label className="grid gap-1.5 text-xs font-bold sm:col-span-2">{t.notes}<textarea maxLength={1000} value={customerForm.notes} onChange={(e)=>setCustomerForm({...customerForm,notes:e.target.value})} className={`${control} min-h-20 resize-y`} aria-label={t.notes} data-testid="input-customer-notes"/></label></div>
      {formError && <p role="alert" className="mt-3 text-sm text-[#a34d43]" data-testid="error-customer-form">{formError}</p>}<button disabled={busy} type="submit" className="mt-5 w-full rounded-xl bg-[#101b30] py-3 text-sm font-bold text-white disabled:opacity-60" data-testid="button-save-customer">{busy ? t.saving : t.save}</button>
    </form></div>}
  </>);

  if (screen === "orders") return shell(<>
    <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-[10px] font-extrabold tracking-[.16em] text-[#927a46]">{t.orders}</p><h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight tracking-[-.055em] text-[#101b30]">{t.titleOrders}</h1><p className="mt-2 text-sm leading-6 text-[#738092]">{t.subOrders}</p></div><Link href="/create-order" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#101b30] px-5 text-sm font-bold text-white transition hover:bg-[#1b2c49]" data-testid="link-create-order"><Plus size={17}/>{t.addOrder}</Link></div>
    <section className={`${panel} overflow-hidden`}><div className="border-b border-[#edf0ed] px-4 py-4 sm:px-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><label className="relative w-full lg:max-w-[310px]"><Search className="absolute start-3 top-1/2 -translate-y-1/2 text-[#8994a0]" size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} className={`${control} ps-10`} placeholder={t.searchOrder} aria-label={t.searchOrder} data-testid="input-search-orders"/></label><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><label className="grid gap-1 text-[10px] font-bold text-[#778493]">{t.status}<select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className={`${control} min-w-[130px] py-2.5`} aria-label={t.status} data-testid="filter-order-status"><option value="">{t.all}</option>{orderStatuses.map((v)=><option key={v} value={v}>{labelFor(v,lang)}</option>)}</select></label><label className="grid gap-1 text-[10px] font-bold text-[#778493]">{t.payment}<select value={paymentFilter} onChange={(e)=>setPaymentFilter(e.target.value)} className={`${control} min-w-[130px] py-2.5`} aria-label={t.payment} data-testid="filter-payment-status"><option value="">{t.all}</option>{paymentStatuses.map((v)=><option key={v} value={v}>{labelFor(v,lang)}</option>)}</select></label><label className="grid gap-1 text-[10px] font-bold text-[#778493]">{t.dateFrom}<input type="date" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} className={`${control} py-2.5`} aria-label={t.dateFrom} data-testid="filter-date-from"/></label><label className="grid gap-1 text-[10px] font-bold text-[#778493]">{t.dateTo}<input type="date" value={toDate} onChange={(e)=>setToDate(e.target.value)} className={`${control} py-2.5`} aria-label={t.dateTo} data-testid="filter-date-to"/></label></div></div></div>
    {loading ? <div className="space-y-3 p-5">{[1,2,3].map((x)=><div key={x} className="h-16 animate-pulse rounded-xl bg-[#f0f2ed]"/>)}</div> : error ? errorBlock : filteredOrders.length === 0 ? <div className="px-6 py-14 text-center" data-testid="state-orders-empty"><span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-[#f2efe6] text-[#9a8050]"><FileText size={20}/></span><h2 className="font-extrabold">{search || statusFilter || paymentFilter || fromDate || toDate ? t.noResults : t.emptyOrders}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#788493]">{search || statusFilter || paymentFilter || fromDate || toDate ? t.noResultsSub : t.emptyOrdersSub}</p>{!search && !statusFilter && !paymentFilter && !fromDate && !toDate && <Link href="/create-order" className="mt-5 inline-flex rounded-xl bg-[#101b30] px-4 py-3 text-sm font-bold text-white" data-testid="link-empty-create-order">{t.addOrder}</Link>}</div> : <div className="divide-y divide-[#edf0ed]">{filteredOrders.map((order) => <Link key={order.id} href={`/order-details?id=${encodeURIComponent(order.id)}`} className="grid gap-3 px-5 py-4 transition hover:bg-[#fafaf6] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6" data-testid={`link-order-${order.id}`}>
      <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[#eaf3ef] text-[#167b70]"><FileText size={17}/></span><span><span className="block text-sm font-extrabold text-[#24364a]">{order.order_number}</span><span className="mt-1 block text-xs text-[#788493]">{order.customer_name_snapshot}<span dir="ltr" className="ms-2">{order.customer_phone_snapshot}</span></span></span></div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end"><span className="text-xs text-[#788493]">{dateLabel(order.order_date,lang)}</span><span className="rounded-full bg-[#f3f4ef] px-2.5 py-1 text-[10px] font-bold text-[#586679]">{labelFor(order.order_status,lang)}</span><span className="rounded-full bg-[#eaf5f0] px-2.5 py-1 text-[10px] font-bold text-[#197966]">{labelFor(order.payment_status,lang)}</span><span className="min-w-[100px] text-end text-sm font-extrabold text-[#17283c]">{money(order.total,order.currency_code,lang)}</span></div>
    </Link>)}</div>}</section>
  </>);

  if (screen === "create-order") return shell(<>
    <div className="mb-6 flex items-center gap-3"><Link href="/orders" aria-label={t.back} className="grid size-10 place-items-center rounded-xl border border-[#dfe5e7] bg-white text-[#526174]" data-testid="link-back-orders">{rtl ? <ArrowRight size={17}/> : <ArrowLeft size={17}/>}</Link><div><p className="text-[10px] font-extrabold tracking-[.16em] text-[#927a46]">{t.orders}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#101b30]">{details ? t.editTitle : t.createTitle}</h1></div></div>
    {loading ? loadingBlock : error ? errorBlock : !details && params.id ? <div className={`${panel} p-6 text-center`} data-testid="state-order-not-found">{t.notFound}</div> : <form onSubmit={(e)=>void submitOrder(e)} className="grid gap-5 lg:grid-cols-[1fr_340px]" data-testid="form-order">
      <div className="space-y-5">
        <section className={`${panel} p-5 sm:p-6`}><h2 className="mb-4 text-sm font-extrabold">{t.customer}</h2><label className="grid gap-1.5 text-xs font-bold">{t.chooseCustomer}<select required value={orderDraft.customer_id} onChange={(e)=>setOrderDraft({...orderDraft,customer_id:e.target.value})} className={control} aria-label={t.chooseCustomer} data-testid="select-order-customer"><option value="">{t.chooseCustomer}</option>{customers.map((customer)=><option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label><Link href="/customers" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#167b70]" data-testid="link-manage-customers"><Plus size={14}/>{t.addCustomer}</Link></section>
         <section className={`${panel} overflow-hidden`}><div className="flex items-center justify-between border-b border-[#edf0ed] px-5 py-4 sm:px-6"><h2 className="text-sm font-extrabold">{t.products}</h2><button type="button" disabled={orderDraft.items.length >= 50} onClick={()=>setOrderDraft({...orderDraft,items:[...orderDraft.items,{product_id:"",quantity:1}]})} className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe5e7] px-3 py-2 text-xs font-bold text-[#526174] disabled:opacity-50" aria-label={t.addProduct} data-testid="button-add-order-item"><PackagePlus size={15}/>{t.addProduct}</button></div>
           {products.length === 0 ? <p className="px-5 py-8 text-center text-sm text-[#788493]" data-testid="state-no-products">{t.noProducts}</p> : <div className="divide-y divide-[#edf0ed]">{orderDraft.items.map((item,index)=><div key={index} className="grid grid-cols-[1fr_90px_38px] items-end gap-2 px-4 py-4 sm:grid-cols-[1fr_115px_38px] sm:px-6" data-testid={`row-order-item-${index}`}><label className="grid min-w-0 gap-1.5 text-[10px] font-bold text-[#788493]">{t.item}<select value={item.product_id} onChange={(e)=>setOrderDraft({...orderDraft,items:orderDraft.items.map((row,i)=>i===index?{...row,product_id:e.target.value}:row)})} className={control} aria-label={`${t.item} ${index+1}`} data-testid={`select-product-${index}`}><option value="">{t.chooseProduct}</option>{products.filter((product)=>!orderDraft.items.some((row,rowIndex)=>rowIndex!==index&&row.product_id===product.id)).map((p)=><option key={p.id} value={p.id}>{p.name} — {money(p.selling_price,p.currency_code,lang)}</option>)}</select></label><label className="grid gap-1.5 text-[10px] font-bold text-[#788493]">{t.quantity}<input type="number" min="1" max="99" step="1" value={item.quantity} onChange={(e)=>setOrderDraft({...orderDraft,items:orderDraft.items.map((row,i)=>i===index?{...row,quantity:Number(e.target.value)}:row)})} className={control} aria-label={`${t.quantity} ${index+1}`} data-testid={`input-quantity-${index}`}/></label><button type="button" onClick={()=>setOrderDraft({...orderDraft,items:orderDraft.items.length>1?orderDraft.items.filter((_,i)=>i!==index):[{product_id:"",quantity:1}]})} aria-label={`${t.cancel} ${t.item}`} className="mb-0.5 grid size-10 place-items-center rounded-xl border border-[#e3e8e5] text-[#9b5a50]" data-testid={`button-remove-item-${index}`}><X size={15}/></button></div>)}</div>}</section>
        <section className={`${panel} grid gap-3 p-5 sm:grid-cols-3 sm:p-6`}><label className="grid gap-1.5 text-xs font-bold">{t.orderDate}<input type="date" value={orderDraft.order_date} onChange={(e)=>setOrderDraft({...orderDraft,order_date:e.target.value})} className={control} aria-label={t.orderDate} data-testid="input-order-date"/></label><label className="grid gap-1.5 text-xs font-bold">{t.status}<select value={orderDraft.order_status} onChange={(e)=>setOrderDraft({...orderDraft,order_status:e.target.value as OrderStatus})} className={control} aria-label={t.status} data-testid="select-create-order-status">{orderStatuses.map((v)=><option key={v} value={v}>{labelFor(v,lang)}</option>)}</select></label><label className="grid gap-1.5 text-xs font-bold">{t.payment}<select value={orderDraft.payment_status} onChange={(e)=>setOrderDraft({...orderDraft,payment_status:e.target.value as PaymentStatus})} className={control} aria-label={t.payment} data-testid="select-create-payment-status">{paymentStatuses.map((v)=><option key={v} value={v}>{labelFor(v,lang)}</option>)}</select></label></section>
      </div>
     <aside className="h-fit space-y-4 lg:sticky lg:top-5"><section className={`${panel} p-5 sm:p-6`}><h2 className="mb-4 text-sm font-extrabold">{t.total}</h2><label className="mb-3 grid gap-1.5 text-xs font-bold">{t.discount}<input inputMode="decimal" value={orderDraft.discount} onChange={(e)=>setOrderDraft({...orderDraft,discount:e.target.value})} className={control} aria-label={t.discount} data-testid="input-order-discount"/></label><label className="grid gap-1.5 text-xs font-bold">{t.shipping}<input inputMode="decimal" value={orderDraft.shipping_fee} onChange={(e)=>setOrderDraft({...orderDraft,shipping_fee:e.target.value})} className={control} aria-label={t.shipping} data-testid="input-order-shipping"/></label><div className="mt-4 space-y-2 border-t border-[#edf0ed] pt-4 text-sm"><div className="flex justify-between text-[#788493]"><span>{t.subtotal}</span>{exactMoney(orderPreview.subtotal,profile.currency_code,lang)}</div><div className="flex justify-between text-[#788493]"><span>{t.discount}</span>{orderPreview.discount === null ? <span>—</span> : <span>−{exactMoney(orderPreview.discount,profile.currency_code,lang)}</span>}</div><div className="flex justify-between text-[#788493]"><span>{t.shipping}</span>{orderPreview.shipping === null ? <span>—</span> : exactMoney(orderPreview.shipping,profile.currency_code,lang)}</div><div className="flex justify-between border-t border-[#edf0ed] pt-3 font-extrabold"><span>{t.total}</span>{orderPreview.total === null ? <span>—</span> : exactMoney(orderPreview.total,profile.currency_code,lang)}</div></div><p className="mt-4 rounded-xl bg-[#f4f5f0] p-3 text-[11px] leading-5 text-[#788493]">{t.previewNote}</p>
        {formError && <p role="alert" className="mt-3 text-xs text-[#a34d43]" data-testid="error-order-form">{formError}</p>}<button type="submit" disabled={busy||products.length===0} className="mt-4 w-full rounded-xl bg-[#101b30] py-3.5 text-sm font-bold text-white transition hover:bg-[#1b2c49] disabled:opacity-50" data-testid="button-save-order">{busy ? t.saving : t.create}</button></section></aside>
    </form>}
  </>);

  if (screen === "order-details") return shell(<>
     <div className="mb-6 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/orders" aria-label={t.back} className="grid size-10 place-items-center rounded-xl border border-[#dfe5e7] bg-white text-[#526174]" data-testid="link-back-orders"><ArrowLeft size={17}/></Link><div><p className="text-[10px] font-extrabold tracking-[.16em] text-[#927a46]">{t.orders}</p><h1 className="mt-1 text-2xl font-extrabold text-[#101b30]">{details?.order_number ?? t.details}</h1></div></div>{details && details.order_status !== "Cancelled" && <Link href={`/create-order?id=${encodeURIComponent(details.id)}`} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe5e7] bg-white px-4 py-2.5 text-xs font-bold text-[#526174]" data-testid="link-edit-order"><Pencil size={14}/>{t.edit}</Link>}</div>
    {noticeLine}{loading ? loadingBlock : error ? errorBlock : !details ? <div className={`${panel} p-7 text-center`} data-testid="state-order-not-found">{t.notFound}</div> : <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
      <section className={`${panel} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0ed] p-5 sm:p-6"><div><p className="text-xs text-[#788493]">{t.orderNo}</p><h2 className="mt-1 text-xl font-extrabold">{details.order_number}</h2><p className="mt-1 text-xs text-[#788493]">{dateLabel(details.order_date,lang)}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#f3f4ef] px-3 py-1.5 text-xs font-bold">{labelFor(details.order_status,lang)}</span><span className="rounded-full bg-[#eaf5f0] px-3 py-1.5 text-xs font-bold text-[#197966]">{labelFor(details.payment_status,lang)}</span></div></div>
        <div className="border-b border-[#edf0ed] p-5 sm:p-6"><p className="mb-2 text-xs font-bold text-[#788493]">{t.customer}</p><p className="font-extrabold">{details.customer_name_snapshot}</p><p dir="ltr" className="mt-1 text-start text-sm text-[#788493]">{details.customer_phone_snapshot}</p>{details.customer_email_snapshot && <p dir="ltr" className="mt-1 text-start text-sm text-[#788493]">{details.customer_email_snapshot}</p>}</div>
        <div className="p-5 sm:p-6"><h3 className="mb-4 text-sm font-extrabold">{t.lineItems}</h3><div className="divide-y divide-[#edf0ed]">{details.items.map((item)=><div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3" data-testid={`order-item-${item.id}`}><div><p className="text-sm font-bold">{item.product_name}</p><p className="mt-1 text-xs text-[#788493]">{item.quantity} × {money(item.unit_price,details.currency_code,lang)}</p></div><p className="text-sm font-extrabold">{money(item.line_total,details.currency_code,lang)}</p></div>)}</div><div className="mt-4 space-y-2 border-t border-[#edf0ed] pt-4 text-sm"><div className="flex justify-between text-[#788493]"><span>{t.subtotal}</span>{money(details.subtotal,details.currency_code,lang)}</div><div className="flex justify-between text-[#788493]"><span>{t.discount}</span><span>−{money(details.discount,details.currency_code,lang)}</span></div><div className="flex justify-between text-[#788493]"><span>{t.shipping}</span>{money(details.shipping_fee,details.currency_code,lang)}</div><div className="flex justify-between border-t border-[#edf0ed] pt-3 text-base font-extrabold"><span>{t.total}</span>{money(details.total,details.currency_code,lang)}</div></div></div>
      </section>
       <aside className="space-y-4"><section className={`${panel} p-5 sm:p-6`}><h2 className="mb-4 text-sm font-extrabold">{t.updateStatus}</h2><label className="mb-3 grid gap-1.5 text-xs font-bold">{t.status}<select disabled={details.order_status==="Cancelled"} value={statusDraft.order_status} onChange={(e)=>setStatusDraft({...statusDraft,order_status:e.target.value as OrderStatus})} className={control} aria-label={t.status} data-testid="select-order-status">{orderStatuses.map((v)=><option key={v} value={v}>{labelFor(v,lang)}</option>)}</select></label><label className="grid gap-1.5 text-xs font-bold">{t.payment}<select value={statusDraft.payment_status} onChange={(e)=>setStatusDraft({...statusDraft,payment_status:e.target.value as PaymentStatus})} className={control} aria-label={t.payment} data-testid="select-payment-status">{paymentStatuses.map((v)=><option key={v} value={v}>{labelFor(v,lang)}</option>)}</select></label>{formError && <p role="alert" className="mt-3 text-xs text-[#a34d43]" data-testid="error-status-update">{formError}</p>}<button type="button" disabled={busy} onClick={()=>void updateStatus()} className="mt-4 w-full rounded-xl bg-[#101b30] py-3 text-sm font-bold text-white disabled:opacity-60" data-testid="button-save-status">{busy?t.saving:t.saveStatus}</button>{details.order_status!=="Cancelled" && <button type="button" disabled={busy} onClick={()=>void updateStatus("Cancelled")} className="mt-2 w-full rounded-xl border border-[#ead2ce] py-3 text-sm font-bold text-[#a34d43] disabled:opacity-60" data-testid="button-cancel-order">{t.cancelOrder}</button>}</section>
        {details.invoice && <section className={`${panel} p-5 sm:p-6`}><p className="text-xs text-[#788493]">{t.invoiceNo}</p><p className="mt-1 font-extrabold">{details.invoice.invoice_number}</p><Link href={`/invoice?order=${encodeURIComponent(details.id)}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe5e7] px-4 py-3 text-sm font-bold text-[#526174] hover:border-[#d6b878]" data-testid="link-order-invoice"><FileText size={16}/>{t.viewInvoice}</Link></section>}
      </aside>
    </div>}
  </>);

  return <InvoiceScreen lang={lang} setLang={setLang} loading={loading} error={error} data={invoiceData} isPublic={Boolean(params.token)} invoiceToken={invoiceToken} retry={() => void load()} onSignOut={() => void signOut()} signingOut={signingOut} signOutError={signOutError} />;
}

function InvoiceScreen({ lang, setLang, loading, error, data, isPublic, invoiceToken, retry, onSignOut, signingOut, signOutError }: { lang: Lang; setLang: (lang: Lang) => void; loading: boolean; error: boolean; data: PublicInvoice | null; isPublic: boolean; invoiceToken: string; retry: () => void; onSignOut: () => void; signingOut: boolean; signOutError: boolean }) {
  const rtl = lang === "ar"; const t = C[lang];
  const [copied, setCopied] = useState(false);
  const control = "rounded-xl border border-[#dfe5e7] bg-white px-3.5 py-2.5 text-xs font-bold text-[#526174] transition hover:border-[#d6b878]";
  const ownerHeader = !isPublic && (
    <AppHeader
      language={lang}
      onLanguageChange={() => setLang(rtl ? "en" : "ar")}
      onSignOut={onSignOut}
      signingOut={signingOut}
    />
  );
  const signOutErrorLine = !isPublic && signOutError && (
    <p role="alert" className="mx-auto mt-3 max-w-[1320px] px-4 text-sm text-[#a34d43] sm:px-7" data-testid="error-sign-out">
      {t.signOutError}
    </p>
  );
  const shareUrl = typeof window === "undefined"
    ? ""
    : isPublic
      ? window.location.href
      : invoiceToken
        ? `${window.location.origin}/invoice?token=${encodeURIComponent(invoiceToken)}`
        : "";
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),2200);
    } catch {
      const field = document.createElement("textarea");
      field.value = shareUrl;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
      setCopied(true);
      window.setTimeout(()=>setCopied(false),2200);
    }
  }
  if (loading) return <main dir={rtl?"rtl":"ltr"} className="min-h-[100dvh] bg-[#f4f6f4]">
    {ownerHeader}{signOutErrorLine}<div className="px-4 py-8"><div className="mx-auto max-w-3xl space-y-4"><div className="h-10 w-48 animate-pulse rounded-xl bg-[#e6e9e4]"/><div className="h-[500px] animate-pulse rounded-[24px] bg-[#fffefa]"/></div></div>
  </main>;
  if (error) return <main dir={rtl?"rtl":"ltr"} className="min-h-[100dvh] bg-[#f4f6f4]">
    {ownerHeader}{signOutErrorLine}<div className="grid min-h-[calc(100dvh-72px)] place-items-center p-5"><div className="max-w-md rounded-[22px] border border-[#e1e7e4] bg-[#fffefa] p-8 text-center"><CircleAlert className="mx-auto mb-4 text-[#a34d43]"/><p className="text-sm text-[#a34d43]">{t.loadError}</p><button onClick={retry} className="mt-4 rounded-xl bg-[#101b30] px-4 py-2.5 text-sm font-bold text-white" aria-label={t.retry} data-testid="button-retry-invoice">{t.retry}</button></div></div>
  </main>;
  if (!data) return <main dir={rtl?"rtl":"ltr"} className="min-h-[100dvh] bg-[#f4f6f4]">
    {ownerHeader}{signOutErrorLine}<div className="grid min-h-[calc(100dvh-72px)] place-items-center p-5"><div className="max-w-md rounded-[22px] border border-[#e1e7e4] bg-[#fffefa] p-8 text-center" data-testid="state-invoice-not-found"><FileText className="mx-auto mb-4 text-[#9a8050]"/><h1 className="text-xl font-extrabold">{t.publicMissing}</h1><Link href={isPublic?"/":"/orders"} className="mt-5 inline-flex rounded-xl border border-[#dfe5e7] px-4 py-2.5 text-sm font-bold text-[#526174]" data-testid="link-invoice-back">{isPublic?t.back:t.toOrders}</Link></div></div>
  </main>;
  const shareText = `${t.invoiceTitle} ${data.invoice.invoice_number} — ${shareUrl}`;
  return <main dir={rtl?"rtl":"ltr"} className="min-h-[100dvh] bg-[#f4f6f4] text-[#172639]">
    {isPublic ? (
      <header className="print:hidden sticky top-0 z-40 border-b border-[#e3e8e5] bg-[#f8f9f6]/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-[68px] max-w-[960px] items-center justify-between gap-3 px-4 sm:px-7">
          <Link href="/" className="flex items-center gap-2.5" aria-label={t.brand} data-testid="link-invoice-brand">
            <span className="grid size-9 place-items-center rounded-xl bg-[#101b30] text-lg font-bold text-[#d6b878]">د</span>
            <span className="font-extrabold text-[#101b30]">{t.brand}</span>
          </Link>
          <button type="button" onClick={() => setLang(rtl ? "en" : "ar")} aria-label={rtl ? "Switch to English" : "التبديل إلى العربية"} className={control} data-testid="button-invoice-language">{t.language}</button>
        </div>
      </header>
    ) : (
      <>
        {ownerHeader}
        {signOutErrorLine}
        <div className="print:hidden mx-auto flex max-w-[1320px] flex-wrap justify-end gap-2 px-4 py-3 sm:px-7">
          <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer")} aria-label={t.whatsapp} className={control} data-testid="button-invoice-whatsapp">{t.whatsapp}</button>
          <button type="button" onClick={() => void copyLink()} aria-label={t.copy} className={control} data-testid="button-copy-invoice-link"><Clipboard size={15}/><span className="ms-1.5">{copied ? t.copied : t.copy}</span></button>
          <button type="button" onClick={() => window.print()} aria-label={t.print} className={control} data-testid="button-print-invoice"><Printer size={15}/><span className="ms-1.5 hidden sm:inline">{t.print}</span></button>
        </div>
      </>
    )}
    <div className="mx-auto max-w-[960px] px-4 py-6 sm:px-7 sm:py-10">
      <div className="mb-5 flex items-center justify-between"><p className="text-[10px] font-extrabold tracking-[.17em] text-[#927a46]">{isPublic?t.publicInvoice:t.ownerInvoice}</p>{!isPublic && <Link href="/orders" className="text-xs font-bold text-[#647184] hover:text-[#167b70]" data-testid="link-invoice-back-orders">{t.toOrders}</Link>}</div>
      <article className="overflow-hidden rounded-[22px] border border-[#e1e7e4] bg-[#fffefa] shadow-[0_16px_50px_rgba(28,48,56,.06)] print:rounded-none print:border-0 print:shadow-none" data-testid="invoice-document">
        <div className="relative overflow-hidden bg-[#101b30] px-6 py-8 text-[#f5f2e8] sm:px-10 sm:py-10"><div className="absolute -end-10 -top-20 size-56 rounded-full border border-[#d6b878]/20"/><div className="absolute -end-3 -top-14 size-40 rounded-full border border-[#d6b878]/15"/><div className="relative flex flex-wrap items-start justify-between gap-5"><div><p className="text-[10px] font-extrabold tracking-[.18em] text-[#d6b878]">{t.invoiceTitle}</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">{data.business.business_name || t.business}</h1></div><div className="min-w-[140px] rounded-2xl border border-white/15 bg-white/[.06] p-4"><p className="text-[10px] text-[#b9c1cd]">{t.invoiceNo}</p><p className="mt-1 text-sm font-extrabold" data-testid="text-invoice-number">{data.invoice.invoice_number}</p><p className="mt-3 text-[10px] text-[#b9c1cd]">{t.issued}</p><p className="mt-1 text-xs font-bold">{dateLabel(data.invoice.issued_at,lang)}</p></div></div></div>
        <div className="grid gap-5 border-b border-[#edf0ed] p-6 sm:grid-cols-2 sm:px-10 sm:py-7"><div><p className="mb-2 text-[10px] font-extrabold tracking-[.13em] text-[#927a46]">{t.billTo}</p><p className="font-extrabold">{data.customer.name}</p><p dir="ltr" className="mt-1 text-start text-sm text-[#788493]">{data.customer.phone}</p>{data.customer.email && <p dir="ltr" className="mt-1 text-start text-sm text-[#788493]">{data.customer.email}</p>}</div><div className="sm:text-end"><p className="mb-2 text-[10px] font-extrabold tracking-[.13em] text-[#927a46]">{t.orderNo}</p><p className="font-extrabold">{data.order.order_number}</p><p className="mt-1 text-sm text-[#788493]">{dateLabel(data.order.order_date,lang)}</p><div className="mt-3 flex flex-wrap gap-2 sm:justify-end"><span className="rounded-full bg-[#f3f4ef] px-3 py-1 text-[10px] font-bold">{labelFor(data.order.order_status,lang)}</span><span className="rounded-full bg-[#eaf5f0] px-3 py-1 text-[10px] font-bold text-[#197966]">{labelFor(data.order.payment_status,lang)}</span></div></div></div>
        <div className="px-5 py-5 sm:px-10 sm:py-7"><div className="hidden grid-cols-[1fr_80px_120px_120px] gap-3 border-b border-[#e8ece8] pb-3 text-[10px] font-extrabold text-[#788493] sm:grid"><span>{t.item}</span><span className="text-center">{t.quantity}</span><span className="text-end">{t.unitPrice}</span><span className="text-end">{t.total}</span></div><div className="divide-y divide-[#edf0ed]">{data.items.map((item,i)=><div key={`${item.product_name}-${i}`} className="grid grid-cols-[1fr_auto] gap-2 py-4 sm:grid-cols-[1fr_80px_120px_120px] sm:items-center sm:gap-3" data-testid={`invoice-item-${i}`}><div><p className="text-sm font-bold">{item.product_name}</p><p className="mt-1 text-[11px] text-[#788493] sm:hidden">{item.quantity} × {money(item.unit_price,data.order.currency_code,lang)}</p></div><span className="text-end text-sm font-bold sm:text-center">{item.quantity}</span><span className="hidden text-end text-sm text-[#788493] sm:inline">{money(item.unit_price,data.order.currency_code,lang)}</span><span className="text-end text-sm font-extrabold">{money(item.line_total,data.order.currency_code,lang)}</span></div>)}</div>
          <div className="ms-auto mt-5 max-w-sm space-y-2.5 border-t border-[#edf0ed] pt-5 text-sm"><div className="flex justify-between text-[#788493]"><span>{t.subtotal}</span>{money(data.order.subtotal,data.order.currency_code,lang)}</div><div className="flex justify-between text-[#788493]"><span>{t.discount}</span><span>−{money(data.order.discount,data.order.currency_code,lang)}</span></div><div className="flex justify-between text-[#788493]"><span>{t.shipping}</span>{money(data.order.shipping_fee,data.order.currency_code,lang)}</div><div className="flex justify-between border-t border-[#e8ece8] pt-3 text-base font-extrabold text-[#17283c]"><span>{t.totalDue}</span>{money(data.order.total,data.order.currency_code,lang)}</div></div>
          {data.invoice.payment_url && <div className="mt-6 rounded-xl border border-[#e2e9e3] bg-[#f7f8f3] p-4"><p className="text-xs font-bold text-[#526174]">{t.paymentLink}</p><a href={data.invoice.payment_url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm font-bold text-[#167b70] underline" data-testid="link-invoice-payment">{data.invoice.payment_url}</a></div>}
        </div><footer className="border-t border-[#edf0ed] bg-[#f8f9f6] px-6 py-4 text-center text-[10px] text-[#85909d] sm:px-10">{rtl?"شكرًا لثقتكم":"Thank you for your business."}</footer>
      </article>
    </div>
  </main>;
}

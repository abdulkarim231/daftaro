"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CircleAlert,
  Layers3,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { isLowStock, parseInventoryCount } from "../../lib/inventory";
import {
  calculateProductMetrics,
  formatMarginHundredths,
  formatMilliAmount,
  milliToDatabaseValue,
  normalizeMoneyInput,
  parseAmountToMilli,
} from "../../lib/money";
import { AppHeader } from "../../components/app-header";
import { useAppLanguage } from "../../hooks/use-app-language";

type Language = "ar" | "en";
type Product = {
  id: string;
  user_id: string;
  name: string;
  selling_price: string | number;
  materials_cost: string | number;
  packaging_cost: string | number;
  other_cost: string | number;
  available_quantity: number;
  low_stock_threshold: number;
  currency_code: string;
  created_at: string;
  updated_at: string;
};
type ProductDraft = {
  name: string;
  selling_price: string;
  materials_cost: string;
  packaging_cost: string;
  other_cost: string;
  available_quantity: string;
  low_stock_threshold: string;
};
type MetricInput = "selling_price" | "materials_cost" | "packaging_cost" | "other_cost";

const emptyDraft: ProductDraft = {
  name: "",
  selling_price: "",
  materials_cost: "",
  packaging_cost: "",
  other_cost: "",
  available_quantity: "0",
  low_stock_threshold: "5",
};

const copy = {
  ar: {
    brand: "دفترُك", section: "إدارة المنتجات", title: "منتجاتك، وتكلفتها الحقيقية",
    subtitle: "أضف تكلفة كل وحدة لتعرف ما يتبقى لك من كل عملية بيع.",
    add: "إضافة منتج", products: "قائمة المنتجات", currencyNote: "المبالغ بعملة نشاطك الأساسية",
    private: "بياناتك خاصة بحسابك", loading: "جارٍ تحميل المنتجات…",
    emptyTitle: "ابدأ بإضافة أول منتج", emptyText: "أدخل سعر البيع وتكاليف الوحدة لترى تكلفتها وربحها بوضوح.",
    loadError: "تعذر تحميل المنتجات. تحقق من اتصالك ثم أعد المحاولة.",
    retry: "إعادة المحاولة", name: "اسم المنتج", namePlaceholder: "مثال: علبة معمول",
    price: "سعر البيع للوحدة", materials: "تكلفة المواد للوحدة", packaging: "تكلفة التغليف للوحدة",
    other: "تكاليف أخرى للوحدة", otherHint: "مبلغ واحد يجمع أي تكلفة إضافية لكل وحدة.",
    totalCost: "التكلفة الكلية للوحدة", profit: "الربح لكل وحدة", margin: "هامش الربح",
    save: "حفظ المنتج", saving: "جارٍ الحفظ…", cancel: "إلغاء", edit: "تعديل",
    delete: "حذف", createTitle: "منتج جديد", editTitle: "تعديل المنتج",
    confirmDelete: "هل تريد حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.",
    confirm: "نعم، احذف المنتج", deleting: "جارٍ الحذف…",
    saveError: "تعذر حفظ المنتج. تحقق من البيانات والاتصال ثم أعد المحاولة.",
    deleteError: "تعذر حذف المنتج. أعد المحاولة.",
    saved: "تم حفظ المنتج بنجاح.", deleted: "تم حذف المنتج.",
    savedRefreshError: "تم حفظ المنتج، لكن تعذر تحديث القائمة. أعد تحميلها للمراجعة.",
    deletedRefreshError: "تم حذف المنتج، لكن تعذر تحديث القائمة. أعد تحميلها للمراجعة.",
    validationName: "اكتب اسمًا من حرف واحد إلى ١٢٠ حرفًا.",
    validationPrice: "أدخل سعر بيع أكبر من صفر وبحد أقصى ثلاث خانات عشرية.",
    validationCost: "أدخل كل تكلفة كقيمة صفر أو أكثر وبحد أقصى ثلاث خانات عشرية.",
    availableQuantity: "الكمية المتوفرة",
    lowStockThreshold: "نبّهني عند وصول الكمية إلى",
    units: "وحدة",
    lowStockTitle: "تنبيه انخفاض المخزون",
    lowStockSummary: "منتجات وصلت إلى حد التنبيه أو أقل. حدّث كمياتها لتجنب نفادها.",
    lowStockBadge: "مخزون منخفض",
    outOfStock: "نفد المخزون",
    stockHint: "يُخصم المخزون عند حفظ الطلب ويُعاد عند إلغائه.",
    validationStock: "أدخل الكمية وحدّ التنبيه كأعداد صحيحة من صفر إلى ٢٬١٤٧٬٤٨٣٬٦٤٧.",
    close: "إغلاق", profile: "ملف النشاط", ledger: "سجل الحركات", dashboard: "لوحة التحكم", orders: "الطلبات", customers: "العملاء", signOut: "تسجيل الخروج",
    signingOut: "جارٍ تسجيل الخروج…", signOutError: "تعذر تسجيل الخروج. أعد المحاولة.",
    positive: "ربح", negative: "خسارة", language: "EN", noProducts: "لا توجد منتجات بعد",
    direction: "rtl",
  },
  en: {
    brand: "Daftaro", section: "PRODUCT MANAGEMENT", title: "Products, with their real cost",
    subtitle: "Add the cost of each unit to understand what remains from every sale.",
    add: "Add product", products: "Your products", currencyNote: "Amounts use your business currency",
    private: "Your data is private to your account", loading: "Loading your products…",
    emptyTitle: "Start with your first product", emptyText: "Enter a selling price and unit costs to see the cost and profit clearly.",
    loadError: "We couldn't load products. Check your connection and try again.",
    retry: "Try again", name: "Product name", namePlaceholder: "For example, Maamoul box",
    price: "Selling price per unit", materials: "Materials cost per unit", packaging: "Packaging cost per unit",
    other: "Other cost per unit", otherHint: "One combined amount for any additional cost per unit.",
    totalCost: "Total unit cost", profit: "Profit per unit", margin: "Profit margin",
    save: "Save product", saving: "Saving…", cancel: "Cancel", edit: "Edit",
    delete: "Delete", createTitle: "New product", editTitle: "Edit product",
    confirmDelete: "Delete this product? This action cannot be undone.",
    confirm: "Yes, delete product", deleting: "Deleting…",
    saveError: "We couldn't save this product. Check the details and try again.",
    deleteError: "We couldn't delete this product. Please try again.",
    saved: "Product saved.", deleted: "Product deleted.",
    savedRefreshError: "The product was saved, but the list couldn't refresh. Reload to review.",
    deletedRefreshError: "The product was deleted, but the list couldn't refresh. Reload to review.",
    validationName: "Enter a name between 1 and 120 characters.",
    validationPrice: "Enter a selling price greater than zero with up to three decimal places.",
    validationCost: "Enter each cost as zero or more with up to three decimal places.",
    availableQuantity: "Available quantity",
    lowStockThreshold: "Alert me at or below",
    units: "units",
    lowStockTitle: "Low-stock alert",
    lowStockSummary: "Products reached their alert level or lower. Update quantities before they run out.",
    lowStockBadge: "Low stock",
    outOfStock: "Out of stock",
    stockHint: "Stock is reduced when an order is saved and restored if it is cancelled.",
    validationStock: "Enter whole numbers from 0 to 2,147,483,647 for stock and its alert level.",
    close: "Close", profile: "Business profile", ledger: "Transactions", dashboard: "Dashboard", orders: "Orders", customers: "Customers", signOut: "Sign out",
    signingOut: "Signing out…", signOutError: "We couldn't sign you out. Please try again.",
    positive: "Profit", negative: "Loss", language: "عربي", noProducts: "No products yet",
    direction: "ltr",
  },
} as const;

const controlClass =
  "w-full rounded-[13px] border border-[#dfe5e8] bg-[#fffefa] px-4 py-3 text-sm text-[#1d2c3d] outline-none transition placeholder:text-[#a3acb5] focus:border-[#168d78] focus:ring-4 focus:ring-[#168d78]/10 disabled:opacity-60";

export default function ProductsClient() {
  const router = useRouter();
  const [language, setLanguage] = useAppLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("KWD");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const rtl = language === "ar";
  const text = copy[language];
  const lowStockProducts = products.filter((product) =>
    isLowStock(product.available_quantity, product.low_stock_threshold),
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("arabic", rtl);
  }, [language, rtl]);

  const loadProducts = useCallback(async (currentUserId: string) => {
    setLoadError(false);
    const { data, error } = await supabase
      .from("business_products")
      .select("id,user_id,name,selling_price,materials_cost,packaging_cost,other_cost,available_quantity,low_stock_threshold,currency_code,created_at,updated_at")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(true);
      throw error;
    }
    setProducts((data ?? []) as Product[]);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      const currentUser = data.session.user;
      setUserId(currentUser.id);
      const { data: profile, error: profileError } = await supabase
        .from("business_profiles")
        .select("currency_code")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        router.replace("/auth/complete");
        return;
      }
      setCurrency(profile.currency_code);
      await loadProducts(currentUser.id);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [loadProducts, router]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setFormError("");
    setNotice(null);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setDraft({
      name: product.name,
      selling_price: String(product.selling_price),
      materials_cost: String(product.materials_cost),
      packaging_cost: String(product.packaging_cost),
      other_cost: String(product.other_cost),
      available_quantity: String(product.available_quantity),
      low_stock_threshold: String(product.low_stock_threshold),
    });
    setFormError("");
    setNotice(null);
    setModalOpen(true);
  }

  function updateAmount(field: MetricInput, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const name = draft.name.trim();
    if (name.length < 1 || name.length > 120) {
      setFormError(text.validationName);
      return;
    }
    const normalized = {
      selling_price: normalizeMoneyInput(draft.selling_price),
      materials_cost: normalizeMoneyInput(draft.materials_cost.trim() || "0"),
      packaging_cost: normalizeMoneyInput(draft.packaging_cost.trim() || "0"),
      other_cost: normalizeMoneyInput(draft.other_cost.trim() || "0"),
    };
    const selling = parseAmountToMilli(normalized.selling_price);
    const materials = parseAmountToMilli(normalized.materials_cost);
    const packaging = parseAmountToMilli(normalized.packaging_cost);
    const other = parseAmountToMilli(normalized.other_cost);
    if (selling === null || selling <= 0n) {
      setFormError(text.validationPrice);
      return;
    }
    if (materials === null || materials < 0n || packaging === null || packaging < 0n || other === null || other < 0n) {
      setFormError(text.validationCost);
      return;
    }
    const availableQuantity = parseInventoryCount(draft.available_quantity);
    const lowStockThreshold = parseInventoryCount(draft.low_stock_threshold);
    if (availableQuantity === null || lowStockThreshold === null) {
      setFormError(text.validationStock);
      return;
    }
    const metrics = calculateProductMetrics(
      normalized.selling_price,
      normalized.materials_cost,
      normalized.packaging_cost,
      normalized.other_cost,
    );
    if (!metrics || !userId) {
      if (!userId) router.replace("/auth");
      else setFormError(text.validationPrice);
      return;
    }
    setSaving(true);
    setNotice(null);
    const values = {
      name,
      selling_price: milliToDatabaseValue(metrics.sellingPriceMilli),
      materials_cost: milliToDatabaseValue(materials),
      packaging_cost: milliToDatabaseValue(packaging),
      other_cost: milliToDatabaseValue(other),
      available_quantity: availableQuantity,
      low_stock_threshold: lowStockThreshold,
      currency_code: editing?.currency_code ?? currency,
    };
    try {
      const result = editing
        ? await supabase.from("business_products").update(values).eq("id", editing.id).eq("user_id", userId)
        : await supabase.from("business_products").insert({ ...values, user_id: userId });
      if (result.error) throw result.error;
      setModalOpen(false);
      setEditing(null);
      setNotice({ kind: "success", message: text.saved });
      try {
        await loadProducts(userId);
      } catch {
        setNotice({ kind: "error", message: text.savedRefreshError });
      }
    } catch {
      setFormError(text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!deleting || !userId) return;
    setDeletingBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase
        .from("business_products")
        .delete()
        .eq("id", deleting.id)
        .eq("user_id", userId);
      if (error) throw error;
      setDeleting(null);
      setNotice({ kind: "success", message: text.deleted });
      try {
        await loadProducts(userId);
      } catch {
        setNotice({ kind: "error", message: text.deletedRefreshError });
      }
    } catch {
      setNotice({ kind: "error", message: text.deleteError });
    } finally {
      setDeletingBusy(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/");
    } catch {
      setNotice({ kind: "error", message: text.signOutError });
      setSigningOut(false);
    }
  }

  function amount(value: string | number | bigint, code = currency) {
    const milli =
      typeof value === "bigint" ? value : parseAmountToMilli(String(value));
    if (milli === null) return <span dir="ltr">—</span>;
    return (
      <span dir="ltr" className="inline-flex items-baseline gap-1.5">
        <span>{formatMilliAmount(milli, language)}</span>
        <span className="text-[10px] font-semibold tracking-wide text-[#7a8795]">{code}</span>
      </span>
    );
  }

  function productMetrics(product: Product) {
    return calculateProductMetrics(
      String(product.selling_price),
      String(product.materials_cost),
      String(product.packaging_cost),
      String(product.other_cost),
    );
  }

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[#f4f6f4] text-[#172639]">
      <AppHeader
        language={language}
        onLanguageChange={() => setLanguage(rtl ? "en" : "ar")}
        onSignOut={() => void signOut()}
        signingOut={signingOut}
      />

      <div className="mx-auto max-w-[1240px] px-4 pb-12 pt-7 sm:px-7 sm:pt-10">
        <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="reveal">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-px w-7 bg-[#c6a75c]" />
              <p className="text-[10px] font-extrabold tracking-[.16em] text-[#927a46]">{text.section}</p>
            </div>
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight tracking-[-.055em] text-[#101b30]">{text.title}</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#738092]">{text.subtitle}</p>
          </div>
          <button type="button" onClick={openCreate} className="outline-ring inline-flex min-h-12 items-center justify-center gap-2.5 rounded-[14px] bg-[#101b30] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(16,27,48,.12)] transition hover:bg-[#1b2c49]" data-testid="button-add-product">
            <Plus size={17} />{text.add}
          </button>
        </div>

        {notice && (
          <div role={notice.kind === "error" ? "alert" : "status"} aria-live="polite" data-testid={`status-${notice.kind}`} className={`mb-5 flex items-center gap-2.5 rounded-[13px] px-4 py-3 text-sm ${notice.kind === "error" ? "border border-[#f1d2cd] bg-[#fff2ef] text-[#a34d43]" : "border border-[#cde7df] bg-[#eaf6f1] text-[#197360]"}`}>
            {notice.kind === "success" ? <ShieldCheck size={16} /> : <CircleAlert size={16} />}{notice.message}
          </div>
        )}

        {!loading && !loadError && lowStockProducts.length > 0 && (
          <aside
            role="alert"
            aria-live="polite"
            data-testid="alert-low-stock"
            className="mb-5 rounded-[16px] border border-[#f0d5b5] bg-[#fff8ed] px-4 py-4 text-[#805a2c] sm:px-5"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px] bg-[#ffedcf] text-[#a66d1e]">
                <CircleAlert size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold" data-testid="text-low-stock-title">
                  {text.lowStockTitle} · {lowStockProducts.length}
                </h2>
                <p className="mt-1 text-xs leading-5">{text.lowStockSummary}</p>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                  {lowStockProducts.map((product) => (
                    <li key={product.id} data-testid={`low-stock-product-${product.id}`}>
                      {product.name}: {product.available_quantity} {text.units}
                      {product.available_quantity === 0 ? ` · ${text.outOfStock}` : ` · ${text.lowStockBadge}`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        )}

        <section className="overflow-hidden rounded-[22px] border border-[#e1e7e4] bg-[#fffefa] shadow-[0_12px_42px_rgba(28,48,56,.045)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[12px] bg-[#f1f3ed] text-[#68798a]"><Layers3 size={18} /></span>
              <div><h2 className="text-sm font-bold text-[#24364a]">{text.products}</h2><p className="mt-0.5 text-[11px] text-[#87919b]">{text.currencyNote}</p></div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#8a959e]"><ShieldCheck size={13} className="text-[#168d78]" />{text.private}</span>
          </div>

          {loading ? (
            <div className="space-y-3 p-5 sm:p-6" role="status" aria-live="polite" data-testid="status-loading">
              <span className="sr-only">{text.loading}</span>
              {[0, 1, 2].map((item) => <div key={item} className="grid animate-pulse gap-4 rounded-xl border border-[#eff1ed] p-4 sm:grid-cols-[1.2fr_1fr_1fr_1fr]"><span className="h-4 w-32 rounded-full bg-[#e9ede8]" /><span className="h-4 w-24 rounded-full bg-[#e9ede8]" /><span className="h-4 w-28 rounded-full bg-[#e9ede8]" /><span className="h-4 w-20 rounded-full bg-[#e9ede8]" /></div>)}
            </div>
          ) : loadError ? (
            <div className="px-6 py-16 text-center" role="alert" data-testid="state-load-error">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fff1ed] text-[#a34d43]"><CircleAlert size={21} /></span>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#7b6260]">{text.loadError}</p>
              <button type="button" onClick={() => void initialize()} className="outline-ring mt-4 rounded-xl border border-[#dfe5e2] bg-white px-4 py-2.5 text-xs font-bold text-[#34485a] transition hover:border-[#168d78]" data-testid="button-retry-load">{text.retry}</button>
            </div>
          ) : products.length === 0 ? (
            <div className="px-6 py-16 text-center sm:py-20" data-testid="state-empty">
              <span className="relative mx-auto grid size-[62px] place-items-center rounded-[21px] bg-[#f2f3ec] text-[#8b794e]">
                <Package size={25} /><span className="absolute -bottom-1 -end-1 grid size-6 place-items-center rounded-full border-2 border-[#fffefa] bg-[#168d78] text-white"><Plus size={13} /></span>
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-[#26384a]">{text.emptyTitle}</h3>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#82909a]">{text.emptyText}</p>
              <button type="button" onClick={openCreate} className="outline-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-[#101b30] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#1b2c49]" data-testid="button-empty-add"><Plus size={15} />{text.add}</button>
              <p className="sr-only" data-testid="text-empty-products">{text.noProducts}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#edf0ed]">
              {products.map((product) => {
                const metrics = productMetrics(product);
                const isPositive = metrics ? metrics.unitProfitMilli >= 0n : false;
                const productIsLow = isLowStock(product.available_quantity, product.low_stock_threshold);
                return (
                  <article key={product.id} data-testid={`row-product-${product.id}`} className="px-4 py-5 transition hover:bg-[#fbfcf8] sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3 lg:w-[23%]">
                        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-[13px] bg-[#f1f3ed] text-[#927a46]"><Package size={18} /></span>
                        <div className="min-w-0">
                          <h3 className="break-words text-[14px] font-bold leading-5 text-[#25364a]" data-testid={`text-product-name-${product.id}`}>{product.name}</h3>
                          <p className="mt-1 text-[10px] text-[#8b969e]">{text.price}: {amount(product.selling_price, product.currency_code)}</p>
                          {productIsLow && (
                            <span data-testid={`badge-low-stock-${product.id}`} className="mt-2 inline-flex rounded-full bg-[#fff0dc] px-2.5 py-1 text-[10px] font-bold text-[#9a641e]">
                              {product.available_quantity === 0 ? text.outOfStock : text.lowStockBadge}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
                        <div className="rounded-[13px] bg-[#f7f8f4] px-3 py-3">
                          <p className="text-[10px] font-medium text-[#87919b]">{text.totalCost}</p>
                          <p className="mt-1.5 text-[12px] font-bold text-[#344258]" data-testid={`text-total-cost-${product.id}`}>{metrics ? amount(metrics.totalCostMilli, product.currency_code) : "—"}</p>
                        </div>
                        <div className={`rounded-[13px] px-3 py-3 ${isPositive ? "bg-[#eaf6f1]" : "bg-[#fff2ef]"}`}>
                          <p className="text-[10px] font-medium text-[#87919b]">{text.profit}</p>
                          <p className={`mt-1.5 text-[12px] font-bold ${isPositive ? "text-[#197360]" : "text-[#a34d43]"}`} data-testid={`text-unit-profit-${product.id}`}>{metrics ? amount(metrics.unitProfitMilli, product.currency_code) : "—"}</p>
                        </div>
                        <div className="rounded-[13px] bg-[#f7f8f4] px-3 py-3">
                          <p className="text-[10px] font-medium text-[#87919b]">{text.margin}</p>
                          <p className={`mt-1.5 text-[12px] font-bold ${isPositive ? "text-[#344258]" : "text-[#a34d43]"}`} data-testid={`text-profit-margin-${product.id}`}>{metrics ? formatMarginHundredths(metrics.marginHundredths, language) : "—"}</p>
                        </div>
                        <div className={`rounded-[13px] px-3 py-3 ${productIsLow ? "bg-[#fff5e8]" : "bg-[#f7f8f4]"}`}>
                          <p className="text-[10px] font-medium text-[#87919b]">{text.availableQuantity}</p>
                          <p className={`mt-1.5 text-[12px] font-bold ${productIsLow ? "text-[#9a641e]" : "text-[#344258]"}`} data-testid={`text-available-quantity-${product.id}`}>
                            {product.available_quantity} {text.units}
                          </p>
                          <p className="mt-1 text-[9px] text-[#87919b]">
                            {text.lowStockThreshold}: {product.low_stock_threshold}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 lg:ms-2">
                        <button type="button" onClick={() => openEdit(product)} aria-label={`${text.edit}: ${product.name}`} className="outline-ring inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-[#e5e9e5] px-3 text-[11px] font-semibold text-[#687789] transition hover:bg-[#edf4f0] hover:text-[#168d78]" data-testid={`button-edit-${product.id}`}><Pencil size={14} />{text.edit}</button>
                        <button type="button" onClick={() => setDeleting(product)} aria-label={`${text.delete}: ${product.name}`} className="outline-ring inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-[#efe2de] px-3 text-[11px] font-semibold text-[#9c5c54] transition hover:bg-[#fff0ed]" data-testid={`button-delete-${product.id}`}><Trash2 size={14} />{text.delete}</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-5 flex items-center justify-center gap-2 text-[10px] text-[#919ba1]">
          <ShieldCheck size={13} className="text-[#168d78]" />{text.private}
        </footer>
      </div>

      {modalOpen && (
        <div data-testid="overlay-product-form" className="fixed inset-0 z-50 flex items-end justify-center bg-[#101b30]/35 p-0 backdrop-blur-[3px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[24px] border border-[#e6e9e3] bg-[#fffefa] shadow-[0_24px_80px_rgba(16,27,48,.22)] sm:max-w-[600px] sm:rounded-[24px]" data-testid="dialog-product-form">
            <div className="flex items-center justify-between border-b border-[#edf0ed] px-5 py-4 sm:px-7">
              <div><p className="text-[10px] font-extrabold tracking-[.15em] text-[#927a46]">{text.section}</p><h2 id="product-dialog-title" className="mt-1 text-lg font-extrabold text-[#172639]">{editing ? text.editTitle : text.createTitle}</h2></div>
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} aria-label={text.close} className="outline-ring grid size-9 place-items-center rounded-full text-[#788493] transition hover:bg-[#f1f3ed]" data-testid="button-close-product-form"><X size={17} /></button>
            </div>
            <form onSubmit={saveProduct} className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
              <div>
                <label htmlFor="product-name" className="mb-1.5 block text-xs font-bold text-[#344258]">{text.name}</label>
                <input id="product-name" type="text" required maxLength={120} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={text.namePlaceholder} className={controlClass} data-testid="input-product-name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="product-available-quantity" className="mb-1.5 block text-xs font-bold text-[#344258]">{text.availableQuantity}</label>
                  <input
                    id="product-available-quantity"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    value={draft.available_quantity}
                    onChange={(event) => setDraft((current) => ({ ...current, available_quantity: event.target.value }))}
                    className={controlClass}
                    dir="auto"
                    data-testid="input-available-quantity"
                  />
                </div>
                <div>
                  <label htmlFor="product-low-stock-threshold" className="mb-1.5 block text-xs font-bold text-[#344258]">{text.lowStockThreshold}</label>
                  <input
                    id="product-low-stock-threshold"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    value={draft.low_stock_threshold}
                    onChange={(event) => setDraft((current) => ({ ...current, low_stock_threshold: event.target.value }))}
                    className={controlClass}
                    dir="auto"
                    data-testid="input-low-stock-threshold"
                  />
                </div>
                <p className="text-[10px] leading-5 text-[#87919b] sm:col-span-2">{text.stockHint}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["selling_price", text.price, true],
                  ["materials_cost", text.materials, false],
                  ["packaging_cost", text.packaging, false],
                  ["other_cost", text.other, false],
                ] as const).map(([field, label, required]) => (
                  <div key={field}>
                    <label htmlFor={`product-${field}`} className="mb-1.5 block text-xs font-bold text-[#344258]">{label}</label>
                    <div className="relative">
                      <input id={`product-${field}`} type="text" inputMode="decimal" autoComplete="off" maxLength={15} required={required} value={draft[field]} onChange={(event) => updateAmount(field, event.target.value)} placeholder="0.000" className={`${controlClass} pe-14`} dir="auto" data-testid={`input-${field}`} />
                      <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[10px] font-bold tracking-wide text-[#8a959e]">{editing?.currency_code ?? currency}</span>
                    </div>
                    {field === "other_cost" && <p className="mt-1.5 text-[10px] leading-5 text-[#87919b]">{text.otherHint}</p>}
                  </div>
                ))}
              </div>
              {formError && <p role="alert" aria-live="polite" className="rounded-xl border border-[#f1d2cd] bg-[#fff2ef] px-4 py-3 text-xs leading-5 text-[#a34d43]" data-testid="status-form-error">{formError}</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-[#edf0ed] pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="outline-ring rounded-xl border border-[#dfe5e2] px-5 py-3 text-xs font-bold text-[#687789] transition hover:bg-[#f7f8f4] disabled:opacity-60" data-testid="button-cancel-product">{text.cancel}</button>
                <button type="submit" disabled={saving} className="outline-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[#101b30] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#1b2c49] disabled:cursor-wait disabled:opacity-65" data-testid="button-save-product">{saving ? text.saving : text.save}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleting && (
        <div data-testid="overlay-delete-product" className="fixed inset-0 z-50 flex items-center justify-center bg-[#101b30]/35 p-4 backdrop-blur-[3px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingBusy) setDeleting(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-[420px] rounded-[22px] border border-[#e6e9e3] bg-[#fffefa] p-6 shadow-[0_24px_80px_rgba(16,27,48,.22)]" data-testid="dialog-delete-product">
            <span className="grid size-11 place-items-center rounded-[14px] bg-[#fff0ed] text-[#a34d43]"><Trash2 size={19} /></span>
            <h2 id="delete-title" className="mt-4 text-lg font-extrabold text-[#172639]">{text.delete}: {deleting.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[#738092]">{text.confirmDelete}</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeleting(null)} disabled={deletingBusy} className="outline-ring rounded-xl border border-[#dfe5e2] px-4 py-3 text-xs font-bold text-[#687789] transition hover:bg-[#f7f8f4] disabled:opacity-60" data-testid="button-cancel-delete">{text.cancel}</button>
              <button type="button" onClick={() => void deleteProduct()} disabled={deletingBusy} className="outline-ring rounded-xl bg-[#a34d43] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#8e3f37] disabled:opacity-65" data-testid="button-confirm-delete">{deletingBusy ? text.deleting : text.confirm}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  FilePlus2,
  Pencil,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { calculateFinancialSummaries } from "../../lib/financial-summary";
import {
  formatMarginHundredths,
  formatMilliAmount,
  parseAmountToMilli,
} from "../../lib/money";
import { AppHeader } from "../../components/app-header";
import { useAppLanguage } from "../../hooks/use-app-language";
import { supabase } from "../../lib/supabase";

type Language = "ar" | "en";
type TransactionType = "income" | "expense";
type Category =
  | "materials"
  | "packaging"
  | "shipping"
  | "marketing"
  | "rent"
  | "salaries"
  | "utilities"
  | "other";

type Transaction = {
  id: string;
  user_id: string;
  transaction_type: TransactionType;
  amount: string | number;
  currency_code: string;
  transaction_date: string;
  description: string;
  category: Category | null;
  created_at: string;
  updated_at: string;
};

type Draft = {
  transaction_type: TransactionType;
  amount: string;
  transaction_date: string;
  description: string;
  category: Category | "";
};

const TRANSACTION_PAGE_SIZE = 500;

const categoryOptions: { value: Category; ar: string; en: string }[] = [
  { value: "materials", ar: "مواد خام", en: "Materials" },
  { value: "packaging", ar: "تغليف", en: "Packaging" },
  { value: "shipping", ar: "شحن وتوصيل", en: "Shipping" },
  { value: "marketing", ar: "تسويق", en: "Marketing" },
  { value: "rent", ar: "إيجار", en: "Rent" },
  { value: "salaries", ar: "رواتب", en: "Salaries" },
  { value: "utilities", ar: "خدمات ومرافق", en: "Utilities" },
  { value: "other", ar: "أخرى", en: "Other" },
];

const copy = {
  ar: {
    brand: "دفترُك",
    section: "سجل النشاط",
    title: "الحركات المالية",
    subtitle: "سجّل ما يدخل إلى نشاطك وما يُنفق عليه، في مكان واحد واضح.",
    add: "إضافة حركة",
    income: "دخل",
    expense: "مصروف",
    type: "نوع الحركة",
    amount: "المبلغ",
    date: "التاريخ",
    description: "الوصف",
    descriptionPlaceholder: "مثال: طلب حلويات — أم نورة",
    category: "التصنيف",
    chooseCategory: "اختر التصنيف",
    save: "حفظ الحركة",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    edit: "تعديل",
    delete: "حذف",
    confirmDelete: "هل تريد حذف هذه الحركة؟ لا يمكن التراجع عن هذا الإجراء.",
    confirm: "نعم، احذفها",
    deleting: "جارٍ الحذف…",
    tableDate: "التاريخ",
    tableDetails: "التفاصيل",
    tableCategory: "التصنيف",
    tableAmount: "المبلغ",
    tableActions: "الإجراءات",
    loading: "جارٍ تحميل سجلّك…",
    emptyTitle: "ابدأ بتسجيل أول حركة",
    emptyText: "أضف دخلًا أو مصروفًا لتبدأ ببناء سجل واضح لنشاطك.",
    loadError: "تعذر تحميل الحركات. تحقق من اتصالك ثم أعد المحاولة.",
    saveError: "تعذر حفظ الحركة. تحقق من البيانات والاتصال ثم أعد المحاولة.",
    deleteError: "تعذر حذف الحركة. أعد المحاولة.",
    savedRefreshError: "تم حفظ الحركة، لكن تعذر تحديث السجل. أعد تحميله للمراجعة.",
    deletedRefreshError: "تم حذف الحركة، لكن تعذر تحديث السجل. أعد تحميله للمراجعة.",
    validationAmount: "أدخل مبلغًا أكبر من صفر وبحد أقصى ثلاث خانات عشرية.",
    validationDescription: "اكتب وصفًا من حرف واحد إلى ٢٥٠ حرفًا.",
    validationCategory: "اختر تصنيفًا للمصروف.",
    validationDate: "اختر تاريخًا صحيحًا.",
    saved: "تم حفظ الحركة بنجاح.",
    deleted: "تم حذف الحركة.",
    currencyNote: "تُسجّل المبالغ بعملة نشاطك الأساسية.",
    private: "بياناتك المالية خاصة بحسابك.",
    language: "EN",
    close: "إغلاق",
    newIncome: "دخل جديد",
    newExpense: "مصروف جديد",
    editTransaction: "تعديل الحركة",
    expenseLabel: "مصروف",
    incomeLabel: "دخل",
    noCategory: "—",
    amountPlaceholder: "0.000",
    back: "العودة",
    dashboard: "لوحة التحكم",
    profile: "ملف النشاط",
    products: "المنتجات وتكاليفها",
    orders: "الطلبات",
    customers: "العملاء",
    signOut: "تسجيل الخروج",
    signingOut: "جارٍ تسجيل الخروج…",
    signOutError: "تعذر تسجيل الخروج. أعد المحاولة.",
    summaryEyebrow: "الملخص المالي",
    summaryTitle: "النتائج المالية",
    summaryIntro: "إجمالي الإيرادات والمصروفات وصافي الربح من الحركات المسجلة.",
    summaryEmpty: "لا توجد حركات مالية بعد.",
    summaryUnavailable: "تعذر تحديث الملخص. أعد تحميل سجل المعاملات للمراجعة.",
    summaryIncome: "إجمالي الإيرادات",
    summaryExpenses: "إجمالي المصروفات",
    summaryNet: "صافي الربح",
    summaryMargin: "هامش الربح",
    summaryMarginUnavailable: "غير متاح لعدم وجود إيرادات",
    summaryCurrencyNote: "تُعرض كل عملة منفصلة دون تحويل بينها.",
  },
  en: {
    brand: "Daftaro",
    section: "BUSINESS LEDGER",
    title: "Transactions",
    subtitle: "Keep the money coming in and going out of your business in one clear place.",
    add: "Add transaction",
    income: "Income",
    expense: "Expense",
    type: "Transaction type",
    amount: "Amount",
    date: "Date",
    description: "Description",
    descriptionPlaceholder: "For example, dessert order — Umm Noura",
    category: "Category",
    chooseCategory: "Choose a category",
    save: "Save transaction",
    saving: "Saving…",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    confirmDelete: "Delete this transaction? This action cannot be undone.",
    confirm: "Yes, delete",
    deleting: "Deleting…",
    tableDate: "Date",
    tableDetails: "Details",
    tableCategory: "Category",
    tableAmount: "Amount",
    tableActions: "Actions",
    loading: "Loading your ledger…",
    emptyTitle: "Start with your first transaction",
    emptyText: "Add income or an expense to begin keeping a clear record of your business.",
    loadError: "We couldn't load transactions. Check your connection and try again.",
    saveError: "We couldn't save this transaction. Check the details and try again.",
    deleteError: "We couldn't delete this transaction. Please try again.",
    savedRefreshError: "The transaction was saved, but the ledger couldn't refresh. Reload it to review.",
    deletedRefreshError: "The transaction was deleted, but the ledger couldn't refresh. Reload it to review.",
    validationAmount: "Enter an amount greater than zero with up to three decimal places.",
    validationDescription: "Enter a description between 1 and 250 characters.",
    validationCategory: "Choose a category for this expense.",
    validationDate: "Choose a valid date.",
    saved: "Transaction saved.",
    deleted: "Transaction deleted.",
    currencyNote: "New entries use your business's primary currency.",
    private: "Your financial records are private to your account.",
    language: "عربي",
    close: "Close",
    newIncome: "New income",
    newExpense: "New expense",
    editTransaction: "Edit transaction",
    expenseLabel: "Expense",
    incomeLabel: "Income",
    noCategory: "—",
    amountPlaceholder: "0.000",
    back: "Back",
    dashboard: "Dashboard",
    profile: "Business profile",
    products: "Products and costs",
    orders: "Orders",
    customers: "Customers",
    signOut: "Sign out",
    signingOut: "Signing out…",
    signOutError: "We couldn't sign you out. Please try again.",
    summaryEyebrow: "FINANCIAL SUMMARY",
    summaryTitle: "Financial results",
    summaryIntro: "Total income, expenses, and net profit from recorded transactions.",
    summaryEmpty: "No transactions have been recorded yet.",
    summaryUnavailable: "The summary could not refresh. Reload your transaction ledger to review it.",
    summaryIncome: "Total income",
    summaryExpenses: "Total expenses",
    summaryNet: "Net profit",
    summaryMargin: "Profit margin",
    summaryMarginUnavailable: "Unavailable because there is no income",
    summaryCurrencyNote: "Each currency is shown separately, without conversion.",
  },
} as const;

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function normalizeAmount(value: string) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace("٫", ".");
}

function formatDate(value: string, language: Language) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(language === "ar" ? "ar-KW" : "en-KW", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function TransactionsClient() {
  const router = useRouter();
  const [language, setLanguage] = useAppLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("KWD");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState<Draft>({
    transaction_type: "income",
    amount: "",
    transaction_date: today(),
    description: "",
    category: "",
  });

  const rtl = language === "ar";
  const text = copy[language];
  const financialSummaries = useMemo(
    () => calculateFinancialSummaries(transactions, currency),
    [transactions, currency],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("arabic", rtl);
  }, [language, rtl]);

  const loadTransactions = useCallback(async (currentUserId: string) => {
    setLoadError(false);
    const allTransactions: Transaction[] = [];
    try {
      for (let offset = 0; ; offset += TRANSACTION_PAGE_SIZE) {
        const { data, error } = await supabase
          .from("financial_transactions")
          .select("id,user_id,transaction_type,amount,currency_code,transaction_date,description,category,created_at,updated_at")
          .eq("user_id", currentUserId)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + TRANSACTION_PAGE_SIZE - 1);
        if (error) throw error;

        const page = (data ?? []) as Transaction[];
        allTransactions.push(...page);
        if (page.length < TRANSACTION_PAGE_SIZE) break;
      }
    } catch (error) {
      setLoadError(true);
      throw error;
    }
    setTransactions(allTransactions);
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
      await loadTransactions(currentUser.id);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [loadTransactions, router]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  function openCreate(type: TransactionType = "income") {
    setEditing(null);
    setFormError("");
    setNotice(null);
    setDraft({
      transaction_type: type,
      amount: "",
      transaction_date: today(),
      description: "",
      category: "",
    });
    setModalOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setFormError("");
    setNotice(null);
    setDraft({
      transaction_type: transaction.transaction_type,
      amount: String(transaction.amount),
      transaction_date: transaction.transaction_date,
      description: transaction.description,
      category: transaction.category ?? "",
    });
    setModalOpen(true);
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const amount = normalizeAmount(draft.amount);
    const amountMilli = parseAmountToMilli(amount);
    const description = draft.description.trim();
    if (amountMilli === null || amountMilli <= 0n) {
      setFormError(text.validationAmount);
      return;
    }
    if (description.length < 1 || description.length > 250) {
      setFormError(text.validationDescription);
      return;
    }
    if (draft.transaction_type === "expense" && !draft.category) {
      setFormError(text.validationCategory);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.transaction_date) || Number.isNaN(Date.parse(`${draft.transaction_date}T00:00:00`))) {
      setFormError(text.validationDate);
      return;
    }
    if (!userId) {
      router.replace("/auth");
      return;
    }

    setSaving(true);
    setNotice(null);
    const values = {
      transaction_type: draft.transaction_type,
      amount,
      currency_code: editing?.currency_code ?? currency,
      transaction_date: draft.transaction_date,
      description,
      category: draft.transaction_type === "expense" ? draft.category : null,
    };
    try {
      const result = editing
        ? await supabase.from("financial_transactions").update(values).eq("id", editing.id).eq("user_id", userId)
        : await supabase.from("financial_transactions").insert({ ...values, user_id: userId });
      if (result.error) throw result.error;
      setModalOpen(false);
      setEditing(null);
      setNotice({ kind: "success", message: text.saved });
      try {
        await loadTransactions(userId);
      } catch {
        setNotice({ kind: "error", message: text.savedRefreshError });
      }
    } catch {
      setFormError(text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction() {
    if (!deleting || !userId) return;
    setDeletingBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase
        .from("financial_transactions")
        .delete()
        .eq("id", deleting.id)
        .eq("user_id", userId);
      if (error) throw error;
      setDeleting(null);
      setNotice({ kind: "success", message: text.deleted });
      setTransactions((current) => current.filter((transaction) => transaction.id !== deleting.id));
      try {
        await loadTransactions(userId);
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

  function categoryLabel(category: Category | null) {
    const option = categoryOptions.find((item) => item.value === category);
    return option ? (rtl ? option.ar : option.en) : text.noCategory;
  }

  function amountLabel(amount: string | number, currencyCode: string) {
    const amountMilli = parseAmountToMilli(String(amount));
    if (amountMilli === null) return <span dir="ltr">—</span>;
    const formatted = formatMilliAmount(amountMilli, language);
    return <span dir="ltr" className="inline-flex items-baseline gap-1.5"><span>{formatted}</span><span className="text-[10px] font-semibold tracking-wide text-[#7a8795]">{currencyCode}</span></span>;
  }

  const controlClass = "w-full rounded-[13px] border border-[#dfe5e8] bg-[#fffefa] px-4 py-3 text-sm text-[#1d2c3d] outline-none transition placeholder:text-[#a3acb5] focus:border-[#168d78] focus:ring-4 focus:ring-[#168d78]/10";

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
          <button
            type="button"
            onClick={() => openCreate()}
            className="outline-ring inline-flex min-h-12 items-center justify-center gap-2.5 rounded-[14px] bg-[#101b30] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(16,27,48,.12)] transition hover:-translate-y-0.5 hover:bg-[#1b2c49]"
            data-testid="button-add-transaction"
          >
            <Plus size={17} />
            {text.add}
          </button>
        </div>

        {notice && (
          <div role={notice.kind === "error" ? "alert" : "status"} aria-live="polite" data-testid={`status-${notice.kind}`} className={`mb-5 flex items-center gap-2.5 rounded-[13px] px-4 py-3 text-sm ${notice.kind === "error" ? "border border-[#f1d2cd] bg-[#fff2ef] text-[#a34d43]" : "border border-[#cde7df] bg-[#eaf6f1] text-[#197360]"}`}>
            {notice.kind === "success" ? <Check size={16} /> : <CircleAlert size={16} />}
            {notice.message}
          </div>
        )}

        <section aria-labelledby="financial-summary-title" className="mb-5 overflow-hidden rounded-[22px] border border-[#dfe7e1] bg-[#fffefa] shadow-[0_10px_34px_rgba(28,48,56,.04)]" data-testid="section-financial-summary">
          <div className="flex flex-col gap-2 border-b border-[#edf0ed] px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="mb-1 text-[9px] font-extrabold tracking-[.16em] text-[#a1864b]">{text.summaryEyebrow}</p>
              <h2 id="financial-summary-title" className="text-base font-extrabold tracking-[-.025em] text-[#17283c]">{text.summaryTitle}</h2>
              <p className="mt-1 text-[11px] leading-5 text-[#7d8992]">{text.summaryIntro}</p>
            </div>
            <p className="text-[10px] leading-5 text-[#8a959e]">{text.summaryCurrencyNote}</p>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5" role="status" aria-label={text.loading} data-testid="status-summary-loading">
              {[0, 1, 2, 3].map((metric) => <div key={metric} className="h-[76px] animate-pulse rounded-[14px] bg-[#f0f2ed]" />)}
            </div>
          ) : loadError ? (
            <p className="px-5 py-6 text-center text-xs font-medium leading-6 text-[#a34d43]" role="alert" data-testid="state-summary-error">{text.summaryUnavailable}</p>
          ) : financialSummaries.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs font-medium leading-6 text-[#78858f]" data-testid="state-summary-empty">{text.summaryEmpty}</p>
          ) : (
            <div className="divide-y divide-[#edf0ed]">
              {financialSummaries.map((summary) => (
                <section key={summary.currency_code} className="px-4 py-4 sm:px-6 sm:py-5" data-testid={`summary-group-${summary.currency_code}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-px w-5 bg-[#d6b878]" />
                    <h3 className="text-[11px] font-extrabold tracking-[.12em] text-[#526174]" data-testid={`summary-currency-${summary.currency_code}`}>
                      {summary.currency_code}
                      {summary.currency_code === currency && <span className="ms-2 rounded-full bg-[#e8f4ee] px-2 py-1 text-[9px] font-bold tracking-normal text-[#187966]">{rtl ? "الأساسية" : "Primary"}</span>}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    <div className="min-w-0 rounded-[14px] bg-[#f5f7f3] px-3 py-3 sm:px-4">
                      <p className="text-[10px] font-semibold leading-4 text-[#7e8a91]">{text.summaryIncome}</p>
                      <p dir="ltr" className="mt-2 break-words text-start text-[clamp(.95rem,2vw,1.15rem)] font-extrabold tabular-nums tracking-[-.035em] text-[#197966]" data-testid={`summary-income-${summary.currency_code}`}>
                        <span>{formatMilliAmount(summary.totalIncomeMilli, language)}</span><span className="ms-1.5 text-[9px] font-bold tracking-wide text-[#7a8795]">{summary.currency_code}</span>
                      </p>
                    </div>
                    <div className="min-w-0 rounded-[14px] bg-[#f8f6f0] px-3 py-3 sm:px-4">
                      <p className="text-[10px] font-semibold leading-4 text-[#7e8a91]">{text.summaryExpenses}</p>
                      <p dir="ltr" className="mt-2 break-words text-start text-[clamp(.95rem,2vw,1.15rem)] font-extrabold tabular-nums tracking-[-.035em] text-[#927846]" data-testid={`summary-expenses-${summary.currency_code}`}>
                        <span>{formatMilliAmount(summary.totalExpensesMilli, language)}</span><span className="ms-1.5 text-[9px] font-bold tracking-wide text-[#7a8795]">{summary.currency_code}</span>
                      </p>
                    </div>
                    <div className={`min-w-0 rounded-[14px] px-3 py-3 sm:px-4 ${summary.netProfitMilli < 0n ? "bg-[#fff2ef]" : "bg-[#eaf5f0]"}`}>
                      <p className="text-[10px] font-semibold leading-4 text-[#7e8a91]">{text.summaryNet}</p>
                      <p dir="ltr" className={`mt-2 break-words text-start text-[clamp(.95rem,2vw,1.15rem)] font-extrabold tabular-nums tracking-[-.035em] ${summary.netProfitMilli < 0n ? "text-[#a34d43]" : "text-[#197966]"}`} data-testid={`summary-net-profit-${summary.currency_code}`}>
                        <span>{formatMilliAmount(summary.netProfitMilli, language)}</span><span className="ms-1.5 text-[9px] font-bold tracking-wide text-[#7a8795]">{summary.currency_code}</span>
                      </p>
                    </div>
                    <div className="min-w-0 rounded-[14px] border border-[#edf0ed] bg-[#fffefa] px-3 py-3 sm:px-4">
                      <p className="text-[10px] font-semibold leading-4 text-[#7e8a91]">{text.summaryMargin}</p>
                      {summary.profitMarginHundredths === null ? (
                        <p className="mt-2 text-[10px] font-semibold leading-4 text-[#88939a]" data-testid={`summary-margin-${summary.currency_code}`}>{text.summaryMarginUnavailable}</p>
                      ) : (
                        <p dir="ltr" className="mt-2 text-start text-[clamp(.95rem,2vw,1.15rem)] font-extrabold tabular-nums tracking-[-.035em] text-[#34485a]" data-testid={`summary-margin-${summary.currency_code}`}>
                          {formatMarginHundredths(summary.profitMarginHundredths, language)}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-[22px] border border-[#e1e7e4] bg-[#fffefa] shadow-[0_12px_42px_rgba(28,48,56,.045)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[12px] bg-[#f1f3ed] text-[#68798a]"><ReceiptText size={18} /></span>
              <div>
                <h2 className="text-sm font-bold text-[#24364a]">{text.title}</h2>
                <p className="mt-0.5 text-[11px] text-[#87919b]">{text.currencyNote}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#8a959e]"><ShieldCheck size={13} className="text-[#168d78]" />{text.private}</span>
          </div>

          {loading ? (
            <div className="space-y-3 p-5 sm:p-6" role="status" aria-live="polite" data-testid="status-loading">
              <span className="sr-only">{text.loading}</span>
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="grid animate-pulse grid-cols-2 gap-4 rounded-xl border border-[#eff1ed] p-4 sm:grid-cols-4">
                  <span className="h-3 w-24 rounded-full bg-[#e9ede8]" />
                  <span className="h-3 w-40 rounded-full bg-[#e9ede8]" />
                  <span className="hidden h-3 w-20 rounded-full bg-[#e9ede8] sm:block" />
                  <span className="h-3 w-16 justify-self-end rounded-full bg-[#e9ede8]" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="px-6 py-16 text-center" role="alert" data-testid="state-load-error">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fff1ed] text-[#a34d43]"><CircleAlert size={21} /></span>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#7b6260]">{text.loadError}</p>
              <button type="button" onClick={() => void initialize()} className="mt-4 rounded-xl border border-[#dfe5e2] bg-white px-4 py-2.5 text-xs font-bold text-[#34485a] transition hover:border-[#168d78]" data-testid="button-retry-load">
                {rtl ? "إعادة المحاولة" : "Try again"}
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-16 text-center sm:py-20" data-testid="state-empty">
              <span className="relative mx-auto grid size-[62px] place-items-center rounded-[21px] bg-[#f2f3ec] text-[#8b794e]">
                <FilePlus2 size={25} />
                <span className="absolute -bottom-1 -end-1 grid size-6 place-items-center rounded-full border-2 border-[#fffefa] bg-[#168d78] text-white"><Plus size={13} /></span>
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-[#26384a]">{text.emptyTitle}</h3>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#82909a]">{text.emptyText}</p>
              <button type="button" onClick={() => openCreate()} className="outline-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-[#101b30] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#1b2c49]" data-testid="button-empty-add">
                <Plus size={15} />{text.add}
              </button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[700px] border-collapse text-start">
                  <thead>
                    <tr className="bg-[#f8f9f5] text-[10px] font-bold tracking-wide text-[#89939c]">
                      <th className="px-6 py-3.5 text-start">{text.tableDate}</th>
                      <th className="px-6 py-3.5 text-start">{text.tableDetails}</th>
                      <th className="px-6 py-3.5 text-start">{text.tableCategory}</th>
                      <th className="px-6 py-3.5 text-end">{text.tableAmount}</th>
                      <th className="px-6 py-3.5 text-end">{text.tableActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0ed]">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} data-testid={`row-transaction-desktop-${transaction.id}`} className="group transition hover:bg-[#fbfcf8]">
                        <td className="whitespace-nowrap px-6 py-4 text-xs text-[#687789]">{formatDate(transaction.transaction_date, language)}</td>
                        <td className="max-w-[360px] px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`grid size-9 shrink-0 place-items-center rounded-[12px] ${transaction.transaction_type === "income" ? "bg-[#e8f4ee] text-[#16866f]" : "bg-[#f7f0e2] text-[#a38440]"}`}>
                              {transaction.transaction_type === "income" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-semibold text-[#25364a]" data-testid={`text-description-desktop-${transaction.id}`}>{transaction.description}</span>
                              <span className="mt-1 block text-[10px] text-[#8b969e]">{transaction.transaction_type === "income" ? text.incomeLabel : text.expenseLabel}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-[#758292]">{categoryLabel(transaction.category)}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-end text-[13px] font-bold text-[#26384a]" data-testid={`text-amount-desktop-${transaction.id}`}>{amountLabel(transaction.amount, transaction.currency_code)}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1.5 opacity-75 transition group-hover:opacity-100">
                            <button type="button" onClick={() => openEdit(transaction)} aria-label={`${text.edit}: ${transaction.description}`} className="outline-ring grid size-9 place-items-center rounded-[10px] text-[#758392] transition hover:bg-[#edf4f0] hover:text-[#168d78]" data-testid={`button-edit-${transaction.id}`}><Pencil size={15} /></button>
                            <button type="button" onClick={() => setDeleting(transaction)} aria-label={`${text.delete}: ${transaction.description}`} className="outline-ring grid size-9 place-items-center rounded-[10px] text-[#8d7d78] transition hover:bg-[#fff0ed] hover:text-[#b44e43]" data-testid={`button-delete-${transaction.id}`}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-[#edf0ed] sm:hidden">
                {transactions.map((transaction) => (
                  <article key={transaction.id} data-testid={`row-transaction-mobile-${transaction.id}`} className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px] ${transaction.transaction_type === "income" ? "bg-[#e8f4ee] text-[#16866f]" : "bg-[#f7f0e2] text-[#a38440]"}`}>
                        {transaction.transaction_type === "income" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="break-words text-[13px] font-semibold leading-5 text-[#25364a]" data-testid={`text-description-mobile-${transaction.id}`}>{transaction.description}</p>
                          <p className="shrink-0 text-[12px] font-bold text-[#26384a]" data-testid={`text-amount-mobile-${transaction.id}`}>{amountLabel(transaction.amount, transaction.currency_code)}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#8b969e]">
                          <span>{formatDate(transaction.transaction_date, language)}</span><span aria-hidden="true">·</span>
                          <span>{transaction.transaction_type === "income" ? text.incomeLabel : text.expenseLabel}</span><span aria-hidden="true">·</span>
                          <span>{categoryLabel(transaction.category)}</span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => openEdit(transaction)} className="outline-ring inline-flex items-center gap-1.5 rounded-lg border border-[#e5e9e5] px-3 py-2 text-[11px] font-semibold text-[#687789]" data-testid={`button-edit-${transaction.id}`}><Pencil size={13} />{text.edit}</button>
                          <button type="button" onClick={() => setDeleting(transaction)} className="outline-ring inline-flex items-center gap-1.5 rounded-lg border border-[#efe2de] px-3 py-2 text-[11px] font-semibold text-[#9c5c54]" data-testid={`button-delete-${transaction.id}`}><Trash2 size={13} />{text.delete}</button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
        <footer className="mt-5 flex items-center justify-center gap-2 text-[10px] text-[#919ba1]">
          <ShieldCheck size={13} className="text-[#168d78]" />
          {text.private}
        </footer>
      </div>

      {modalOpen && (
        <div data-testid="overlay-transaction-form" className="fixed inset-0 z-50 flex items-end justify-center bg-[#101b30]/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="transaction-form-title" className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[24px] border border-white/70 bg-[#fffefa] shadow-[0_24px_90px_rgba(16,27,48,.25)] sm:max-w-[520px] sm:rounded-[24px]" data-testid="dialog-transaction-form">
            <div className="flex items-start justify-between gap-4 border-b border-[#edf0ed] px-5 py-5 sm:px-7">
              <div>
                <p className="mb-1 text-[10px] font-extrabold tracking-[.16em] text-[#a1864b]">{text.section}</p>
                <h2 id="transaction-form-title" className="text-xl font-extrabold tracking-[-.04em] text-[#17283c]">{editing ? text.editTransaction : draft.transaction_type === "income" ? text.newIncome : text.newExpense}</h2>
              </div>
              <button type="button" disabled={saving} onClick={() => setModalOpen(false)} aria-label={text.close} className="outline-ring grid size-9 place-items-center rounded-xl border border-[#e5e9e5] text-[#6f7d89] transition hover:bg-[#f1f3ef] disabled:opacity-50" data-testid="button-close-form"><X size={17} /></button>
            </div>
            <form onSubmit={saveTransaction} className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
              <fieldset>
                <legend className="mb-2 text-xs font-bold text-[#394b5c]">{text.type}</legend>
                <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-[#f1f3ef] p-1.5">
                  {(["income", "expense"] as const).map((type) => (
                    <button key={type} type="button" onClick={() => setDraft((current) => ({ ...current, transaction_type: type, category: type === "income" ? "" : current.category }))} className={`outline-ring min-h-10 rounded-[10px] text-xs font-bold transition ${draft.transaction_type === type ? type === "income" ? "bg-white text-[#187966] shadow-sm" : "bg-white text-[#9a7941] shadow-sm" : "text-[#7c8993] hover:text-[#34495a]"}`} aria-pressed={draft.transaction_type === type} data-testid={`button-type-${type}`}>
                      {type === "income" ? text.income : text.expense}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="transaction-amount" className="mb-2 block text-xs font-bold text-[#394b5c]">{text.amount}</label>
                  <div className="relative">
                    <input id="transaction-amount" type="text" inputMode="decimal" autoComplete="off" maxLength={15} placeholder={text.amountPlaceholder} value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} className={`${controlClass} pe-16`} aria-describedby="currency-code" data-testid="input-amount" />
                    <span id="currency-code" className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[10px] font-bold tracking-wide text-[#8b969e]">{editing?.currency_code ?? currency}</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="transaction-date" className="mb-2 block text-xs font-bold text-[#394b5c]">{text.date}</label>
                  <div className="relative">
                    <input id="transaction-date" type="date" required value={draft.transaction_date} onChange={(event) => setDraft((current) => ({ ...current, transaction_date: event.target.value }))} className={`${controlClass} pe-10`} data-testid="input-date" />
                    <CalendarDays size={15} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-[#8b969e]" />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="transaction-description" className="mb-2 flex items-center justify-between text-xs font-bold text-[#394b5c]">
                  <span>{text.description}</span><span className="text-[10px] font-medium text-[#9aa3a9]">{draft.description.length}/250</span>
                </label>
                <input id="transaction-description" type="text" required maxLength={250} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder={text.descriptionPlaceholder} className={controlClass} data-testid="input-description" />
              </div>

              {draft.transaction_type === "expense" && (
                <div>
                  <label htmlFor="transaction-category" className="mb-2 block text-xs font-bold text-[#394b5c]">{text.category}</label>
                  <div className="relative">
                    <select id="transaction-category" required value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as Category | "" }))} className={`${controlClass} appearance-none pe-10`} data-testid="select-category">
                      <option value="">{text.chooseCategory}</option>
                      {categoryOptions.map((category) => <option key={category.value} value={category.value}>{rtl ? category.ar : category.en}</option>)}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-[#8b969e]" />
                  </div>
                </div>
              )}

              <p className="flex items-center gap-2 rounded-xl bg-[#f7f7f1] px-3.5 py-3 text-[10px] leading-5 text-[#7a8790]">
                <ShieldCheck size={14} className="shrink-0 text-[#168d78]" />
                {editing ? text.private : text.currencyNote}
              </p>
              {formError && <p role="alert" aria-live="polite" className="rounded-xl border border-[#f1d2cd] bg-[#fff2ef] px-3.5 py-3 text-xs leading-5 text-[#a34d43]" data-testid="status-form-error">{formError}</p>}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
                <button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="outline-ring min-h-12 flex-1 rounded-xl border border-[#dfe5e2] bg-white px-4 text-sm font-bold text-[#647282] transition hover:bg-[#f7f8f5] disabled:opacity-50" data-testid="button-cancel-form">{text.cancel}</button>
                <button type="submit" disabled={saving} className="outline-ring inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#101b30] px-4 text-sm font-bold text-white transition hover:bg-[#1b2c49] disabled:cursor-wait disabled:opacity-60" data-testid="button-save-transaction">
                  {saving ? text.saving : <><Check size={16} />{text.save}</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleting && (
        <div data-testid="overlay-delete-confirm" className="fixed inset-0 z-[60] grid place-items-center bg-[#101b30]/45 p-4 backdrop-blur-[3px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingBusy) setDeleting(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-[410px] rounded-[22px] border border-white/70 bg-[#fffefa] p-6 shadow-[0_24px_90px_rgba(16,27,48,.25)] sm:p-7" data-testid="dialog-delete-confirm">
            <span className="grid size-11 place-items-center rounded-[14px] bg-[#fff0ed] text-[#ad5549]"><Trash2 size={19} /></span>
            <h2 id="delete-title" className="mt-4 text-lg font-extrabold tracking-tight text-[#17283c]">{text.delete}</h2>
            <p className="mt-2 text-sm leading-6 text-[#77838d]">{text.confirmDelete}</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" disabled={deletingBusy} onClick={() => setDeleting(null)} className="outline-ring min-h-11 flex-1 rounded-xl border border-[#dfe5e2] px-4 text-sm font-bold text-[#647282] transition hover:bg-[#f7f8f5] disabled:opacity-50" data-testid="button-cancel-delete">{text.cancel}</button>
              <button type="button" disabled={deletingBusy} onClick={() => void deleteTransaction()} className="outline-ring min-h-11 flex-1 rounded-xl bg-[#a94e43] px-4 text-sm font-bold text-white transition hover:bg-[#923d35] disabled:opacity-60" data-testid="button-confirm-delete">{deletingBusy ? text.deleting : text.confirm}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

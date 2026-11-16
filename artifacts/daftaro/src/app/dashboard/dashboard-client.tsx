"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Download,
  Moon,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildDashboardTrend,
  buildExpenseCategoryTotals,
  calculateDashboardComparison,
  getDateRangeForPreset,
  getPreviousDateRange,
  type DashboardDateRange,
  type DashboardPeriodPreset,
  type DashboardTrendPoint,
  type DashboardTransaction,
} from "../../lib/dashboard-data";
import { formatMarginHundredths, formatMilliAmount, milliToDatabaseValue, parseAmountToMilli } from "../../lib/money";
import { AppHeader } from "../../components/app-header";
import { AiOverviewCard } from "../../components/ai-overview-card";
import { useAppLanguage } from "../../hooks/use-app-language";
import { supabase } from "../../lib/supabase";

type Language = "ar" | "en";
type IntervalMs = 300_000 | 900_000 | 3_600_000 | 86_400_000;

const PAGE_SIZE = 500;
const CURRENCIES = ["KWD", "SAR", "AED", "BHD", "QAR", "OMR", "USD"];
const INTERVALS: { ms: IntervalMs; ar: string; en: string }[] = [
  { ms: 300_000, ar: "كل ٥ دقائق", en: "Every 5 minutes" },
  { ms: 900_000, ar: "كل ١٥ دقيقة", en: "Every 15 minutes" },
  { ms: 3_600_000, ar: "كل ساعة", en: "Every hour" },
  { ms: 86_400_000, ar: "كل ٢٤ ساعة", en: "Every 24 hours" },
];
const CHART_COLORS = ["#167b70", "#c09b50", "#536f9a", "#a45149", "#786aa5", "#56876b"];
const COPY = {
  ar: {
    brand: "دفترُك", privacy: "بياناتك خاصة وآمنة", title: "صورة نشاطك المالية", source: "مصدر البيانات",
    subtitle: "نظرة واضحة على ما كسبته وما أنفقته، خطوة بخطوة.", profile: "ملف النشاط",
    transactions: "الحركات", products: "المنتجات", orders: "الطلبات", customers: "العملاء", signOut: "تسجيل الخروج", signingOut: "جارٍ الخروج…",
    language: "EN", refresh: "تحديث", refreshed: "آخر تحديث", print: "حفظ كـ PDF",
    dark: "تبديل الوضع الداكن", range: "الفترة", currency: "العملة", custom: "فترة مخصصة",
    from: "من", to: "إلى", apply: "تطبيق الفترة", invalidDate: "تحقق من تاريخ البداية والنهاية.",
    preset7: "٧ أيام", preset30: "٣٠ يومًا", preset90: "٩٠ يومًا", ytd: "من بداية السنة",
    income: "إجمالي الدخل", expenses: "إجمالي المصروفات", net: "صافي الربح", margin: "هامش الربح",
    vsPrevious: "مقارنة بالفترة السابقة", noComparison: "لا توجد بيانات كافية للمقارنة",
    marginPoints: "نقطة مئوية عن الفترة السابقة", otherCategories: "تصنيفات أخرى",
    trend: "الدخل والمصروفات عبر الوقت", categories: "المصروفات حسب التصنيف",
    recent: "أحدث الحركات", allTransactions: "عرض كل الحركات", noTransactions: "لا توجد حركات في هذه الفترة",
    noChart: "ستظهر البيانات هنا بعد تسجيل حركة مالية.", noCategories: "لا توجد مصروفات مصنفة في هذه الفترة.",
    loading: "جارٍ إعداد ملخصك المالي…", errorTitle: "لم نتمكن من تحميل البيانات",
    errorBody: "تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.", retry: "إعادة المحاولة",
    amount: "المبلغ", category: "التصنيف", date: "التاريخ", description: "البيان",
    incomeShort: "دخل", expenseShort: "مصروف", other: "أخرى", noMargin: "غير متاح",
    autoRefresh: "تحديث تلقائي", off: "إيقاف", on: "تشغيل", signOutError: "تعذر تسجيل الخروج.",
    csvTrend: "تنزيل بيانات الرسم بصيغة CSV", csvCategories: "تنزيل التصنيفات بصيغة CSV",
    securityNote: "الأرقام من سجل حركاتك فقط، وكل عملة مستقلة دون تحويل.",
  },
  en: {
    brand: "Daftaro", privacy: "Private to your account", title: "Your business, at a glance", source: "Data source",
    subtitle: "A clear view of what came in and what went out.", profile: "Business profile",
    transactions: "Transactions", products: "Products", orders: "Orders", customers: "Customers", signOut: "Sign out", signingOut: "Signing out…",
    language: "العربية", refresh: "Refresh", refreshed: "Last refreshed", print: "Save as PDF",
    dark: "Toggle dark mode", range: "Period", currency: "Currency", custom: "Custom range",
    from: "From", to: "To", apply: "Apply period", invalidDate: "Check the start and end dates.",
    preset7: "7 days", preset30: "30 days", preset90: "90 days", ytd: "Year to date",
    income: "Total income", expenses: "Total expenses", net: "Net profit", margin: "Profit margin",
    vsPrevious: "compared with previous period", noComparison: "Not enough data to compare",
    marginPoints: "percentage points vs. previous period", otherCategories: "Other categories",
    trend: "Income and expenses over time", categories: "Expenses by category",
    recent: "Recent transactions", allTransactions: "View all transactions", noTransactions: "No transactions in this period",
    noChart: "Your chart will take shape as you record transactions.", noCategories: "No expenses categorized in this period.",
    loading: "Preparing your financial summary…", errorTitle: "We couldn't load your data",
    errorBody: "Check your connection and try again.", retry: "Try again",
    amount: "Amount", category: "Category", date: "Date", description: "Description",
    incomeShort: "Income", expenseShort: "Expense", other: "Other", noMargin: "Not available",
    autoRefresh: "Auto-refresh", off: "Off", on: "On", signOutError: "Could not sign out.",
    csvTrend: "Download chart data as CSV", csvCategories: "Download category data as CSV",
    securityNote: "Figures come from your ledger. Each currency is shown separately, never converted.",
  },
};

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(name: string, rows: Array<Array<string | number>>) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StatCard({
  id, title, value, change, currency, isDark, accent,
}: {
  id: string; title: string; value: string; change: string; currency: string; isDark: boolean; accent: string;
}) {
  return (
    <section className={`rounded-[20px] border p-5 sm:p-6 ${isDark ? "border-white/10 bg-[#17243a]" : "border-[#e3e8e5] bg-[#fffefa]"}`} data-testid={`metric-${id}`}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className={`text-sm font-semibold ${isDark ? "text-[#aab5c5]" : "text-[#647184]"}`}>{title}</p>
        <span className="h-1.5 w-9 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <p className={`text-[clamp(1.45rem,3vw,2rem)] font-extrabold tracking-[-.05em] ${isDark ? "text-[#f4f0e7]" : "text-[#14233a]"}`} dir="ltr" data-testid={`metric-value-${id}`}>
        {value}{currency && <span className={`ms-2 text-xs font-bold tracking-normal ${isDark ? "text-[#98a5b6]" : "text-[#8290a0]"}`}>{currency}</span>}
      </p>
      <p className={`mt-3 text-xs ${isDark ? "text-[#96a4b8]" : "text-[#85909d]"}`} data-testid={`metric-comparison-${id}`}>{change}</p>
    </section>
  );
}

export default function DashboardClient() {
  const router = useRouter();
  const [language, setLanguage] = useAppLanguage();
  const [isDark, setIsDark] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriodPreset | "custom">("30d");
  const [dateRange, setDateRange] = useState<DashboardDateRange | null>(null);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const userSelectedCurrency = useRef(false);
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [interval, setInterval] = useState<IntervalMs>(300_000);
  const [refreshMenu, setRefreshMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [dateError, setDateError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const latestRequest = useRef(0);
  const loadedUserId = useRef<string | null>(null);
  const rtl = language === "ar";
  const text = COPY[language];
  const theme = isDark
    ? { page: "bg-[#101a2c] text-[#f2efe7]", panel: "border-white/10 bg-[#17243a]", muted: "text-[#aab5c5]", line: "#314158", tick: "#aab5c5" }
    : { page: "bg-[#f3f5f1] text-[#172639]", panel: "border-[#e3e8e5] bg-[#fffefa]", muted: "text-[#718092]", line: "#e5e9e5", tick: "#778391" };

  useEffect(() => {
    const initialRange = getDateRangeForPreset("30d", localToday());
    setDateRange(initialRange);
    setDraftFrom(initialRange.from);
    setDraftTo(initialRange.to);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("arabic", rtl);
  }, [language, rtl]);

  const loadData = useCallback(async (quiet = false) => {
    if (!dateRange) return;
    const requestId = ++latestRequest.current;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);
    try {
      const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionResult.session) {
        setTransactions([]);
        setLastRefreshed(null);
        loadedUserId.current = null;
        router.replace("/auth");
        return;
      }
      if (requestId !== latestRequest.current) return;
      const userId = sessionResult.session.user.id;
      if (loadedUserId.current && loadedUserId.current !== userId) {
        setTransactions([]);
        setLastRefreshed(null);
        userSelectedCurrency.current = false;
      }
      loadedUserId.current = userId;
      const { data: profile, error: profileError } = await supabase
        .from("business_profiles")
        .select("currency_code")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        setTransactions([]);
        setLastRefreshed(null);
        router.replace("/auth/complete");
        return;
      }
      if (requestId !== latestRequest.current) return;
      if (!userSelectedCurrency.current) {
        setCurrency(CURRENCIES.includes(profile.currency_code) ? profile.currency_code : "KWD");
      }

      const previous = getPreviousDateRange(dateRange);
      const records: DashboardTransaction[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("financial_transactions")
          .select("id,transaction_type,amount,currency_code,transaction_date,description,category,created_at")
          .eq("user_id", userId)
          .gte("transaction_date", previous.from)
          .lte("transaction_date", dateRange.to)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as DashboardTransaction[];
        records.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      if (requestId !== latestRequest.current) return;
      setTransactions(records);
      setLastRefreshed(new Date());
    } catch {
      if (requestId === latestRequest.current) setLoadError(true);
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [dateRange, router]);

  useEffect(() => {
    if (dateRange) void loadData();
  }, [dateRange, loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const safeInterval = Math.max(interval, 300_000);
    const timer = window.setInterval(() => { void loadData(true); }, safeInterval);
    return () => window.clearInterval(timer);
  }, [autoRefresh, interval, loadData]);

  useEffect(() => {
    function onOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setRefreshMenu(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    return () => document.documentElement.classList.remove("dark");
  }, [isDark]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        latestRequest.current += 1;
        loadedUserId.current = null;
        userSelectedCurrency.current = false;
        setTransactions([]);
        setLastRefreshed(null);
        setLoading(false);
        setRefreshing(false);
        if (event === "SIGNED_OUT") router.replace("/auth");
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, [router]);

  const currentTransactions = useMemo(
    () => dateRange ? transactions.filter((item) => item.transaction_date >= dateRange.from && item.transaction_date <= dateRange.to) : [],
    [transactions, dateRange],
  );
  const previousRange = useMemo(() => dateRange ? getPreviousDateRange(dateRange) : null, [dateRange]);
  const previousTransactions = useMemo(
    () => previousRange ? transactions.filter((item) => item.transaction_date >= previousRange.from && item.transaction_date <= previousRange.to) : [],
    [transactions, previousRange],
  );
  const comparison = useMemo(
    () => calculateDashboardComparison(currentTransactions, previousTransactions, currency),
    [currentTransactions, previousTransactions, currency],
  );
  const trend = useMemo(
    () => dateRange ? buildDashboardTrend(currentTransactions, dateRange, currency, language) : [],
    [currentTransactions, dateRange, currency, language],
  );
  const categories = useMemo(
    () => dateRange ? buildExpenseCategoryTotals(transactions, dateRange, currency) : [],
    [transactions, dateRange, currency],
  );
  const chartCategories = useMemo(() => {
    if (categories.length <= 6) return categories;
    const leading = categories.slice(0, 5);
    const remaining = categories.slice(5);
    const remainingMilli = remaining.reduce((total, item) => total + item.amountMilli, 0n);
    return [
      ...leading,
      {
        category: "__other_categories__",
        amountMilli: remainingMilli,
        amount: Number(remainingMilli) / 1000,
      },
    ];
  }, [categories]);
  const recentTransactions = useMemo(
    () => currentTransactions.filter((item) => item.currency_code === currency).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at)).slice(0, 6),
    [currentTransactions, currency],
  );

  function applyPreset(preset: DashboardPeriodPreset) {
    const range = getDateRangeForPreset(preset, localToday());
    setPeriod(preset);
    setDateRange(range);
    setDraftFrom(range.from);
    setDraftTo(range.to);
    setDateError(false);
  }

  function applyCustomRange() {
    if (!draftFrom || !draftTo || draftFrom > draftTo || draftTo > localToday()) {
      setDateError(true);
      return;
    }
    setPeriod("custom");
    setDateRange({ from: draftFrom, to: draftTo });
    setDateError(false);
  }

  function percentageChange(value: bigint | null) {
    if (value === null) return text.noComparison;
    const absolute = value < 0n ? -value : value;
    return `${value > 0n ? "+" : value < 0n ? "−" : ""}${formatMarginHundredths(absolute, language)} ${text.vsPrevious}`;
  }

  function marginChange(value: bigint | null) {
    if (value === null) return text.noComparison;
    const absolute = value < 0n ? -value : value;
    return `${value > 0n ? "+" : value < 0n ? "−" : ""}${formatMarginHundredths(absolute, language)} ${text.marginPoints}`;
  }

  function categoryLabel(name: string) {
    if (name === "other") return text.other;
    if (language === "ar") {
      const labels: Record<string, string> = { materials: "مواد خام", packaging: "تغليف", shipping: "شحن وتوصيل", marketing: "تسويق", rent: "إيجار", salaries: "رواتب", utilities: "خدمات ومرافق" };
      return labels[name] ?? name;
    }
    const labels: Record<string, string> = { materials: "Materials", packaging: "Packaging", shipping: "Shipping", marketing: "Marketing", rent: "Rent", salaries: "Salaries", utilities: "Utilities" };
    return labels[name] ?? name;
  }

  async function signOut() {
    setSigningOut(true);
    setSignOutError(false);
    const { error } = await supabase.auth.signOut();
    if (error) setSignOutError(true);
    else router.replace("/auth");
    setSigningOut(false);
  }

  const currentSummary = comparison.current;
  const metrics = [
    { id: "income", title: text.income, value: formatMilliAmount(currentSummary.totalIncomeMilli, language), change: percentageChange(comparison.incomeChangePercentHundredths), accent: "#167b70" },
    { id: "expenses", title: text.expenses, value: formatMilliAmount(currentSummary.totalExpensesMilli, language), change: percentageChange(comparison.expensesChangePercentHundredths), accent: "#b65a50" },
    { id: "net-profit", title: text.net, value: formatMilliAmount(currentSummary.netProfitMilli, language), change: percentageChange(comparison.netProfitChangePercentHundredths), accent: currentSummary.netProfitMilli >= 0n ? "#167b70" : "#b65a50" },
    { id: "profit-margin", title: text.margin, value: currentSummary.profitMarginHundredths === null ? text.noMargin : formatMarginHundredths(currentSummary.profitMarginHundredths, language), change: marginChange(comparison.marginChangeHundredths), accent: "#c09b50" },
  ];

  return (
    <main dir={rtl ? "rtl" : "ltr"} className={`min-h-[100dvh] transition-colors ${theme.page}`} data-testid="dashboard-page">
      <AppHeader
        language={language}
        onLanguageChange={() => setLanguage(rtl ? "en" : "ar")}
        onSignOut={() => void signOut()}
        signingOut={signingOut}
        isDark={isDark}
      />

      <div className="mx-auto max-w-[1320px] px-4 pb-12 pt-7 sm:px-7 sm:pt-10">
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="reveal">
            <div className="mb-3 flex items-center gap-2"><span className="h-px w-7 bg-[#c6a75c]" /><p className="text-[10px] font-extrabold tracking-[.16em] text-[#927a46]">{rtl ? "ملخص النشاط" : "BUSINESS OVERVIEW"}</p></div>
            <h1 className={`text-[clamp(2rem,4vw,3.25rem)] font-extrabold tracking-[-.06em] ${isDark ? "text-[#f4f0e7]" : "text-[#101b30]"}`} data-testid="dashboard-title">{text.title}</h1>
            <p className={`mt-2 max-w-xl text-sm leading-6 ${theme.muted}`}>{text.subtitle}</p>
              <div className={`mt-2 flex items-center gap-2 text-[11px] ${theme.muted}`} data-testid="dashboard-source">
                <span>{text.source}:</span>
                <span className={`rounded-md px-2 py-0.5 font-bold ${isDark ? "bg-white/10 text-[#d9dfeb]" : "bg-[#e8ece9] text-[#526174]"}`}>Supabase</span>
              </div>
            {lastRefreshed && <p className={`mt-2 text-[11px] ${theme.muted}`} data-testid="last-refreshed">{text.refreshed}: {lastRefreshed.toLocaleString(rtl ? "ar-KW" : "en-KW", { dateStyle: "medium", timeStyle: "short" })}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="relative" ref={menuRef}>
              <div className={`flex h-10 overflow-hidden rounded-xl border ${isDark ? "border-white/15 bg-white/5 text-[#e3e7ed]" : "border-[#dfe5e7] bg-white text-[#526174]"}`}>
                <button type="button" onClick={() => void loadData(true)} disabled={refreshing || loading} className="inline-flex items-center gap-2 px-3 text-xs font-bold transition hover:bg-black/5 disabled:opacity-50" data-testid="button-refresh"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />{text.refresh}</button>
                <span className={`my-2 w-px ${isDark ? "bg-white/15" : "bg-[#e0e5e3]"}`} />
                <button type="button" onClick={() => setRefreshMenu((open) => !open)} aria-expanded={refreshMenu} aria-label={text.autoRefresh} className="px-2.5 transition hover:bg-black/5" data-testid="button-refresh-menu"><ChevronDown size={15} /></button>
              </div>
              {refreshMenu && <div className={`absolute end-0 top-12 z-20 w-64 rounded-2xl border p-3 shadow-xl ${isDark ? "border-white/10 bg-[#1b2940]" : "border-[#e1e6e3] bg-[#fffefa]"}`} data-testid="refresh-menu">
                <div className="flex items-center justify-between border-b border-current/10 pb-3">
                  <span className="text-sm font-bold">{text.autoRefresh}</span>
                  <button type="button" onClick={() => setAutoRefresh((enabled) => !enabled)} aria-pressed={autoRefresh} className={`rounded-full px-3 py-1 text-xs font-bold ${autoRefresh ? "bg-[#dcefe9] text-[#176b5c]" : "bg-[#edf0ed] text-[#697687]"}`} data-testid="toggle-auto-refresh">{autoRefresh ? text.on : text.off}</button>
                </div>
                <div className="space-y-1 pt-2">{INTERVALS.map((option) => <button key={option.ms} type="button" onClick={() => { setInterval(option.ms); setRefreshMenu(false); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition hover:bg-black/5 ${interval === option.ms ? "font-bold text-[#167b70]" : ""}`} data-testid={`refresh-interval-${option.ms}`}>{rtl ? option.ar : option.en}{interval === option.ms && <Check size={14} />}</button>)}</div>
              </div>}
            </div>
            <button type="button" onClick={() => window.print()} aria-label={text.print} title={text.print} className={`grid size-10 place-items-center rounded-xl border transition hover:border-[#c6a75c] ${isDark ? "border-white/15 bg-white/5 text-[#d9dfeb]" : "border-[#dfe5e7] bg-white text-[#526174]"}`} data-testid="button-print"><Printer size={16} /></button>
            <button type="button" onClick={() => setIsDark((value) => !value)} aria-label={text.dark} title={text.dark} className={`grid size-10 place-items-center rounded-xl border transition hover:border-[#c6a75c] ${isDark ? "border-white/15 bg-white/5 text-[#d9dfeb]" : "border-[#dfe5e7] bg-white text-[#526174]"}`} data-testid="button-dark-mode">{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
          </div>
        </div>

        <section className={`mb-6 rounded-[22px] border p-4 sm:p-5 print:hidden ${theme.panel}`} aria-label={text.range} data-testid="period-controls">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className={`mb-2 text-xs font-bold ${theme.muted}`}>{text.range}</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ["7d", text.preset7], ["30d", text.preset30], ["90d", text.preset90], ["ytd", text.ytd],
                ] as [DashboardPeriodPreset, string][]).map(([key, label]) => <button key={key} type="button" onClick={() => applyPreset(key)} aria-pressed={period === key} className={`rounded-full px-4 py-2 text-xs font-bold transition ${period === key ? "bg-[#101b30] text-[#f2e4bf]" : isDark ? "bg-white/5 text-[#c1cad7] hover:bg-white/10" : "bg-[#f1f3ef] text-[#586679] hover:bg-[#e9ede8]"}`} data-testid={`period-${key}`}>{label}</button>)}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="flex w-[145px] flex-col gap-1.5 text-[11px] font-bold">
                <span className={theme.muted}>{text.from}</span>
                <span className={`flex items-center gap-2 rounded-xl border px-3 ${isDark ? "border-white/15 bg-[#101a2c]" : "border-[#dfe5e7] bg-white"}`}><CalendarDays size={14} className="shrink-0 text-[#9a8050]" /><input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} max={draftTo || localToday()} aria-label={text.from} className="min-w-0 bg-transparent py-2.5 text-xs outline-none" data-testid="input-date-from" /></span>
              </label>
              <label className="flex w-[145px] flex-col gap-1.5 text-[11px] font-bold">
                <span className={theme.muted}>{text.to}</span>
                <span className={`flex items-center gap-2 rounded-xl border px-3 ${isDark ? "border-white/15 bg-[#101a2c]" : "border-[#dfe5e7] bg-white"}`}><CalendarDays size={14} className="shrink-0 text-[#9a8050]" /><input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} min={draftFrom} max={localToday()} aria-label={text.to} className="min-w-0 bg-transparent py-2.5 text-xs outline-none" data-testid="input-date-to" /></span>
              </label>
              <button type="button" onClick={applyCustomRange} className="rounded-xl bg-[#e8dfc9] px-4 py-2.5 text-xs font-extrabold text-[#3f382a] transition hover:bg-[#ddcfad]" data-testid="button-apply-custom">{text.apply}</button>
              <label className="flex w-[122px] flex-col gap-1.5 text-[11px] font-bold">
                <span className={theme.muted}>{text.currency}</span>
                <select value={currency} onChange={(event) => { userSelectedCurrency.current = true; setCurrency(event.target.value); }} className={`rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-[#168d78] ${isDark ? "border-white/15 bg-[#101a2c]" : "border-[#dfe5e7] bg-white"}`} data-testid="select-currency">
                  {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
            </div>
          </div>
          {dateError && <p role="alert" className="mt-3 text-xs font-semibold text-[#a45149]" data-testid="date-error">{text.invalidDate}</p>}
          <p className={`mt-3 text-[11px] ${theme.muted}`}>{text.securityNote}</p>
        </section>

        {signOutError && <div role="alert" className="mb-4 rounded-xl border border-[#b65a50]/30 bg-[#b65a50]/10 px-4 py-3 text-sm text-[#a45149]" data-testid="signout-error">{text.signOutError}</div>}
        {loadError ? (
          <section className={`rounded-[24px] border px-6 py-16 text-center ${theme.panel}`} role="alert" data-testid="dashboard-error">
            <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[#f7e8e3] text-[#a45149]"><CircleAlert size={24} /></span>
            <h2 className="text-xl font-extrabold">{text.errorTitle}</h2><p className={`mt-2 text-sm ${theme.muted}`}>{text.errorBody}</p>
            <button type="button" onClick={() => void loadData()} className="mt-5 rounded-xl bg-[#101b30] px-5 py-3 text-sm font-bold text-[#f2e4bf] transition hover:bg-[#1b2c49]" data-testid="button-retry">{text.retry}</button>
          </section>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric, index) => loading
                ? <section key={metric.title} className={`animate-pulse rounded-[20px] border p-5 sm:p-6 ${theme.panel}`} data-testid={`metric-skeleton-${index}`}><div className={`mb-7 h-3 w-24 rounded ${isDark ? "bg-white/10" : "bg-[#e6eae6]"}`} /><div className={`h-8 w-36 rounded ${isDark ? "bg-white/10" : "bg-[#e6eae6]"}`} /><div className={`mt-4 h-3 w-28 rounded ${isDark ? "bg-white/10" : "bg-[#e6eae6]"}`} /></section>
                : <StatCard key={metric.id} id={metric.id} title={metric.title} value={metric.value} change={metric.change} currency={metric.id === "profit-margin" ? "" : currency} isDark={isDark} accent={metric.accent} />)}
            </div>

            <AiOverviewCard language={language} currency={currency} dateRange={dateRange} isDark={isDark} />

            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
              <section className={`overflow-hidden rounded-[22px] border ${theme.panel}`} data-testid="trend-chart-card">
                <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5 sm:px-6">
                  <div><div className="mb-2 flex items-center gap-2 text-[#167b70]"><Activity size={16} /><span className="text-[10px] font-extrabold tracking-[.12em]">{rtl ? "اتجاه الحركة" : "CASH FLOW"}</span></div><h2 className="text-base font-extrabold">{text.trend}</h2></div>
                  {!loading && trend.length > 0 && <button type="button" onClick={() => downloadCsv("daftaro-income-expenses.csv", [[rtl ? "الفترة" : "Period", `${text.income} (${currency})`, `${text.expenses} (${currency})`], ...trend.map((point) => [point.key, milliToDatabaseValue(point.incomeMilli), milliToDatabaseValue(point.expensesMilli)])])} title={text.csvTrend} aria-label={text.csvTrend} className={`print:hidden grid size-9 shrink-0 place-items-center rounded-xl transition hover:bg-black/5 ${theme.muted}`} data-testid="button-export-trend"><Download size={16} /></button>}
                </div>
                <div className="px-2 pb-5 pt-4 sm:px-4">
                  {loading ? <div className={`h-[290px] animate-pulse rounded-xl ${isDark ? "bg-white/5" : "bg-[#f0f3ef]"}`} data-testid="trend-skeleton" /> : trend.length === 0 || !currentTransactions.some((item) => item.currency_code === currency) ? <div className={`grid h-[290px] place-items-center px-6 text-center text-sm ${theme.muted}`} data-testid="trend-empty">{text.noChart}</div> : (
                    <ResponsiveContainer width="100%" height={290}>
                      <AreaChart data={trend} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                        <defs><linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#167b70" stopOpacity={0.25} /><stop offset="100%" stopColor="#167b70" stopOpacity={0.015} /></linearGradient><linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bd805c" stopOpacity={0.2} /><stop offset="100%" stopColor="#bd805c" stopOpacity={0.015} /></linearGradient></defs>
                        <CartesianGrid stroke={theme.line} strokeDasharray="3 5" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.tick }} stroke={theme.line} tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis width={52} tick={{ fontSize: 10, fill: theme.tick }} stroke={theme.line} tickLine={false} axisLine={false} tickFormatter={(value: number) => new Intl.NumberFormat(rtl ? "ar-KW" : "en-KW", { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
                         <Tooltip isAnimationActive={false} cursor={{ stroke: isDark ? "#8390a3" : "#bac4be", strokeDasharray: "3 3" }} contentStyle={{ borderRadius: 12, border: `1px solid ${theme.line}`, background: isDark ? "#1b2940" : "#fffefa", color: isDark ? "#f4f0e7" : "#172639", fontSize: 12 }} formatter={(value, name, entry) => { const point = entry?.payload as DashboardTrendPoint | undefined; const exactValue = point ? name === text.income ? point.incomeMilli : point.expensesMilli : 0n; return [`${formatMilliAmount(exactValue, language)} ${currency}`, name]; }} />
                        <Area type="monotone" dataKey="income" name={text.income} stroke="#167b70" strokeWidth={2.5} fill="url(#income-fill)" isAnimationActive={false} />
                        <Area type="monotone" dataKey="expenses" name={text.expenses} stroke="#bd805c" strokeWidth={2.5} strokeDasharray="5 3" fill="url(#expense-fill)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                  <div className={`mt-1 flex justify-center gap-5 text-xs ${theme.muted}`}><span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#167b70]" />{text.income}</span><span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#bd805c]" />{text.expenses}</span></div>
                </div>
              </section>

              <section className={`overflow-hidden rounded-[22px] border ${theme.panel}`} data-testid="category-chart-card">
                <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5 sm:px-6">
                  <div><div className="mb-2 text-[10px] font-extrabold tracking-[.12em] text-[#927a46]">{rtl ? "مواضع الإنفاق" : "WHERE IT GOES"}</div><h2 className="text-base font-extrabold">{text.categories}</h2></div>
                  {!loading && categories.length > 0 && <button type="button" onClick={() => downloadCsv("daftaro-expenses-by-category.csv", [[text.category, text.amount, text.currency], ...categories.map((item) => [categoryLabel(item.category), milliToDatabaseValue(item.amountMilli), currency])])} title={text.csvCategories} aria-label={text.csvCategories} className={`print:hidden grid size-9 shrink-0 place-items-center rounded-xl transition hover:bg-black/5 ${theme.muted}`} data-testid="button-export-categories"><Download size={16} /></button>}
                </div>
                <div className="px-3 pb-5 pt-3 sm:px-5">
                  {loading ? <div className={`h-[290px] animate-pulse rounded-xl ${isDark ? "bg-white/5" : "bg-[#f0f3ef]"}`} data-testid="category-skeleton" /> : categories.length === 0 ? <div className={`grid h-[290px] place-items-center px-6 text-center text-sm ${theme.muted}`} data-testid="category-empty">{text.noCategories}</div> : (
                    <>
                       <ResponsiveContainer width="100%" height={190}>
                         <PieChart><Pie data={chartCategories.map((item) => ({ ...item, label: categoryLabel(item.category) }))} dataKey="amount" nameKey="label" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none" isAnimationActive={false}>{chartCategories.map((item, index) => <Cell key={item.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip isAnimationActive={false} contentStyle={{ borderRadius: 12, border: `1px solid ${theme.line}`, background: isDark ? "#1b2940" : "#fffefa", color: isDark ? "#f4f0e7" : "#172639", fontSize: 12 }} formatter={(_value, _name, entry) => { const item = entry?.payload as { amountMilli?: bigint } | undefined; return [`${formatMilliAmount(item?.amountMilli ?? 0n, language)} ${currency}`, text.amount]; }} /></PieChart>
                      </ResponsiveContainer>
                      <div className="mt-2 space-y-2">
                         {chartCategories.map((item, index) => <div key={item.category} className="flex items-center gap-2.5 text-xs" data-testid={`category-row-${item.category}`}><span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} /><span className={`min-w-0 flex-1 truncate ${theme.muted}`}>{item.category === "__other_categories__" ? text.otherCategories : categoryLabel(item.category)}</span><span className="font-bold" dir="ltr">{formatMilliAmount(item.amountMilli, language)} <span className={`text-[10px] ${theme.muted}`}>{currency}</span></span></div>)}
                      </div>
                    </>
                  )}
                </div>
              </section>
            </div>

            <section className={`overflow-hidden rounded-[22px] border ${theme.panel}`} data-testid="recent-transactions-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 px-5 py-5 sm:px-6">
                <div><div className="mb-2 text-[10px] font-extrabold tracking-[.12em] text-[#927a46]">{rtl ? "آخر ما سُجّل" : "LATEST ENTRIES"}</div><h2 className="text-base font-extrabold">{text.recent}</h2></div>
                <Link href="/transactions" className="print:hidden rounded-full border border-[#d6b878]/70 px-4 py-2 text-xs font-bold text-[#9a8050] transition hover:bg-[#f5f0e4]" data-testid="link-all-transactions">{text.allTransactions}</Link>
              </div>
              {loading ? <div className="space-y-3 p-5 sm:p-6" data-testid="recent-skeleton">{[0, 1, 2].map((row) => <div key={row} className={`h-12 animate-pulse rounded-xl ${isDark ? "bg-white/5" : "bg-[#f0f3ef]"}`} />)}</div> : recentTransactions.length === 0 ? <div className={`flex flex-col items-center px-6 py-12 text-center ${theme.muted}`} data-testid="recent-empty"><span className={`mb-3 grid size-12 place-items-center rounded-2xl ${isDark ? "bg-white/5" : "bg-[#f1f3ef]"}`}><Activity size={20} /></span><p className="text-sm font-semibold">{text.noTransactions}</p></div> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-start">
                    <thead><tr className={`text-[11px] ${theme.muted}`}><th className="px-5 py-3 font-semibold sm:px-6">{text.description}</th><th className="px-3 py-3 font-semibold">{text.category}</th><th className="px-3 py-3 font-semibold">{text.date}</th><th className="px-5 py-3 text-end font-semibold sm:px-6">{text.amount}</th></tr></thead>
                    <tbody>{recentTransactions.map((transaction) => <tr key={transaction.id} className="border-t border-current/[.07] transition hover:bg-black/[.02]" data-testid={`transaction-row-${transaction.id}`}>
                      <td className="px-5 py-3.5 sm:px-6"><div className="flex items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${transaction.transaction_type === "income" ? "bg-[#e1f1eb] text-[#167b70]" : "bg-[#f7e9e3] text-[#a45149]"}`}>{transaction.transaction_type === "income" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><div className="min-w-0"><p className="max-w-[230px] truncate text-sm font-bold">{transaction.description}</p><p className={`mt-0.5 text-[10px] ${theme.muted}`}>{transaction.transaction_type === "income" ? text.incomeShort : text.expenseShort}</p></div></div></td>
                      <td className={`px-3 py-3.5 text-xs ${theme.muted}`}>{transaction.category ? categoryLabel(transaction.category) : "—"}</td>
                      <td className={`px-3 py-3.5 text-xs ${theme.muted}`}><time dateTime={transaction.transaction_date}>{new Date(`${transaction.transaction_date}T12:00:00`).toLocaleDateString(rtl ? "ar-KW" : "en-KW", { day: "numeric", month: "short", year: "numeric" })}</time></td>
                      <td className="px-5 py-3.5 text-end sm:px-6"><span className={`text-sm font-extrabold ${transaction.transaction_type === "income" ? "text-[#167b70]" : "text-[#a45149]"}`} dir="ltr">{transaction.transaction_type === "expense" ? "−" : "+"}{(() => { const milli = parseAmountToMilli(String(transaction.amount)); return milli === null ? "—" : formatMilliAmount(milli, language); })()}<span className={`ms-1.5 text-[10px] font-bold ${theme.muted}`}>{transaction.currency_code}</span></span></td>
                    </tr>)}</tbody>
                  </table>
                </div>
              )}
            </section>
            <footer className={`mt-5 flex items-center justify-center gap-2 text-[11px] ${theme.muted}`} data-testid="dashboard-data-note"><ShieldCheck size={13} className="text-[#168d78]" />{text.securityNote}</footer>
          </>
        )}
      </div>
    </main>
  );
}

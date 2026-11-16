"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bot, CircleAlert, LoaderCircle, MessageCircle, Printer, RefreshCw, Send, Sparkles, Tag } from "lucide-react";
import { AppHeader } from "../../components/app-header";
import { AiReportHistoryPanel } from "../../components/ai-report-history-panel";
import { AiReportSharingPanel } from "../../components/ai-report-sharing-panel";
import { PrintableAiReport } from "../../components/printable-ai-report";
import { useAppLanguage } from "../../hooks/use-app-language";
import { supabase } from "../../lib/supabase";
import {
  askDaftaro,
  getAiAnalysis,
  getAiPriceAdvice,
  localizeAiError,
  type AiAnalysis,
  type AiChatMessage,
  type AiPeriod,
  type AiPriceResult,
} from "../../lib/ai-api";
import { buildPrintableAiReport } from "../../lib/printable-ai-report";

type ProductOption = {
  id: string; name: string; selling_price: string | number; currency_code: string;
};

const COPY = {
  ar: {
    title: "رؤى دفترُك الذكية", subtitle: "تفسير وتحليل يستند إلى بيانات نشاطك الفعلية.",
    analyze: "تحديث التحليل", period: "الفترة", periods: { "7d": "٧ أيام", "30d": "٣٠ يومًا", "90d": "٩٠ يومًا" },
    currency: "العملة", loading: "جارٍ تحليل بياناتك…", error: "تعذر إعداد التحليل. أعد المحاولة.",
    financial: "ملخص مالي", income: "الدخل المسجل", expense: "المصروفات المسجلة", net: "صافي السجل", margin: "هامش السجل",
    vsPrevious: "مقارنة بالفترة السابقة", paidOrders: "طلبات مدفوعة", unpaidOrders: "غير مدفوعة أو معلقة", failedRefunded: "فشلت أو استُردت",
    chartNote: "الحركات المالية والطلبات مصدران منفصلان؛ لا نجمعهما لتجنب احتساب الدخل مرتين.",
    bestSellers: "الأكثر مبيعًا", profitable: "الأكثر ربحًا", slow: "حركة أبطأ", noSales: "لا مبيعات مدفوعة حديثًا",
    restock: "مساعد إعادة التخزين", leaks: "مراجعة الربحية", discounts: "خصومات الطلبات المدفوعة خلال ٩٠ يومًا",
    shipping: "مصروفات الشحن في السجل", costBasis: "التقديرات تعتمد على التكاليف الحالية المسجلة للمنتج، وليست لقطة تاريخية.",
    insufficient: "لا توجد بيانات كافية لتقدير كمية شراء دقيقة.", available: "المتاح", threshold: "حد التنبيه",
    daysStock: "أيام مخزون تقريبية", suggested: "كمية مقترحة", units: "وحدة", periodsTitle: "الفترة",
    advisor: "مستشار التسعير", product: "المنتج", newPrice: "سعر تجربة", compare: "احسب واطلب النصيحة",
    priceLoading: "جارٍ حساب السيناريو…", current: "السعر الحالي", proposed: "السعر المقترح",
    unitCost: "تكلفة الوحدة", currentProfit: "الربح الحالي", proposedProfit: "الربح المقترح",
    currentMargin: "الهامش الحالي", proposedMargin: "الهامش المقترح", changePerUnit: "التغير لكل وحدة",
    simulationOnly: "هذه محاكاة فقط؛ لن يتغير السعر المحفوظ.", noProducts: "أضف منتجًا لتجربة التسعير.",
    assistant: "اسأل دفترُك", assistantHint: "اسأل عن الأرباح، المصروفات، المنتجات أو المخزون. الإجابات تعتمد على ملخص آمن لبيانات حسابك.",
    placeholder: "مثال: ما المنتجات التي تحتاج إعادة شراء؟", send: "إرسال", sending: "جارٍ الرد…",
    noChat: "ابدأ بسؤال عن بيانات نشاطك.", clear: "مسح المحادثة", localHistory: "سجل المحادثة محفوظ على هذا الجهاز فقط.",
    loadProductsError: "تعذر تحميل المنتجات.", answerError: "لم نتمكن من الإجابة من بيانات نشاطك.",
    noNarrative: "لم يُنتج النموذج شرحًا. الأرقام المعروضة محسوبة من بياناتك.",
    evidence: "الدليل", paidUnits: "وحدات مدفوعة", revenue: "الإيراد المدفوع", profit: "الربح التقديري",
    noData: "لا توجد بيانات لهذا القسم في الفترة المختارة.", notEnough: "بيانات غير كافية لتقييم الأداء.",
    close: "إغلاق",
    printReport: "طباعة أو حفظ PDF",
  },
  en: {
    title: "Daftaro AI insights", subtitle: "Analysis and explanations based on your actual business data.",
    analyze: "Refresh analysis", period: "Period", periods: { "7d": "7 days", "30d": "30 days", "90d": "90 days" },
    currency: "Currency", loading: "Analyzing your data…", error: "Analysis couldn't be prepared. Try again.",
    financial: "Financial summary", income: "Ledger income", expense: "Ledger expenses", net: "Ledger net", margin: "Ledger margin",
    vsPrevious: "compared with previous period", paidOrders: "Paid orders", unpaidOrders: "Unpaid or pending", failedRefunded: "Failed or refunded",
    chartNote: "Ledger entries and orders stay separate to avoid counting income twice.",
    bestSellers: "Best sellers", profitable: "Most profitable", slow: "Slowing down", noSales: "No recent paid sales",
    restock: "Smart restocking", leaks: "Profit review", discounts: "Paid-order discounts in the last 90 days",
    shipping: "Shipping expenses in ledger", costBasis: "Estimates use current saved product costs, not historical cost snapshots.",
    insufficient: "There isn't enough data to estimate an exact purchase quantity.", available: "Available", threshold: "Alert threshold",
    daysStock: "Estimated stock days", suggested: "Suggested quantity", units: "units", periodsTitle: "Period",
    advisor: "Pricing advisor", product: "Product", newPrice: "Try a price", compare: "Calculate and get advice",
    priceLoading: "Calculating scenario…", current: "Current price", proposed: "Proposed price",
    unitCost: "Unit cost", currentProfit: "Current profit", proposedProfit: "Proposed profit",
    currentMargin: "Current margin", proposedMargin: "Proposed margin", changePerUnit: "Change per unit",
    simulationOnly: "This is a simulation; the saved price will not change.", noProducts: "Add a product to try pricing.",
    assistant: "Ask Daftaro", assistantHint: "Ask about profit, expenses, products, or stock. Answers use a private summary of your account data.",
    placeholder: "For example: Which products should I restock?", send: "Send", sending: "Thinking…",
    noChat: "Ask a question about your business data.", clear: "Clear chat", localHistory: "Chat history is stored only on this device.",
    loadProductsError: "Products could not be loaded.", answerError: "We couldn't answer from your business data.",
    noNarrative: "The model didn't return an explanation. Figures shown are calculated from your data.",
    evidence: "Evidence", paidUnits: "Paid units", revenue: "Paid revenue", profit: "Estimated profit",
    noData: "No data for this section in the selected period.", notEnough: "Not enough data to assess performance.",
    close: "Close",
    printReport: "Print or save PDF",
  },
} as const;

function formatAmount(value: string | number, currency: string, language: "ar" | "en") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(number)} ${currency}`;
}

function formatPercent(value: string | null, language: "ar" | "en") {
  if (value === null) return "—";
  return `${new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", { maximumFractionDigits: 2 }).format(Number(value))}%`;
}

export default function InsightsClient() {
  const router = useRouter();
  const [language, setLanguage] = useAppLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [chatLoadedForUser, setChatLoadedForUser] = useState<string | null>(null);
  const [currency, setCurrency] = useState("KWD");
  const [period, setPeriod] = useState<AiPeriod>("30d");
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productLoadError, setProductLoadError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [priceResult, setPriceResult] = useState<AiPriceResult | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const rtl = language === "ar";
  const text = COPY[language];
  const productLoadErrorText = useRef(text.loadProductsError);
  productLoadErrorText.current = text.loadProductsError;
  const chatStorageKey = userId ? `daftaro-ai-chat:${userId}` : null;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("arabic", rtl);
  }, [language, rtl]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        router.replace("/auth");
        return;
      }
      const id = data.session.user.id;
      if (!active) return;
      setUserId(id);
      setProfileReady(false);
      const { data: profile, error: profileError } = await supabase
        .from("business_profiles")
        .select("currency_code")
        .eq("user_id", id)
        .maybeSingle();
      if (profileError || !profile) {
        router.replace("/auth/complete");
        return;
      }
      setCurrency(profile.currency_code);
      setProfileReady(true);
      const { data: productRows, error: productsError } = await supabase
        .from("business_products")
        .select("id,name,selling_price,currency_code")
        .eq("user_id", id)
        .order("name", { ascending: true });
      if (!active) return;
      if (productsError) setProductLoadError(productLoadErrorText.current);
      else {
        const matching = (productRows ?? []).filter((product) => product.currency_code === profile.currency_code) as ProductOption[];
        setProducts(matching);
        setSelectedProduct(matching[0]?.id ?? "");
        setNewPrice(matching[0] ? String(matching[0].selling_price) : "");
      }
    }
    void initialize();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setMessages([]);
        setUserId(null);
        router.replace("/auth");
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!chatStorageKey) return;
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (!saved) {
        setMessages([]);
        setChatLoadedForUser(userId);
        return;
      }
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setMessages(parsed.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string").slice(-40));
      }
      setChatLoadedForUser(userId);
    } catch {
      setMessages([]);
      setChatLoadedForUser(userId);
    }
  }, [chatStorageKey]);

  useEffect(() => {
    if (!chatStorageKey || chatLoadedForUser !== userId) return;
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-40)));
    } catch {
      setChatError(language === "ar" ? "تعذر حفظ المحادثة على هذا الجهاز." : "Chat history couldn't be saved on this device.");
    }
  }, [chatLoadedForUser, chatStorageKey, language, messages, userId]);

  const loadAnalysis = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setAnalysisError("");
    try {
      setAnalysis(await getAiAnalysis(period, currency, language));
    } catch (error) {
      setAnalysisError(error instanceof Error ? localizeAiError(error.message, language) : text.error);
    } finally {
      setLoading(false);
    }
  }, [currency, language, period, text.error, userId]);

  useEffect(() => {
    if (userId && profileReady) void loadAnalysis();
  }, [userId, profileReady, loadAnalysis]);

  const periodLabels = useMemo(() => text.periods, [text.periods]);

  async function submitPrice(event: FormEvent) {
    event.preventDefault();
    if (!selectedProduct || !newPrice.trim()) return;
    setPriceLoading(true);
    setPriceError("");
    setPriceResult(null);
    try {
      setPriceResult(await getAiPriceAdvice(selectedProduct, newPrice, language));
    } catch (error) {
      setPriceError(error instanceof Error ? localizeAiError(error.message, language) : text.error);
    } finally {
      setPriceLoading(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = messageText.trim();
    if (!content || chatLoading) return;
    const next = [...messages, { role: "user" as const, content }].slice(-12);
    setMessages(next);
    setMessageText("");
    setChatLoading(true);
    setChatError("");
    try {
      const result = await askDaftaro(next, currency, language);
      setMessages((current) => [...current, { role: "assistant" as const, content: result.answer }].slice(-40));
    } catch (error) {
      setChatError(error instanceof Error ? localizeAiError(error.message, language) : text.answerError);
      setMessages(next);
    } finally {
      setChatLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setChatError("");
  }

  function changeProduct(productId: string) {
    setSelectedProduct(productId);
    const product = products.find((item) => item.id === productId);
    setNewPrice(product ? String(product.selling_price) : "");
    setPriceResult(null);
    setPriceError("");
  }

  const panel = "rounded-[22px] border border-[#e3e8e5] bg-[#fffefa] p-5 shadow-[0_12px_42px_rgba(28,48,56,.035)] sm:p-6";
  const muted = "text-[#788594]";

  function metricCard(label: string, value: string, change?: string | null) {
    return <div className="rounded-[15px] bg-[#f5f7f3] p-4" key={label}><p className="text-xs font-medium text-[#778594]">{label}</p><p className="mt-2 text-lg font-extrabold" dir="ltr">{value}</p>{change !== undefined && <p className="mt-1 text-[11px] text-[#788594]">{change === null ? text.notEnough : `${change}% ${text.vsPrevious}`}</p>}</div>;
  }

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[#f4f6f4] text-[#172639]" data-testid="ai-insights-page">
      <div className="screen-only">
        <AppHeader
          language={language}
          onLanguageChange={() => setLanguage(rtl ? "en" : "ar")}
          onSignOut={() => void supabase.auth.signOut().then(({ error }) => { if (!error) router.replace("/auth"); })}
          signingOut={false}
        />
      </div>
      <div className="screen-only mx-auto max-w-[1240px] space-y-5 px-4 pb-12 pt-7 sm:px-7 sm:pt-10">
        <section className={`${panel} flex flex-wrap items-end justify-between gap-5`}>
          <div>
            <div className="mb-3 flex items-center gap-2 text-[#167b70]"><Sparkles size={16} /><span className="text-[10px] font-extrabold tracking-[.15em]">{rtl ? "تحليل مدعوم بالذكاء الاصطناعي" : "AI-POWERED BUSINESS REVIEW"}</span></div>
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-[-.05em] text-[#101b30]">{text.title}</h1>
            <p className={`mt-2 text-sm ${muted}`}>{text.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-[11px] font-bold"><span className={muted}>{text.period}</span><select value={period} onChange={(event) => setPeriod(event.target.value as AiPeriod)} className="rounded-xl border border-[#dfe5e7] bg-white px-3 py-2.5 text-xs" data-testid="select-ai-period">{(["7d", "30d", "90d"] as AiPeriod[]).map((key) => <option key={key} value={key}>{periodLabels[key]}</option>)}</select></label>
            <div className="grid gap-1 text-[11px] font-bold"><span className={muted}>{text.currency}</span><span className="rounded-xl border border-[#dfe5e7] bg-[#f1f3ef] px-3 py-2.5 text-xs" data-testid="text-ai-currency">{currency}</span></div>
            <button type="button" onClick={() => void loadAnalysis()} disabled={loading || !userId} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#101b30] px-4 text-xs font-bold text-white disabled:opacity-60" data-testid="button-refresh-ai-analysis">{loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}{text.analyze}</button>
             <button type="button" onClick={() => window.print()} disabled={loading || !analysis || analysis.period !== period} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dfe5e7] bg-white px-4 text-xs font-bold text-[#172639] disabled:opacity-50" data-testid="button-print-ai-report"><Printer size={14} />{text.printReport}</button>
          </div>
        </section>

        {analysisError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#f0d2cc] bg-[#fff2ef] px-4 py-3 text-sm text-[#9c4b43]" data-testid="ai-analysis-error"><CircleAlert size={17} className="mt-0.5 shrink-0" />{analysisError}</div>}
        {loading && !analysis && <div className={`${panel} flex items-center gap-3 text-sm ${muted}`} role="status" data-testid="ai-analysis-loading"><LoaderCircle size={18} className="animate-spin text-[#167b70]" />{text.loading}</div>}

        {analysis && (
          <>
            <section className={panel} data-testid="ai-financial-insights">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-extrabold">{text.financial}</h2><p className={`mt-1 text-xs ${muted}`} dir="ltr">{analysis.from} — {analysis.to}</p></div>
                <span className="rounded-full bg-[#e8f3f0] px-3 py-1 text-[11px] font-bold text-[#12665e]">{currency}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metricCard(text.income, formatAmount(analysis.financial.current.income, currency, language), analysis.financial.changes.incomePercent)}
                {metricCard(text.expense, formatAmount(analysis.financial.current.expenses, currency, language), analysis.financial.changes.expensesPercent)}
                {metricCard(text.net, formatAmount(analysis.financial.current.netProfit, currency, language), analysis.financial.changes.netProfitPercent)}
                {metricCard(text.margin, formatPercent(analysis.financial.current.marginPercent, language), analysis.financial.changes.marginPoints)}
              </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#e8ece8] p-4"><p className="text-xs font-bold">{text.paidOrders}</p><p className="mt-2 text-lg font-extrabold" dir="ltr">{formatAmount(analysis.financial.paidOrderTotal, currency, language)}</p></div>
                <div className="rounded-xl border border-[#e8ece8] p-4"><p className="text-xs font-bold">{text.unpaidOrders}</p><p className="mt-2 text-lg font-extrabold" dir="ltr">{formatAmount(analysis.financial.unpaidOrPendingOrderTotal, currency, language)}</p></div>
                  <div className="rounded-xl border border-[#e8ece8] p-4"><p className="text-xs font-bold">{text.failedRefunded}</p><p className="mt-2 text-lg font-extrabold" dir="ltr">{formatAmount(analysis.financial.failedOrRefundedOrderTotal, currency, language)}</p></div>
              </div>
              <p className={`mt-3 text-[11px] leading-5 ${muted}`}>{text.chartNote}</p>
              <div className="mt-5 rounded-[15px] border border-[#dfe9e4] bg-[#f6f9f6] p-4" data-testid="ai-analysis-narrative">
                <div className="mb-2 flex items-center gap-2 text-[#167b70]"><Bot size={16} /><h3 className="text-xs font-extrabold">{rtl ? "تفسير الذكاء الاصطناعي" : "AI explanation"}</h3></div>
                {analysis.ai.summary ? <p className="text-sm leading-7 text-[#344258]">{analysis.ai.summary}</p> : <p className="text-sm leading-7 text-[#778594]">{analysis.aiError ? localizeAiError(analysis.aiError, language) : text.noNarrative}</p>}
                {analysis.ai.recommendations.length > 0 && <ul className="mt-3 space-y-2">{analysis.ai.recommendations.map((item) => <li key={item.evidenceId} className="rounded-lg bg-white px-3 py-2 text-xs leading-6 text-[#344258]"><span className="me-2 text-[10px] font-bold text-[#167b70]">{text.evidence}</span>{item.advice}</li>)}</ul>}
              </div>
            </section>

            <section className={`${panel} grid gap-5 xl:grid-cols-2`} data-testid="ai-product-performance">
              <div>
                <h2 className="text-lg font-extrabold">{text.bestSellers}</h2>
                <div className="mt-4 flex flex-wrap gap-2">{(["7d", "30d", "90d"] as AiPeriod[]).map((key) => <span key={key} className="rounded-full bg-[#f2f4f0] px-3 py-1 text-[10px] font-bold">{periodLabels[key]}</span>)}</div>
                <div className="mt-3 space-y-4">
                  {(["7d", "30d", "90d"] as AiPeriod[]).map((key) => (
                    <div key={key} className="rounded-xl border border-[#e8ece8] p-4">
                      <h3 className="text-xs font-extrabold">{periodLabels[key]}</h3>
                      {analysis.productPerformance.bestSellers[key].length === 0 ? <p className={`mt-3 text-xs ${muted}`}>{text.noData}</p> : <div className="mt-3 space-y-2">{analysis.productPerformance.bestSellers[key].map((product) => <div key={product.productId} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-bold">{product.name} · {product.paidUnits} {text.paidUnits}</span><span dir="ltr">{formatAmount(product.paidRevenue, currency, language)}</span></div>)}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-extrabold">{text.profitable}</h2>
                  {analysis.productPerformance.mostProfitable.length === 0 ? <p className={`mt-3 text-xs ${muted}`}>{text.noData}</p> : <div className="mt-3 space-y-2">{analysis.productPerformance.mostProfitable.map((product) => <div key={product.productId} className="rounded-xl bg-[#f5f7f3] p-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><b>{product.name}</b><b dir="ltr">{formatAmount(product.estimatedProfit, currency, language)}</b></div><p className={`mt-1 text-[11px] ${muted}`}>{product.paidUnits} {text.paidUnits} · {formatPercent(product.marginPercent, language)}</p></div>)}</div>}
                  <p className={`mt-3 text-[11px] leading-5 ${muted}`}>{text.costBasis}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><h3 className="text-sm font-extrabold">{text.slow}</h3>{analysis.productPerformance.slowMoving.length === 0 ? <p className={`mt-2 text-xs ${muted}`}>{text.notEnough}</p> : <ul className="mt-2 space-y-1 text-xs">{analysis.productPerformance.slowMoving.map((product) => <li key={product.productId}>{product.name} · {product.previousPaidUnits} → {product.currentPaidUnits}</li>)}</ul>}</div>
                  <div><h3 className="text-sm font-extrabold">{text.noSales}</h3>{analysis.productPerformance.noSales.length === 0 ? <p className={`mt-2 text-xs ${muted}`}>{text.noData}</p> : <ul className="mt-2 space-y-1 text-xs">{analysis.productPerformance.noSales.map((product) => <li key={product.productId}>{product.name}</li>)}</ul>}</div>
                </div>
              </div>
            </section>

            <section className={`${panel} grid gap-5 lg:grid-cols-2`} data-testid="ai-profit-leaks-restocking">
              <div>
                <h2 className="text-lg font-extrabold">{text.leaks}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#f5f7f3] p-4"><p className="text-xs text-[#778594]">{text.discounts}</p><p className="mt-2 font-extrabold" dir="ltr">{formatAmount(analysis.profitLeaks.paidOrderDiscounts, currency, language)}</p></div>
                  <div className="rounded-xl bg-[#f5f7f3] p-4"><p className="text-xs text-[#778594]">{text.shipping}</p><p className="mt-2 font-extrabold" dir="ltr">{formatAmount(analysis.profitLeaks.shippingExpensesFromLedger, currency, language)}</p></div>
                </div>
                {analysis.profitLeaks.negativeMarginProducts.length > 0 ? <ul className="mt-4 space-y-2">{analysis.profitLeaks.negativeMarginProducts.map((product) => <li key={product.productId} className="rounded-xl border border-[#f0d8d2] bg-[#fff6f2] p-3 text-xs"><b>{product.name}</b> · {formatAmount(product.unitProfit, currency, language)} / {text.units} · {formatPercent(product.marginPercent, language)}</li>)}</ul> : <p className={`mt-3 text-xs ${muted}`}>{text.noData}</p>}
              </div>
              <div>
                <h2 className="text-lg font-extrabold">{text.restock}</h2>
                {analysis.restocking.length === 0 ? <p className={`mt-3 text-xs ${muted}`}>{text.noData}</p> : <div className="mt-3 space-y-2">{analysis.restocking.map((item) => <div key={item.productId} className="rounded-xl border border-[#eeddbd] bg-[#fffbf1] p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><b>{item.name}</b><span className="text-xs">{text.available}: {item.availableQuantity} · {text.threshold}: {item.lowStockThreshold}</span></div><p className="mt-2 text-xs">{text.paidUnits}: {item.paidUnitsLast30Days} · {text.daysStock}: {item.daysOfStock ?? "—"}</p><p className="mt-2 text-xs font-bold text-[#805a2c]">{item.suggestedQuantity === null ? text.insufficient : `${text.suggested}: ${item.suggestedQuantity} ${text.units}`}</p></div>)}</div>}
              </div>
            </section>
          </>
        )}

        {analysis && analysis.period === period && <AiReportSharingPanel analysis={analysis} language={language} />}
        {analysis && analysis.period === period && <AiReportHistoryPanel analysis={analysis} language={language} />}

        <section id="pricing" className={panel} data-testid="ai-pricing-advisor">
          <div className="mb-4 flex items-center gap-2 text-[#167b70]"><Tag size={17} /><h2 className="text-lg font-extrabold text-[#172639]">{text.advisor}</h2></div>
          <p className={`mb-4 text-xs leading-6 ${muted}`}>{text.simulationOnly}</p>
          {productLoadError && <p role="alert" className="mb-3 text-xs text-[#a34d43]">{productLoadError}</p>}
          {products.length === 0 ? <p className={`text-sm ${muted}`}>{text.noProducts}</p> : (
            <form onSubmit={(event) => void submitPrice(event)} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
              <label className="grid gap-1.5 text-xs font-bold">{text.product}<select value={selectedProduct} onChange={(event) => changeProduct(event.target.value)} className="rounded-xl border border-[#dfe5e7] bg-white px-3 py-3 text-sm" data-testid="select-pricing-product">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-xs font-bold">{text.newPrice}<input type="text" inputMode="decimal" maxLength={20} required value={newPrice} onChange={(event) => setNewPrice(event.target.value)} className="rounded-xl border border-[#dfe5e7] bg-white px-3 py-3 text-sm" data-testid="input-pricing-new-price" /></label>
              <button type="submit" disabled={priceLoading || !selectedProduct} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#101b30] px-4 text-xs font-bold text-white disabled:opacity-60" data-testid="button-run-pricing-advisor">{priceLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}{priceLoading ? text.priceLoading : text.compare}</button>
            </form>
          )}
          {priceError && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ed] px-3 py-2 text-xs text-[#a34d43]" data-testid="pricing-error">{priceError}</p>}
          {priceResult && <div className="mt-5 rounded-xl border border-[#dfe9e4] bg-[#f6f9f6] p-4" data-testid="pricing-result"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metricCard(text.current, formatAmount(priceResult.facts.currentPrice, priceResult.facts.currencyCode, language))}{metricCard(text.proposed, formatAmount(priceResult.facts.proposedPrice, priceResult.facts.currencyCode, language))}{metricCard(text.unitCost, formatAmount(priceResult.facts.totalUnitCost, priceResult.facts.currencyCode, language))}{metricCard(text.changePerUnit, formatAmount(priceResult.facts.profitChangePerUnit, priceResult.facts.currencyCode, language))}</div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><p>{text.currentProfit}: <b dir="ltr">{formatAmount(priceResult.facts.currentUnitProfit, currency, language)}</b> · {formatPercent(priceResult.facts.currentMarginPercent, language)}</p><p>{text.proposedProfit}: <b dir="ltr">{formatAmount(priceResult.facts.proposedUnitProfit, currency, language)}</b> · {formatPercent(priceResult.facts.proposedMarginPercent, language)}</p></div><p className="mt-4 border-t border-[#dfe9e4] pt-3 text-sm leading-7">{priceResult.explanation || (priceResult.aiError ? localizeAiError(priceResult.aiError, language) : text.noNarrative)}</p></div>}
        </section>

        <section className={panel} data-testid="ask-daftaro">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-[13px] bg-[#e9f4f0] text-[#167b70]"><MessageCircle size={18} /></span><div><h2 className="text-lg font-extrabold">{text.assistant}</h2><p className={`mt-1 max-w-2xl text-xs leading-5 ${muted}`}>{text.assistantHint}</p></div></div>
            <button type="button" onClick={clearChat} disabled={messages.length === 0 || chatLoading} className="rounded-lg border border-[#dfe5e7] px-3 py-2 text-xs font-bold disabled:opacity-50" data-testid="button-clear-ai-chat">{text.clear}</button>
          </div>
          <div className="mt-4 max-h-[460px] min-h-28 space-y-3 overflow-y-auto rounded-[16px] bg-[#f5f7f3] p-3 sm:p-4" aria-live="polite" data-testid="ai-chat-messages">
            {messages.length === 0 && <p className={`py-7 text-center text-sm ${muted}`}>{text.noChat}</p>}
            {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`max-w-[90%] whitespace-pre-wrap rounded-[14px] px-4 py-3 text-sm leading-7 ${message.role === "user" ? "ms-auto bg-[#101b30] text-white" : "me-auto border border-[#e2e8e3] bg-white text-[#29384b]"}`} data-testid={`ai-chat-message-${message.role}`}>{message.content}</div>)}
            {chatLoading && <div className="flex items-center gap-2 text-xs text-[#788594]" role="status"><LoaderCircle size={14} className="animate-spin" />{text.sending}</div>}
          </div>
          <p className={`mt-2 text-[10px] ${muted}`}>{text.localHistory}</p>
          {chatError && <p role="alert" className="mt-2 rounded-lg bg-[#fff1ed] px-3 py-2 text-xs text-[#a34d43]" data-testid="ai-chat-error">{chatError}</p>}
          <form onSubmit={(event) => void sendMessage(event)} className="mt-3 flex items-end gap-2">
            <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} maxLength={2500} rows={2} placeholder={text.placeholder} className="min-h-12 flex-1 resize-y rounded-xl border border-[#dfe5e7] bg-white px-4 py-3 text-sm outline-none focus:border-[#168d78]" data-testid="input-ai-question" />
            <button type="submit" disabled={chatLoading || !messageText.trim()} aria-label={text.send} className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#167b70] text-white disabled:opacity-50" data-testid="button-send-ai-question">{chatLoading ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}</button>
          </form>
        </section>
      </div>
      {analysis && analysis.period === period && <PrintableAiReport report={buildPrintableAiReport(analysis)} language={language} />}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bot, LoaderCircle, Sparkles } from "lucide-react";
import { getAiAnalysis, localizeAiError, type AiAnalysis, type AiLanguage } from "../lib/ai-api";
import { getDisplayedAiNarrative } from "../lib/ai-narrative-display";
import type { DashboardDateRange } from "../lib/dashboard-data";

export function AiOverviewCard({
  language,
  currency,
  dateRange,
  isDark = false,
}: {
  language: AiLanguage;
  currency: string;
  dateRange: DashboardDateRange | null;
  isDark?: boolean;
}) {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisKey, setAnalysisKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const hasRequestedAnalysis = useRef(false);
  const ar = language === "ar";
  const period: "7d" | "30d" | "90d" = "30d";
  const requestKey = `${period}:${currency}:${language}`;

  const run = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const nextAnalysis = await getAiAnalysis(period, currency, language);
      if (sequence !== requestSequence.current) return;
      setAnalysis(nextAnalysis);
      setAnalysisKey(requestKey);
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      setError(caught instanceof Error ? localizeAiError(caught.message, language) : (ar ? "تعذر إعداد التحليل." : "Analysis could not be prepared."));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [ar, currency, language, requestKey]);

  useEffect(() => {
    if (hasRequestedAnalysis.current) void run();
  }, [run]);

  function handleAnalyze() {
    hasRequestedAnalysis.current = true;
    void run();
  }

  const panelClass = isDark ? "border-white/10 bg-[#17243a] text-[#f4f0e7]" : "border-[#e3e8e5] bg-[#fffefa] text-[#172639]";
  const mutedClass = isDark ? "text-[#aab5c5]" : "text-[#718092]";
  const visibleAnalysis = analysisKey === requestKey ? analysis : null;
  const visibleNarrative = visibleAnalysis
    ? getDisplayedAiNarrative(visibleAnalysis, language)
    : null;

  return (
    <section className={`mb-5 rounded-[22px] border p-5 sm:p-6 ${panelClass}`} data-testid="ai-overview-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[#e9f4f0] text-[#167b70]"><Sparkles size={18} /></span>
          <div>
            <h2 className="font-extrabold">{ar ? "مساعد دفترك الذكي" : "Daftarik AI insights"}</h2>
            <p className={`mt-1 max-w-2xl text-xs leading-5 ${mutedClass}`}>
              {ar ? "تحليل مستقل لآخر ٣٠ يومًا، يعتمد على بياناتك الفعلية ويفصل سجل الحركات عن الطلبات." : "A private last-30-day review of real data, keeping ledger entries separate from orders."}
            </p>
          </div>
        </div>
        <button type="button" onClick={handleAnalyze} disabled={loading || !dateRange} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#101b30] px-4 text-xs font-bold text-white transition hover:bg-[#1b2c49] disabled:opacity-60" data-testid="button-generate-ai-overview">
          {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Bot size={15} />}
          {loading ? (ar ? "جارٍ التحليل…" : "Analyzing…") : (ar ? "حلّل بياناتي" : "Analyze my data")}
        </button>
      </div>
      {visibleAnalysis && (
        <div className="mt-4 rounded-xl border border-[#dfe9e4] bg-[#f6f9f6] p-4 text-sm leading-7 text-[#344258] dark:border-white/10 dark:bg-white/5 dark:text-[#d9dfeb]" data-testid="ai-overview-result">
          <p>{visibleNarrative?.summary || visibleAnalysis.aiError || (ar ? "لم تتوفر صياغة من الذكاء الاصطناعي. راجعي الأرقام الموثقة في صفحة الرؤى." : "No AI narrative was returned. Review the verified figures on the insights page.")}</p>
          {visibleNarrative && visibleNarrative.recommendations.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pe-5 text-xs">
              {visibleNarrative.recommendations.slice(0, 3).map((item) => <li key={item.evidenceId}>{item.advice}</li>)}
            </ul>
          )}
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-[#fff1ed] px-3 py-2 text-xs text-[#a34d43]" role="alert" data-testid="ai-overview-error">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-3">
        <p className={`text-[11px] ${mutedClass}`}>{ar ? "لا يغيّر المساعد الأسعار أو المخزون تلقائيًا." : "AI never changes prices or stock automatically."}</p>
        <Link href="/insights" className="inline-flex items-center gap-1 text-xs font-bold text-[#167b70] hover:underline" data-testid="link-full-ai-insights">
          {ar ? "كل الرؤى والأسئلة" : "All insights and chat"} <ArrowUpRight size={14} />
        </Link>
      </div>
    </section>
  );
}

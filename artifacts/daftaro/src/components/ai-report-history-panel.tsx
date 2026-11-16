"use client";

import { useEffect, useState } from "react";
import { ArrowDown, GitCompareArrows, LoaderCircle, Save, Trash2 } from "lucide-react";
import {
  deleteAiSavedReport,
  getAiSavedReport,
  listAiSavedReports,
  localizeAiError,
  saveAiReport,
  type AiAnalysis,
  type AiLanguage,
  type AiSavedReport,
  type AiSavedReportSummary,
} from "../lib/ai-api";
import { buildPrintableAiReport, type PrintableAiReportData } from "../lib/printable-ai-report";

const COPY = {
  ar: {
    title: "التقارير المحفوظة",
    description: "احفظي لقطة مؤرخة للفترة والعملة المختارتين، ثم قارني أرقامها بالتقرير الحالي.",
    save: "حفظ التقرير الحالي",
    saving: "جارٍ حفظ اللقطة…",
    saved: "تم حفظ التقرير. يمكنك الرجوع إليه أو حذفه في أي وقت.",
    loadError: "تعذر تحميل التقارير المحفوظة.",
    saveError: "تعذر حفظ التقرير.",
    deleteError: "تعذر حذف التقرير.",
    empty: "لا توجد تقارير محفوظة بعد.",
    savedAt: "تاريخ الحفظ",
    period: "الفترة",
    currency: "العملة",
    compare: "مقارنة بالحالي",
    hideComparison: "إخفاء المقارنة",
    comparing: "جارٍ فتح التقرير…",
    current: "التقرير الحالي",
    savedSnapshot: "اللقطة المحفوظة",
    income: "الدخل المسجل",
    expenses: "المصروفات المسجلة",
    net: "صافي السجل",
    paid: "إجمالي الطلبات المدفوعة",
    aiSummary: "تفسير دفترُك",
    noSummary: "لا يوجد تفسير محفوظ لهذا التقرير.",
    notes: "ملاحظات الحساب وتكلفة المنتجات",
    separate: "السجل المالي والطلبات مصدران منفصلان.",
    cancelled: "الطلبات الملغاة مستبعدة.",
    costBasis: "أساس تكلفة المنتج",
    shipping: "ملاحظة الشحن",
    delete: "حذف",
    confirmDelete: "هل تريدين حذف هذا التقرير المحفوظ نهائيًا؟",
    deleting: "جارٍ الحذف…",
    loadMore: "تحميل تقارير أقدم",
    loadingMore: "جارٍ التحميل…",
    unavailable: "غير متاح",
    days7: "آخر ٧ أيام",
    days30: "آخر ٣٠ يومًا",
    days90: "آخر ٩٠ يومًا",
  },
  en: {
    title: "Saved reports",
    description: "Save a dated snapshot for the selected period and currency, then compare it with today's report.",
    save: "Save current report",
    saving: "Saving snapshot…",
    saved: "Report saved. You can return to it or delete it later.",
    loadError: "Saved reports could not be loaded.",
    saveError: "The report could not be saved.",
    deleteError: "The report could not be deleted.",
    empty: "No reports have been saved yet.",
    savedAt: "Saved",
    period: "Period",
    currency: "Currency",
    compare: "Compare with current",
    hideComparison: "Hide comparison",
    comparing: "Opening report…",
    current: "Current report",
    savedSnapshot: "Saved snapshot",
    income: "Ledger income",
    expenses: "Ledger expenses",
    net: "Ledger net",
    paid: "Paid-order total",
    aiSummary: "Daftaro's explanation",
    noSummary: "No explanation was saved for this report.",
    notes: "Calculation notes and product-cost caveat",
    separate: "Ledger entries and orders are separate sources.",
    cancelled: "Cancelled orders are excluded.",
    costBasis: "Product cost basis",
    shipping: "Shipping note",
    delete: "Delete",
    confirmDelete: "Permanently delete this saved report?",
    deleting: "Deleting…",
    loadMore: "Load older reports",
    loadingMore: "Loading…",
    unavailable: "Not available",
    days7: "Last 7 days",
    days30: "Last 30 days",
    days90: "Last 90 days",
  },
} as const;

function formatDate(value: string, language: AiLanguage) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-KW" : "en-KW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function periodName(period: AiSavedReportSummary["period"], text: typeof COPY.ar | typeof COPY.en, language: AiLanguage) {
  if (period === "7d") return text.days7;
  if (period === "30d") return text.days30;
  if (period === "90d") return text.days90;
  return language === "ar" ? "فترة غير معروفة" : "Unknown period";
}

function amount(value: string | number, currency: string, language: AiLanguage) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(number)} ${currency}`;
}

function ComparisonCard({
  report,
  heading,
  createdAt,
  language,
}: {
  report: PrintableAiReportData;
  heading: string;
  createdAt?: string;
  language: AiLanguage;
}) {
  const text = COPY[language];
  const metrics = [
    [text.income, report.financial.current.income],
    [text.expenses, report.financial.current.expenses],
    [text.net, report.financial.current.netProfit],
    [text.paid, report.financial.orders.paid],
  ] as const;

  return (
    <section className="rounded-xl border border-[#e3e8e5] bg-white p-4" data-testid="saved-report-comparison-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#edf0ed] pb-3">
        <div>
          <h4 className="text-sm font-extrabold">{heading}</h4>
          {createdAt && <p className="mt-1 text-[11px] text-[#788594]">{text.savedAt}: {formatDate(createdAt, language)}</p>}
        </div>
        <div className="text-end text-[11px] font-bold text-[#536273]">
          <p>{periodName(report.period, text, language)}</p>
          <p dir="ltr">{report.currencyCode}</p>
          <p dir="ltr" className="mt-1 text-[10px] font-normal text-[#788594]">{report.from} — {report.to}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.map(([label, value]) => <div key={label} className="rounded-lg bg-[#f5f7f3] p-3">
          <p className="text-[10px] text-[#788594]">{label}</p>
          <p className="mt-1 text-xs font-extrabold" dir="ltr">{amount(value, report.currencyCode, language)}</p>
        </div>)}
      </div>
      <div className="mt-4">
        <h5 className="text-xs font-extrabold">{text.aiSummary}</h5>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-[#536273]">{report.ai.summary || text.noSummary}</p>
      </div>
      <details className="mt-4 rounded-lg border border-[#e8ece8] px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold">{text.notes}</summary>
        <ul className="mt-2 space-y-2 text-[11px] leading-5 text-[#536273]">
          {report.calculationNotes.ledgerAndOrdersKeptSeparate && <li>{text.separate}</li>}
          {report.calculationNotes.cancelledOrdersExcluded && <li>{text.cancelled}</li>}
          <li><b>{text.costBasis}:</b> {report.calculationNotes.productCostBasis}</li>
          <li><b>{text.shipping}:</b> {report.calculationNotes.shippingAllocation}</li>
        </ul>
      </details>
    </section>
  );
}

export function AiReportHistoryPanel({
  analysis,
  language,
}: {
  analysis: AiAnalysis;
  language: AiLanguage;
}) {
  const text = COPY[language];
  const currentReport = buildPrintableAiReport(analysis);
  const [reports, setReports] = useState<AiSavedReportSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparison, setComparison] = useState<AiSavedReport | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadFirstPage() {
    setLoading(true);
    setError("");
    try {
      const page = await listAiSavedReports(50, 0);
      setReports(page.reports);
      setHasMore(page.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? localizeAiError(cause.message, language) : text.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFirstPage();
    // Load this account's first page once when the signed-in panel mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveCurrentReport() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await saveAiReport(analysis);
      const saved = result.savedReport;
      setReports((current) => [saved, ...current.filter((item) => item.savedReportId !== saved.savedReportId)].slice(0, 50));
      setHasMore((current) => current || reports.length >= 50);
      setComparison(saved);
      setNotice(text.saved);
    } catch (cause) {
      setError(cause instanceof Error ? localizeAiError(cause.message, language) : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function loadOlderReports() {
    setLoadingMore(true);
    setError("");
    try {
      const page = await listAiSavedReports(50, reports.length);
      setReports((current) => {
        const seen = new Set(current.map((item) => item.savedReportId));
        return [...current, ...page.reports.filter((item) => !seen.has(item.savedReportId))];
      });
      setHasMore(page.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? localizeAiError(cause.message, language) : text.loadError);
    } finally {
      setLoadingMore(false);
    }
  }

  async function compareReport(reportId: string) {
    if (comparison?.savedReportId === reportId) {
      setComparison(null);
      return;
    }
    setComparisonLoading(true);
    setError("");
    try {
      setComparison((await getAiSavedReport(reportId)).savedReport);
    } catch (cause) {
      setError(cause instanceof Error ? localizeAiError(cause.message, language) : text.loadError);
    } finally {
      setComparisonLoading(false);
    }
  }

  async function deleteReport(reportId: string) {
    const confirmed = window.confirm(text.confirmDelete);
    if (!confirmed) return;
    setDeleting(reportId);
    setError("");
    setNotice("");
    try {
      await deleteAiSavedReport(reportId);
      setReports((current) => current.filter((item) => item.savedReportId !== reportId));
      setComparison((current) => current?.savedReportId === reportId ? null : current);
      setNotice(language === "ar" ? "تم حذف التقرير المحفوظ." : "Saved report deleted.");
    } catch (cause) {
      setError(cause instanceof Error ? localizeAiError(cause.message, language) : text.deleteError);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="rounded-[22px] border border-[#e3e8e5] bg-[#fffefa] p-5 shadow-[0_12px_42px_rgba(28,48,56,.035)] sm:p-6" data-testid="ai-report-history">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#172639]">{text.title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-6 text-[#788594]">{text.description}</p>
        </div>
        <button
          type="button"
          onClick={() => void saveCurrentReport()}
          disabled={saving}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#101b30] px-4 text-xs font-bold text-white disabled:opacity-60"
          data-testid="button-save-ai-report"
        >
          {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? text.saving : text.save}
        </button>
      </div>

      {notice && <p role="status" className="mt-3 rounded-lg bg-[#e8f3f0] px-3 py-2 text-xs leading-5 text-[#12665e]" data-testid="saved-report-notice">{notice}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ed] px-3 py-2 text-xs leading-5 text-[#a34d43]" data-testid="saved-report-error">{error}</p>}

      {comparison && <div className="mt-5 rounded-[16px] border border-[#dfe9e4] bg-[#f6f9f6] p-4" data-testid="saved-report-comparison">
        <div className="mb-3 flex items-center gap-2 text-[#167b70]"><GitCompareArrows size={16} /><h3 className="text-sm font-extrabold">{text.compare}</h3></div>
        <div className="grid gap-3 lg:grid-cols-2">
          <ComparisonCard report={comparison.report} heading={text.savedSnapshot} createdAt={comparison.createdAt} language={language} />
          <ComparisonCard report={currentReport} heading={text.current} language={language} />
        </div>
      </div>}

      <div className="mt-5 border-t border-[#e8ece8] pt-4">
        {loading ? <p className="flex items-center gap-2 text-xs text-[#788594]" role="status"><LoaderCircle size={14} className="animate-spin" />{language === "ar" ? "جارٍ تحميل التقارير…" : "Loading reports…"}</p>
          : reports.length === 0 ? <p className="text-xs text-[#788594]">{text.empty}</p>
            : <ul className="space-y-2">
              {reports.map((report) => {
                const isSelected = comparison?.savedReportId === report.savedReportId;
                return <li key={report.savedReportId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8ece8] bg-white p-3" data-testid={`saved-report-${report.savedReportId}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#344258]">{formatDate(report.createdAt, language)}</p>
                    <p className="mt-1 text-[11px] text-[#788594]">{periodName(report.period, text, language)} · <span dir="ltr">{report.currencyCode}</span></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void compareReport(report.savedReportId)}
                      disabled={comparisonLoading}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#dfe5e7] px-3 text-[11px] font-bold text-[#344258] disabled:opacity-60"
                      data-testid={`button-compare-ai-report-${report.savedReportId}`}
                    >
                      {comparisonLoading && isSelected ? <LoaderCircle size={13} className="animate-spin" /> : <GitCompareArrows size={13} />}
                      {isSelected ? text.hideComparison : text.compare}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteReport(report.savedReportId)}
                      disabled={deleting === report.savedReportId}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#eed3cf] px-3 text-[11px] font-bold text-[#9c4b43] disabled:opacity-60"
                      data-testid={`button-delete-ai-report-${report.savedReportId}`}
                    >
                      {deleting === report.savedReportId ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      {deleting === report.savedReportId ? text.deleting : text.delete}
                    </button>
                  </div>
                </li>;
              })}
            </ul>}
      </div>

      {hasMore && !loading && <button
        type="button"
        onClick={() => void loadOlderReports()}
        disabled={loadingMore}
        className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dfe5e7] px-3 text-xs font-bold text-[#344258] disabled:opacity-60"
        data-testid="button-load-older-ai-reports"
      >
        {loadingMore ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowDown size={14} />}
        {loadingMore ? text.loadingMore : text.loadMore}
      </button>}
    </section>
  );
}

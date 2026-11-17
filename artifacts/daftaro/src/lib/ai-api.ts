import { supabase } from "./supabase";
import { buildPrintableAiReport } from "./printable-ai-report";
import type { PrintableAiReportData } from "./printable-ai-report";
import { apiUrl } from "./api-client-config";

export type AiPeriod = "7d" | "30d" | "90d";
export type AiLanguage = "ar" | "en";

export type AiEvidence = {
  id: string;
  label: string;
  details: Record<string, string | number | null>;
};

export type AiAnalysis = {
  period: AiPeriod;
  currencyCode: string;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  monthToDate: { from: string; to: string; income: string; expenses: string; netProfit: string; marginPercent: string | null };
  previousMonth: { from: string; to: string; income: string; expenses: string; netProfit: string; marginPercent: string | null };
  financial: {
    current: { income: string; expenses: string; netProfit: string; marginPercent: string | null };
    previous: { income: string; expenses: string; netProfit: string; marginPercent: string | null };
    changes: { incomePercent: string | null; expensesPercent: string | null; netProfitPercent: string | null; marginPoints: string | null };
    monthToDateChanges: { income: string; expenses: string; netProfit: string };
    expenseCategories: Array<{ category: string; amount: string }>;
    expenseCategoryChanges: Array<{ category: string; current: string; previous: string; change: string }>;
    monthExpenseCategoryChanges: Array<{ category: string; current: string; previous: string; change: string }>;
    paidOrderTotal: string;
    unpaidOrPendingOrderTotal: string;
    failedOrRefundedOrderTotal: string;
    cancelledOrdersExcluded: true;
    ledgerAndOrdersKeptSeparate: true;
  };
  productPerformance: {
    bestSellers: Record<AiPeriod, Array<{ productId: string; name: string; paidUnits: number; paidRevenue: string }>>;
    mostProfitable: Array<{ productId: string; name: string; estimatedProfit: string; marginPercent: string | null; paidUnits: number }>;
    unitEconomics: Array<{ productId: string; name: string; currentPrice: string; unitCost: string; unitProfit: string; marginPercent: string | null }>;
    unitEconomicsTotalCount: number;
    slowMoving: Array<{ productId: string; name: string; previousPaidUnits: number; currentPaidUnits: number }>;
    noSales: Array<{ productId: string; name: string; daysSinceAdded: number }>;
    costBasisNote: string;
  };
  profitLeaks: {
    paidOrderDiscounts: string;
    shippingExpensesFromLedger: string;
    negativeMarginProducts: Array<{ productId: string; name: string; unitProfit: string; marginPercent: string }>;
    note: string;
  };
  restocking: Array<{
    productId: string; name: string; availableQuantity: number; lowStockThreshold: number;
    paidUnitsLast30Days: number; daysOfStock: number | null; suggestedQuantity: number | null; reason: string;
  }>;
  evidence: AiEvidence[];
  ai: { summary: string; recommendations: Array<{ evidenceId: string; advice: string }> };
  aiError?: string | null;
};

export type AiChatMessage = { role: "user" | "assistant"; content: string };

export type AiPriceResult = {
  facts: {
    productId: string; productName: string; currencyCode: string; currentPrice: string;
    proposedPrice: string; totalUnitCost: string; currentUnitProfit: string; proposedUnitProfit: string;
    currentMarginPercent: string | null; proposedMarginPercent: string | null; profitChangePerUnit: string;
  };
  explanation: string;
  aiError?: string | null;
};

export type AiReportShare = {
  shareId: string;
  period: AiPeriod;
  currencyCode: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type CreatedAiReportShare = AiReportShare & { token: string };

export type AiSavedReportSummary = {
  savedReportId: string;
  period: AiPeriod;
  currencyCode: string;
  createdAt: string;
};

export type AiSavedReport = AiSavedReportSummary & {
  report: PrintableAiReportData;
};

export function localizeAiError(message: string, language: AiLanguage) {
  if (language === "en") return message;
  if (/saved reports.*migration|saved reports.*not set up/i.test(message)) return "تحتاج التقارير المحفوظة إلى تطبيق تحديث قاعدة Supabase أولًا.";
  if (/report sharing.*migration|sharing storage.*not ready/i.test(message)) return "تحتاج مشاركة التقارير إلى تطبيق تحديث قاعدة Supabase أولًا.";
  if (/share.*(expired|revoked|invalid|not found)/i.test(message)) return "انتهت صلاحية الرابط أو تم إلغاؤه. اطلب رابطًا جديدًا من صاحب التقرير.";
  if (/sign in|session is invalid/i.test(message)) return "سجّل الدخول مجددًا لاستخدام مساعد دفترك.";
  if (/too many|rate limit/i.test(message)) return "تجاوزت عدد الطلبات المسموح. حاول مجددًا بعد دقيقة.";
  if (/busy|rate-limited|temporarily/i.test(message)) return "النماذج المجانية مشغولة الآن. حاول مجددًا بعد قليل.";
  if (/timed out/i.test(message)) return "انتهت مهلة طلب الذكاء الاصطناعي. حاول مجددًا.";
  if (/openrouter|AI is not configured/i.test(message)) return "لم يتوفر اتصال OpenRouter. تحقق من إعداد المفتاح السري في إعدادات المشروع.";
  if (/price greater than zero/i.test(message)) return "أدخل سعر بيع أكبر من صفر.";
  if (/product not found/i.test(message)) return "لم يتم العثور على المنتج.";
  if (/currency/i.test(message)) return "اختر عملة مدعومة.";
  return "تعذر إكمال طلب الذكاء الاصطناعي. حاول مجددًا.";
}

async function authenticatedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in again to use Daftarik AI.");
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Daftarik AI could not complete this request.");
  return body as T;
}

export function getAiAnalysis(period: AiPeriod, currency: string, language: AiLanguage) {
  const query = new URLSearchParams({ period, currency, lang: language });
  return authenticatedFetch<AiAnalysis>(`/api/ai/analysis?${query.toString()}`);
}

export function askDaftaro(messages: AiChatMessage[], currency: string, language: AiLanguage) {
  return authenticatedFetch<{ answer: string }>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ messages, currency, language }),
  });
}

export function getAiChatHistory() {
  return authenticatedFetch<{ messages: AiChatMessage[]; updatedAt: string | null }>("/api/ai/chat-history", {
    cache: "no-store",
  });
}

export function saveAiChatHistory(messages: AiChatMessage[]) {
  return authenticatedFetch<{ saved: boolean; updatedAt: string }>("/api/ai/chat-history", {
    method: "PUT",
    body: JSON.stringify({ messages }),
  });
}

export function clearAiChatHistory() {
  return authenticatedFetch<{ cleared: boolean }>("/api/ai/chat-history", {
    method: "DELETE",
  });
}

export function getAiPriceAdvice(productId: string, proposedPrice: string, language: AiLanguage) {
  return authenticatedFetch<AiPriceResult>("/api/ai/pricing", {
    method: "POST",
    body: JSON.stringify({ productId, proposedPrice, language }),
  });
}

export function createAiReportShare(
  analysis: AiAnalysis,
  expiresInDays: 1 | 7 | 30,
  language: AiLanguage,
) {
  return authenticatedFetch<CreatedAiReportShare>("/api/ai/report-shares", {
    method: "POST",
    body: JSON.stringify({
      period: analysis.period,
      currency: analysis.currencyCode,
      expiresInDays,
      language,
    }),
  });
}

export function listAiReportShares() {
  return authenticatedFetch<{ shares: AiReportShare[] }>("/api/ai/report-shares");
}

export function revokeAiReportShare(shareId: string) {
  return authenticatedFetch<{ revoked: boolean }>(`/api/ai/report-shares/${encodeURIComponent(shareId)}/revoke`, {
    method: "POST",
  });
}

export async function getSharedAiReport(shareId: string, token: string) {
  const response = await fetch(apiUrl(`/api/ai/report-shares/${encodeURIComponent(shareId)}/view`), {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const body = await response.json().catch(() => null) as { report?: PrintableAiReportData; error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "This report link is expired or unavailable.");
  if (!body?.report || typeof body.report !== "object") throw new Error("The shared report could not be loaded.");
  return body.report;
}

export function saveAiReport(analysis: AiAnalysis) {
  return authenticatedFetch<{ savedReport: AiSavedReport }>("/api/ai/saved-reports", {
    method: "POST",
    body: JSON.stringify({
      period: analysis.period,
      currency: analysis.currencyCode,
      report: buildPrintableAiReport(analysis),
    }),
  });
}

export function listAiSavedReports(limit = 50, offset = 0) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return authenticatedFetch<{ reports: AiSavedReportSummary[]; hasMore: boolean }>(`/api/ai/saved-reports?${query.toString()}`);
}

export function getAiSavedReport(savedReportId: string) {
  return authenticatedFetch<{ savedReport: AiSavedReport }>(`/api/ai/saved-reports/${encodeURIComponent(savedReportId)}`);
}

export function deleteAiSavedReport(savedReportId: string) {
  return authenticatedFetch<{ deleted: boolean }>(`/api/ai/saved-reports/${encodeURIComponent(savedReportId)}`, {
    method: "DELETE",
  });
}

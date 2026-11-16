import { supabase } from "./supabase";

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
    expenseCategories: Array<{ category: string; amount: string }>;
    paidOrderTotal: string;
    unpaidOrPendingOrderTotal: string;
    cancelledOrdersExcluded: true;
    ledgerAndOrdersKeptSeparate: true;
  };
  productPerformance: {
    bestSellers: Record<AiPeriod, Array<{ productId: string; name: string; paidUnits: number; paidRevenue: string }>>;
    mostProfitable: Array<{ productId: string; name: string; estimatedProfit: string; marginPercent: string | null; paidUnits: number }>;
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

async function authenticatedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in again to use Daftaro AI.");
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Daftaro AI could not complete this request.");
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

export function getAiPriceAdvice(productId: string, proposedPrice: string, language: AiLanguage) {
  return authenticatedFetch<AiPriceResult>("/api/ai/pricing", {
    method: "POST",
    body: JSON.stringify({ productId, proposedPrice, language }),
  });
}

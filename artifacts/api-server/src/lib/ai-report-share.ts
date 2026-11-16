import { createHash, randomBytes } from "node:crypto";
import type { AiAnalysis, AiEvidence } from "./ai-analysis";

export const REPORT_SHARE_EXPIRY_DAYS = [1, 7, 30] as const;
export type ReportShareExpiryDays = typeof REPORT_SHARE_EXPIRY_DAYS[number];
export type ShareNarrative = {
  summary: string;
  recommendations: Array<{ evidenceId: string; advice: string }>;
};

const SAFE_EVIDENCE_FIELDS = new Set([
  "current",
  "previous",
  "changePercent",
  "largestCategory",
  "product",
  "unitProfit",
  "marginPercent",
  "amount",
  "availableQuantity",
  "threshold",
  "daysOfStock",
  "suggestedQuantity",
]);

function evidenceKind(id: string) {
  if (id === "financial-income") return "income";
  if (id === "financial-expenses") return "expenses";
  if (id === "financial-profit") return "profit";
  if (id.startsWith("negative-margin-")) return "negativeMargin";
  if (id.startsWith("stock-")) return "restock";
  if (id === "shipping-expenses") return "shipping";
  return "other";
}

function publicEvidence(evidence: AiEvidence) {
  return {
    kind: evidenceKind(evidence.id),
    label: evidence.label,
    details: Object.fromEntries(
      Object.entries(evidence.details).filter(([key]) => SAFE_EVIDENCE_FIELDS.has(key)),
    ),
  };
}

export function createReportShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashReportShareToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isReportShareToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function isReportShareExpiryDays(value: unknown): value is ReportShareExpiryDays {
  return typeof value === "number"
    && REPORT_SHARE_EXPIRY_DAYS.includes(value as ReportShareExpiryDays);
}

export function sanitizeShareNarrative(value: unknown, evidence: AiEvidence[]): ShareNarrative {
  if (!value || typeof value !== "object") return { summary: "", recommendations: [] };
  const candidate = value as { summary?: unknown; recommendations?: unknown };
  const knownEvidence = new Map(evidence.map((item) => [item.id, item]));
  const summary = typeof candidate.summary === "string" ? candidate.summary.trim().slice(0, 1500) : "";
  const recommendations = Array.isArray(candidate.recommendations)
    ? candidate.recommendations.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const recommendation = item as { evidenceId?: unknown; advice?: unknown };
        if (
          typeof recommendation.evidenceId !== "string"
          || !knownEvidence.has(recommendation.evidenceId)
          || typeof recommendation.advice !== "string"
        ) return [];
        return [{
          evidenceId: recommendation.evidenceId,
          advice: recommendation.advice.trim().slice(0, 500),
        }];
      }).filter((item) => item.advice.length > 0).slice(0, 5)
    : [];
  return { summary, recommendations };
}

export function buildShareableAiReport(analysis: AiAnalysis, narrative: ShareNarrative) {
  return {
    period: analysis.period,
    from: analysis.from,
    to: analysis.to,
    currencyCode: analysis.currencyCode,
    financial: {
      current: { ...analysis.financial.current },
      previous: { ...analysis.financial.previous },
      changes: { ...analysis.financial.changes },
      expenseCategories: analysis.financial.expenseCategories.slice(0, 8).map(({ category, amount }) => ({ category, amount })),
      orders: {
        paid: analysis.financial.paidOrderTotal,
        unpaidOrPending: analysis.financial.unpaidOrPendingOrderTotal,
        failedOrRefunded: analysis.financial.failedOrRefundedOrderTotal,
      },
    },
    bestSellers: analysis.productPerformance.bestSellers[analysis.period].slice(0, 8).map(({ name, paidUnits, paidRevenue }) => ({
      name, paidUnits, paidRevenue,
    })),
    mostProfitable: analysis.productPerformance.mostProfitable.slice(0, 8).map(({ name, estimatedProfit, marginPercent, paidUnits }) => ({
      name, estimatedProfit, marginPercent, paidUnits,
    })),
    slowMoving: analysis.productPerformance.slowMoving.slice(0, 8).map(({ name, previousPaidUnits, currentPaidUnits }) => ({
      name, previousPaidUnits, currentPaidUnits,
    })),
    noSales: analysis.productPerformance.noSales.slice(0, 8).map(({ name, daysSinceAdded }) => ({ name, daysSinceAdded })),
    restocking: analysis.restocking.slice(0, 10).map((item) => ({
      name: item.name,
      availableQuantity: item.availableQuantity,
      lowStockThreshold: item.lowStockThreshold,
      paidUnitsLast30Days: item.paidUnitsLast30Days,
      daysOfStock: item.daysOfStock,
      suggestedQuantity: item.suggestedQuantity,
    })),
    profitReview: {
      paidOrderDiscountsLast90Days: analysis.profitLeaks.paidOrderDiscounts,
      shippingExpensesFromLedger: analysis.profitLeaks.shippingExpensesFromLedger,
      negativeMarginProducts: analysis.profitLeaks.negativeMarginProducts.slice(0, 8).map(({ name, unitProfit, marginPercent }) => ({
        name, unitProfit, marginPercent,
      })),
      note: analysis.profitLeaks.note,
    },
    evidence: analysis.evidence.slice(0, 24).map(publicEvidence),
    ai: {
      summary: narrative.summary,
      recommendations: narrative.recommendations.map(({ evidenceId, advice }) => {
        const evidence = analysis.evidence.find((item) => item.id === evidenceId);
        return {
          advice,
          evidenceKind: evidence ? evidenceKind(evidence.id) : null,
          evidenceLabel: evidence?.label ?? null,
        };
      }),
    },
    calculationNotes: {
      ledgerAndOrdersKeptSeparate: analysis.financial.ledgerAndOrdersKeptSeparate,
      cancelledOrdersExcluded: analysis.financial.cancelledOrdersExcluded,
      productCostBasis: analysis.productPerformance.costBasisNote,
      shippingAllocation: analysis.profitLeaks.note,
    },
  };
}

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
const SAFE_EVIDENCE_KINDS = new Set([
  "income",
  "expenses",
  "profit",
  "negativeMargin",
  "restock",
  "shipping",
  "other",
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

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function safeText(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function safeAmount(value: unknown): string | null {
  return typeof value === "string" && /^-?\d{1,12}(?:\.\d{1,3})?$/.test(value) ? value : null;
}

function safePercent(value: unknown): string | null {
  return value === null || (typeof value === "string" && /^-?\d{1,12}(?:\.\d{1,2})?$/.test(value))
    ? value
    : null;
}

function safeCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function amountFields(record: JsonRecord | null, keys: string[]) {
  if (!record) return null;
  const output: JsonRecord = {};
  for (const key of keys) {
    const value = safeAmount(record[key]);
    if (value === null) return null;
    output[key] = value;
  }
  return output;
}

function percentFields(record: JsonRecord | null, keys: string[]) {
  if (!record) return null;
  const output: JsonRecord = {};
  for (const key of keys) {
    const value = safePercent(record[key]);
    if (value === null && record[key] !== null) return null;
    output[key] = value;
  }
  return output;
}

function safeRows<T>(
  value: unknown,
  maximum: number,
  map: (row: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const rows: T[] = [];
  for (const row of value.slice(0, maximum)) {
    const safeRow = map(row);
    if (safeRow === null) return null;
    rows.push(safeRow);
  }
  return rows;
}

function safeNameRow(value: unknown) {
  const row = asRecord(value);
  const name = safeText(row?.name, 160);
  return row && name !== null ? { row, name } : null;
}

/**
 * Rebuilds a printable report snapshot from an allowlist so arbitrary fields
 * (including customer details or credentials) sent by a modified client are
 * never persisted.
 */
export function sanitizePrintableAiReportSnapshot(value: unknown) {
  const root = asRecord(value);
  if (!root) return null;
  const period = root.period;
  const currencyCode = root.currencyCode;
  const from = safeText(root.from, 10);
  const to = safeText(root.to, 10);
  if (
    !["7d", "30d", "90d"].includes(String(period))
    || !/^(KWD|SAR|AED|BHD|QAR|OMR|USD)$/.test(String(currencyCode))
    || !from || !/^\d{4}-\d{2}-\d{2}$/.test(from)
    || !to || !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) return null;

  const financial = asRecord(root.financial);
  const current = amountFields(asRecord(financial?.current), ["income", "expenses", "netProfit"]);
  const currentMargin = safePercent(asRecord(financial?.current)?.marginPercent);
  const previous = amountFields(asRecord(financial?.previous), ["income", "expenses", "netProfit"]);
  const previousMargin = safePercent(asRecord(financial?.previous)?.marginPercent);
  const changes = percentFields(asRecord(financial?.changes), ["incomePercent", "expensesPercent", "netProfitPercent", "marginPoints"]);
  const orders = amountFields(asRecord(financial?.orders), ["paid", "unpaidOrPending", "failedOrRefunded"]);
  if (!financial || !current || currentMargin === null && asRecord(financial.current)?.marginPercent !== null
    || !previous || previousMargin === null && asRecord(financial.previous)?.marginPercent !== null
    || !changes || !orders) return null;

  const expenseCategories = safeRows(financial.expenseCategories, 8, (candidate) => {
    const row = asRecord(candidate);
    const category = safeText(row?.category, 120);
    const amount = safeAmount(row?.amount);
    return row && category !== null && amount !== null ? { category, amount } : null;
  });
  const bestSellers = safeRows(root.bestSellers, 8, (candidate) => {
    const row = safeNameRow(candidate);
    const paidUnits = safeCount(row?.row.paidUnits);
    const paidRevenue = safeAmount(row?.row.paidRevenue);
    return row && paidUnits !== null && paidRevenue !== null
      ? { name: row.name, paidUnits, paidRevenue }
      : null;
  });
  const mostProfitable = safeRows(root.mostProfitable, 8, (candidate) => {
    const row = safeNameRow(candidate);
    const estimatedProfit = safeAmount(row?.row.estimatedProfit);
    const marginPercent = safePercent(row?.row.marginPercent);
    const paidUnits = safeCount(row?.row.paidUnits);
    return row && estimatedProfit !== null && (marginPercent !== null || row.row.marginPercent === null) && paidUnits !== null
      ? { name: row.name, estimatedProfit, marginPercent, paidUnits }
      : null;
  });
  const slowMoving = safeRows(root.slowMoving, 8, (candidate) => {
    const row = safeNameRow(candidate);
    const previousPaidUnits = safeCount(row?.row.previousPaidUnits);
    const currentPaidUnits = safeCount(row?.row.currentPaidUnits);
    return row && previousPaidUnits !== null && currentPaidUnits !== null
      ? { name: row.name, previousPaidUnits, currentPaidUnits }
      : null;
  });
  const noSales = safeRows(root.noSales, 8, (candidate) => {
    const row = safeNameRow(candidate);
    const daysSinceAdded = safeCount(row?.row.daysSinceAdded);
    return row && daysSinceAdded !== null ? { name: row.name, daysSinceAdded } : null;
  });
  const restocking = safeRows(root.restocking, 10, (candidate) => {
    const row = safeNameRow(candidate);
    const availableQuantity = safeCount(row?.row.availableQuantity);
    const lowStockThreshold = safeCount(row?.row.lowStockThreshold);
    const paidUnitsLast30Days = safeCount(row?.row.paidUnitsLast30Days);
    const daysOfStock = row?.row.daysOfStock === null ? null : safeCount(row?.row.daysOfStock);
    const suggestedQuantity = row?.row.suggestedQuantity === null ? null : safeCount(row?.row.suggestedQuantity);
    return row && availableQuantity !== null && lowStockThreshold !== null && paidUnitsLast30Days !== null
      && (daysOfStock !== null || row.row.daysOfStock === null)
      && (suggestedQuantity !== null || row.row.suggestedQuantity === null)
      ? { name: row.name, availableQuantity, lowStockThreshold, paidUnitsLast30Days, daysOfStock, suggestedQuantity }
      : null;
  });
  const profitReview = asRecord(root.profitReview);
  const paidOrderDiscountsLast90Days = safeAmount(profitReview?.paidOrderDiscountsLast90Days);
  const shippingExpensesFromLedger = safeAmount(profitReview?.shippingExpensesFromLedger);
  const profitNote = safeText(profitReview?.note, 500);
  const negativeMarginProducts = safeRows(profitReview?.negativeMarginProducts, 8, (candidate) => {
    const row = safeNameRow(candidate);
    const unitProfit = safeAmount(row?.row.unitProfit);
    const marginPercent = safePercent(row?.row.marginPercent);
    return row && unitProfit !== null && (marginPercent !== null || row.row.marginPercent === null)
      ? { name: row.name, unitProfit, marginPercent }
      : null;
  });
  const evidence = safeRows(root.evidence, 24, (candidate) => {
    const row = asRecord(candidate);
    const kind = row?.kind;
    const label = safeText(row?.label, 160);
    const details = asRecord(row?.details);
    if (!row || typeof kind !== "string" || !SAFE_EVIDENCE_KINDS.has(kind) || label === null || !details) return null;
    const safeDetails: JsonRecord = {};
    for (const [key, detail] of Object.entries(details)) {
      if (!SAFE_EVIDENCE_FIELDS.has(key)) continue;
      if (detail === null || typeof detail === "number" && Number.isFinite(detail)) safeDetails[key] = detail;
      else if (typeof detail === "string" && detail.length <= 160) safeDetails[key] = detail;
    }
    return { kind, label, details: safeDetails };
  });
  const ai = asRecord(root.ai);
  const summary = safeText(ai?.summary, 1500);
  const recommendations = safeRows(ai?.recommendations, 5, (candidate) => {
    const row = asRecord(candidate);
    const advice = safeText(row?.advice, 500);
    const evidenceKind = row?.evidenceKind;
    const evidenceLabel = row?.evidenceLabel;
    if (!row || advice === null
      || evidenceKind !== null && (typeof evidenceKind !== "string" || !SAFE_EVIDENCE_KINDS.has(evidenceKind))
      || evidenceLabel !== null && safeText(evidenceLabel, 160) === null) return null;
    return {
      advice,
      evidenceKind: evidenceKind as string | null,
      evidenceLabel: evidenceLabel as string | null,
    };
  });
  const notes = asRecord(root.calculationNotes);
  const productCostBasis = safeText(notes?.productCostBasis, 1000);
  const shippingAllocation = safeText(notes?.shippingAllocation, 500);

  if (!expenseCategories || !bestSellers || !mostProfitable || !slowMoving || !noSales
    || !restocking || !profitReview || paidOrderDiscountsLast90Days === null
    || shippingExpensesFromLedger === null || profitNote === null || !negativeMarginProducts
    || !evidence || !ai || summary === null || !recommendations || !notes
    || typeof notes.ledgerAndOrdersKeptSeparate !== "boolean"
    || typeof notes.cancelledOrdersExcluded !== "boolean"
    || productCostBasis === null || shippingAllocation === null) return null;

  const safeSnapshot = {
    period,
    from,
    to,
    currencyCode,
    financial: {
      current: { ...current, marginPercent: currentMargin },
      previous: { ...previous, marginPercent: previousMargin },
      changes,
      expenseCategories,
      orders,
    },
    bestSellers,
    mostProfitable,
    slowMoving,
    noSales,
    restocking,
    profitReview: {
      paidOrderDiscountsLast90Days,
      shippingExpensesFromLedger,
      negativeMarginProducts,
      note: profitNote,
    },
    evidence,
    ai: { summary, recommendations },
    calculationNotes: {
      ledgerAndOrdersKeptSeparate: notes.ledgerAndOrdersKeptSeparate,
      cancelledOrdersExcluded: notes.cancelledOrdersExcluded,
      productCostBasis,
      shippingAllocation,
    },
  };
  return JSON.stringify(safeSnapshot).length <= 50_000 ? safeSnapshot : null;
}

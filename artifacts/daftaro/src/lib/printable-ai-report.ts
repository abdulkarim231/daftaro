import type { AiAnalysis } from "./ai-api";

function evidenceKind(id: string) {
  if (id === "financial-income") return "income";
  if (id === "financial-expenses") return "expenses";
  if (id === "financial-profit") return "profit";
  if (id.startsWith("negative-margin-")) return "negativeMargin";
  if (id.startsWith("stock-")) return "restock";
  if (id === "shipping-expenses") return "shipping";
  return "other";
}

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

export function buildPrintableAiReport(analysis: AiAnalysis) {
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
    evidence: analysis.evidence.slice(0, 24).map(({ id, label, details }) => ({
      kind: evidenceKind(id),
      label,
      details: Object.fromEntries(
        Object.entries(details).filter(([key]) => SAFE_EVIDENCE_FIELDS.has(key)),
      ),
    })),
    ai: {
      summary: analysis.ai.summary,
      recommendations: analysis.ai.recommendations.map(({ evidenceId, advice }) => {
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

export type PrintableAiReportData = ReturnType<typeof buildPrintableAiReport>;

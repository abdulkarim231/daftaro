import assert from "node:assert/strict";
import test from "node:test";
import { buildPrintableAiReport } from "../src/lib/printable-ai-report.ts";

function sampleAnalysis() {
  return {
    period: "30d",
    from: "2026-10-18",
    to: "2026-11-16",
    currencyCode: "KWD",
    financial: {
      current: { income: "100.000", expenses: "30.000", netProfit: "70.000", marginPercent: "70.00" },
      previous: { income: "80.000", expenses: "25.000", netProfit: "55.000", marginPercent: "68.75" },
      changes: { incomePercent: "25.00", expensesPercent: "20.00", netProfitPercent: "27.27", marginPoints: "1.25" },
      expenseCategories: [{ category: "Shipping", amount: "20.000" }],
      paidOrderTotal: "50.000",
      unpaidOrPendingOrderTotal: "4.000",
      failedOrRefundedOrderTotal: "2.000",
      cancelledOrdersExcluded: true,
      ledgerAndOrdersKeptSeparate: true,
    },
    productPerformance: {
      bestSellers: {
        "7d": [],
        "30d": [{ productId: "product-1", name: "Notebook", paidUnits: 3, paidRevenue: "15.000" }],
        "90d": [{ productId: "product-1", name: "Notebook", paidUnits: 9, paidRevenue: "45.000" }],
      },
      mostProfitable: [{ productId: "product-1", name: "Notebook", estimatedProfit: "8.000", marginPercent: "53.33", paidUnits: 9 }],
      slowMoving: [{ productId: "product-2", name: "Pen", previousPaidUnits: 4, currentPaidUnits: 1 }],
      noSales: [{ productId: "product-3", name: "Folder", daysSinceAdded: 60 }],
      costBasisNote: "Current costs are used.",
    },
    profitLeaks: {
      paidOrderDiscounts: "3.000",
      shippingExpensesFromLedger: "5.000",
      negativeMarginProducts: [{ productId: "product-4", name: "Bag", unitProfit: "-1.000", marginPercent: "-10.00" }],
      note: "Shipping isn't allocated to products.",
    },
    restocking: [{
      productId: "product-2",
      name: "Pen",
      availableQuantity: 2,
      lowStockThreshold: 5,
      paidUnitsLast30Days: 8,
      daysOfStock: 7,
      suggestedQuantity: 6,
      reason: "Based on paid orders.",
    }],
    evidence: [{
      id: "stock-secret-product-id",
      label: "restock signal",
      details: {
        product: "Pen",
        availableQuantity: 2,
        threshold: 5,
        daysOfStock: 7,
        suggestedQuantity: 6,
        customerEmail: "secret@example.com",
        apiKey: "should-not-appear",
      },
    }],
    ai: {
      summary: "Sales are steady.",
      recommendations: [{ evidenceId: "stock-secret-product-id", advice: "Review restocking for Pen." }],
    },
    customerDetails: [{ name: "Private Customer", email: "customer@example.com" }],
    openRouterKey: "private-test-value",
  };
}

test("builds a period-specific printable report from verified business fields", () => {
  const report = buildPrintableAiReport(sampleAnalysis());
  assert.equal(report.period, "30d");
  assert.equal(report.from, "2026-10-18");
  assert.equal(report.currencyCode, "KWD");
  assert.equal(report.bestSellers[0].name, "Notebook");
  assert.equal(report.financial.orders.paid, "50.000");
  assert.equal(report.financial.orders.failedOrRefunded, "2.000");
  assert.equal(report.ai.recommendations[0].evidenceKind, "restock");
  assert.equal(report.evidence[0].kind, "restock");
});

test("excludes customer details, credentials, and internal product IDs", () => {
  const serialized = JSON.stringify(buildPrintableAiReport(sampleAnalysis()));
  assert.doesNotMatch(serialized, /Private Customer|customer@example\.com|secret@example\.com|private-test-value|should-not-appear|stock-secret-product-id|product-1/);
});

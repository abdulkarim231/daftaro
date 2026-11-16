import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAiAnalysis,
  buildChatFacts,
  calculatePriceAdvice,
  dateKeyInKuwait,
  periodRange,
} from "../src/lib/ai-analysis.ts";

const product = (overrides = {}) => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: "Maamoul box",
  selling_price: "10.000",
  materials_cost: "4.000",
  packaging_cost: "1.000",
  other_cost: "1.000",
  available_quantity: 2,
  low_stock_threshold: 5,
  currency_code: "KWD",
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const order = (overrides = {}) => ({
  id: "order-1",
  order_date: "2026-03-10",
  order_status: "Completed",
  payment_status: "Paid",
  currency_code: "KWD",
  subtotal: "20.000",
  discount: "2.000",
  shipping_fee: "1.000",
  total: "19.000",
  ...overrides,
});

const item = (overrides = {}) => ({
  id: "item-1",
  order_id: "order-1",
  product_id: "00000000-0000-4000-8000-000000000001",
  product_name: "Maamoul box",
  quantity: 2,
  position: 1,
  line_total: "20.000",
  ...overrides,
});

function analysis(overrides = {}) {
  return buildAiAnalysis({
    transactions: [
      { transaction_type: "income", amount: "20.000", currency_code: "KWD", transaction_date: "2026-03-10", category: null },
      { transaction_type: "expense", amount: "5.000", currency_code: "KWD", transaction_date: "2026-03-10", category: "shipping" },
      { transaction_type: "income", amount: "900.000", currency_code: "SAR", transaction_date: "2026-03-10", category: null },
    ],
    orders: [order()],
    items: [item()],
    products: [product()],
    currencyCode: "KWD",
    period: "30d",
    today: "2026-03-10",
    ...overrides,
  });
}

test("uses Kuwait calendar date and inclusive comparison periods", () => {
  assert.equal(dateKeyInKuwait(new Date("2026-03-10T22:30:00.000Z")), "2026-03-11");
  assert.deepEqual(periodRange("7d", "2026-03-10"), {
    from: "2026-03-04", to: "2026-03-10",
    previousFrom: "2026-02-25", previousTo: "2026-03-03", days: 7,
  });
});

test("keeps currencies and ledger income separate from paid orders", () => {
  const result = analysis();
  assert.equal(result.financial.current.income, "20.000");
  assert.equal(result.financial.current.expenses, "5.000");
  assert.equal(result.financial.paidOrderTotal, "19.000");
  assert.equal(result.financial.ledgerAndOrdersKeptSeparate, true);
});

test("excludes cancelled orders and separates unpaid totals from paid revenue", () => {
  const result = analysis({
    orders: [
      order(),
      order({ id: "cancelled", order_status: "Cancelled", total: "100.000" }),
      order({ id: "unpaid", payment_status: "Unpaid", total: "8.000" }),
      order({ id: "failed", payment_status: "Failed", total: "2.000" }),
      order({ id: "refunded", payment_status: "Refunded", total: "3.000" }),
    ],
    items: [
      item(),
      item({ id: "item-cancelled", order_id: "cancelled", quantity: 20 }),
      item({ id: "item-unpaid", order_id: "unpaid", quantity: 4 }),
    ],
  });
  assert.equal(result.financial.paidOrderTotal, "19.000");
  assert.equal(result.financial.unpaidOrPendingOrderTotal, "8.000");
  assert.equal(result.financial.failedOrRefundedOrderTotal, "5.000");
  assert.equal(result.productPerformance.bestSellers["30d"][0].paidUnits, 2);
});

test("allocates discounts to paid product revenue and excludes general shipping from product profit", () => {
  const result = analysis();
  assert.equal(result.productPerformance.bestSellers["90d"][0].paidRevenue, "18.000");
  assert.equal(result.productPerformance.mostProfitable[0].estimatedProfit, "6.000");
  assert.equal(result.profitLeaks.shippingExpensesFromLedger, "5.000");
  assert.match(result.productPerformance.costBasisNote, /current saved unit costs/);
});

test("does not recommend an exact restock quantity when paid history is insufficient", () => {
  const result = analysis();
  assert.equal(result.restocking.length, 1);
  assert.equal(result.restocking[0].suggestedQuantity, null);
  assert.match(result.restocking[0].reason, /insufficient/);
});

test("chat facts exclude customer details and include explicit accounting rules", () => {
  const facts = buildChatFacts(analysis());
  assert.equal("customer" in facts, false);
  assert.equal(facts.paidOrderRevenue, "19.000");
  assert.equal(facts.monthToDate.from, "2026-03-01");
  assert.ok(facts.dataRules.some((rule) => rule.includes("never added together")));
});

test("pricing advice calculates exact profit and margin from trusted product costs", () => {
  const result = calculatePriceAdvice(product(), "12.500");
  assert.equal(result.totalUnitCost, "6.000");
  assert.equal(result.proposedUnitProfit, "6.500");
  assert.equal(result.proposedMarginPercent, "52.00");
  assert.equal(result.profitChangePerUnit, "2.500");
  assert.equal(calculatePriceAdvice(product(), "١٢٫٥٠٠").proposedPrice, "12.500");
});

test("rejects malformed or negative stored amounts instead of inventing a figure", () => {
  assert.throws(() => calculatePriceAdvice(product(), "-2"), /greater than zero/);
  assert.throws(() => buildAiAnalysis({
    transactions: [{ transaction_type: "income", amount: "bad", currency_code: "KWD", transaction_date: "2026-03-10", category: null }],
    orders: [], items: [], products: [], currencyCode: "KWD", period: "7d", today: "2026-03-10",
  }), /invalid amount/);
});

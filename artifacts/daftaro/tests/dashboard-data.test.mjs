import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysToDateKey,
  buildDashboardTrend,
  buildExpenseCategoryTotals,
  calculateDashboardComparison,
  getDateRangeForPreset,
  getPreviousDateRange,
} from "../src/lib/dashboard-data.ts";

const transaction = (overrides = {}) => ({
  id: "transaction-1",
  transaction_type: "income",
  amount: "100.000",
  currency_code: "KWD",
  transaction_date: "2026-03-10",
  description: "Test transaction",
  category: null,
  created_at: "2026-03-10T12:00:00.000Z",
  ...overrides,
});

test("creates exact inclusive date presets and same-length previous periods", () => {
  assert.equal(addDaysToDateKey("2024-03-01", -1), "2024-02-29");
  assert.deepEqual(getDateRangeForPreset("7d", "2024-03-01"), {
    from: "2024-02-24",
    to: "2024-03-01",
  });
  assert.deepEqual(getDateRangeForPreset("ytd", "2024-02-29"), {
    from: "2024-01-01",
    to: "2024-02-29",
  });
  assert.deepEqual(
    getPreviousDateRange({ from: "2024-03-01", to: "2024-03-07" }),
    { from: "2024-02-23", to: "2024-02-29" },
  );
});

test("compares financial totals without combining currencies", () => {
  const previous = [
    transaction({ transaction_type: "income", amount: "100.000" }),
    transaction({ transaction_type: "expense", amount: "80.000" }),
    transaction({ currency_code: "SAR", amount: "900.000" }),
  ];
  const current = [
    transaction({ transaction_type: "income", amount: "150.000" }),
    transaction({ transaction_type: "expense", amount: "100.000" }),
    transaction({ currency_code: "SAR", amount: "2.000" }),
  ];
  const comparison = calculateDashboardComparison(current, previous, "KWD");

  assert.equal(comparison.current.netProfitMilli, 50000n);
  assert.equal(comparison.previous.netProfitMilli, 20000n);
  assert.equal(comparison.incomeChangePercentHundredths, 5000n);
  assert.equal(comparison.expensesChangePercentHundredths, 2500n);
  assert.equal(comparison.netProfitChangePercentHundredths, 15000n);
  assert.equal(comparison.marginChangeHundredths, 1333n);
});

test("keeps prior loss comparisons signed and avoids a zero-baseline percentage", () => {
  const comparison = calculateDashboardComparison(
    [transaction({ transaction_type: "income", amount: "20.000" })],
    [transaction({ transaction_type: "expense", amount: "40.000" })],
    "KWD",
  );

  assert.equal(comparison.previous.netProfitMilli, -40000n);
  assert.equal(comparison.netProfitChangePercentHundredths, 15000n);
  assert.equal(comparison.incomeChangePercentHundredths, null);
  assert.equal(comparison.marginChangeHundredths, null);
});

test("builds complete daily trends with zero buckets and exact totals", () => {
  const trend = buildDashboardTrend(
    [
      transaction({ transaction_date: "2026-03-01", amount: "12.345" }),
      transaction({ transaction_date: "2026-03-03", transaction_type: "expense", amount: "2.125" }),
      transaction({ transaction_date: "2026-03-03", currency_code: "SAR", amount: "900.000" }),
    ],
    { from: "2026-03-01", to: "2026-03-03" },
    "KWD",
    "en",
  );

  assert.equal(trend.length, 3);
  assert.deepEqual(trend.map((point) => point.key), ["2026-03-01", "2026-03-02", "2026-03-03"]);
  assert.deepEqual(trend.map((point) => point.incomeMilli), [12345n, 0n, 0n]);
  assert.deepEqual(trend.map((point) => point.expensesMilli), [0n, 0n, 2125n]);
});

test("groups monthly amounts and ranks expense categories by exact totals", () => {
  const rows = [
    transaction({ transaction_date: "2026-01-31", amount: "5.111" }),
    transaction({ transaction_date: "2026-02-01", amount: "7.222" }),
    transaction({ transaction_type: "expense", category: "materials", amount: "10.001", transaction_date: "2026-02-10" }),
    transaction({ transaction_type: "expense", category: "shipping", amount: "3.000", transaction_date: "2026-02-11" }),
  ];
  const trend = buildDashboardTrend(
    rows,
    { from: "2026-01-01", to: "2026-02-28" },
    "KWD",
    "ar",
  );
  const categories = buildExpenseCategoryTotals(
    rows,
    { from: "2026-02-01", to: "2026-02-28" },
    "KWD",
  );

  assert.deepEqual(trend.map((point) => point.key), ["2026-01", "2026-02"]);
  assert.deepEqual(trend.map((point) => point.incomeMilli), [5111n, 7222n]);
  assert.deepEqual(categories.map((entry) => [entry.category, entry.amountMilli]), [
    ["materials", 10001n],
    ["shipping", 3000n],
  ]);
});

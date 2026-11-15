import assert from "node:assert/strict";
import test from "node:test";
import { calculateFinancialSummaries } from "../src/lib/financial-summary.ts";

test("calculates net profit and margin from actual transaction rows", () => {
  const [summary] = calculateFinancialSummaries([
    { transaction_type: "income", amount: "100.000", currency_code: "KWD" },
    { transaction_type: "income", amount: "25.500", currency_code: "KWD" },
    { transaction_type: "expense", amount: "20.250", currency_code: "KWD" },
  ]);

  assert.equal(summary.totalIncomeMilli, 125500n);
  assert.equal(summary.totalExpensesMilli, 20250n);
  assert.equal(summary.netProfitMilli, 105250n);
  assert.equal(summary.profitMarginHundredths, 8386n);
});

test("returns no margin when there is no income", () => {
  const [summary] = calculateFinancialSummaries([
    { transaction_type: "expense", amount: "5.000", currency_code: "KWD" },
  ]);

  assert.equal(summary.netProfitMilli, -5000n);
  assert.equal(summary.profitMarginHundredths, null);
});

test("shows a negative net profit and margin when expenses exceed income", () => {
  const [summary] = calculateFinancialSummaries([
    { transaction_type: "income", amount: "100.000", currency_code: "KWD" },
    { transaction_type: "expense", amount: "125.000", currency_code: "KWD" },
  ]);

  assert.equal(summary.netProfitMilli, -25000n);
  assert.equal(summary.profitMarginHundredths, -2500n);
});

test("keeps currencies separate and orders the business currency first", () => {
  const summaries = calculateFinancialSummaries(
    [
      { transaction_type: "income", amount: "10.000", currency_code: "USD" },
      { transaction_type: "income", amount: "8.000", currency_code: "KWD" },
      { transaction_type: "expense", amount: "2.000", currency_code: "USD" },
    ],
    "KWD",
  );

  assert.deepEqual(
    summaries.map((summary) => summary.currency_code),
    ["KWD", "USD"],
  );
  assert.equal(summaries[0].netProfitMilli, 8000n);
  assert.equal(summaries[1].netProfitMilli, 8000n);
});

test("rejects invalid database amounts instead of silently omitting them", () => {
  assert.throws(
    () =>
      calculateFinancialSummaries([
        {
          transaction_type: "income",
          amount: "not-a-number",
          currency_code: "KWD",
        },
      ]),
    /invalid amount/,
  );
});

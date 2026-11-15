import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateProductMetrics,
  formatMarginHundredths,
  formatMilliAmount,
  milliToDatabaseValue,
  parseAmountToMilli,
} from "../src/lib/money.ts";

test("parses decimal values to exact thousandths", () => {
  assert.equal(parseAmountToMilli("12.345"), 12345n);
  assert.equal(milliToDatabaseValue(12345n), "12.345");
});

test("accepts Arabic and Persian numerals", () => {
  assert.equal(parseAmountToMilli("١٢٫٣٤٥"), 12345n);
  assert.equal(parseAmountToMilli("۱۲.۳۴۵"), 12345n);
});

test("rejects values outside supported precision", () => {
  assert.equal(parseAmountToMilli("1.2345"), null);
  assert.equal(parseAmountToMilli("-1.000"), null);
  assert.equal(parseAmountToMilli("100000000000.000"), null);
});

test("calculates unit cost, profit, and margin without floating-point math", () => {
  const metrics = calculateProductMetrics("10.000", "3.125", "1.100", "0.500");

  assert.deepEqual(metrics, {
    sellingPriceMilli: 10000n,
    totalCostMilli: 4725n,
    unitProfitMilli: 5275n,
    marginHundredths: 5275n,
  });
});

test("supports zero and negative unit profit margins", () => {
  const breakEven = calculateProductMetrics("1.000", "0.333", "0.333", "0.334");
  const loss = calculateProductMetrics("2.000", "1.000", "2.000", "1.000");

  assert.equal(breakEven?.unitProfitMilli, 0n);
  assert.equal(breakEven?.marginHundredths, 0n);
  assert.equal(loss?.unitProfitMilli, -2000n);
  assert.equal(loss?.marginHundredths, -10000n);
});

test("formats amounts and margins for English and Arabic", () => {
  assert.equal(formatMilliAmount(12345n, "en"), "12.345");
  assert.match(formatMilliAmount(12345n, "ar"), /١٢٫٣٤٥/);
  assert.match(formatMarginHundredths(5275n, "en"), /52\.75/);
  assert.match(formatMarginHundredths(-10000n, "en"), /-100\.00/);
});

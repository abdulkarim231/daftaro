import assert from "node:assert/strict";
import test from "node:test";
import {
  isLowStock,
  parseInventoryCount,
} from "../src/lib/inventory.ts";

test("parses stock counts and Arabic or Persian numerals exactly", () => {
  assert.equal(parseInventoryCount("0"), 0);
  assert.equal(parseInventoryCount(" 18 "), 18);
  assert.equal(parseInventoryCount("١٢"), 12);
  assert.equal(parseInventoryCount("۷"), 7);
});

test("rejects negative, fractional, and out-of-range stock counts", () => {
  assert.equal(parseInventoryCount("-1"), null);
  assert.equal(parseInventoryCount("1.5"), null);
  assert.equal(parseInventoryCount("2e3"), null);
  assert.equal(parseInventoryCount("2147483648"), null);
});

test("marks stock low at or below each product's threshold", () => {
  assert.equal(isLowStock(5, 5), true);
  assert.equal(isLowStock(0, 5), true);
  assert.equal(isLowStock(6, 5), false);
  assert.equal(isLowStock(6, 0), false);
});

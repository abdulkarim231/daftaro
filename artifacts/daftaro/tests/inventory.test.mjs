import assert from "node:assert/strict";
import test from "node:test";
import {
  availableQuantityForOrder,
  findStockShortages,
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

test("adds stock already reserved by the order being edited", () => {
  const products = [
    { id: "product-a", available_quantity: 3 },
    { id: "product-b", available_quantity: 1 },
  ];
  const reservedItems = [
    { product_id: "product-a", quantity: 2 },
    { product_id: "product-b", quantity: 4 },
  ];

  assert.equal(
    availableQuantityForOrder("product-a", products, reservedItems),
    5,
  );
  assert.equal(
    availableQuantityForOrder("product-b", products, reservedItems),
    5,
  );
  assert.equal(availableQuantityForOrder("missing", products, reservedItems), null);
  assert.deepEqual(
    findStockShortages(
      [{ product_id: "product-a", quantity: 5 }],
      products,
      reservedItems,
    ),
    [],
  );
});

test("reports requested quantities that exceed per-product stock", () => {
  const products = [
    { id: "product-a", available_quantity: 3 },
    { id: "product-b", available_quantity: 8 },
  ];

  assert.deepEqual(
    findStockShortages(
      [
        { product_id: "product-a", quantity: 2 },
        { product_id: "product-a", quantity: 2 },
        { product_id: "product-b", quantity: 8 },
      ],
      products,
    ),
    [{ product_id: "product-a", requested: 4, available: 3 }],
  );
});

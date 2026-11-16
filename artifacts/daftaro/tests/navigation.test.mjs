import assert from "node:assert/strict";
import test from "node:test";
import { isAppNavActive } from "../src/lib/navigation.ts";

test("highlights only the selected primary navigation page", () => {
  assert.equal(isAppNavActive(null, "/dashboard"), false);
  assert.equal(isAppNavActive("/dashboard", "/dashboard"), true);
  assert.equal(isAppNavActive("/customers", "/customers"), true);
  assert.equal(isAppNavActive("/transactions", "/products"), false);
});

test("keeps order workflows under the Orders navigation item", () => {
  for (const pathname of ["/orders", "/create-order", "/order-details", "/invoice"]) {
    assert.equal(isAppNavActive(pathname, "/orders"), true, `${pathname} should highlight Orders`);
  }
  assert.equal(isAppNavActive("/customers", "/orders"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStripeTestPaymentLink } from "../src/lib/payment-links.ts";

test("accepts and normalizes Stripe test payment links", () => {
  assert.equal(
    normalizeStripeTestPaymentLink("  https://buy.stripe.com/test_a1B2-c3_  "),
    "https://buy.stripe.com/test_a1B2-c3_",
  );
});

test("rejects live, non-Stripe, and insecure payment links", () => {
  assert.equal(normalizeStripeTestPaymentLink("https://buy.stripe.com/live_123"), null);
  assert.equal(normalizeStripeTestPaymentLink("https://example.com/test_123"), null);
  assert.equal(normalizeStripeTestPaymentLink("http://buy.stripe.com/test_123"), null);
});

test("rejects links containing credentials, query strings, or fragments", () => {
  assert.equal(normalizeStripeTestPaymentLink("https://user:pass@buy.stripe.com/test_123"), null);
  assert.equal(normalizeStripeTestPaymentLink("https://buy.stripe.com/test_123?email=a@example.com"), null);
  assert.equal(normalizeStripeTestPaymentLink("https://buy.stripe.com/test_123#invoice"), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  isStripeTestPaymentLink,
  toStripeUnitAmount,
} from "../src/lib/stripe-invoice-amount.ts";
import { requireStripeTestSecret } from "../src/lib/stripe-client.ts";

test("converts three-decimal Gulf currencies exactly", () => {
  assert.equal(toStripeUnitAmount("12.345", "KWD"), 12345);
  assert.equal(toStripeUnitAmount("0.125", "BHD"), 125);
  assert.equal(toStripeUnitAmount("7", "OMR"), 7000);
});

test("converts two-decimal currencies without rounding", () => {
  assert.equal(toStripeUnitAmount("12.34", "USD"), 1234);
  assert.equal(toStripeUnitAmount("7.1", "SAR"), 710);
  assert.equal(toStripeUnitAmount("3.000", "AED"), 300);
});

test("accepts zero but rejects invalid precision and unsupported currencies", () => {
  assert.equal(toStripeUnitAmount("0.000", "KWD"), 0);
  assert.throws(() => toStripeUnitAmount("1.001", "USD"));
  assert.throws(() => toStripeUnitAmount("-1.00", "USD"));
  assert.throws(() => toStripeUnitAmount("1e3", "USD"));
  assert.throws(() => toStripeUnitAmount("1.00", "XXX"));
});

test("accepts only hosted Stripe test-mode Payment Links", () => {
  assert.equal(isStripeTestPaymentLink("https://buy.stripe.com/test_abc-123"), true);
  assert.equal(isStripeTestPaymentLink("https://buy.stripe.com/live_abc-123"), false);
  assert.equal(isStripeTestPaymentLink("https://example.com/test_abc-123"), false);
  assert.equal(isStripeTestPaymentLink("http://buy.stripe.com/test_abc-123"), false);
});

test("allows only Stripe test secret keys", () => {
  assert.equal(requireStripeTestSecret("sk_test_example"), "sk_test_example");
  assert.throws(() => requireStripeTestSecret(undefined));
  assert.throws(() => requireStripeTestSecret("sk_live_example"));
});

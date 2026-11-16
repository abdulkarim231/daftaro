import assert from "node:assert/strict";
import test from "node:test";
import {
  extractConfirmedStripePayment,
  paymentMatchesInvoiceAmount,
} from "../src/lib/stripe-payment-confirmation.ts";

function event(overrides = {}) {
  return {
    id: "evt_test_123",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        mode: "payment",
        payment_status: "paid",
        payment_link: "plink_test123",
        amount_total: 12345,
        currency: "kwd",
      },
    },
    ...overrides,
  };
}

test("extracts only confirmed test-mode payment-link checkout sessions", () => {
  assert.deepEqual(extractConfirmedStripePayment(event()), {
    eventId: "evt_test_123",
    paymentLinkId: "plink_test123",
    amountTotal: 12345,
    currencyCode: "KWD",
  });

  assert.deepEqual(
    extractConfirmedStripePayment(event({
      type: "checkout.session.async_payment_succeeded",
      data: { object: { ...event().data.object, payment_link: { id: "plink_test123" } } },
    })),
    {
      eventId: "evt_test_123",
      paymentLinkId: "plink_test123",
      amountTotal: 12345,
      currencyCode: "KWD",
    },
  );
});

test("ignores unpaid, unsupported, malformed, and live-mode events", () => {
  assert.equal(
    extractConfirmedStripePayment(event({
      data: { object: { ...event().data.object, payment_status: "unpaid" } },
    })),
    null,
  );
  assert.equal(extractConfirmedStripePayment(event({ type: "payment_intent.succeeded" })), null);
  assert.equal(extractConfirmedStripePayment(event({ livemode: true })), null);
  assert.equal(
    extractConfirmedStripePayment(event({
      data: { object: { ...event().data.object, payment_link: "plink bad" } },
    })),
    null,
  );
});

test("matches payment amount and currency using the invoice currency precision", () => {
  const payment = { amountTotal: 12345, currencyCode: "KWD" };
  assert.equal(paymentMatchesInvoiceAmount(payment, "12.345", "KWD"), true);
  assert.equal(paymentMatchesInvoiceAmount(payment, "12.344", "KWD"), false);
  assert.equal(paymentMatchesInvoiceAmount(payment, "12.345", "USD"), false);
});

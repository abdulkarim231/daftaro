import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStripeIncomeTransaction,
  extractConfirmedStripePayment,
  paymentMatchesInvoiceAmount,
} from "../src/lib/stripe-payment-confirmation.ts";

function event(overrides = {}) {
  return {
    id: "evt_test_123",
    type: "checkout.session.completed",
    livemode: false,
    created: 1794820000,
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
    transactionDate: "2026-11-16",
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
      transactionDate: "2026-11-16",
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
  assert.equal(extractConfirmedStripePayment(event({ created: Number.NaN })), null);
});

test("uses the Kuwait calendar date for late-night payment events", () => {
  const lateUtcTimestamp = Date.parse("2026-11-16T21:30:00.000Z") / 1000;
  const payment = extractConfirmedStripePayment(event({ created: lateUtcTimestamp }));

  assert.equal(payment?.transactionDate, "2026-11-17");
});

test("matches payment amount and currency using the invoice currency precision", () => {
  const payment = { amountTotal: 12345, currencyCode: "KWD" };
  assert.equal(paymentMatchesInvoiceAmount(payment, "12.345", "KWD"), true);
  assert.equal(paymentMatchesInvoiceAmount(payment, "12.344", "KWD"), false);
  assert.equal(paymentMatchesInvoiceAmount(payment, "12.345", "USD"), false);
});

test("builds one stable income row for a confirmed order payment", () => {
  const entry = buildStripeIncomeTransaction(
    { id: "order-uuid", order_number: "ORD-2026-00000001", total: "12.345", currency_code: "KWD" },
    "user-uuid",
    "2026-11-16",
  );

  assert.deepEqual(entry, {
    id: "order-uuid",
    user_id: "user-uuid",
    transaction_type: "income",
    amount: "12.345",
    currency_code: "KWD",
    transaction_date: "2026-11-16",
    description: "دخل من الطلب ORD-2026-00000001",
    category: null,
  });
});

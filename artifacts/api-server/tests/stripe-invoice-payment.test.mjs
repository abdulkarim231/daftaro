import assert from "node:assert/strict";
import test from "node:test";
import {
  createInvoicePaymentLink,
  deactivateInvoicePaymentLink,
} from "../src/lib/stripe-invoice-payment.ts";

test("creates a one-time Stripe link from the saved invoice amount", async () => {
  const calls = {};
  const stripe = {
    products: {
      search: async (params) => {
        calls.productSearch = params;
        return { data: [] };
      },
      create: async (params, options) => {
        calls.product = { params, options };
        return { id: "prod_invoice", active: true };
      },
    },
    prices: {
      list: async (params) => {
        calls.priceList = params;
        return { data: [] };
      },
      create: async (params, options) => {
        calls.price = { params, options };
        return { id: "price_invoice", active: true };
      },
    },
    paymentLinks: {
      create: async (params, options) => {
        calls.paymentLink = { params, options };
        return {
          id: "plink_test123",
          url: "https://buy.stripe.com/test_abc123",
        };
      },
    },
  };

  const result = await createInvoicePaymentLink(stripe, {
    invoiceId: "invoice-uuid",
    invoiceNumber: "INV-001",
    orderId: "order-uuid",
    orderNumber: "ORD-001",
    total: "12.345",
    currencyCode: "KWD",
    previousPaymentLinkId: "plink_old123",
  });

  assert.deepEqual(result, {
    id: "plink_test123",
    url: "https://buy.stripe.com/test_abc123",
  });
  assert.equal(calls.price.params.unit_amount, 12345);
  assert.equal(calls.price.params.currency, "kwd");
  assert.deepEqual(calls.paymentLink.params.line_items, [
    { price: "price_invoice", quantity: 1 },
  ]);
  assert.match(calls.paymentLink.options.idempotencyKey, /plink_old123$/);
  assert.equal(calls.product.params.metadata.daftaro_invoice_id, "invoice-uuid");
});

test("does not create a payment link for a zero-total invoice", async () => {
  let stripeCalled = false;
  const stripe = {
    products: {
      search: async () => {
        stripeCalled = true;
        return { data: [] };
      },
    },
  };

  await assert.rejects(
    createInvoicePaymentLink(stripe, {
      invoiceId: "invoice-uuid",
      invoiceNumber: "INV-001",
      orderId: "order-uuid",
      orderNumber: "ORD-001",
      total: "0.000",
      currencyCode: "KWD",
      previousPaymentLinkId: null,
    }),
  );
  assert.equal(stripeCalled, false);
});

test("cancellation disables a Stripe test link without creating a charge", async () => {
  const calls = [];
  const stripe = {
    paymentLinks: {
      update: async (id, params) => {
        calls.push({ id, params });
      },
      create: async () => {
        throw new Error("Cancellation must not create another payment link.");
      },
    },
    paymentIntents: {
      create: async () => {
        throw new Error("Cancellation must never create a payment intent.");
      },
    },
  };

  await deactivateInvoicePaymentLink(stripe, "plink_test123");

  assert.deepEqual(calls, [{ id: "plink_test123", params: { active: false } }]);
});

test("treats an already-removed Stripe payment link as safely deactivated", async () => {
  const stripe = {
    paymentLinks: {
      update: async () => {
        const error = new Error("No such payment link");
        error.code = "resource_missing";
        throw error;
      },
    },
  };

  await assert.doesNotReject(
    deactivateInvoicePaymentLink(stripe, "plink_missing123"),
  );
});

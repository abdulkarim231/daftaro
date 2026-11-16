import Stripe from "stripe";
import {
  isStripeTestPaymentLink,
  toStripeUnitAmount,
} from "./stripe-invoice-amount.ts";

export interface InvoicePaymentLinkInput {
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  total: string | number;
  currencyCode: string;
  previousPaymentLinkId: string | null;
}

export interface CreatedInvoicePaymentLink {
  id: string;
  url: string;
}

const PAYMENT_LINK_ID = /^plink_[A-Za-z0-9]+$/;

function idempotencyPart(value: string | null): string {
  if (!value) return "initial";
  return /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : "previous";
}

export async function deactivateInvoicePaymentLink(
  stripe: Stripe,
  paymentLinkId: string | null,
): Promise<void> {
  if (!paymentLinkId || !PAYMENT_LINK_ID.test(paymentLinkId)) return;

  try {
    await stripe.paymentLinks.update(paymentLinkId, { active: false });
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "resource_missing"
    ) {
      return;
    }
    throw error;
  }
}

export async function createInvoicePaymentLink(
  stripe: Stripe,
  input: InvoicePaymentLinkInput,
): Promise<CreatedInvoicePaymentLink> {
  const unitAmount = toStripeUnitAmount(input.total, input.currencyCode);
  if (unitAmount <= 0) {
    throw new Error("A payment link cannot be created for a zero total.");
  }

  const search = await stripe.products.search({
    query: `metadata['daftaro_invoice_id']:'${input.invoiceId}'`,
    limit: 1,
  });
  let product = search.data.find((candidate) => candidate.active) ?? search.data[0];
  if (!product) {
    product = await stripe.products.create(
      {
        name: `Invoice ${input.invoiceNumber}`,
        description: `Order ${input.orderNumber}`,
        metadata: {
          daftaro_invoice_id: input.invoiceId,
          daftaro_order_id: input.orderId,
        },
      },
      { idempotencyKey: `daftaro-invoice-product-${input.invoiceId}` },
    );
  } else if (!product.active) {
    product = await stripe.products.update(product.id, { active: true });
  }

  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });
  let price = existingPrices.data.find(
    (candidate) =>
      candidate.active
      && candidate.type === "one_time"
      && candidate.currency === input.currencyCode.toLowerCase()
      && candidate.unit_amount === unitAmount,
  );
  if (!price) {
    price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: unitAmount,
        currency: input.currencyCode.toLowerCase(),
        metadata: {
          daftaro_invoice_id: input.invoiceId,
          daftaro_order_id: input.orderId,
        },
      },
      {
        idempotencyKey:
          `daftaro-invoice-price-${input.invoiceId}-${input.currencyCode}-${unitAmount}`,
      },
    );
  }

  const link = await stripe.paymentLinks.create(
    {
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        daftaro_invoice_id: input.invoiceId,
        daftaro_invoice_number: input.invoiceNumber,
        daftaro_order_id: input.orderId,
      },
    },
    {
      idempotencyKey:
        `daftaro-invoice-link-${input.invoiceId}-${input.currencyCode}-${unitAmount}-${idempotencyPart(input.previousPaymentLinkId)}`,
    },
  );

  if (!link.url || !isStripeTestPaymentLink(link.url)) {
    throw new Error("Stripe did not return a valid test-mode payment link.");
  }

  return { id: link.id, url: link.url };
}

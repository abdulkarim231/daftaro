import { toStripeUnitAmount } from "./stripe-invoice-amount.ts";

export interface StripeCheckoutEventLike {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: unknown };
}

export interface ConfirmedStripePayment {
  eventId: string;
  paymentLinkId: string;
  amountTotal: number;
  currencyCode: string;
}

type CheckoutSessionLike = {
  mode?: unknown;
  payment_status?: unknown;
  payment_link?: unknown;
  amount_total?: unknown;
  currency?: unknown;
};

const PAID_CHECKOUT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);
const PAYMENT_LINK_ID = /^plink_[A-Za-z0-9]+$/;

export function extractConfirmedStripePayment(
  event: StripeCheckoutEventLike,
): ConfirmedStripePayment | null {
  if (event.livemode || !PAID_CHECKOUT_EVENTS.has(event.type)) return null;
  if (!event.data || typeof event.data.object !== "object" || event.data.object === null) return null;

  const session = event.data.object as CheckoutSessionLike;
  if (session.mode !== "payment" || session.payment_status !== "paid") return null;

  const paymentLinkId = typeof session.payment_link === "string"
    ? session.payment_link
    : session.payment_link && typeof session.payment_link === "object" && "id" in session.payment_link
      ? String(session.payment_link.id)
      : "";
  if (!PAYMENT_LINK_ID.test(paymentLinkId)) return null;

  if (
    typeof session.amount_total !== "number"
    || !Number.isSafeInteger(session.amount_total)
    || session.amount_total <= 0
    || typeof session.currency !== "string"
    || !/^[a-z]{3}$/i.test(session.currency)
    || typeof event.id !== "string"
    || !event.id
  ) {
    return null;
  }

  return {
    eventId: event.id,
    paymentLinkId,
    amountTotal: session.amount_total,
    currencyCode: session.currency.toUpperCase(),
  };
}

export function paymentMatchesInvoiceAmount(
  payment: Pick<ConfirmedStripePayment, "amountTotal" | "currencyCode">,
  invoiceTotal: string | number,
  invoiceCurrency: string,
): boolean {
  if (payment.currencyCode.toUpperCase() !== invoiceCurrency.toUpperCase()) return false;
  try {
    return payment.amountTotal === toStripeUnitAmount(invoiceTotal, invoiceCurrency);
  } catch {
    return false;
  }
}

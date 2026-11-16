import { toStripeUnitAmount } from "./stripe-invoice-amount.ts";

export interface StripeCheckoutEventLike {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
  data: { object: unknown };
}

export interface ConfirmedStripePayment {
  eventId: string;
  paymentLinkId: string;
  amountTotal: number;
  currencyCode: string;
  transactionDate: string;
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

function kuwaitDateFromUnixTimestamp(timestamp: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuwait",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp * 1000));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function extractConfirmedStripePayment(
  event: StripeCheckoutEventLike,
): ConfirmedStripePayment | null {
  if (
    event.livemode
    || !PAID_CHECKOUT_EVENTS.has(event.type)
    || !Number.isSafeInteger(event.created)
    || event.created <= 0
  ) return null;
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
    transactionDate: kuwaitDateFromUnixTimestamp(event.created),
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

export function buildStripeIncomeTransaction(
  order: {
    id: string;
    order_number: string;
    total: string | number;
    currency_code: string;
  },
  userId: string,
  transactionDate: string,
) {
  return {
    // Reusing the order UUID makes Stripe retries idempotent without a schema change.
    id: order.id,
    user_id: userId,
    transaction_type: "income" as const,
    amount: String(order.total),
    currency_code: order.currency_code,
    transaction_date: transactionDate,
    description: `دخل من الطلب ${order.order_number}`,
    category: null,
  };
}

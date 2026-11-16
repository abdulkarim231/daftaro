const STRIPE_TEST_PAYMENT_LINK =
  /^https:\/\/buy\.stripe\.com\/test_[A-Za-z0-9_-]+\/?$/;

export function normalizeStripeTestPaymentLink(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:"
      || url.hostname !== "buy.stripe.com"
      || url.username
      || url.password
      || url.port
      || url.search
      || url.hash
      || !STRIPE_TEST_PAYMENT_LINK.test(url.href)
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function canPayPublicInvoice(
  orderStatus: string,
  paymentUrl: string | null,
): boolean {
  return orderStatus !== "Cancelled" && Boolean(paymentUrl);
}

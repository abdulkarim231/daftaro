const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  AED: 2,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  QAR: 2,
  SAR: 2,
  USD: 2,
};

export class InvoiceAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceAmountError";
  }
}

export function toStripeUnitAmount(
  amount: string | number,
  currencyCode: string,
): number {
  const decimals = CURRENCY_DECIMALS[currencyCode];
  if (decimals === undefined) {
    throw new InvoiceAmountError("Unsupported invoice currency.");
  }

  const value = String(amount).trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) {
    throw new InvoiceAmountError("Invoice total is invalid.");
  }

  const whole = BigInt(match[1]);
  const fraction = match[2] ?? "";
  const extraFraction = fraction.slice(decimals);
  if (/[1-9]/.test(extraFraction)) {
    throw new InvoiceAmountError("Invoice total has unsupported precision.");
  }

  const minorUnits = BigInt(10 ** decimals);
  const paddedFraction = fraction.slice(0, decimals).padEnd(decimals, "0");
  const fractionAmount = paddedFraction ? BigInt(paddedFraction) : 0n;
  const unitAmount = whole * minorUnits + fractionAmount;
  if (unitAmount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InvoiceAmountError("Invoice total exceeds Stripe's supported range.");
  }

  return Number(unitAmount);
}

export function isStripeTestPaymentLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:"
      && url.hostname === "buy.stripe.com"
      && !url.username
      && !url.password
      && !url.port
      && !url.search
      && !url.hash
      && /^\/test_[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

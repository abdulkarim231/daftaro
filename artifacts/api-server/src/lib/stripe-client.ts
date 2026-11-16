import Stripe from "stripe";

export class StripeTestConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeTestConfigurationError";
  }
}

export function requireStripeTestSecret(secretKey: string | undefined): string {
  if (!secretKey) {
    throw new StripeTestConfigurationError("Stripe test key is missing.");
  }
  if (!secretKey.startsWith("sk_test_")) {
    throw new StripeTestConfigurationError("A Stripe test-mode key is required.");
  }
  return secretKey;
}

export function createStripeTestClient(): Stripe {
  return new Stripe(requireStripeTestSecret(process.env.STRIPE_SECRET_KEY));
}

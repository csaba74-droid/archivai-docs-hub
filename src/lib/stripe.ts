import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const stripeKey = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const environment: StripeEnv = stripeKey?.startsWith("pk_test_") ? "sandbox" : "live";

console.log("[Stripe] publishable key injected", {
  hasPaymentsClientToken: Boolean(import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN),
  hasStripePublishableKeyFallback: Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY),
  hasStripeKey: Boolean(stripeKey),
  environment,
});

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!stripeKey) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN or VITE_STRIPE_PUBLISHABLE_KEY is not set");
    stripePromise = loadStripe(stripeKey);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return environment;
}

export function hasStripePublishableKey(): boolean {
  return Boolean(stripeKey);
}

export function isStripeTestMode(): boolean {
  return stripeKey?.startsWith("pk_test_") ?? false;
}

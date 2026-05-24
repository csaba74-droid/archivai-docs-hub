// Lightweight client-side helpers for Stripe.
// Uses VITE_STRIPE_PUBLISHABLE_KEY (publishable key, safe to expose).
// We use redirect-based Stripe Checkout, so stripe.js is NOT loaded in the
// browser — only the publishable key prefix is read to detect sandbox/live.

export type StripeEnv = "sandbox" | "live";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export function getStripeEnvironment(): StripeEnv {
  return publishableKey?.startsWith("pk_live_") ? "live" : "sandbox";
}

export function hasStripePublishableKey(): boolean {
  return Boolean(publishableKey);
}

export function isStripeTestMode(): boolean {
  return publishableKey?.startsWith("pk_test_") ?? false;
}

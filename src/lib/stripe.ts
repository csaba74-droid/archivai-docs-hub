// Lightweight client-side helpers for the Lovable managed Stripe integration.
// We use redirect-based Stripe Checkout, so stripe.js is NOT loaded in the
// browser — only the publishable token prefix is read to detect sandbox/live.

export type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function getStripeEnvironment(): StripeEnv {
  return clientToken?.startsWith("pk_live_") ? "live" : "sandbox";
}

export function hasStripePublishableKey(): boolean {
  return Boolean(clientToken);
}

export function isStripeTestMode(): boolean {
  return clientToken?.startsWith("pk_test_") ?? false;
}

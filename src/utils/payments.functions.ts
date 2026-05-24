import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const VALID_PRICE_IDS = new Set([
  "alap_monthly",
  "alap_yearly",
  "pro_monthly",
  "pro_yearly",
  "vallalati_monthly",
  "vallalati_yearly",
]);

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      priceId: string;
      customerEmail?: string;
      userId?: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!VALID_PRICE_IDS.has(data.priceId)) throw new Error("Invalid priceId");
      if (!data.userId) throw new Error("userId is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const stripe = createStripeClient(data.environment);

    const prices = await stripe.prices.list({ lookup_keys: [data.priceId], limit: 1 });
    if (!prices.data.length) throw new Error(`Price not found for lookup_key: ${data.priceId}`);
    const stripePrice = prices.data[0];

    const customerId = await resolveOrCreateCustomer(stripe, {
      email: data.customerEmail,
      userId: data.userId,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded_page" as any,
      return_url: data.returnUrl,
      customer: customerId,
      subscription_data: {
        trial_period_days: 14,
        metadata: { userId: data.userId!, priceId: data.priceId },
      },
      metadata: { userId: data.userId!, priceId: data.priceId },
    });

    return session.client_secret;
  });

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const VALID_PRICE_IDS = new Set([
  "alap_monthly",
  "alap_yearly",
  "pro_monthly",
  "pro_yearly",
  "vallalati_monthly",
  "vallalati_yearly",
]);

async function verifyAccessToken(accessToken: string): Promise<{ id: string; email: string | undefined }> {
  const url = process.env.APP_SUPABASE_URL;
  const key = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("APP_SUPABASE_URL / APP_SUPABASE_SERVICE_ROLE_KEY not set");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Invalid session");
  return { id: data.user.id, email: data.user.email };
}

function getAppSupabase() {
  const url = process.env.APP_SUPABASE_URL;
  const key = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("APP_SUPABASE_URL / APP_SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

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
    console.log("[checkout] start", { priceId: data.priceId, env: data.environment });
    try {
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId], limit: 1 });
      if (!prices.data.length) {
        throw new Error(`Stripe price not found for lookup_key: ${data.priceId}`);
      }
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
        // No trial_period_days: the app already gives a 14-day no-card local
        // trial via use-subscription. Adding Stripe's trial would stack 28
        // free days. Users who reach checkout pay immediately.
        subscription_data: {
          metadata: { userId: data.userId!, priceId: data.priceId },
        },
        metadata: { userId: data.userId!, priceId: data.priceId },
      });

      if (!session.client_secret) {
        throw new Error("Stripe session created but client_secret is missing");
      }
      return session.client_secret;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[checkout] failed", { message });
      throw new Error(`Checkout session creation failed: ${message}`);
    }
  });

/**
 * Stripe Customer Portal. Client opens the returned URL in a NEW TAB
 * (the portal cannot be iframed). Webhooks reflect any changes back into
 * the subscriptions table.
 */
export const createPortalSession = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { accessToken: string; returnUrl: string; environment: StripeEnv }) => {
      if (!data.accessToken) throw new Error("accessToken is required");
      if (!data.returnUrl) throw new Error("returnUrl is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    try {
      const user = await verifyAccessToken(data.accessToken);
      const admin = getAppSupabase();
      const { data: sub, error } = await admin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!sub?.stripe_customer_id) {
        throw new Error(
          "Nincs aktív Stripe előfizetés. Válassz csomagot a fizetési beállítások eléréséhez.",
        );
      }

      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        return_url: data.returnUrl,
      });
      return portal.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[portal] failed", { message });
      throw new Error(message);
    }
  });

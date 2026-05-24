import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getAppSupabase() {
  if (!_supabase) {
    const url = process.env.APP_SUPABASE_URL;
    const key = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("APP_SUPABASE_URL / APP_SUPABASE_SERVICE_ROLE_KEY not set");
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

type Plan = "alap" | "pro" | "vallalati";

function lookupToPlan(lookupKey: string | undefined | null): Plan | null {
  if (!lookupKey) return null;
  if (lookupKey.startsWith("alap")) return "alap";
  if (lookupKey.startsWith("pro")) return "pro";
  if (lookupKey.startsWith("vallalati")) return "vallalati";
  return null;
}

function mapStatus(stripeStatus: string): "active" | "past_due" | "canceled" | "inactive" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}

async function upsertFromSubscription(subscription: any) {
  const userId =
    subscription.metadata?.userId ??
    subscription.subscription_details?.metadata?.userId;
  if (!userId) {
    console.error("[webhook] no userId in subscription metadata", subscription.id);
    return;
  }

  const item = subscription.items?.data?.[0];
  const lookupKey =
    item?.price?.lookup_key ??
    subscription.metadata?.priceId ??
    null;
  const plan = lookupToPlan(lookupKey);
  if (!plan) {
    console.error("[webhook] could not resolve plan from", lookupKey);
    return;
  }

  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const { error } = await getAppSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan,
        status: mapStatus(subscription.status),
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) console.error("[webhook] upsert error", error);
}

async function handleSubscriptionDeleted(subscription: any) {
  const { error } = await getAppSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);
  if (error) console.error("[webhook] delete update error", error);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertFromSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object);
      break;
    default:
      console.log("[webhook] unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[webhook] invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[webhook] error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";


let _supabase: any = null;
function getAppSupabase(): any {
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

function mapStatus(stripeStatus: string): "trialing" | "active" | "past_due" | "canceled" | "inactive" {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
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

async function handleInvoicePaymentSucceeded(invoice: any, env: StripeEnv) {
  // Only act on the first paid invoice for a brand-new subscription.
  if (invoice.billing_reason !== "subscription_create") return;

  const customerId = invoice.customer as string | null;
  if (!customerId) return;

  const supabase = getAppSupabase();

  // Resolve the paying user from the subscriptions table by Stripe customer id.
  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  const userId = subRow?.user_id as string | undefined;
  if (!userId) {
    console.log("[webhook] invoice.payment_succeeded: no user for customer", customerId);
    return;
  }

  // Look up referrer and reward flag.
  const { data: profile } = await supabase
    .from("profiles")
    .select("referred_by, referral_reward_sent")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.referred_by || profile.referral_reward_sent) return;

  // Resolve the referrer's Stripe customer id.
  const { data: referrerSub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", profile.referred_by)
    .maybeSingle();
  const referrerCustomerId = referrerSub?.stripe_customer_id as string | undefined;
  if (!referrerCustomerId) {
    console.log("[webhook] referrer has no stripe_customer_id", profile.referred_by);
    return;
  }

  try {
    const stripe = createStripeClient(env);
    await stripe.customers.update(referrerCustomerId, {
      coupon: "REFERRAL_REWARD",
    });
    await supabase
      .from("profiles")
      .update({ referral_reward_sent: true })
      .eq("id", userId);
    console.log("[webhook] applied REFERRAL_REWARD to", referrerCustomerId, "for referred user", userId);
  } catch (err) {
    console.error("[webhook] failed to apply REFERRAL_REWARD", err);
  }
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
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object, env);
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

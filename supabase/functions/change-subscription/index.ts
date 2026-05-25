// Supabase Edge Function: change-subscription
// Updates an existing Stripe subscription to a new plan with prorations.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PlanKey = "alap" | "pro" | "vallalati";
type Interval = "monthly" | "yearly";

const PRICES: Record<PlanKey, { monthly: number; yearly: number }> = {
  alap: { monthly: 2990, yearly: 30490 },
  pro: { monthly: 4990, yearly: 50890 },
  vallalati: { monthly: 9990, yearly: 101890 },
};

const PLAN_NAMES: Record<PlanKey, string> = {
  alap: "Alap csomag",
  pro: "Pro csomag",
  vallalati: "Vállalati csomag",
};

interface Payload {
  priceId: string; // e.g. "pro_monthly"
  subscriptionId: string; // stripe_subscription_id
}

function parsePriceId(priceId: string): { plan: PlanKey; interval: Interval } | null {
  const [plan, interval] = priceId.split("_") as [PlanKey, Interval];
  if (!(plan in PRICES)) return null;
  if (interval !== "monthly" && interval !== "yearly") return null;
  return { plan, interval };
}

async function stripeGet(stripeKey: string, path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  if (!res.ok) throw new Error(`Stripe GET ${path} failed: ${await res.text()}`);
  return res.json();
}

async function stripePost(stripeKey: string, path: string, params: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Stripe POST ${path} failed: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Payload;
    if (!body.priceId || !body.subscriptionId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: priceId, subscriptionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = parsePriceId(body.priceId);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "Invalid priceId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { plan, interval } = parsed;
    const amount = PRICES[plan][interval];
    const stripeInterval = interval === "monthly" ? "month" : "year";

    // Fetch existing subscription to get the current item id
    const sub = await stripeGet(stripeKey, `/subscriptions/${body.subscriptionId}`);
    const itemId = sub.items?.data?.[0]?.id as string | undefined;
    if (!itemId) {
      return new Response(
        JSON.stringify({ error: "Subscription has no items" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create a new inline price (matches the create-checkout-session pattern)
    const priceParams = new URLSearchParams();
    priceParams.append("currency", "huf");
    priceParams.append("unit_amount", String(amount));
    priceParams.append("recurring[interval]", stripeInterval);
    priceParams.append(
      "product_data[name]",
      `${PLAN_NAMES[plan]} (${interval === "monthly" ? "havi" : "éves"})`,
    );
    const newPrice = await stripePost(stripeKey, "/prices", priceParams);

    // Update subscription: swap the item to the new price, prorate.
    const updateParams = new URLSearchParams();
    updateParams.append("items[0][id]", itemId);
    updateParams.append("items[0][price]", newPrice.id);
    updateParams.append("proration_behavior", "create_prorations");
    updateParams.append("metadata[plan]", plan);
    updateParams.append("metadata[interval]", interval);
    updateParams.append("metadata[priceId]", body.priceId);

    const updated = await stripePost(
      stripeKey,
      `/subscriptions/${body.subscriptionId}`,
      updateParams,
    );

    return new Response(
      JSON.stringify({ ok: true, subscriptionId: updated.id, plan, interval }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[change-subscription] failed", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

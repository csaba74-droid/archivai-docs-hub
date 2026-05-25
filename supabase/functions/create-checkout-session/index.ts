// Supabase Edge Function: create-checkout-session
// Creates a Stripe Checkout Session (subscription mode) and returns the URL.

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
  priceId: string;
  email?: string;
  userId: string;
}

function parsePriceId(priceId: string): { plan: PlanKey; interval: Interval } | null {
  const [plan, interval] = priceId.split("_") as [PlanKey, Interval];
  if (!(plan in PRICES)) return null;
  if (interval !== "monthly" && interval !== "yearly") return null;
  return { plan, interval };
}

async function findOrCreateCustomer(
  stripeKey: string,
  userId: string,
  email: string | undefined,
): Promise<string> {
  const search = await fetch(
    `https://api.stripe.com/v1/customers/search?query=${encodeURIComponent(
      `metadata['userId']:'${userId}'`,
    )}&limit=1`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  if (search.ok) {
    const json = await search.json();
    if (json.data?.[0]?.id) return json.data[0].id as string;
  }

  const params = new URLSearchParams();
  if (email) params.append("email", email);
  params.append("metadata[userId]", userId);

  const created = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!created.ok) {
    throw new Error(`Stripe customer create failed: ${await created.text()}`);
  }
  const customer = await created.json();
  return customer.id as string;
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
    if (!body.priceId || !body.userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: priceId, userId" }),
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

    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const baseUrl = origin.replace(/\/$/, "");
    const successUrl = `${baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/subscription?checkout=canceled`;

    const customerId = await findOrCreateCustomer(stripeKey, body.userId, body.email);

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("locale", "hu");
    params.append("customer", customerId);
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "huf");
    params.append("line_items[0][price_data][unit_amount]", String(amount));
    params.append("line_items[0][price_data][recurring][interval]", stripeInterval);
    params.append(
      "line_items[0][price_data][product_data][name]",
      `${PLAN_NAMES[plan]} (${interval === "monthly" ? "havi" : "éves"})`,
    );
    params.append("metadata[userId]", body.userId);
    params.append("metadata[plan]", plan);
    params.append("metadata[interval]", interval);
    params.append("metadata[priceId]", body.priceId);
    params.append("subscription_data[metadata][userId]", body.userId);
    params.append("subscription_data[metadata][plan]", plan);
    params.append("subscription_data[metadata][interval]", interval);
    params.append("subscription_data[metadata][priceId]", body.priceId);

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      console.error("[create-checkout-session] stripe error", err);
      return new Response(
        JSON.stringify({ error: `Stripe error: ${err}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const session = await sessionRes.json();
    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[create-checkout-session] failed", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

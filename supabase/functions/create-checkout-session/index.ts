// Supabase Edge Function: create-checkout-session
// Creates a Stripe Checkout Session (subscription mode) using the
// STRIPE_SECRET_KEY secret and returns the hosted checkout URL.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PlanKey = "alap" | "pro" | "vallalati";
type Interval = "monthly" | "yearly";

// Hardcoded HUF prices (in fillér = HUF * 100? No — HUF is zero-decimal).
// Stripe HUF: amount is in the smallest currency unit. HUF is zero-decimal,
// so the amount IS the forint value.
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
  plan: PlanKey;
  interval: Interval;
  successUrl: string;
  cancelUrl: string;
}

function decodeJwtSub(jwt: string): { sub?: string; email?: string } {
  try {
    const [, payload] = jwt.split(".");
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return { sub: json.sub, email: json.email };
  } catch {
    return {};
  }
}

async function findOrCreateCustomer(
  stripeKey: string,
  userId: string,
  email: string | undefined,
): Promise<string> {
  // Search by metadata.userId
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

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { sub: userId, email } = decodeJwtSub(jwt);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Bejelentkezés szükséges" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Payload;
    if (!body.plan || !body.interval || !body.successUrl || !body.cancelUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!(body.plan in PRICES)) {
      return new Response(
        JSON.stringify({ error: "Invalid plan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amount = PRICES[body.plan][body.interval];
    const interval = body.interval === "monthly" ? "month" : "year";

    const customerId = await findOrCreateCustomer(stripeKey, userId, email);

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("customer", customerId);
    params.append("success_url", body.successUrl);
    params.append("cancel_url", body.cancelUrl);
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "huf");
    params.append("line_items[0][price_data][unit_amount]", String(amount));
    params.append("line_items[0][price_data][recurring][interval]", interval);
    params.append(
      "line_items[0][price_data][product_data][name]",
      `${PLAN_NAMES[body.plan]} (${body.interval === "monthly" ? "havi" : "éves"})`,
    );
    params.append("metadata[userId]", userId);
    params.append("metadata[plan]", body.plan);
    params.append("metadata[interval]", body.interval);
    params.append("subscription_data[metadata][userId]", userId);
    params.append("subscription_data[metadata][plan]", body.plan);
    params.append("subscription_data[metadata][interval]", body.interval);

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

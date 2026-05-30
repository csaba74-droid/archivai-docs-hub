// Supabase Edge Function: create-checkout-session
// Creates a Stripe Checkout Session (subscription mode) and returns the URL.
// Deploy bump: 2026-05-30 referral-discounts-param-v3

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

    // Check referral eligibility: apply REFERRAL_INVITEE coupon once
    // if the user was referred and has not yet redeemed the discount.
    console.log("[create-checkout-session] userId received:", body.userId);
    let applyReferralCoupon = false;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log("[create-checkout-session] supabase env present:", {
      supabaseUrl: !!supabaseUrl,
      serviceRoleKey: !!serviceRoleKey,
    });
    if (supabaseUrl && serviceRoleKey) {
      try {
        const profUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${body.userId}&select=referred_by,referral_discount_used`;
        console.log("[create-checkout-session] fetching profile:", profUrl);
        const profRes = await fetch(profUrl, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        });
        console.log("[create-checkout-session] profile fetch status:", profRes.status);
        if (profRes.ok) {
          const rows = await profRes.json();
          console.log("[create-checkout-session] profile rows:", JSON.stringify(rows));
          const profile = Array.isArray(rows) ? rows[0] : null;
          console.log("[create-checkout-session] profile parsed:", {
            referred_by: profile?.referred_by ?? null,
            referral_discount_used: profile?.referral_discount_used ?? null,
          });
          if (profile && profile.referred_by && !profile.referral_discount_used) {
            applyReferralCoupon = true;
          }
        } else {
          const errText = await profRes.text();
          console.error("[create-checkout-session] profile fetch not ok:", errText);
        }
      } catch (e) {
        console.error("[create-checkout-session] referral lookup failed", e);
      }
    }
    console.log("[create-checkout-session] applyReferralCoupon:", applyReferralCoupon);

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
    if (applyReferralCoupon) {
      // Stripe Checkout expects coupon discounts as discounts[0][coupon].
      params.append("discounts[0][coupon]", "REFERRAL_INVITEE");
    }
    params.append("metadata[userId]", body.userId);
    params.append("metadata[plan]", plan);
    params.append("metadata[interval]", interval);
    params.append("metadata[priceId]", body.priceId);
    params.append("metadata[referralCoupon]", applyReferralCoupon ? "REFERRAL_INVITEE" : "");
    params.append("subscription_data[metadata][userId]", body.userId);
    params.append("subscription_data[metadata][plan]", plan);
    params.append("subscription_data[metadata][interval]", interval);
    params.append("subscription_data[metadata][priceId]", body.priceId);

    console.log("[create-checkout-session] final stripe params:", params.toString());

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

    if (applyReferralCoupon && supabaseUrl && serviceRoleKey) {
      try {
        await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${body.userId}`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ referral_discount_used: true }),
          },
        );
      } catch (e) {
        console.error("[create-checkout-session] failed to mark referral_discount_used", e);
      }
    }

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

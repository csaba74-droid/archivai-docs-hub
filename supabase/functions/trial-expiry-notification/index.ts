// Supabase Edge Function: trial-expiry-notification
// Sends trial expiry reminder emails (3, 2, 1 days before expiry) via Resend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = "Archivai <kapcsolat@archivai.hu>";
const REPLY_TO = "kapcsolat@archivai.hu";
const APP_URL = "https://archivai-docs-hub.lovable.app";
const FOOTER =
  "Kérjük ne válaszoljon erre az automatikus értesítőre — ha segítségre van szüksége, írjon a kapcsolat@archivai.hu címre.";

type Variant = {
  daysLeft: number;
  subject: string;
  message: string;
};

const VARIANTS: Variant[] = [
  {
    daysLeft: 3,
    subject: "Archivai próbaidőszakod hamarosan lejár",
    message:
      "Még 3 napod van hátra az ingyenes próbaidőszakból. Válassz csomagot hogy megőrizd a hozzáférést dokumentumaidhoz.",
  },
  {
    daysLeft: 2,
    subject: "Archivai próbaidőszakod hamarosan lejár",
    message: "Még 2 napod van hátra az ingyenes próbaidőszakból.",
  },
  {
    daysLeft: 1,
    subject: "Holnap lejár az Archivai próbaidőszakod",
    message:
      "Holnap lejár az ingyenes próbaidőszakod. Ne veszítsd el a hozzáférést dokumentumaidhoz — válassz csomagot még ma!",
  },
];

function renderHtml(message: string) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A2B4A;">
    <h2 style="margin: 0 0 16px;">Archivai</h2>
    <p style="font-size: 15px; line-height: 1.6;">${message}</p>
    <p style="margin: 24px 0;">
      <a href="${APP_URL}/subscription" style="background:#1A2B4A;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
        Csomag választása
      </a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="font-size: 12px; color: #6b7280; line-height:1.5;">${FOOTER}</p>
  </div>`;
}

async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  message: string,
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject,
      html: renderHtml(message),
      text: `${message}\n\n${APP_URL}/subscription\n\n${FOOTER}`,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!apiKey || !supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing required environment variables" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const results: Array<Record<string, unknown>> = [];

    for (const variant of VARIANTS) {
      // Window: subscriptions whose trial_end is between [now + (daysLeft-1)d, now + daysLeft d)
      // Effectively "trial ends in `daysLeft` days" (calendar-day bucket).
      const now = new Date();
      const startMs = now.getTime() + (variant.daysLeft - 1) * 86400000;
      const endMs = now.getTime() + variant.daysLeft * 86400000;
      const start = new Date(startMs).toISOString();
      const end = new Date(endMs).toISOString();

      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("user_id, status, trial_end")
        .eq("status", "trialing")
        .gte("trial_end", start)
        .lt("trial_end", end);

      if (error) {
        results.push({ daysLeft: variant.daysLeft, error: error.message });
        continue;
      }

      const userIds = (subs || []).map((s) => s.user_id);
      let sent = 0;
      const failures: Array<Record<string, unknown>> = [];

      for (const userId of userIds) {
        const { data: userRes, error: uerr } =
          await supabase.auth.admin.getUserById(userId);
        if (uerr || !userRes?.user?.email) {
          failures.push({ userId, reason: uerr?.message || "no email" });
          continue;
        }
        const email = userRes.user.email;
        const result = await sendEmail(
          apiKey,
          email,
          variant.subject,
          variant.message,
        );
        if (result.ok) {
          sent++;
        } else {
          failures.push({ userId, email, status: result.status, body: result.body });
        }
      }

      results.push({
        daysLeft: variant.daysLeft,
        candidates: userIds.length,
        sent,
        failures,
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[trial-expiry-notification] exception", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

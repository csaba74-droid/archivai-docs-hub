// Supabase Edge Function: send-invitation
// Sends an invitation email via the Resend API.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InvitationPayload {
  to_email: string;
  owner_name?: string;
  categories?: string[];
  invitation_link?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  szamlak: "Számlák",
  szerzodesek: "Szerződések",
  szallitolevek: "Szállítólevelek",
  munkaugyi: "Munkaügyi",
  adobevallasok: "Adóbevallások",
  kozuzemi: "Közüzemi",
  banki: "Banki",
  muszaki: "Műszaki",
  belso: "Belső",
  egyeb: "Egyéb",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    console.log("[send-invitation] start", {
      hasApiKey: Boolean(apiKey),
      apiKeyPrefix: apiKey ? apiKey.slice(0, 6) : null,
    });
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const payload = (await req.json()) as InvitationPayload;
    const { to_email, owner_name, categories, invitation_link } = payload;

    if (!to_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email)) {
      return new Response(JSON.stringify({ error: "Invalid to_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviter = owner_name?.trim() || "egy felhasználó";
    const link = invitation_link || "https://archivai-docs-hub.lovable.app/login";
    const catList =
      categories && categories.length > 0
        ? categories.map((c) => CATEGORY_LABELS[c] || c).join(", ")
        : null;

    const subject = "Meghívó az Archivai dokumentumkezelő rendszerbe";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A2B4A;">
        <h2 style="margin: 0 0 16px;">Meghívót kapott az Archivai-ba</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          Meghívták Önt (<strong>${inviter}</strong> által) az <strong>Archivai</strong> dokumentumkezelő rendszerbe.
        </p>
        ${
          catList
            ? `<p style="font-size: 15px; line-height: 1.6;">Hozzáférést kapott az alábbi kategóriákhoz: <strong>${catList}</strong>.</p>`
            : ""
        }
        <p style="font-size: 15px; line-height: 1.6;">
          Kattintson az alábbi linkre a hozzáféréshez:
        </p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background:#1A2B4A;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Belépés az Archivai-ba
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          Vagy másolja be a böngészőbe:<br/>
          <a href="${link}">${link}</a>
        </p>
      </div>
    `;
    const text = `Meghívták Önt az Archivai rendszerbe. Kattintson a linkre: ${link}`;

    const fromAddress = "Archivai <no-reply@archivai.hu>";
    console.log("[send-invitation] calling Resend", {
      from: fromAddress,
      to: to_email,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to_email],
        subject,
        html,
        text,
      }),
    });

    const bodyText = await res.text();
    console.log("[send-invitation] Resend response", {
      status: res.status,
      ok: res.ok,
      body: bodyText,
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: `Resend hiba (${res.status})`,
          details: bodyText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, providerResponse: bodyText }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[send-invitation] exception", err);
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

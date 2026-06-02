// Supabase Edge Function: notify-shared-upload
// Notifies users with shared access to a category when a new document is uploaded.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  document_id: string;
  category: string;
  filename: string;
  uploader_name?: string;
  uploader_email?: string;
}

const BUILTIN_LABELS: Record<string, string> = {
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
  beerkezett: "Beérkezett",
};

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
        JSON.stringify({ error: "Missing server configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = (await req.json()) as Payload;
    const { document_id, category, filename, uploader_name, uploader_email } = payload;

    if (!category || !filename) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve category label + collect IDs that count as "this category"
    // (the category itself, plus, if it's a subfolder, its parent chain so
    // shares on the parent root also trigger the notification).
    const categoryIds = new Set<string>([category]);
    let categoryLabel = BUILTIN_LABELS[category] ?? category;

    if (category.startsWith("custom:")) {
      const ownerId = uploader_email; // not used; we look up by id
      void ownerId;
      const id = category.slice("custom:".length);
      const { data: cat } = await admin
        .from("custom_categories")
        .select("id, name, parent_id, parent_builtin, root_builtin")
        .eq("id", id)
        .maybeSingle();
      if (cat) {
        categoryLabel = cat.name;
        // Walk up parent chain
        let cursor: string | null = cat.parent_id;
        let depth = 0;
        while (cursor && depth < 16) {
          categoryIds.add(`custom:${cursor}`);
          const { data: parent } = await admin
            .from("custom_categories")
            .select("id, parent_id, parent_builtin")
            .eq("id", cursor)
            .maybeSingle();
          if (!parent) break;
          if (parent.parent_builtin) categoryIds.add(parent.parent_builtin);
          cursor = parent.parent_id;
          depth++;
        }
        if (cat.parent_builtin) categoryIds.add(cat.parent_builtin);
        if (cat.root_builtin) categoryIds.add(cat.root_builtin);
      }
    }

    // Find shares overlapping any of these category IDs.
    const { data: shares, error: sharesErr } = await admin
      .from("shared_access")
      .select("invited_email, categories, status")
      .overlaps("categories", Array.from(categoryIds));

    if (sharesErr) {
      console.error("[notify-shared-upload] shares query error", sharesErr);
      return new Response(JSON.stringify({ error: sharesErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients = Array.from(
      new Set(
        (shares ?? [])
          .filter((s) => s.status === "accepted")
          .map((s) => s.invited_email?.toLowerCase().trim())
          .filter((e): e is string => !!e && e !== uploader_email?.toLowerCase().trim()),
      ),
    );

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: "No shared recipients" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const uploader = uploader_name?.trim() || uploader_email?.trim() || "egy felhasználó";
    const link = "https://archivai.hu/dashboard";
    const subject = "Új dokumentum érkezett a megosztott mappába";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background:#f6f7fb;">
        <div style="background:#1A2B4A;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:18px;">Archivai</h2>
        </div>
        <div style="background:#ffffff;padding:24px;border-radius:0 0 8px 8px;color:#1A2B4A;">
          <h3 style="margin:0 0 12px;font-size:17px;">Új dokumentum érkezett a megosztott mappába</h3>
          <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">
            <strong>${escapeHtml(uploader)}</strong> új dokumentumot töltött fel egy Önnel megosztott mappába.
          </p>
          <table style="font-size:14px;line-height:1.6;border-collapse:collapse;margin:8px 0 20px;">
            <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Fájl:</td><td><strong>${escapeHtml(filename)}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Mappa:</td><td><strong>${escapeHtml(categoryLabel)}</strong></td></tr>
          </table>
          <p style="margin:24px 0;">
            <a href="${link}" style="background:#1A2B4A;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
              Megnyitás az Archivai-ban
            </a>
          </p>
          <p style="font-size:12px;color:#6b7280;margin-top:24px;">
            Ezt az értesítést azért kapta, mert hozzáférést kapott ehhez a mappához az Archivai-ban.
          </p>
        </div>
      </div>
    `;
    const text = `${uploader} új dokumentumot töltött fel a(z) "${categoryLabel}" megosztott mappába: ${filename}\n\nMegnyitás: ${link}`;

    const fromAddress = "Archivai <kapcsolat@archivai.hu>";
    let sent = 0;
    const errors: Array<{ to: string; error: string }> = [];

    for (const to of recipients) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [to],
            subject,
            html,
            text,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          console.error("[notify-shared-upload] Resend error", { to, status: res.status, body });
          errors.push({ to, error: `${res.status}: ${body.slice(0, 200)}` });
        } else {
          sent++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[notify-shared-upload] send exception", { to, msg });
        errors.push({ to, error: msg });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, recipients: recipients.length, errors, document_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[notify-shared-upload] exception", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

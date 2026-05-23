import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SubjectSchema = z.object({
  invitedEmail: z.string().email(),
  inviterName: z.string().min(1).max(200).optional(),
});

export const sendInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SubjectSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.RESEND_API_KEY;
    console.log("[sendInvitationEmail] start", {
      to: data.invitedEmail,
      hasApiKey: Boolean(apiKey),
      apiKeyPrefix: apiKey ? apiKey.slice(0, 6) : null,
    });
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

    const inviter =
      data.inviterName ||
      (context.claims as { email?: string } | undefined)?.email ||
      "egy felhasználó";

    const appUrl =
      process.env.APP_URL ||
      process.env.PUBLIC_APP_URL ||
      "https://archivai-docs-hub.lovable.app";
    const invitationLink = `${appUrl}/login`;

    const subject = "Meghívó az Archivai dokumentumkezelő rendszerbe";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A2B4A;">
        <h2 style="margin: 0 0 16px;">Meghívót kapott az Archivai-ba</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          Meghívták Önt (${inviter} által) az <strong>Archivai</strong> dokumentumkezelő rendszerbe.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Kattintson az alábbi linkre a hozzáféréshez:
        </p>
        <p style="margin: 24px 0;">
          <a href="${invitationLink}" style="background:#1A2B4A;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Belépés az Archivai-ba
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          Vagy másolja be a böngészőbe: <br/>
          <a href="${invitationLink}">${invitationLink}</a>
        </p>
      </div>
    `;
    const text = `Meghívták Önt az Archivai rendszerbe. Kattintson a linkre a hozzáféréshez: ${invitationLink}`;

    const fromAddress = "Archivai <no-reply@archivai.hu>";
    console.log("[sendInvitationEmail] calling Resend", {
      from: fromAddress,
      to: data.invitedEmail,
      subject,
    });

    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [data.invitedEmail],
          subject,
          html,
          text,
        }),
      });
    } catch (err) {
      console.error("[sendInvitationEmail] fetch threw", err);
      throw new Error(
        `Resend fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const bodyText = await res.text();
    console.log("[sendInvitationEmail] Resend response", {
      status: res.status,
      ok: res.ok,
      body: bodyText,
    });

    if (!res.ok) {
      throw new Error(`Email küldés sikertelen (${res.status}): ${bodyText}`);
    }

    return { ok: true, providerResponse: bodyText };
  });


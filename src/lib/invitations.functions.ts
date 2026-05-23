import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.object({ token: z.string().uuid() });

export const lookupInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: inv, error } = await supabaseAdmin
      .from("shared_access")
      .select(
        "id, owner_user_id, invited_email, invited_user_id, categories, status",
      )
      .eq("id", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!inv) return { invitation: null, ownerName: "" };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, company")
      .eq("id", inv.owner_user_id)
      .maybeSingle();

    const ownerName =
      (profile as { full_name?: string | null; company?: string | null } | null)
        ?.full_name ||
      (profile as { full_name?: string | null; company?: string | null } | null)
        ?.company ||
      "Egy felhasználó";

    return { invitation: inv, ownerName };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tokenSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const userEmail = (claims as { email?: string } | null)?.email ?? null;

    const { data: inv, error: lookupErr } = await supabaseAdmin
      .from("shared_access")
      .select("id, invited_email, status")
      .eq("id", data.token)
      .maybeSingle();

    if (lookupErr) throw new Error(lookupErr.message);
    if (!inv) throw new Error("Érvénytelen vagy lejárt meghívó");
    if (inv.status === "revoked") throw new Error("Ez a meghívó visszavonásra került");

    if (
      userEmail &&
      String(inv.invited_email).toLowerCase() !== userEmail.toLowerCase()
    ) {
      throw new Error(
        `A meghívó a ${inv.invited_email} címre érkezett. Jelentkezz be ezzel az email címmel.`,
      );
    }

    const { error: updErr } = await supabaseAdmin
      .from("shared_access")
      .update({
        status: "active",
        invited_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.token);

    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

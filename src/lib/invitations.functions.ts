import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.object({ token: z.string().uuid() });

export const lookupInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    console.log("[lookupInvitation] token:", data.token);
    const { data: inv, error } = await supabaseAdmin
      .from("shared_access")
      .select("*")
      .eq("id", data.token)
      .maybeSingle();

    console.log("[lookupInvitation] result:", inv, "error:", error);

    if (error) throw new Error(error.message);
    if (!inv) return { invitation: null, ownerName: "" };


    let ownerName = "Egy felhasználó";
    try {
      const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(
        inv.owner_user_id,
      );
      const meta = (ownerUser.user?.user_metadata ?? {}) as {
        full_name?: string;
        company?: string;
      };
      ownerName =
        meta.full_name ||
        meta.company ||
        ownerUser.user?.email ||
        "Egy felhasználó";
    } catch {
      // fall back to default
    }


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

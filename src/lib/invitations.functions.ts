import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  .inputValidator((input) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    // Manually read the auth header and validate via admin client.
    // This avoids the strict `getClaims` JWKS path used by requireSupabaseAuth
    // which can spuriously reject otherwise-valid sessions.
    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      throw new Error(
        "Bejelentkezés szükséges a meghívó elfogadásához. Jelentkezz be, majd nyisd meg újra a meghívó linket.",
      );
    }
    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) {
      throw new Error("Hiányzó hozzáférési token. Jelentkezz be újra.");
    }

    const { data: userResult, error: userErr } =
      await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userResult?.user) {
      console.error("[acceptInvitation] getUser failed:", userErr);
      throw new Error(
        "Lejárt vagy érvénytelen munkamenet. Jelentkezz ki és vissza, majd próbáld újra.",
      );
    }

    const userId = userResult.user.id;
    const userEmail = userResult.user.email ?? null;

    const { data: inv, error: lookupErr } = await supabaseAdmin
      .from("shared_access")
      .select("id, invited_email, status")
      .eq("id", data.token)
      .maybeSingle();

    if (lookupErr) throw new Error(lookupErr.message);
    if (!inv) throw new Error("Érvénytelen vagy lejárt meghívó");
    if (inv.status === "revoked")
      throw new Error("Ez a meghívó visszavonásra került");

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

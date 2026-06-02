import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { appSupabaseAdmin } from "@/lib/app-supabase-admin.server";

const tokenSchema = z.object({ token: z.string().uuid() });

export const lookupInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    console.log("[lookupInvitation] token:", data.token);
    const { data: inv, error } = await appSupabaseAdmin
      .from("shared_access")
      .select("*")
      .eq("id", data.token)
      .maybeSingle();

    console.log("[lookupInvitation] result:", inv, "error:", error);

    if (error) throw new Error(error.message);
    if (!inv) return { invitation: null, ownerName: "" };

    let ownerName = "Egy felhasználó";
    try {
      const { data: ownerUser } = await appSupabaseAdmin.auth.admin.getUserById(inv.owner_user_id);
      const meta = (ownerUser.user?.user_metadata ?? {}) as {
        full_name?: string;
        company?: string;
      };
      ownerName = meta.full_name || meta.company || ownerUser.user?.email || "Egy felhasználó";
    } catch {
      // fall back to default
    }

    // Resolve human-readable labels for custom: category IDs
    const categoryLabels: Record<string, string> = {};
    const customIds = (inv.categories ?? [])
      .filter((c: string) => typeof c === "string" && c.startsWith("custom:"))
      .map((c: string) => c.slice(7));
    if (customIds.length > 0) {
      const { data: customs } = await appSupabaseAdmin
        .from("custom_categories")
        .select("id, name")
        .in("id", customIds);
      (customs ?? []).forEach((c) => {
        const row = c as { id: string; name: string };
        categoryLabels[`custom:${row.id}`] = row.name;
      });
    }

    return { invitation: inv, ownerName, categoryLabels };
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

    const { data: userResult, error: userErr } = await appSupabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userResult?.user) {
      console.error("[acceptInvitation] getUser failed:", userErr);
      throw new Error(
        "Lejárt vagy érvénytelen munkamenet. Jelentkezz ki és vissza, majd próbáld újra.",
      );
    }

    const userId = userResult.user.id;
    const userEmail = userResult.user.email ?? null;

    const { data: inv, error: lookupErr } = await appSupabaseAdmin
      .from("shared_access")
      .select("id, invited_email, invited_user_id, status")
      .eq("id", data.token)
      .maybeSingle();

    if (lookupErr) throw new Error(lookupErr.message);
    if (!inv) throw new Error("Érvénytelen vagy lejárt meghívó");
    if (inv.status === "revoked") throw new Error("Ez a meghívó visszavonásra került");
    if (inv.status === "accepted" && inv.invited_user_id && inv.invited_user_id !== userId) {
      throw new Error("Ezt a meghívót már egy másik fiókkal elfogadták.");
    }

    if (userEmail && String(inv.invited_email).toLowerCase() !== userEmail.toLowerCase()) {
      throw new Error(
        `A meghívó a ${inv.invited_email} címre érkezett. Jelentkezz be ezzel az email címmel.`,
      );
    }

    const { error: updErr } = await appSupabaseAdmin
      .from("shared_access")
      .update({
        status: "accepted",
        invited_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.token);

    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

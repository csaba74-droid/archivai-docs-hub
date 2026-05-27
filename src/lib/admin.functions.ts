import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "lenard.csaba74@gmail.com";

export const adminSetPartnerType = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        partnerType: z.enum(["accountant_lifetime"]).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const authHeader = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: missing bearer token");
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new Error("Unauthorized: empty token");
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error("[adminSetPartnerType] getUser error:", userErr);
      throw new Error("Unauthorized: invalid token");
    }

    const email = userData.user.email?.toLowerCase() ?? "";
    if (email !== ADMIN_EMAIL) {
      throw new Error("Forbidden");
    }

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update({ partner_type: data.partnerType })
      .eq("id", data.userId)
      .select("id, partner_type")
      .single();

    if (error) {
      console.error("[adminSetPartnerType] update error:", error);
      throw new Error(error.message);
    }

    return { ok: true, profile: updated };
  });

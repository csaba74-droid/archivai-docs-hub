import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "lenard.csaba74@gmail.com";

export const adminSetPartnerType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        partnerType: z.enum(["accountant_lifetime"]).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email as string | undefined)?.toLowerCase() ?? "";
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

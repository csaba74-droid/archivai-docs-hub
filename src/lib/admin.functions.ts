import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

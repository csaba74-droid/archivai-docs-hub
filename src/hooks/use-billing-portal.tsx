import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

/**
 * Opens the Stripe Customer Portal in a new tab. Returns `loading` so a
 * button can show a spinner. The portal cannot be iframed, so we always
 * open via window.open.
 */
export function useBillingPortal() {
  const [loading, setLoading] = useState(false);

  const openPortal = useCallback(async (returnUrl?: string) => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) {
        toast.error("Bejelentkezés szükséges");
        return;
      }
      const url = await createPortalSession({
        data: {
          accessToken,
          returnUrl: returnUrl || (typeof window !== "undefined" ? window.location.href : ""),
          environment: getStripeEnvironment(),
        },
      });
      if (!url) throw new Error("Üres válasz a szervertől");
      if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Nem sikerült megnyitni", { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  return { openPortal, loading };
}

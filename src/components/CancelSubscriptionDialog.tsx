import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GdprExportButton } from "./GdprExportButton";
import { toast } from "sonner";

/**
 * Cancel/downgrade is routed through the Stripe Customer Portal. We no
 * longer update the local subscriptions row directly — that produced
 * drift (Stripe kept billing while the DB said "canceled", and the next
 * webhook reset it). Instead we show a retention warning + GDPR export,
 * then hand off to the portal where the user can cancel, switch plans,
 * or update payment method. Webhooks reflect the change back into the DB.
 */
export function CancelSubscriptionDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlan?: "alap" | "pro" | "vallalati" | null;
}) {
  const [strictCount, setStrictCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Bejelentkezés szükséges");
        return;
      }
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        "create-portal-session",
        {
          body: {
            userId: u.user.id,
            returnUrl: window.location.origin + "/profile",
          },
        },
      );
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error(data?.error || "Üres válasz a szervertől");
      window.open(data.url, "_blank", "noopener");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Nem sikerült megnyitni", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.user.id)
        .eq("itm_compliant", true);
      setStrictCount(count ?? 0);
    })();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Számlázás kezelése
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2 text-sm">
              <p>
                A felmondás, csomagváltás és kártyacsere a biztonságos Stripe ügyfélportálon történik.
              </p>
              {strictCount !== null && strictCount > 0 && (
                <p>
                  ⚠️ Önnek <strong>{strictCount}</strong> dokumentuma van aktív törvényi
                  megőrzési kötelezettséggel. Felmondás esetén Ön lesz felelős ezek
                  biztonságos megőrzéséért — javasoljuk az exportot.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                A változás néhány másodpercen belül érvényesül itt is, miután a Stripe értesít minket.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <GdprExportButton />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bezár</Button>
          <Button onClick={() => openPortal()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Stripe portál megnyitása
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

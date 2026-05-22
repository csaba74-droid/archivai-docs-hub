import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GdprExportButton } from "./GdprExportButton";

type Step = "warning" | "downgrade" | "done";

export function CancelSubscriptionDialog({
  open, onOpenChange, currentPlan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlan: "alap" | "pro" | "vallalati" | null;
}) {
  const [step, setStep] = useState<Step>("warning");
  const [strictCount, setStrictCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("warning");
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

  const proceedCancel = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", u.user.id);
    if (error) {
      toast.error("Hiba a felmondásnál", { description: error.message });
      return;
    }
    toast.success("Előfizetés felmondva");
    onOpenChange(false);
    setTimeout(() => window.location.reload(), 800);
  };

  const downgradeToAlap = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("subscriptions")
      .update({ plan: "alap", status: "active" })
      .eq("user_id", u.user.id);
    if (error) {
      toast.error("Hiba a váltásnál", { description: error.message });
      return;
    }
    toast.success("Sikeresen átváltottál az Alap csomagra");
    onOpenChange(false);
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {step === "warning" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Figyelem - megőrzési kötelezettség
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-2 text-sm">
                  <p>
                    ⚠️ Önnek <strong>{strictCount ?? "…"}</strong> dokumentuma van aktív törvényi
                    megőrzési kötelezettséggel.
                  </p>
                  <p>
                    Ha felmondja az előfizetést, Ön lesz felelős ezek biztonságos megőrzéséért.
                  </p>
                  <p className="font-medium">
                    Javasoljuk, hogy exportálja adatait mielőtt folytatja.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <GdprExportButton />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Mégsem</Button>
              <Button variant="destructive" onClick={() => setStep("downgrade")}>
                Folytatás felmondással
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "downgrade" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDown className="h-5 w-5 text-brand" />
                Esetleg inkább váltsunk olcsóbb csomagra?
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-2 text-sm">
                  <p>Az Alap csomag továbbra is biztosítja a dokumentumai biztonságos tárolását.</p>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <div className="font-semibold text-base">Alap csomag</div>
                    <div className="text-2xl font-bold mt-1">2 990 Ft / hó</div>
                    <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                      <li>• Max 100 dokumentum tárolása</li>
                      <li>• Alap kategorizálás</li>
                      <li>• Törvényi megőrzés folyamatos</li>
                    </ul>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button variant="destructive" onClick={proceedCancel}>
                Nem, felmondás
              </Button>
              <Button onClick={downgradeToAlap} disabled={currentPlan === "alap"}>
                {currentPlan === "alap" ? "Már Alap csomagon van" : "Váltás Alap csomagra"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

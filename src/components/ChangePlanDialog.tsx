import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase, type SubscriptionRow } from "@/lib/supabase";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";

type PlanKey = SubscriptionRow["plan"];

const PRICES: Record<PlanKey, number> = {
  alap: 2990,
  pro: 4990,
  vallalati: 9990,
};

const formatHuf = (n: number) => `${n.toLocaleString("hu-HU")} Ft`;

export function ChangePlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { subscription, reload } = useSubscription();
  const [switching, setSwitching] = useState<PlanKey | null>(null);

  const currentPlan = subscription?.plan;
  const stripeSubscriptionId = subscription?.stripe_subscription_id;

  const handleSwitch = async (plan: PlanKey) => {
    if (!stripeSubscriptionId) {
      toast.error("Nincs aktív Stripe előfizetés");
      return;
    }
    setSwitching(plan);
    try {
      const priceId = `${plan}_monthly`;
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        "change-subscription",
        { body: { priceId, subscriptionId: stripeSubscriptionId } },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Csomag sikeresen módosítva", {
        description: "Az új csomag azonnal érvénybe lép, az időarányos elszámolással.",
      });
      await reload();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[change-subscription] failed", err);
      toast.error("Csomagváltás sikertelen", { description: message });
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Csomag váltása</DialogTitle>
          <DialogDescription>
            Az új csomag azonnal érvénybe lép. Az időarányos különbözetet automatikusan
            elszámoljuk a következő számlában.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-3 gap-3 mt-2">
          {(["alap", "pro", "vallalati"] as const).map((plan) => {
            const info = PLAN_INFO[plan];
            const isCurrent = currentPlan === plan;
            return (
              <Card key={plan} className="p-4 flex flex-col">
                <h3 className="font-semibold">{info.label}</h3>
                <p className="text-lg font-bold mt-1">{formatHuf(PRICES[plan])} / hó</p>
                <p className="text-xs text-muted-foreground mt-1 flex-1">{info.description}</p>
                <Button
                  className="mt-4 w-full"
                  variant={isCurrent ? "secondary" : "default"}
                  disabled={isCurrent || switching !== null}
                  onClick={() => void handleSwitch(plan)}
                >
                  {switching === plan ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Váltás…</>
                  ) : isCurrent ? (
                    <><Check className="h-4 w-4 mr-2" /> Jelenlegi</>
                  ) : "Váltás"}
                </Button>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

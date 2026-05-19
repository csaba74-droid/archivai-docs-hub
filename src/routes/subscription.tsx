import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, CreditCard, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/subscription")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: SubscriptionPage,
});

const PLAN_FEATURES: Record<keyof typeof PLAN_INFO, string[]> = {
  alap: ["Max 100 dokumentum", "Alap kategorizálás", "Egyszerű kereső"],
  pro: ["Korlátlan dokumentum", "AI kategorizálás (Claude)", "Bulk upload", "Custom kategóriák", "Teljes szöveges kereső"],
  vallalati: ["Minden Pro funkció", "Több felhasználó", "Prioritásos támogatás", "Audit log export", "SLA garancia"],
};

function SubscriptionPage() {
  const { subscription, reload, active } = useSubscription();
  const [busy, setBusy] = useState<string | null>(null);

  const setPlan = async (plan: "alap" | "pro" | "vallalati") => {
    setBusy(plan);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(null); return; }
    const { error } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: u.user.id,
        plan,
        status: "active",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      });
    setBusy(null);
    if (error) {
      toast.error("Csomag váltás sikertelen", { description: error.message });
      return;
    }
    toast.success(`Csomag frissítve: ${PLAN_INFO[plan].label}`);
    await reload();
  };

  // For demo: toggle past_due to test access control
  const togglePaymentStatus = async () => {
    if (!subscription) return;
    const newStatus = subscription.status === "active" ? "past_due" : "active";
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("user_id", subscription.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Állapot: ${newStatus}`);
    await reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Vissza</Link>
        </Button>
        <h1 className="text-lg font-semibold">Előfizetés és számlázás</h1>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Current status */}
        <Card className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Jelenlegi csomag</p>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="text-2xl font-bold">{subscription ? PLAN_INFO[subscription.plan].label : "—"}</h2>
                <Badge variant={active ? "secondary" : "destructive"}>
                  {subscription?.status === "active" ? "Aktív" : subscription?.status === "past_due" ? "Fizetés esedékes" : subscription?.status === "canceled" ? "Lemondva" : "Inaktív"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {subscription ? PLAN_INFO[subscription.plan].priceLabel : ""}
                {subscription?.current_period_end && (
                  <> • Következő számlázás: {new Date(subscription.current_period_end).toLocaleDateString("hu-HU")}</>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={togglePaymentStatus}>
                <CreditCard className="h-4 w-4 mr-2" /> Fizetési állapot váltása (teszt)
              </Button>
            </div>
          </div>
          <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            ⓘ Stripe integráció később kerül bekötésre. Most a csomag és fizetési állapot manuálisan változtatható tesztelési célból.
          </div>
        </Card>

        {/* Plan picker */}
        <div className="grid md:grid-cols-3 gap-4">
          {(["alap", "pro", "vallalati"] as const).map((plan) => {
            const info = PLAN_INFO[plan];
            const isCurrent = subscription?.plan === plan;
            return (
              <Card key={plan} className={`p-5 flex flex-col ${isCurrent ? "border-brand ring-2 ring-brand/20" : ""}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{info.label}</h3>
                  {plan === "pro" && <Sparkles className="h-4 w-4 text-brand" />}
                </div>
                <p className="text-2xl font-bold mt-2">{info.priceLabel}</p>
                <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                <ul className="mt-4 space-y-2 text-sm flex-1">
                  {PLAN_FEATURES[plan].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full"
                  variant={isCurrent ? "secondary" : "default"}
                  disabled={isCurrent || busy === plan}
                  onClick={() => setPlan(plan)}
                >
                  {isCurrent ? "Jelenlegi csomag" : busy === plan ? "Váltás..." : "Váltás erre"}
                </Button>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}

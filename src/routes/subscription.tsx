import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Check, Sparkles, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { GdprExportButton } from "@/components/GdprExportButton";
import { CancelSubscriptionDialog } from "@/components/CancelSubscriptionDialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/subscription")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: SubscriptionPage,
});

type PlanKey = "alap" | "pro" | "vallalati";
type Interval = "monthly" | "yearly";

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  alap: ["Max 100 dokumentum", "Alap kategorizálás", "Egyszerű kereső"],
  pro: ["Korlátlan dokumentum", "AI kategorizálás (Claude)", "Bulk upload", "Custom kategóriák", "Teljes szöveges kereső"],
  vallalati: ["Minden Pro funkció", "Több felhasználó", "Prioritásos támogatás", "Audit log export", "SLA garancia"],
};

const PRICES: Record<PlanKey, { monthly: number; yearly: number }> = {
  alap: { monthly: 2990, yearly: 30490 },
  pro: { monthly: 4990, yearly: 50890 },
  vallalati: { monthly: 9990, yearly: 101890 },
};

const formatHuf = (n: number) => `${n.toLocaleString("hu-HU")} Ft`;

function SubscriptionPage() {
  const { subscription, active, isTrialing, trialDaysLeft, trialExpired } = useSubscription();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [interval, setInterval] = useState<Interval>("monthly");
  const [checkout, setCheckout] = useState<{ priceId: string } | null>(null);
  const [email, setEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const canCancel = subscription?.status !== "canceled";

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email);
      setUserId(data.user?.id);
    });
  }, []);

  const openCheckout = (plan: PlanKey) => {
    setCheckout({ priceId: `${plan}_${interval === "monthly" ? "monthly" : "yearly"}` });
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
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
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {isTrialing ? "Ingyenes próbaidőszak" : "Jelenlegi csomag"}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="text-2xl font-bold">
                  {isTrialing
                    ? (trialExpired ? "Próba lejárt" : `${trialDaysLeft} nap van hátra`)
                    : (subscription ? PLAN_INFO[subscription.plan].label : "—")}
                </h2>
                <Badge variant={active ? "secondary" : "destructive"}>
                  {isTrialing
                    ? (trialExpired ? "Lejárt" : "Próba")
                    : subscription?.status === "active" ? "Aktív"
                    : subscription?.status === "past_due" ? "Fizetés esedékes"
                    : subscription?.status === "canceled" ? "Lemondva" : "Inaktív"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isTrialing
                  ? "Kártyaadat nélkül — válassz csomagot a próba végén a folytatáshoz."
                  : (
                    <>
                      {subscription ? PLAN_INFO[subscription.plan].priceLabel : ""}
                      {subscription?.current_period_end && (
                        <> • Következő számlázás: {new Date(subscription.current_period_end).toLocaleDateString("hu-HU")}</>
                      )}
                    </>
                  )}
              </p>
            </div>
          </div>
        </Card>


        {/* Interval toggle */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border p-1 bg-card">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${interval === "monthly" ? "bg-brand text-white" : "text-muted-foreground"}`}
            >
              Havi
            </button>
            <button
              onClick={() => setInterval("yearly")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${interval === "yearly" ? "bg-brand text-white" : "text-muted-foreground"}`}
            >
              Éves <span className="text-xs opacity-80 ml-1">−15%</span>
            </button>
          </div>
        </div>

        {/* Plan picker */}
        <div className="grid md:grid-cols-3 gap-4">
          {(["alap", "pro", "vallalati"] as const).map((plan) => {
            const info = PLAN_INFO[plan];
            const isCurrent = subscription?.plan === plan && active;
            const amount = PRICES[plan][interval];
            const priceLabel = interval === "monthly" ? `${formatHuf(amount)} / hó` : `${formatHuf(amount)} / év`;
            return (
              <Card key={plan} className={`p-5 flex flex-col ${plan === "pro" ? "border-brand ring-2 ring-brand/20" : ""}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{info.label}</h3>
                  {plan === "pro" && <Sparkles className="h-4 w-4 text-brand" />}
                </div>
                <p className="text-2xl font-bold mt-2">{priceLabel}</p>
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
                  variant={isCurrent ? "secondary" : plan === "pro" ? "default" : "outline"}
                  disabled={isCurrent || !userId}
                  onClick={() => openCheckout(plan)}
                >
                  {isCurrent ? "Jelenlegi csomag" : "14 napos próba indítása"}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Minden új előfizetés 14 napos ingyenes próbaidővel indul. Bármikor lemondható.
        </p>

        {/* GDPR data export */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Adataim és adatvédelem</h2>
          <GdprExportButton />
        </Card>

        {/* Cancel subscription */}
        {canCancel && (
          <Card className="p-6 border-destructive/30">
            <h2 className="text-lg font-semibold mb-1">Előfizetés felmondása</h2>
            <p className="text-sm text-muted-foreground mb-4">
              A felmondás után dokumentumai elérhetők maradnak az aktuális elszámolási időszak végéig.
            </p>
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" /> Előfizetés felmondása
            </Button>
          </Card>
        )}
      </main>

      <CancelSubscriptionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        currentPlan={subscription?.plan ?? null}
      />

      <Dialog open={!!checkout} onOpenChange={(o) => !o && setCheckout(null)}>
        <DialogContent className="max-w-3xl p-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Fizetés</DialogTitle>
          </DialogHeader>
          {checkout && userId && (
            <div className="p-2">
              <StripeEmbeddedCheckout
                priceId={checkout.priceId}
                userId={userId}
                customerEmail={email}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

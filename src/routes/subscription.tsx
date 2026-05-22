import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, Sparkles, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { GdprExportButton } from "@/components/GdprExportButton";
import { CancelSubscriptionDialog } from "@/components/CancelSubscriptionDialog";

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
  const { subscription, active } = useSubscription();
  const [cancelOpen, setCancelOpen] = useState(false);
  const canCancel = subscription?.status === "active" && subscription.plan !== "alap";


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
          </div>
          <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            ⓘ A csomagváltást a Stripe fizetési integráció bekötése után tudjuk élesíteni. Addig is keress minket emailben:{" "}
            <a href="mailto:hello@archivai.hu" className="underline">hello@archivai.hu</a>.
          </div>
        </Card>

        {/* Plan picker (read-only until Stripe is wired) */}
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
                  variant={isCurrent ? "secondary" : "outline"}
                  disabled
                >
                  {isCurrent ? "Jelenlegi csomag" : "Hamarosan elérhető"}
                </Button>
              </Card>
            );
          })}
        </div>

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
    </div>
  );
}


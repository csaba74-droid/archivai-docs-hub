import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, Sparkles, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSubscription, PLAN_INFO } from "@/hooks/use-subscription";
import { useBillingPortal } from "@/hooks/use-billing-portal";
import { GdprExportButton } from "@/components/GdprExportButton";
import { CancelSubscriptionDialog } from "@/components/CancelSubscriptionDialog";
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
  alap: [
    "5 GB tárhely",
    "Max 200 dokumentum / hó",
    "AI alapú kategorizálás",
    "Teljes szöveges keresés",
    "SHA-256 integritásvédelem",
    "Audit napló",
    "GDPR adatexport",
    "ITM rendelet szerinti archiválás",
  ],
  pro: [
    "25 GB tárhely",
    "Max 500 dokumentum / hó",
    "Minden Alap funkció",
    "Tömeges feltöltés",
    "Egyéni kategóriák",
    "Hozzáférés megosztás",
    "Dokumentum előnézet",
    "Dedikált Archivai e-mail cím",
  ],
  vallalati: [
    "100 GB tárhely",
    "Korlátlan dokumentum",
    "Minden Pro funkció",
    "Több felhasználó kezelése",
    "Prioritásos ügyfélszolgálat",
    "NAV számlaadatok importálása",
  ],
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
  const [interval, setInterval] = useState<Interval>("yearly");
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [email, setEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const { openPortal, loading: portalLoading } = useBillingPortal();
  const hasStripeSubscription = !!subscription?.stripe_subscription_id;
  const canCancel = subscription?.status !== "canceled";


  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email);
      setUserId(data.user?.id);
    });
  }, []);

  const openCheckout = async (plan: PlanKey) => {
    if (!userId) return;
    const selectedPriceId = `${plan}_${interval === "monthly" ? "monthly" : "yearly"}`;
    setRedirecting(selectedPriceId);
    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        "create-checkout-session",
        {
          body: {
            priceId: selectedPriceId,
            email,
            userId,
          },
        },
      );
      if (error) throw new Error(error.message);
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data?.error || "Üres válasz a szervertől");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[checkout] redirect failed", err);
      toast.error("Fizetés nem indítható", { description: message });
      setRedirecting(null);
    }
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
            {hasStripeSubscription && (
              <Button variant="outline" onClick={() => openPortal()} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                Számlázás kezelése
              </Button>
            )}
          </div>
        </Card>

        {/* Prominent billing period toggle — applies to all plans */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">Válassz számlázási időszakot</p>
          <div
            role="radiogroup"
            aria-label="Számlázási időszak"
            className="inline-flex items-center rounded-lg border bg-muted/40 p-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={interval === "monthly"}
              onClick={() => setInterval("monthly")}
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all ${
                interval === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Havi
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={interval === "yearly"}
              onClick={() => setInterval("yearly")}
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all inline-flex items-center gap-2 ${
                interval === "yearly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Éves
              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                −2 hónap
              </span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {interval === "yearly"
              ? "Éves számlázás — 2 hónap grátisz"
              : "Havi számlázás — bármikor lemondható"}
          </p>
        </div>

        {/* Plan picker */}
        <div className="grid md:grid-cols-3 gap-4">
          {(["alap", "pro", "vallalati"] as const).map((plan) => {
            const info = PLAN_INFO[plan];
            const isCurrent = subscription?.plan === plan && active && !isTrialing;
            const monthlyAmount = PRICES[plan].monthly;
            const yearlyAmount = PRICES[plan].yearly;
            const yearlyAsMonthly = Math.round(yearlyAmount / 12);
            const displayPerMonth = interval === "yearly" ? yearlyAsMonthly : monthlyAmount;
            return (
              <Card key={plan} className={`p-5 flex flex-col ${plan === "pro" ? "border-brand ring-2 ring-brand/20" : ""}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{info.label}</h3>
                  {plan === "pro" && <Sparkles className="h-4 w-4 text-brand" />}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{info.description}</p>

                {/* Price display reflects the selected interval */}
                <div className="mt-4">
                  <p className="text-3xl font-bold">
                    {formatHuf(displayPerMonth)}
                    <span className="text-sm font-normal text-muted-foreground"> / hó</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                    {interval === "yearly"
                      ? <>{formatHuf(yearlyAmount)} évente egy összegben</>
                      : <>Havi számlázás</>}
                  </p>
                </div>

                <ul className="mt-5 space-y-2 text-sm flex-1">
                  {PLAN_FEATURES[plan].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Confirmation of selection right above CTA */}
                <div className="mt-5 rounded-md bg-muted/50 px-3 py-2 text-xs text-center">
                  <span className="text-muted-foreground">Választott: </span>
                  <span className="font-semibold text-foreground">
                    {interval === "yearly" ? "Éves" : "Havi"}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}— {interval === "yearly" ? formatHuf(yearlyAmount) + " / év" : formatHuf(monthlyAmount) + " / hó"}
                  </span>
                </div>

                <Button
                  className="mt-3 w-full"
                  variant={isCurrent ? "secondary" : plan === "pro" ? "default" : "outline"}
                  disabled={isCurrent || !userId || redirecting !== null}
                  onClick={() => void openCheckout(plan)}
                >
                  {redirecting === `${plan}_${interval === "monthly" ? "monthly" : "yearly"}` ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Átirányítás…</>
                  ) : isCurrent ? "Jelenlegi csomag" : interval === "yearly" ? "Éves csomag kiválasztása" : "Havi csomag kiválasztása"}
                </Button>
              </Card>
            );
          })}
        </div>



        <p className="text-center text-xs text-muted-foreground">
          A 14 napos ingyenes próba kártyaadat nélkül indul a regisztrációkor. A fizetés csak akkor történik, ha a próba végén csomagot választasz.
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

    </div>
  );
}

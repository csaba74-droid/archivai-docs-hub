import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";

export function TrialBanner() {
  const { isTrialing, trialDaysLeft, trialExpired } = useSubscription();
  if (!isTrialing) return null;

  if (trialExpired) {
    return (
      <div className="w-full bg-destructive/10 border-b border-destructive/30 px-4 py-3 flex flex-wrap items-center justify-center gap-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-destructive font-medium">
          A 14 napos próbaidőszak lejárt. A fiók írásvédett — feltöltéshez válassz csomagot.
        </span>
        <Button size="sm" asChild>
          <Link to="/subscription"><CreditCard className="h-4 w-4 mr-1" /> Csomag választása</Link>
        </Button>
      </div>
    );
  }

  const isUrgent = trialDaysLeft <= 3;
  return (
    <div className={`w-full px-4 py-2 flex flex-wrap items-center justify-center gap-3 text-sm border-b ${
      isUrgent ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-brand/5 border-brand/20"
    }`}>
      <Clock className="h-4 w-4 shrink-0" />
      <span>
        {trialDaysLeft > 0
          ? <>Ingyenes próba: <strong>{trialDaysLeft} nap</strong> van hátra — kártyaadat nélkül</>
          : <>Ma jár le az ingyenes próba</>
        }
      </span>
      <Button size="sm" variant={isUrgent ? "default" : "outline"} asChild>
        <Link to="/subscription">Fizetési mód hozzáadása</Link>
      </Button>
    </div>
  );
}

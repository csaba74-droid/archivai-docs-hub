import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/use-subscription";

/**
 * Redirects users with an expired trial and no active subscription to
 * /subscription with a Hungarian notice. Allowed pages: marketing, auth,
 * subscription itself, and a few public/legal pages.
 */
const ALLOWED_PREFIXES = [
  "/subscription",
  "/login",
  "/register",
  "/aszf",
  "/adatkezeles",
  "/accept-invitation",
  "/admin",
  "/referral",
];

export function TrialExpiredGuard() {
  const { loading, active, trialExpired, subscription } = useSubscription();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (pathname === "/" || ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
      notifiedRef.current = false;
      return;
    }
    const hasNoSub = !subscription || subscription.status === "inactive" || subscription.status === "canceled";
    const blocked = trialExpired || (!active && hasNoSub);
    if (blocked && !notifiedRef.current) {
      notifiedRef.current = true;
      toast.error("A próbaidőszakod lejárt. Válassz csomagot a folytatáshoz.");
      void navigate({ to: "/subscription", replace: true });
    }
  }, [loading, active, trialExpired, subscription, pathname, navigate]);

  return null;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, type SubscriptionRow } from "@/lib/supabase";

const TRIAL_DAYS = 14;

type Ctx = {
  subscription: SubscriptionRow | null;
  loading: boolean;
  /** True if user has access right now (paid OR trial-not-expired). */
  active: boolean;
  /** True if user is on the no-card trial (no stripe subscription yet). */
  isTrialing: boolean;
  /** Days left in trial (0 if expired or not on trial). */
  trialDaysLeft: number;
  /** True if trial ended and no paid subscription exists. */
  trialExpired: boolean;
  trialEndsAt: Date | null;
  reload: () => Promise<void>;
};

const SubscriptionContext = createContext<Ctx | null>(null);

export const PLAN_INFO: Record<SubscriptionRow["plan"], { label: string; priceLabel: string; description: string }> = {
  alap: { label: "Alap", priceLabel: "2 990 Ft / hó", description: "Max 100 dokumentum, alap funkciók" },
  pro: { label: "Pro", priceLabel: "4 990 Ft / hó", description: "Korlátlan dokumentum, AI kategorizálás, bulk upload" },
  vallalati: { label: "Vállalati", priceLabel: "9 990 Ft / hó", description: "Több felhasználó, prioritásos támogatás, audit export" },
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (!error && data) {
      setSubscription(data as SubscriptionRow);
    } else if (!data) {
      // First login → start 14-day no-card trial.
      const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: created } = await supabase
        .from("subscriptions")
        .insert({
          user_id: u.user.id,
          plan: "pro",
          status: "active",
          current_period_end: trialEnd,
        })
        .select()
        .single();
      if (created) setSubscription(created as SubscriptionRow);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void reload());
    return () => sub.subscription.unsubscribe();
  }, [reload]);

  const derived = useMemo(() => {
    const now = Date.now();
    const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
    const hasStripe = !!subscription?.stripe_subscription_id;
    const isTrialing = !!subscription && !hasStripe && subscription.status === "active";
    const trialEndsAt = isTrialing ? periodEnd : null;
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)))
      : 0;
    const trialExpired = isTrialing && trialEndsAt !== null && trialEndsAt.getTime() < now;

    // active = paid sub still in period, OR trial not yet expired
    const paidActive = hasStripe && subscription?.status === "active" && (!periodEnd || periodEnd.getTime() > now);
    const trialActive = isTrialing && !trialExpired;
    const active = !!(paidActive || trialActive);

    return { isTrialing, trialDaysLeft, trialExpired, trialEndsAt, active };
  }, [subscription]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, reload, ...derived }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    return {
      subscription: null,
      loading: false,
      active: true,
      isTrialing: false,
      trialDaysLeft: 0,
      trialExpired: false,
      trialEndsAt: null,
      reload: async () => {},
    } as Ctx;
  }
  return ctx;
}

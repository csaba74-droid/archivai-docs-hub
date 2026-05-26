import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, type SubscriptionRow } from "@/lib/supabase";

const TRIAL_DAYS = 14;

type Ctx = {
  subscription: SubscriptionRow | null;
  loading: boolean;
  /** True if user has access right now (paid OR trial-not-expired OR lifetime partner). */
  active: boolean;
  /** True if user is on the no-card trial (no stripe subscription yet). */
  isTrialing: boolean;
  /** Days left in trial (0 if expired or not on trial). */
  trialDaysLeft: number;
  /** True if trial ended and no paid subscription exists. */
  trialExpired: boolean;
  trialEndsAt: Date | null;
  /** Partner type from profiles (e.g. 'accountant_lifetime'). */
  partnerType: string | null;
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
  const [partnerType, setPartnerType] = useState<string | null>(null);

  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      console.log("[useSubscription] no auth user");
      setSubscription(null);
      setUserCreatedAt(null);
      setPartnerType(null);
      setLoading(false);
      return;
    }
    setUserCreatedAt(u.user.created_at ?? null);
    const [{ data, error }, { data: prof }] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("user_id", u.user.id).maybeSingle(),
      supabase.from("profiles").select("partner_type").eq("id", u.user.id).maybeSingle(),
    ]);
    console.log("[useSubscription] loaded for", u.user.id, { data, error, prof });
    if (error) {
      setSubscription(null);
    } else {
      setSubscription((data as SubscriptionRow | null) ?? null);
    }
    setPartnerType((prof as { partner_type: string | null } | null)?.partner_type ?? null);
    setLoading(false);
  }, []);


  useEffect(() => {
    void reload();

    const { data: sub } = supabase.auth.onAuthStateChange(() => void reload());

    const onFocus = () => void reload();
    const onVisible = () => { if (document.visibilityState === "visible") void reload(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    let realtimeSub: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: u }) => {
      if (!u.user) return;
      realtimeSub = supabase
        .channel(`subscriptions:${u.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${u.user.id}`,
          },
          (payload) => {
            console.log('[useSubscription] realtime update:', payload);
            void reload();
          }
        )
        .subscribe();
    });

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (realtimeSub) supabase.removeChannel(realtimeSub);
    };
  }, [reload]);

  const derived = useMemo(() => {
    const now = Date.now();
    const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
    const lifetimePartner = partnerType === "accountant_lifetime";

    // Fallback: no subscription row yet → treat as trial from account creation.
    if (!subscription) {
      const createdMs = userCreatedAt ? new Date(userCreatedAt).getTime() : now;
      const trialEndsAt = new Date(createdMs + TRIAL_MS);
      const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)));
      const trialExpired = trialEndsAt.getTime() < now;
      return {
        isTrialing: !lifetimePartner,
        trialDaysLeft,
        trialExpired,
        trialEndsAt,
        active: lifetimePartner || !trialExpired,
      };
    }

    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
    const trialEndsAt = subscription.trial_end
      ? new Date(subscription.trial_end)
      : (subscription.status === "trialing" ? periodEnd : null);
    const hasStripe = !!(subscription.stripe_subscription_id || subscription.stripe_customer_id);

    const isTrialing = subscription.status === "trialing";
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)))
      : 0;
    const trialExpired = isTrialing && trialEndsAt !== null && trialEndsAt.getTime() < now;

    const paidActive =
      hasStripe &&
      (subscription.status === "active" || subscription.status === "past_due") &&
      (!periodEnd || periodEnd.getTime() > now);
    const canceledGrace =
      hasStripe &&
      subscription.status === "canceled" &&
      periodEnd !== null &&
      periodEnd.getTime() > now;
    const trialActive = isTrialing && !trialExpired;
    const active = lifetimePartner || !!(paidActive || canceledGrace || trialActive);

    return { isTrialing, trialDaysLeft, trialExpired, trialEndsAt, active };
  }, [subscription, userCreatedAt, partnerType]);



  return (
    <SubscriptionContext.Provider value={{ subscription, loading, reload, partnerType, ...derived }}>
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
      partnerType: null,
      reload: async () => {},
    } as Ctx;
  }
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type SubscriptionRow } from "@/lib/supabase";

type Ctx = {
  subscription: SubscriptionRow | null;
  loading: boolean;
  active: boolean;
  reload: () => Promise<void>;
};

const SubscriptionContext = createContext<Ctx | null>(null);

export const PLAN_INFO: Record<SubscriptionRow["plan"], { label: string; priceLabel: string; description: string }> = {
  alap: { label: "Alap", priceLabel: "0 Ft / hó", description: "Max 100 dokumentum, alap funkciók" },
  pro: { label: "Pro", priceLabel: "4 990 Ft / hó", description: "Korlátlan dokumentum, AI kategorizálás, bulk upload" },
  vallalati: { label: "Vállalati", priceLabel: "19 990 Ft / hó", description: "Több felhasználó, prioritásos támogatás, audit export" },
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
      // auto-create alap if trigger didn't run
      const { data: created } = await supabase
        .from("subscriptions")
        .insert({ user_id: u.user.id, plan: "alap", status: "active" })
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

  const active = subscription?.status === "active";

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, active, reload }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) return { subscription: null, loading: false, active: true, reload: async () => {} };
  return ctx;
}

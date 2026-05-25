-- Run this in the Supabase SQL Editor of your project (jofxnjtktwuzmjjcgofw).
-- Installs the signup trigger that auto-creates a 14-day trial subscription,
-- and adds an INSERT RLS policy so the client-side fallback in login.tsx works.

-- Make sure trial_end exists and status accepts 'trialing'
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_end timestamptz;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing','active','past_due','canceled','inactive'));

-- Allow user to insert own subscription row (client-side fallback)
DROP POLICY IF EXISTS "Users insert own subscription" ON public.subscriptions;
CREATE POLICY "Users insert own subscription"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger: auto-create 14-day trial on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, trial_end, current_period_end)
  VALUES (NEW.id, 'alap', 'trialing',
          now() + interval '14 days', now() + interval '14 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_subscription ON auth.users;
CREATE TRIGGER on_auth_user_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();

-- Backfill: existing users without a subscription row get a trial based on signup date
INSERT INTO public.subscriptions (user_id, plan, status, trial_end, current_period_end)
SELECT u.id, 'alap', 'trialing',
       COALESCE(u.created_at, now()) + interval '14 days',
       COALESCE(u.created_at, now()) + interval '14 days'
FROM auth.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.user_id IS NULL;

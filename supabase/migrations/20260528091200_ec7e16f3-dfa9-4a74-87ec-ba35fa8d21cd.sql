CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.nav_settings (
  user_id uuid PRIMARY KEY,
  adoszam text NOT NULL,
  technical_username text NOT NULL,
  signature_key text NOT NULL,
  exchange_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nav_settings TO authenticated;
GRANT ALL ON public.nav_settings TO service_role;

ALTER TABLE public.nav_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own nav settings" ON public.nav_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own nav settings" ON public.nav_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own nav settings" ON public.nav_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own nav settings" ON public.nav_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER nav_settings_updated_at
  BEFORE UPDATE ON public.nav_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

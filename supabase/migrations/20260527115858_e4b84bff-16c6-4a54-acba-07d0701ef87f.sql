
-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  company text,
  archivai_email text UNIQUE,
  referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles(referred_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Admin overrides — required for the admin page's Lifetime Free toggle
CREATE POLICY "Admin can view any profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (lower(coalesce((auth.jwt()->>'email'), '')) = 'lenard.csaba74@gmail.com');
CREATE POLICY "Admin can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (lower(coalesce((auth.jwt()->>'email'), '')) = 'lenard.csaba74@gmail.com')
  WITH CHECK (lower(coalesce((auth.jwt()->>'email'), '')) = 'lenard.csaba74@gmail.com');

CREATE OR REPLACE FUNCTION public.gen_archivai_email()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF new.archivai_email IS NULL THEN
    new.archivai_email := 'u' || substr(replace(new.id::text, '-', ''), 1, 12);
  END IF;
  RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS profiles_archivai_email ON public.profiles;
CREATE TRIGGER profiles_archivai_email BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.gen_archivai_email();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ref uuid;
BEGIN
  BEGIN
    _ref := nullif(new.raw_user_meta_data->>'referred_by', '')::uuid;
  EXCEPTION WHEN OTHERS THEN _ref := NULL;
  END;
  INSERT INTO public.profiles (id, full_name, company, referred_by)
  VALUES (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          coalesce(new.raw_user_meta_data->>'company', ''),
          _ref)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'alap' CHECK (plan IN ('alap','pro','vallalati')),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','canceled','inactive')),
  current_period_end timestamptz,
  trial_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, trial_end, current_period_end)
  VALUES (new.id, 'alap', 'trialing', now() + interval '14 days', now() + interval '14 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_subscription ON auth.users;
CREATE TRIGGER on_auth_user_subscription AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();

-- ============ DOCUMENTS ============
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  original_filename text,
  storage_path text NOT NULL,
  category text NOT NULL,
  itm_compliant boolean NOT NULL DEFAULT false,
  size_bytes bigint,
  mime_type text,
  sha256 text,
  content_text text,
  ai_confidence numeric,
  document_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS documents_category_idx ON public.documents(category);
CREATE INDEX IF NOT EXISTS documents_sha256_idx ON public.documents(sha256);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ AUDIT LOG ============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_document_id_idx ON public.audit_log(document_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audit log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ CUSTOM CATEGORIES ============
CREATE TABLE IF NOT EXISTS public.custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  mode text NOT NULL CHECK (mode IN ('strict','normal')),
  retention_years int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS custom_categories_user_id_idx ON public.custom_categories(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_categories TO authenticated;
GRANT ALL ON public.custom_categories TO service_role;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own custom categories" ON public.custom_categories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own custom categories" ON public.custom_categories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own custom categories" ON public.custom_categories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own custom categories" ON public.custom_categories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users can delete own storage docs" ON storage.objects;
CREATE POLICY "Users can delete own storage docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Backfill profile + subscription rows for any existing auth users
INSERT INTO public.profiles (id, full_name, company)
SELECT u.id, coalesce(u.raw_user_meta_data->>'full_name',''), coalesce(u.raw_user_meta_data->>'company','')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.subscriptions (user_id, plan, status, trial_end, current_period_end)
SELECT u.id, 'alap', 'trialing', now() + interval '14 days', now() + interval '14 days'
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

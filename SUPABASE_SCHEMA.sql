-- Run this in your Supabase SQL editor.

-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'company', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ DOCUMENTS ============
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  category text not null,
  itm_compliant boolean not null default false,
  size_bytes bigint,
  mime_type text,
  sha256 text,
  created_at timestamptz not null default now()
);

-- Add columns if missing
alter table public.documents add column if not exists sha256 text;
alter table public.documents add column if not exists original_filename text;
alter table public.documents add column if not exists content_text text;
alter table public.documents add column if not exists ai_confidence numeric;
alter table public.documents add column if not exists document_date date;

create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_category_idx on public.documents(category);
create index if not exists documents_sha256_idx on public.documents(sha256);
create index if not exists documents_fts_idx on public.documents
  using gin (to_tsvector('simple', coalesce(content_text, '') || ' ' || coalesce(filename, '')));

alter table public.documents enable row level security;

drop policy if exists "Users can view own documents" on public.documents;
create policy "Users can view own documents"
  on public.documents for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own documents" on public.documents;
create policy "Users can update own documents"
  on public.documents for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own documents" on public.documents;
create policy "Users can delete own documents"
  on public.documents for delete to authenticated
  using (auth.uid() = user_id);

-- ============ AUDIT LOG ============
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_user_id_idx on public.audit_log(user_id);
create index if not exists audit_log_document_id_idx on public.audit_log(document_id);
create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "Users can view own audit log" on public.audit_log;
create policy "Users can view own audit log"
  on public.audit_log for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own audit log" on public.audit_log;
create policy "Users can insert own audit log"
  on public.audit_log for insert to authenticated
  with check (auth.uid() = user_id);

-- ============ CUSTOM CATEGORIES ============
create table if not exists public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  mode text not null check (mode in ('strict', 'normal')),
  retention_years int, -- null = no limit / indefinite
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists custom_categories_user_id_idx on public.custom_categories(user_id);

alter table public.custom_categories enable row level security;

drop policy if exists "Users select own custom categories" on public.custom_categories;
create policy "Users select own custom categories"
  on public.custom_categories for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own custom categories" on public.custom_categories;
create policy "Users insert own custom categories"
  on public.custom_categories for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own custom categories" on public.custom_categories;
create policy "Users update own custom categories"
  on public.custom_categories for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users delete own custom categories" on public.custom_categories;
create policy "Users delete own custom categories"
  on public.custom_categories for delete to authenticated
  using (auth.uid() = user_id);

-- ============ SUBSCRIPTIONS ============
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'alap' check (plan in ('alap', 'pro', 'vallalati')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'inactive')),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users view own subscription" on public.subscriptions;
create policy "Users view own subscription"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

-- Insert: handled by the signup trigger only. Do NOT allow authenticated users
-- to insert subscriptions (otherwise they could self-provision a paid plan).
drop policy if exists "Users insert own subscription" on public.subscriptions;

-- Update: NOT allowed from the client. Plan/status changes must come from a
-- trusted backend (Stripe webhook handler running with the service role key).
drop policy if exists "Users update own subscription" on public.subscriptions;

-- Delete: never allowed from the client.
drop policy if exists "Users delete own subscription" on public.subscriptions;


-- Auto-create active 'alap' subscription on signup
create or replace function public.handle_new_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'alap', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_subscription on auth.users;
create trigger on_auth_user_subscription
  after insert on auth.users
  for each row execute function public.handle_new_subscription();

-- ============ STORAGE BUCKET ============
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload own documents" on storage.objects;
create policy "Users can upload own documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can read own documents" on storage.objects;
create policy "Users can read own documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own documents" on storage.objects;
create policy "Users can delete own documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Run this in your Supabase SQL editor.

-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  created_at timestamptz not null default now()
);

-- Add columns if missing
alter table public.profiles add column if not exists archivai_email text unique;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists partner_type text;
create index if not exists profiles_referred_by_idx on public.profiles(referred_by);

-- Auto-fill archivai_email for new profiles (derived from user id)
create or replace function public.gen_archivai_email()
returns trigger language plpgsql as $$
begin
  if new.archivai_email is null then
    new.archivai_email := 'u' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_archivai_email on public.profiles;
create trigger profiles_archivai_email
  before insert on public.profiles
  for each row execute function public.gen_archivai_email();

-- Backfill existing rows
update public.profiles
set archivai_email = 'u' || substr(replace(id::text, '-', ''), 1, 12)
where archivai_email is null;

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

-- Auto-create profile on signup (reads referred_by from user metadata)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _ref uuid;
begin
  begin
    _ref := nullif(new.raw_user_meta_data->>'referred_by', '')::uuid;
  exception when others then
    _ref := null;
  end;
  insert into public.profiles (id, full_name, company, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'company', ''),
    _ref
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ ADMIN REFERRAL FUNCTIONS ============
-- Hardcoded admin email check inside SECURITY DEFINER functions.
create or replace function public.admin_referrals()
returns table (
  referrer_id uuid,
  referrer_email text,
  referrer_partner_type text,
  referred_count bigint,
  referred jsonb
) language plpgsql security definer set search_path = public, auth as $$
begin
  if lower(coalesce((auth.jwt()->>'email'), '')) <> 'lenard.csaba74@gmail.com' then
    raise exception 'forbidden';
  end if;
  return query
  select
    p.id,
    u.email::text,
    p.partner_type,
    count(r.id),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'email', ru.email,
          'full_name', r.full_name,
          'created_at', r.created_at
        ) order by r.created_at desc
      ) filter (where r.id is not null),
      '[]'::jsonb
    )
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.profiles r on r.referred_by = p.id
  left join auth.users ru on ru.id = r.id
  where exists (select 1 from public.profiles x where x.referred_by = p.id)
  group by p.id, u.email, p.partner_type;
end;
$$;

revoke all on function public.admin_referrals() from public;
grant execute on function public.admin_referrals() to authenticated;

create or replace function public.admin_set_partner_type(_user uuid, _type text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce((auth.jwt()->>'email'), '')) <> 'lenard.csaba74@gmail.com' then
    raise exception 'forbidden';
  end if;
  update public.profiles set partner_type = _type where id = _user;
end;
$$;

revoke all on function public.admin_set_partner_type(uuid, text) from public;
grant execute on function public.admin_set_partner_type(uuid, text) to authenticated;

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
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'inactive')),
  current_period_end timestamptz,
  trial_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

-- If the table existed before, make sure new constraints/columns are applied.
alter table public.subscriptions add column if not exists trial_end timestamptz;
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('trialing', 'active', 'past_due', 'canceled', 'inactive'));

alter table public.subscriptions enable row level security;

drop policy if exists "Users view own subscription" on public.subscriptions;
create policy "Users view own subscription"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

-- Insert/update/delete are not allowed from the client.
drop policy if exists "Users insert own subscription" on public.subscriptions;
drop policy if exists "Users update own subscription" on public.subscriptions;
drop policy if exists "Users delete own subscription" on public.subscriptions;


-- Auto-create a 14-day trial subscription on signup
create or replace function public.handle_new_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id, plan, status, trial_end, current_period_end)
  values (new.id, 'alap', 'trialing', now() + interval '14 days', now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_subscription on auth.users;
create trigger on_auth_user_subscription
  after insert on auth.users
  for each row execute function public.handle_new_subscription();

-- Backfill: existing rows that were auto-created as 'active' but never linked
-- to Stripe become proper trial rows.
update public.subscriptions
set status = 'trialing',
    trial_end = coalesce(trial_end, current_period_end, now() + interval '14 days'),
    current_period_end = coalesce(current_period_end, trial_end, now() + interval '14 days')
where stripe_subscription_id is null
  and stripe_customer_id is null
  and status = 'active';


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

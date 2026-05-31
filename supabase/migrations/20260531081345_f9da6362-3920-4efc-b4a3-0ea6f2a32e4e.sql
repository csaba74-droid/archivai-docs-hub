-- Server-side upload guard: only users with active access can insert documents
-- or upload to the documents storage bucket.

create or replace function public.has_active_access(_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  with sub as (
    select * from public.subscriptions where user_id = _user
  ),
  prof as (
    select partner_type from public.profiles where id = _user
  ),
  usr as (
    select created_at from auth.users where id = _user
  )
  select
    -- Lifetime partners always have access
    coalesce((select partner_type from prof) = 'accountant_lifetime', false)
    or
    -- Paid: active / past_due with valid (or null) period end
    exists (
      select 1 from sub
      where status in ('active','past_due')
        and (current_period_end is null or current_period_end > now())
    )
    or
    -- Canceled grace period
    exists (
      select 1 from sub
      where status = 'canceled'
        and current_period_end is not null
        and current_period_end > now()
    )
    or
    -- Trialing not expired
    exists (
      select 1 from sub
      where status = 'trialing'
        and (
          (trial_end is not null and trial_end > now())
          or (trial_end is null and current_period_end is not null and current_period_end > now())
        )
    )
    or
    -- Fallback: no subscription row yet but account < 14 days old
    (
      not exists (select 1 from sub)
      and exists (select 1 from usr where created_at > now() - interval '14 days')
    );
$$;

revoke all on function public.has_active_access(uuid) from public;
grant execute on function public.has_active_access(uuid) to authenticated;

-- Tighten public.documents INSERT policy
drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert to authenticated
  with check (auth.uid() = user_id and public.has_active_access(auth.uid()));

-- Tighten storage upload policy for the documents bucket
drop policy if exists "Users can upload own documents" on storage.objects;
create policy "Users can upload own documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_active_access(auth.uid())
  );
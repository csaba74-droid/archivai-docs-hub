
-- Shared access invitations
create table if not exists public.shared_access (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  invited_user_id uuid references auth.users(id) on delete set null,
  categories text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_access_owner_idx on public.shared_access(owner_user_id);
create index if not exists shared_access_invited_email_idx on public.shared_access(lower(invited_email));
create index if not exists shared_access_invited_user_idx on public.shared_access(invited_user_id);

create unique index if not exists shared_access_owner_email_uniq
  on public.shared_access(owner_user_id, lower(invited_email));

alter table public.shared_access enable row level security;

-- Owner can fully manage their own invites
drop policy if exists "Owner can view own shares" on public.shared_access;
create policy "Owner can view own shares"
  on public.shared_access for select to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "Owner can insert own shares" on public.shared_access;
create policy "Owner can insert own shares"
  on public.shared_access for insert to authenticated
  with check (auth.uid() = owner_user_id);

drop policy if exists "Owner can update own shares" on public.shared_access;
create policy "Owner can update own shares"
  on public.shared_access for update to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "Owner can delete own shares" on public.shared_access;
create policy "Owner can delete own shares"
  on public.shared_access for delete to authenticated
  using (auth.uid() = owner_user_id);

-- Invited user can view invites addressed to them (by email or linked user id)
drop policy if exists "Invitee can view own invitations" on public.shared_access;
create policy "Invitee can view own invitations"
  on public.shared_access for select to authenticated
  using (
    invited_user_id = auth.uid()
    or lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

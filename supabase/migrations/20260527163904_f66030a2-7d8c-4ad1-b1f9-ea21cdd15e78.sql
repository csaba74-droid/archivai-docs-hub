-- Function: list referrals for the current user (security definer to bypass profile RLS)
create or replace function public.my_referrals()
returns table (
  user_id uuid,
  full_name text,
  email text,
  created_at timestamptz,
  subscribed boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  return query
  select
    p.id,
    p.full_name,
    u.email::text,
    p.created_at,
    coalesce(s.status in ('active','past_due'), false) as subscribed
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.subscriptions s on s.user_id = p.id
  where p.referred_by = auth.uid()
  order by p.created_at desc;
end;
$$;

revoke all on function public.my_referrals() from public;
grant execute on function public.my_referrals() to authenticated;

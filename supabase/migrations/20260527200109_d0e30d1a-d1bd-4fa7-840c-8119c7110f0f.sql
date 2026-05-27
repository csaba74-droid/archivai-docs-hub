
create or replace function public.admin_referral_stats()
returns table(
  referrer_id uuid,
  referrer_email text,
  referred_count bigint,
  subscribed_count bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $$
begin
  if lower(coalesce((auth.jwt()->>'email'), '')) <> 'lenard.csaba74@gmail.com' then
    raise exception 'forbidden';
  end if;
  return query
  select
    p.referred_by as referrer_id,
    u.email::text as referrer_email,
    count(*)::bigint as referred_count,
    count(*) filter (where coalesce(s.status in ('active','past_due'), false))::bigint as subscribed_count
  from public.profiles p
  join auth.users u on u.id = p.referred_by
  left join public.subscriptions s on s.user_id = p.id
  where p.referred_by is not null
  group by p.referred_by, u.email
  order by count(*) desc;
end;
$$;

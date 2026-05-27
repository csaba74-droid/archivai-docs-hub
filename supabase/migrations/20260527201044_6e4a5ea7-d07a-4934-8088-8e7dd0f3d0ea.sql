
CREATE OR REPLACE FUNCTION public.admin_referral_list()
RETURNS TABLE(
  referrer_id uuid,
  referrer_email text,
  referred_id uuid,
  referred_email text,
  registered_at timestamp with time zone,
  subscribed boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
begin
  if lower(coalesce((auth.jwt()->>'email'), '')) <> 'lenard.csaba74@gmail.com' then
    raise exception 'forbidden';
  end if;
  return query
  select
    p.referred_by as referrer_id,
    ru.email::text as referrer_email,
    p.id as referred_id,
    u.email::text as referred_email,
    p.created_at as registered_at,
    coalesce(s.status in ('active','past_due'), false) as subscribed
  from public.profiles p
  join auth.users u on u.id = p.id
  join auth.users ru on ru.id = p.referred_by
  left join public.subscriptions s on s.user_id = p.id
  where p.referred_by is not null
  order by p.created_at desc;
end;
$$;

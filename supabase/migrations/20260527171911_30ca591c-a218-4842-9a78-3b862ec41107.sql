CREATE OR REPLACE FUNCTION public.get_referrals()
RETURNS TABLE(user_id uuid, full_name text, email text, created_at timestamp with time zone, subscribed boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
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
$function$;
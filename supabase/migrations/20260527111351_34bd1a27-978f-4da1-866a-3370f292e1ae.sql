create or replace function public.admin_users_overview()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  plan text,
  status text,
  trial_end timestamptz,
  partner_type text,
  document_count bigint,
  storage_bytes bigint
) language plpgsql security definer set search_path = public, auth as $$
begin
  if lower(coalesce((auth.jwt()->>'email'), '')) <> 'lenard.csaba74@gmail.com' then
    raise exception 'forbidden';
  end if;
  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    s.plan,
    s.status,
    s.trial_end,
    p.partner_type,
    coalesce(d.cnt, 0) as document_count,
    coalesce(d.bytes, 0) as storage_bytes
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.subscriptions s on s.user_id = u.id
  left join (
    select user_id, count(*)::bigint as cnt, coalesce(sum(size_bytes),0)::bigint as bytes
    from public.documents group by user_id
  ) d on d.user_id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_users_overview() from public;
grant execute on function public.admin_users_overview() to authenticated;

create or replace function public.admin_extend_trial_days(_user uuid, _days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce((auth.jwt()->>'email'), '')) <> 'lenard.csaba74@gmail.com' then
    raise exception 'forbidden';
  end if;
  insert into public.subscriptions (user_id, plan, status, trial_end, current_period_end)
  values (_user, 'alap', 'trialing', now() + (_days || ' days')::interval, now() + (_days || ' days')::interval)
  on conflict (user_id) do update
    set trial_end = coalesce(public.subscriptions.trial_end, now()) + (_days || ' days')::interval,
        status = 'trialing',
        updated_at = now();
end;
$$;

revoke all on function public.admin_extend_trial_days(uuid, int) from public;
grant execute on function public.admin_extend_trial_days(uuid, int) to authenticated;
create or replace function public.admin_set_partner_type(_user uuid, _type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce((auth.jwt()->>'email'), '')) <> 'lenard.csaba74@gmail.com' then
    raise exception 'forbidden';
  end if;

  update public.profiles
  set partner_type = _type
  where id = _user;
end;
$$;

revoke all on function public.admin_set_partner_type(uuid, text) from public;
grant execute on function public.admin_set_partner_type(uuid, text) to authenticated;

NOTIFY pgrst, 'reload schema';
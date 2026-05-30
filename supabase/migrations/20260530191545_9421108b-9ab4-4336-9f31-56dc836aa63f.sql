
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _ref uuid;
  _full_name text;
  _source text;
  _base text;
  _candidate text;
  _suffix int := 1;
BEGIN
  BEGIN
    _ref := nullif(new.raw_user_meta_data->>'referred_by', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    _ref := NULL;
  END;

  _full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  _source := coalesce(_full_name, nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''));

  _base := lower(coalesce(_source, ''));
  _base := translate(
    _base,
    'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūýÿñçß',
    'aaaaaaaeeeeeiiiiiooooooouuuuuyyncs'
  );
  _base := regexp_replace(_base, '[._\-+]+', '.', 'g');
  _base := regexp_replace(_base, '\s+', '.', 'g');
  _base := regexp_replace(_base, '[^a-z0-9.]', '', 'g');
  _base := regexp_replace(_base, '\.+', '.', 'g');
  _base := trim(both '.' from _base);

  IF _base = '' THEN
    _base := 'u' || substr(replace(new.id::text, '-', ''), 1, 12);
  END IF;

  _candidate := _base || '@inbox.archivai.hu';
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE archivai_email = _candidate) LOOP
    _suffix := _suffix + 1;
    _candidate := _base || _suffix::text || '@inbox.archivai.hu';
  END LOOP;

  INSERT INTO public.profiles (id, email, full_name, company, referred_by, archivai_email)
  VALUES (
    new.id,
    new.email,
    coalesce(_full_name, _source, ''),
    coalesce(new.raw_user_meta_data->>'company', ''),
    _ref,
    _candidate
  )
  ON CONFLICT (id) DO UPDATE
    SET email = coalesce(nullif(public.profiles.email, ''), EXCLUDED.email),
        archivai_email = coalesce(nullif(public.profiles.archivai_email, ''), EXCLUDED.archivai_email),
        full_name = coalesce(nullif(public.profiles.full_name, ''), EXCLUDED.full_name),
        company = coalesce(nullif(public.profiles.company, ''), EXCLUDED.company),
        referred_by = coalesce(public.profiles.referred_by, EXCLUDED.referred_by);

  BEGIN
    INSERT INTO public.custom_categories (user_id, name, color, mode, is_system)
    VALUES (new.id, 'Beérkezett', '#F59E0B', 'normal', true)
    ON CONFLICT (user_id, name) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

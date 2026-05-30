CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ref uuid;
  _full_name text;
  _email_local text;
BEGIN
  BEGIN
    _ref := nullif(new.raw_user_meta_data->>'referred_by', '')::uuid;
  EXCEPTION WHEN OTHERS THEN _ref := NULL;
  END;

  _full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');

  -- Fallback: derive a name from the email local part so gen_archivai_email
  -- can produce a real address instead of the id-based fallback.
  IF _full_name IS NULL AND new.email IS NOT NULL THEN
    _email_local := split_part(new.email, '@', 1);
    _email_local := regexp_replace(_email_local, '[._\-+]+', ' ', 'g');
    _email_local := trim(regexp_replace(_email_local, '\s+', ' ', 'g'));
    IF _email_local <> '' THEN
      _full_name := _email_local;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, company, referred_by)
  VALUES (new.id,
          coalesce(_full_name, ''),
          coalesce(new.raw_user_meta_data->>'company', ''),
          _ref)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.custom_categories (user_id, name, color, mode, is_system)
  VALUES (new.id, 'Beérkezett', '#F59E0B', 'normal', true)
  ON CONFLICT (user_id, name) DO NOTHING;

  RETURN new;
END;
$function$;
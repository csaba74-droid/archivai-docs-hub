
-- Harden handle_new_user: compute archivai_email inline so the value is
-- always written, even if a side-effect (custom_categories insert) errors,
-- and wrap optional inserts so they cannot abort the signup.

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
  _base text;
  _candidate text;
  _suffix int := 1;
BEGIN
  -- referred_by from metadata (uuid-safe)
  BEGIN
    _ref := nullif(new.raw_user_meta_data->>'referred_by', '')::uuid;
  EXCEPTION WHEN OTHERS THEN _ref := NULL;
  END;

  _full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');

  -- Fallback: derive a name from the email local part
  IF _full_name IS NULL AND new.email IS NOT NULL THEN
    _email_local := split_part(new.email, '@', 1);
    _email_local := regexp_replace(_email_local, '[._\-+]+', ' ', 'g');
    _email_local := trim(regexp_replace(_email_local, '\s+', ' ', 'g'));
    IF _email_local <> '' THEN
      _full_name := _email_local;
    END IF;
  END IF;

  -- Compute archivai_email inline (mirrors gen_archivai_email logic)
  _base := lower(coalesce(_full_name, ''));
  _base := translate(
    _base,
    'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūýÿñçß',
    'aaaaaaaeeeeeiiiiiooooooouuuuuyyncs'
  );
  _base := regexp_replace(_base, '\s+', '.', 'g');
  _base := regexp_replace(_base, '[^a-z0-9.]', '', 'g');
  _base := regexp_replace(_base, '\.+', '.', 'g');
  _base := trim(both '.' from _base);

  IF _base = '' THEN
    _base := 'u' || substr(replace(new.id::text, '-', ''), 1, 12);
  END IF;

  _candidate := _base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE archivai_email = _candidate) LOOP
    _suffix := _suffix + 1;
    _candidate := _base || _suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, full_name, company, referred_by, archivai_email)
  VALUES (new.id,
          coalesce(_full_name, ''),
          coalesce(new.raw_user_meta_data->>'company', ''),
          _ref,
          _candidate)
  ON CONFLICT (id) DO UPDATE
    SET archivai_email = COALESCE(public.profiles.archivai_email, EXCLUDED.archivai_email),
        full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);

  -- Optional seed category — never let this abort signup
  BEGIN
    INSERT INTO public.custom_categories (user_id, name, color, mode, is_system)
    VALUES (new.id, 'Beérkezett', '#F59E0B', 'normal', true)
    ON CONFLICT (user_id, name) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- swallow: signup must succeed even if seeding fails
    NULL;
  END;

  RETURN new;
END;
$function$;

-- Backfill: any existing profile row without an archivai_email gets one now.
UPDATE public.profiles p
SET archivai_email = sub.candidate
FROM (
  SELECT
    p2.id,
    CASE
      WHEN trim(coalesce(p2.full_name, '')) <> '' THEN
        trim(both '.' from regexp_replace(
          regexp_replace(
            regexp_replace(
              translate(
                lower(p2.full_name),
                'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūýÿñçß',
                'aaaaaaaeeeeeiiiiiooooooouuuuuyyncs'
              ),
              '\s+', '.', 'g'
            ),
            '[^a-z0-9.]', '', 'g'
          ),
          '\.+', '.', 'g'
        ))
      ELSE 'u' || substr(replace(p2.id::text, '-', ''), 1, 12)
    END AS candidate
  FROM public.profiles p2
  WHERE p2.archivai_email IS NULL OR p2.archivai_email = ''
) sub
WHERE p.id = sub.id;

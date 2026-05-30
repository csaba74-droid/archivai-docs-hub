-- Replace gen_archivai_email trigger to derive local part from full_name
CREATE OR REPLACE FUNCTION public.gen_archivai_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  base_name text;
  candidate text;
  suffix int := 1;
  src text;
BEGIN
  -- Only generate if not already set (preserves existing users' addresses)
  IF NEW.archivai_email IS NOT NULL AND length(NEW.archivai_email) > 0 THEN
    RETURN NEW;
  END IF;

  src := coalesce(nullif(trim(NEW.full_name), ''), '');

  IF src = '' THEN
    -- Fallback to previous id-based scheme when no name is available
    NEW.archivai_email := 'u' || substr(replace(NEW.id::text, '-', ''), 1, 12);
    RETURN NEW;
  END IF;

  -- Normalize: lowercase, strip accents, spaces -> dots, keep [a-z0-9.]
  base_name := lower(src);
  -- Remove accents via unaccent-like manual mapping (common Hungarian chars)
  base_name := translate(
    base_name,
    'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūýÿñçß',
    'aaaaaaaeeeeeiiiiiooooooouuuuuyyncs'
  );
  base_name := regexp_replace(base_name, '\s+', '.', 'g');
  base_name := regexp_replace(base_name, '[^a-z0-9.]', '', 'g');
  base_name := regexp_replace(base_name, '\.+', '.', 'g');
  base_name := trim(both '.' from base_name);

  IF base_name = '' THEN
    NEW.archivai_email := 'u' || substr(replace(NEW.id::text, '-', ''), 1, 12);
    RETURN NEW;
  END IF;

  candidate := base_name;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE archivai_email = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_name || suffix::text;
  END LOOP;

  NEW.archivai_email := candidate;
  RETURN NEW;
END;
$function$;
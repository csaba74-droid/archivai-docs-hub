
ALTER TABLE public.custom_categories ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Modify signup trigger to also seed Beérkezett system category
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _ref uuid;
BEGIN
  BEGIN
    _ref := nullif(new.raw_user_meta_data->>'referred_by', '')::uuid;
  EXCEPTION WHEN OTHERS THEN _ref := NULL;
  END;
  INSERT INTO public.profiles (id, full_name, company, referred_by)
  VALUES (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          coalesce(new.raw_user_meta_data->>'company', ''),
          _ref)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.custom_categories (user_id, name, color, mode, is_system)
  VALUES (new.id, 'Beérkezett', '#F59E0B', 'normal', true)
  ON CONFLICT (user_id, name) DO NOTHING;

  RETURN new;
END;
$function$;

-- Backfill for existing users
INSERT INTO public.custom_categories (user_id, name, color, mode, is_system)
SELECT id, 'Beérkezett', '#F59E0B', 'normal', true FROM public.profiles
ON CONFLICT (user_id, name) DO NOTHING;

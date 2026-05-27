-- Attach handle_new_user trigger to auth.users so profile (with referred_by) is created on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Attach handle_new_subscription trigger as well (trial subscription on signup)
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_subscription();

-- Backfill referred_by for existing profiles where it was lost
-- (reads raw_user_meta_data->>'referred_by' from auth.users)
UPDATE public.profiles p
SET referred_by = nullif(u.raw_user_meta_data->>'referred_by', '')::uuid
FROM auth.users u
WHERE p.id = u.id
  AND p.referred_by IS NULL
  AND u.raw_user_meta_data->>'referred_by' IS NOT NULL
  AND u.raw_user_meta_data->>'referred_by' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
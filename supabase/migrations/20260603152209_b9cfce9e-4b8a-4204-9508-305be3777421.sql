ALTER TABLE public.shared_access
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'guest'
  CHECK (access_type IN ('guest','member'));

CREATE INDEX IF NOT EXISTS idx_shared_access_owner_access_type
  ON public.shared_access (owner_user_id, access_type);

-- Reclassify any existing editor rows as members (editors only make sense for workspace members).
UPDATE public.shared_access SET access_type = 'member' WHERE role = 'editor';

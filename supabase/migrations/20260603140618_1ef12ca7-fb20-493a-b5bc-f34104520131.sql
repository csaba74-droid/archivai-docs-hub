-- 1) Add role column to shared_access
ALTER TABLE public.shared_access
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'viewer';

ALTER TABLE public.shared_access
  DROP CONSTRAINT IF EXISTS shared_access_role_check;
ALTER TABLE public.shared_access
  ADD CONSTRAINT shared_access_role_check CHECK (role IN ('viewer', 'editor'));

-- 2) Security-definer helper to avoid RLS recursion when checking editor access
CREATE OR REPLACE FUNCTION public.is_workspace_editor_for_category(
  _owner uuid,
  _invited uuid,
  _category text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shared_access sa
    WHERE sa.owner_user_id = _owner
      AND sa.invited_user_id = _invited
      AND sa.status IN ('accepted', 'active')
      AND sa.role = 'editor'
      AND _category = ANY (sa.categories)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_editor_for_category(uuid, uuid, text) TO authenticated;

-- 3) New RLS policies on documents for workspace editors
DROP POLICY IF EXISTS "Workspace editors can insert documents" ON public.documents;
CREATE POLICY "Workspace editors can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_editor_for_category(documents.user_id, auth.uid(), documents.category)
);

DROP POLICY IF EXISTS "Workspace editors can update documents" ON public.documents;
CREATE POLICY "Workspace editors can update documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  public.is_workspace_editor_for_category(documents.user_id, auth.uid(), documents.category)
)
WITH CHECK (
  public.is_workspace_editor_for_category(documents.user_id, auth.uid(), documents.category)
);

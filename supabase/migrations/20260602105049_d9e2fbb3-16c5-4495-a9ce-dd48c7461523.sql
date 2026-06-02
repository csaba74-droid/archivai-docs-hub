ALTER TABLE public.shared_access
DROP CONSTRAINT IF EXISTS shared_access_status_check;

UPDATE public.shared_access
SET status = 'accepted', updated_at = now()
WHERE status = 'active';

ALTER TABLE public.shared_access
ADD CONSTRAINT shared_access_status_check
CHECK (status IN ('pending', 'accepted', 'revoked'));

DROP POLICY IF EXISTS "Shared invitees can view shared custom categories" ON public.custom_categories;
CREATE POLICY "Shared invitees can view shared custom categories"
ON public.custom_categories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shared_access sa
    WHERE sa.invited_user_id = auth.uid()
      AND sa.status IN ('accepted', 'active')
      AND sa.owner_user_id = custom_categories.user_id
      AND ('custom:' || custom_categories.id::text) = ANY(sa.categories)
  )
);

DROP POLICY IF EXISTS "Shared invitees can view shared documents" ON public.documents;
CREATE POLICY "Shared invitees can view shared documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shared_access sa
    WHERE sa.invited_user_id = auth.uid()
      AND sa.status IN ('accepted', 'active')
      AND sa.owner_user_id = documents.user_id
      AND documents.category = ANY(sa.categories)
  )
);
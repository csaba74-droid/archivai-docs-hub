-- Allow shared invitees to read custom_categories that have been shared with them
CREATE POLICY "Shared invitees can view shared custom categories"
ON public.custom_categories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shared_access sa
    WHERE sa.invited_user_id = auth.uid()
      AND sa.status = 'active'
      AND sa.owner_user_id = custom_categories.user_id
      AND ('custom:' || custom_categories.id::text) = ANY(sa.categories)
  )
);

-- Allow shared invitees to read documents in categories that have been shared with them
CREATE POLICY "Shared invitees can view shared documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shared_access sa
    WHERE sa.invited_user_id = auth.uid()
      AND sa.status = 'active'
      AND sa.owner_user_id = documents.user_id
      AND documents.category = ANY(sa.categories)
  )
);

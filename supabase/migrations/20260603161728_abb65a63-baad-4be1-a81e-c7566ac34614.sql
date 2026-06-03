
-- Tighten shared_access UPDATE policy: add WITH CHECK to prevent owner reassignment
DROP POLICY IF EXISTS "Owner can update own shares" ON public.shared_access;
CREATE POLICY "Owner can update own shares"
  ON public.shared_access FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Add UPDATE policy on storage.objects for the documents bucket so users can only overwrite their own files
DROP POLICY IF EXISTS "Users can update own storage docs" ON storage.objects;
CREATE POLICY "Users can update own storage docs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Replace the documents INSERT policy with a simple active-or-trialing check.

drop policy if exists "Users can insert own documents" on public.documents;

create policy "users_insert_own_documents_active_or_trial"
  on public.documents for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.subscriptions s
      where s.user_id = auth.uid()
        and (s.status = 'active' or s.trial_end > now())
    )
  );

-- Same rule for the documents storage bucket.
drop policy if exists "Users can upload own documents" on storage.objects;

create policy "users_upload_own_documents_active_or_trial"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.subscriptions s
      where s.user_id = auth.uid()
        and (s.status = 'active' or s.trial_end > now())
    )
  );
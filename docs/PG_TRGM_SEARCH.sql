-- Optional fuzzy search acceleration for the documents table.
-- The app's client-side Fuse.js search works without this, but enabling
-- pg_trgm + GIN indexes makes future server-side fuzzy queries fast at scale.
-- Apply via the Supabase SQL editor in the project that owns `documents`.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS documents_filename_trgm
  ON public.documents USING gin (filename gin_trgm_ops);

CREATE INDEX IF NOT EXISTS documents_original_filename_trgm
  ON public.documents USING gin (original_filename gin_trgm_ops);

CREATE INDEX IF NOT EXISTS documents_content_text_trgm
  ON public.documents USING gin (content_text gin_trgm_ops);

ALTER TABLE public.documents
  ADD COLUMN parent_document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  ADD COLUMN version_number integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_documents_parent_document_id ON public.documents(parent_document_id);
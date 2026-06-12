
CREATE TABLE public.document_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_notes_document_id_idx ON public.document_notes(document_id);
CREATE INDEX document_notes_created_at_idx ON public.document_notes(created_at);

GRANT SELECT, INSERT, DELETE ON public.document_notes TO authenticated;
GRANT ALL ON public.document_notes TO service_role;

ALTER TABLE public.document_notes ENABLE ROW LEVEL SECURITY;

-- Document owner can read all notes on their documents
CREATE POLICY "Document owner can read notes"
  ON public.document_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_notes.document_id
        AND d.user_id = auth.uid()
    )
  );

-- Authenticated users can insert notes on documents they own, as themselves
CREATE POLICY "Document owner can insert notes"
  ON public.document_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_notes.document_id
        AND d.user_id = auth.uid()
    )
  );

-- The note author or the document owner can delete a note
CREATE POLICY "Author or doc owner can delete note"
  ON public.document_notes FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_notes.document_id
        AND d.user_id = auth.uid()
    )
  );

-- Extend log_audit to allow new event types
CREATE OR REPLACE FUNCTION public.log_audit(_action text, _document_id uuid DEFAULT NULL::uuid, _metadata jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _action NOT IN (
    'upload','view','download','delete','delete_blocked',
    'search','categorize','rename','move','note_added','note_deleted'
  ) THEN
    RAISE EXCEPTION 'invalid audit action: %', _action;
  END IF;

  INSERT INTO public.audit_log (user_id, document_id, action, metadata)
  VALUES (_uid, _document_id, _action, _metadata);
END;
$function$;

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS category_changed_at timestamptz NOT NULL DEFAULT now();

UPDATE public.documents SET category_changed_at = created_at WHERE category_changed_at IS NULL OR category_changed_at = '1970-01-01'::timestamptz;

CREATE OR REPLACE FUNCTION public.documents_update_category_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.category IS DISTINCT FROM OLD.category THEN
    NEW.category_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_category_changed_at ON public.documents;
CREATE TRIGGER trg_documents_category_changed_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.documents_update_category_changed_at();
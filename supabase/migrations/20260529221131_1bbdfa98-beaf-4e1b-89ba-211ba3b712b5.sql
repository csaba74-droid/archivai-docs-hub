
-- Remove direct INSERT policy on audit_log
DROP POLICY IF EXISTS "Users can insert own audit log" ON public.audit_log;

-- Security-definer function to log audit entries with allowlisted actions
CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _document_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _action NOT IN (
    'upload','view','download','delete','delete_blocked',
    'search','categorize','rename','move'
  ) THEN
    RAISE EXCEPTION 'invalid audit action: %', _action;
  END IF;

  INSERT INTO public.audit_log (user_id, document_id, action, metadata)
  VALUES (_uid, _document_id, _action, _metadata);
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(text, uuid, jsonb) TO authenticated;

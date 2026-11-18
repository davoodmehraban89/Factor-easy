-- Allocate immutable ATEF and a temporary number for every new transactional document.
-- This keeps identity server-owned even when the UI uses generic datastore sync.
CREATE OR REPLACE FUNCTION public.finora_document_identity_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE n bigint; t text; transactional boolean;
BEGIN
  transactional := NEW.collection IN (
    'journalVouchers','invoices','purchases','payments','expenses','cheques',
    'contractStatements','payrollRuns','employeeBenefitAccruals','pettyCashTransactions'
  );
  IF NOT transactional THEN RETURN NEW; END IF;

  n := NULLIF(NEW.data->>'atefNumber','')::bigint;
  IF n IS NULL THEN n:=public.finora_next_atef(NEW.organization_id); END IF;

  t := nullif(trim(coalesce(NEW.data->>'temporaryNumber',NEW.data->>'number','')),'');
  IF t IS NULL THEN t:='TMP-'||n::text; END IF;

  NEW.data := NEW.data || jsonb_build_object('atefNumber',n,'temporaryNumber',t);

  -- A newly created transaction is always draft. Existing posted rows remain
  -- posted when unrelated metadata is updated; only an explicit posting RPC
  -- may move draft -> posted.
  IF TG_OP='INSERT' AND NEW.collection<>'journalLines' AND NEW.collection<>'journalLineDimensions' THEN
    IF NEW.collection='journalVouchers' THEN
      NEW.data := NEW.data - 'number' - 'postedAt' - 'postedBy' || jsonb_build_object('status','draft');
    ELSE
      NEW.data := NEW.data - 'number' - 'postedAt' - 'postedBy' - 'accountingPostedAt' - 'documentPostedAt' - 'documentPostedBy'
        || jsonb_build_object('documentStatus','draft');
      IF NEW.data ? 'accountingStatus' THEN
        NEW.data := NEW.data || jsonb_build_object('accountingStatus','draft');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS finora_document_identity_trigger ON public.records;
CREATE TRIGGER finora_document_identity_trigger
BEFORE INSERT ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.finora_document_identity_trigger();

REVOKE ALL ON FUNCTION public.finora_document_identity_trigger() FROM PUBLIC, anon, authenticated;

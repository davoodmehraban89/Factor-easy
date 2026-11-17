-- Restore the original strict posted-source immutability guard.
CREATE OR REPLACE FUNCTION private.finora_stage3_guard_posted_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $guard$
DECLARE
  v_kind text;
BEGIN
  IF TG_OP NOT IN ('UPDATE','DELETE') THEN
    RETURN NEW;
  END IF;
  IF OLD.collection NOT IN ('invoices','purchases') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF auth.uid() IS NULL
     OR private.finora_phase1a_mode(OLD.organization_id) <> 'enforce' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_kind := CASE OLD.collection WHEN 'invoices' THEN 'sale' ELSE 'purchase' END;
  IF EXISTS (
    SELECT 1 FROM public.records v
    WHERE v.organization_id = OLD.organization_id
      AND v.collection = 'journalVouchers'
      AND v.data->>'sourceType' = v_kind
      AND v.data->>'sourceId' = OLD.id
      AND v.data->>'status' IN ('posted','reversed')
  ) THEN
    RAISE EXCEPTION 'FINORA_POSTED_SOURCE_IMMUTABLE'
      USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$guard$;

REVOKE ALL ON FUNCTION private.finora_stage3_guard_posted_source()
FROM PUBLIC, anon, authenticated;


-- Restore the exact source guard that existed before this projection migration.
-- Keep the existing trigger untouched; this migration changed only the function body.
CREATE OR REPLACE FUNCTION public.finora_guard_posted_source_records()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  vid text := coalesce(old.data->>'journalVoucherId','');
  voucher_status text := '';
  source_locked boolean := false;
BEGIN
  IF old.collection NOT IN (
    'invoices','purchases','payments','expenses','cheques','contractStatements',
    'payrollRuns','employeeBenefitAccruals','pettyCashTransactions'
  ) THEN
    RETURN CASE WHEN tg_op='DELETE' THEN old ELSE new END;
  END IF;

  IF vid <> '' THEN
    SELECT coalesce(r.data->>'status','') INTO voucher_status
    FROM public.records r
    WHERE r.owner_id=old.owner_id
      AND r.collection='journalVouchers'
      AND r.id=vid;
  END IF;

  source_locked :=
    coalesce(old.data->>'accountingStatus','')='posted'
    OR (old.collection='cheques' AND coalesce(old.data->>'status','') IN ('cleared','bounced','cancelled'))
    OR (old.collection='contractStatements' AND coalesce(old.data->>'status','') IN ('posted','reversed'))
    OR (old.collection IN ('payrollRuns','employeeBenefitAccruals','pettyCashTransactions')
        AND coalesce(old.data->>'status','') IN ('posted','reversed'))
    OR voucher_status IN ('posted','reversed');

  IF NOT source_locked THEN
    RETURN CASE WHEN tg_op='DELETE' THEN old ELSE new END;
  END IF;

  IF tg_op='UPDATE' AND new.data=old.data THEN RETURN new; END IF;
  RAISE EXCEPTION 'source record linked to posted/reversed accounting history is immutable';
END $$;

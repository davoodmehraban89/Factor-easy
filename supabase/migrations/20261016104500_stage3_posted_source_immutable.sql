-- Stage 3 security gate: source documents referenced by an already posted
-- or reversed voucher cannot be altered through user-facing REST, versioned
-- sync, or ordinary SQL UPDATE/DELETE. Test-only pending release approval.
-- Directly addresses RED local JWT evidence: HTTP 200 mutation after autopost.
-- All checks are tenant-scoped and based on the persisted journal linkage,
-- not on potentially stale/missing client-owned accountingStatus flags.
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

  -- Ordinary authenticated JWT clients must never mutate a committed source.
  -- auth.uid() remains the original JWT actor inside this SECURITY DEFINER
  -- trigger. Trusted migrations/admin repairs with no user JWT are not
  -- automatically blocked; those need independent operational approval.
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

DROP TRIGGER IF EXISTS trg_finora_stage3_posted_source_immutable ON public.records;
CREATE TRIGGER trg_finora_stage3_posted_source_immutable
BEFORE UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION private.finora_stage3_guard_posted_source();

REVOKE ALL ON FUNCTION private.finora_stage3_guard_posted_source()
FROM PUBLIC, anon, authenticated;

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

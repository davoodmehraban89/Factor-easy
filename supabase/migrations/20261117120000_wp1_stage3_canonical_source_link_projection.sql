-- Permit only server-verifiable accounting-link projection updates after source posting.
-- Business payload remains immutable; metadata must match the real posted journal and reversal view.
CREATE OR REPLACE FUNCTION private.finora_stage3_guard_posted_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $guard$
DECLARE
  v_kind text;
  v_voucher public.records%rowtype;
  v_effective_status text;
  v_projection_keys text[] := ARRAY[
    'journalVoucherId','accountingStatus','accountingPostedAt',
    'documentStatus','documentPostedAt','documentPostedBy',
    'documentVersion','updatedAt',
    'accountingPostingPending','accountingPostingPendingAt'
  ]::text[];
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
  SELECT v.* INTO v_voucher
  FROM public.records v
  WHERE v.organization_id = OLD.organization_id
    AND v.collection = 'journalVouchers'
    AND v.data->>'sourceType' = v_kind
    AND v.data->>'sourceId' = OLD.id
    AND v.data->>'status' IN ('posted','reversed')
  ORDER BY v.data->>'postedAt' DESC NULLS LAST, v.id
  LIMIT 1;

  IF FOUND THEN
    -- A posted source's commercial/accounting inputs are immutable. The only
    -- permitted update is the canonical linkage/status projection below.
    IF (OLD.data - v_projection_keys) IS DISTINCT FROM (NEW.data - v_projection_keys) THEN
      RAISE EXCEPTION 'FINORA_POSTED_SOURCE_IMMUTABLE'
        USING ERRCODE = '23514';
    END IF;

    SELECT s.effective_status INTO v_effective_status
    FROM public.finora_journal_reversal_status s
    WHERE s.organization_id = OLD.organization_id
      AND s.voucher_id = v_voucher.id;
    v_effective_status := coalesce(v_effective_status, v_voucher.data->>'status');

    IF NEW.data->>'journalVoucherId' IS DISTINCT FROM v_voucher.id
       OR NEW.data->>'accountingStatus' IS DISTINCT FROM
          (CASE WHEN v_effective_status = 'reversed' THEN 'reversed' ELSE 'posted' END)
       OR NEW.data->>'documentStatus' IS DISTINCT FROM
          (CASE WHEN v_effective_status = 'reversed' THEN 'reversed' ELSE 'posted' END)
       OR NEW.data->>'accountingPostedAt' IS DISTINCT FROM v_voucher.data->>'postedAt'
       OR NEW.data->>'documentPostedAt' IS DISTINCT FROM v_voucher.data->>'postedAt'
       OR NEW.data->>'documentPostedBy' IS DISTINCT FROM
          coalesce(v_voucher.data->>'postedBy', OLD.data->>'documentPostedBy', auth.uid()::text)
       OR coalesce(NEW.data->>'documentVersion','1') IS DISTINCT FROM
          coalesce(OLD.data->>'documentVersion','1')
       OR NEW.data ? 'accountingPostingPending'
       OR NEW.data ? 'accountingPostingPendingAt' THEN
      RAISE EXCEPTION 'FINORA_POSTED_SOURCE_LINK_PROJECTION_INVALID'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$guard$;

REVOKE ALL ON FUNCTION private.finora_stage3_guard_posted_source()
FROM PUBLIC, anon, authenticated;

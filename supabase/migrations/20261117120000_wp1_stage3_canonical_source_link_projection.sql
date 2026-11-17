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
  source_locked boolean := false;
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


-- The earlier production guard also protects invoices/purchases by their linked voucher.
-- Permit only a canonical, voucher-derived status/link projection; all commercial
-- payload fields and all other source collections remain strictly immutable.
CREATE OR REPLACE FUNCTION public.finora_guard_posted_source_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  vid text := coalesce(old.data->>'journalVoucherId','');
  voucher_status text := '';
  v_voucher public.records%rowtype;
  v_effective_status text;
  source_locked boolean := false;
  v_projection_keys text[] := ARRAY[
    'journalVoucherId','accountingStatus','accountingPostedAt',
    'documentStatus','documentPostedAt','documentPostedBy',
    'documentVersion','updatedAt',
    'accountingPostingPending','accountingPostingPendingAt'
  ]::text[];
BEGIN
  IF old.collection NOT IN ('invoices','purchases','payments','expenses','cheques','contractStatements') THEN
    RETURN CASE WHEN tg_op='DELETE' THEN old ELSE new END;
  END IF;

  IF vid <> '' THEN
    SELECT coalesce(r.data->>'status','') INTO voucher_status
    FROM public.records r
    WHERE r.organization_id=old.organization_id
      AND r.owner_id=old.owner_id
      AND r.collection='journalVouchers'
      AND r.id=vid;
  END IF;

  IF old.collection IN ('invoices','purchases')
     AND tg_op='UPDATE'
     AND (coalesce(old.data->>'accountingStatus','')='posted'
          OR voucher_status IN ('posted','reversed')) THEN
    SELECT r.* INTO v_voucher
    FROM public.records r
    WHERE r.organization_id=old.organization_id
      AND r.owner_id=old.owner_id
      AND r.collection='journalVouchers'
      AND r.id=vid
      AND r.data->>'sourceType'=CASE old.collection WHEN 'invoices' THEN 'sale' ELSE 'purchase' END
      AND r.data->>'sourceId'=old.id
      AND r.data->>'status' IN ('posted','reversed');

    IF FOUND
       AND (old.data - v_projection_keys) IS NOT DISTINCT FROM (new.data - v_projection_keys) THEN
      SELECT s.effective_status INTO v_effective_status
      FROM public.finora_journal_reversal_status s
      WHERE s.organization_id=old.organization_id AND s.voucher_id=v_voucher.id;
      v_effective_status:=coalesce(v_effective_status,v_voucher.data->>'status');

      IF new.data->>'journalVoucherId' IS NOT DISTINCT FROM v_voucher.id
         AND new.data->>'accountingStatus' IS NOT DISTINCT FROM
           (CASE WHEN v_effective_status='reversed' THEN 'reversed' ELSE 'posted' END)
         AND new.data->>'documentStatus' IS NOT DISTINCT FROM
           (CASE WHEN v_effective_status='reversed' THEN 'reversed' ELSE 'posted' END)
         AND new.data->>'accountingPostedAt' IS NOT DISTINCT FROM v_voucher.data->>'postedAt'
         AND new.data->>'documentPostedAt' IS NOT DISTINCT FROM v_voucher.data->>'postedAt'
         AND new.data->>'documentPostedBy' IS NOT DISTINCT FROM
           coalesce(v_voucher.data->>'postedBy',old.data->>'documentPostedBy')
         AND coalesce(new.data->>'documentVersion','1') IS NOT DISTINCT FROM
           coalesce(old.data->>'documentVersion','1')
         AND NOT (new.data ? 'accountingPostingPending')
         AND NOT (new.data ? 'accountingPostingPendingAt') THEN
        RETURN new;
      END IF;
    END IF;
  END IF;

  source_locked :=
    coalesce(old.data->>'accountingStatus','')='posted'
    OR (old.collection='cheques' and coalesce(old.data->>'status','') in ('cleared','bounced','cancelled'))
    OR (old.collection='contractStatements' and coalesce(old.data->>'status','') in ('posted','reversed'))
    OR voucher_status in ('posted','reversed');

  IF NOT source_locked THEN
    RETURN CASE WHEN tg_op='DELETE' THEN old ELSE new END;
  END IF;

  IF tg_op='UPDATE' AND new.data=old.data THEN RETURN new; END IF;
  RAISE EXCEPTION 'source record linked to posted/reversed accounting history is immutable';
END $$;

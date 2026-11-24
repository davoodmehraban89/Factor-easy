-- Issue248: validate linked draft rows before either is removed.
-- No financial row rewrite. The old guards remain in force and unchanged.
-- PostgreSQL executes same-event triggers in lexical name order.
CREATE FUNCTION private.finora_wp4_guarded_draft_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $delete$
DECLARE
  v_source public.records%rowtype;
  v_voucher public.records%rowtype;
  v_registry public.finora_journal_document_registry%rowtype;
  v_collection text;
  v_type text;
  v_id text;
BEGIN
  IF OLD.collection NOT IN ('journalVouchers','invoices','purchases') THEN
    RETURN OLD;
  END IF;
  IF OLD.collection='journalVouchers' THEN
    v_voucher:=OLD;
    v_type:=coalesce(OLD.data->>'sourceType','manual');
    v_collection:=CASE v_type WHEN 'sale' THEN 'invoices' WHEN 'purchase' THEN 'purchases' END;
    IF v_collection IS NOT NULL THEN
      v_id:=nullif(OLD.data->>'sourceId','');
      SELECT * INTO v_source FROM public.records
       WHERE organization_id=OLD.organization_id AND collection=v_collection AND id=v_id
       FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'FINORA_DRAFT_DELETE_SOURCE_LINK_INVALID' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSE
    v_source:=OLD;
    v_collection:=OLD.collection;
    v_type:=CASE v_collection WHEN 'invoices' THEN 'sale' ELSE 'purchase' END;
    v_id:=nullif(OLD.data->>'journalVoucherId','');
    IF v_id IS NULL THEN
      -- Missing forward pointer is not permission to erase a linked source.
      IF EXISTS(SELECT 1 FROM public.records v
         WHERE v.organization_id=OLD.organization_id AND v.collection='journalVouchers'
           AND v.data->>'sourceType'=v_type AND v.data->>'sourceId'=OLD.id) THEN
        RAISE EXCEPTION 'FINORA_DRAFT_DELETE_SOURCE_LINK_INVALID' USING ERRCODE='23514';
      END IF;
    ELSE
      SELECT * INTO v_voucher FROM public.records
       WHERE organization_id=OLD.organization_id AND collection='journalVouchers' AND id=v_id
       FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'FINORA_DRAFT_DELETE_VOUCHER_LINK_INVALID' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;

  IF v_source.id IS NOT NULL THEN
    IF v_source.data->>'documentStatus' IS DISTINCT FROM 'draft'
       OR v_source.data->>'accountingStatus' IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'FINORA_POSTED_SOURCE_NOT_DELETABLE' USING ERRCODE='23514';
    END IF;
    PERFORM private.finora_phase1a_authorize(v_source.organization_id,'delete',v_type);
    IF private.can_access_record(v_source.organization_id,v_source.collection,v_source.owner_id,v_source.data,'delete') IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'FINORA_DRAFT_DELETE_SOURCE_SCOPE_FORBIDDEN' USING ERRCODE='42501';
    END IF;
  END IF;

  IF v_voucher.id IS NOT NULL THEN
    IF v_voucher.data->>'status' IS DISTINCT FROM 'draft'
       OR v_voucher.data->>'documentStatus' IS DISTINCT FROM 'draft'
       OR v_voucher.data->>'accountingStatus' IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'FINORA_POSTED_DOCUMENT_NOT_DELETABLE' USING ERRCODE='23514';
    END IF;
    PERFORM private.finora_phase1a_authorize(v_voucher.organization_id,'delete',NULL);
    IF private.can_access_record(v_voucher.organization_id,'journalVouchers',v_voucher.owner_id,v_voucher.data,'delete') IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'FINORA_DRAFT_DELETE_VOUCHER_SCOPE_FORBIDDEN' USING ERRCODE='42501';
    END IF;
    IF v_source.id IS NOT NULL AND (
        v_source.organization_id IS DISTINCT FROM v_voucher.organization_id
        OR v_source.owner_id IS DISTINCT FROM v_voucher.owner_id
        OR nullif(v_source.data->>'companyId','') IS NULL
        OR v_source.data->>'companyId' IS DISTINCT FROM v_voucher.data->>'companyId'
        OR v_source.data->>'journalVoucherId' IS DISTINCT FROM v_voucher.id
        OR v_voucher.data->>'sourceType' IS DISTINCT FROM v_type
        OR v_voucher.data->>'sourceId' IS DISTINCT FROM v_source.id
        OR v_source.data->>'date' IS DISTINCT FROM v_voucher.data->>'date') THEN
      RAISE EXCEPTION 'FINORA_DRAFT_DELETE_LINK_SCOPE_MISMATCH' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.records fy
      WHERE fy.organization_id=v_voucher.organization_id AND fy.collection='fiscalYears'
        AND fy.id=v_voucher.data->>'fiscalYearId'
        AND fy.data->>'companyId'=v_voucher.data->>'companyId'
        AND coalesce(fy.data->>'status','open')<>'locked'
        AND v_voucher.data->>'date' BETWEEN fy.data->>'startDate' AND fy.data->>'endDate') THEN
      RAISE EXCEPTION 'FINORA_FISCAL_YEAR_LOCKED_OR_INVALID' USING ERRCODE='23514';
    END IF;
    SELECT * INTO v_registry FROM public.finora_journal_document_registry
     WHERE organization_id=v_voucher.organization_id AND voucher_id=v_voucher.id FOR UPDATE;
    IF NOT FOUND OR v_registry.state IS DISTINCT FROM 'draft'
       OR v_registry.company_id IS DISTINCT FROM v_voucher.data->>'companyId'
       OR v_registry.fiscal_year_id IS DISTINCT FROM v_voucher.data->>'fiscalYearId'
       OR v_registry.atf_number::text IS DISTINCT FROM v_voucher.data->>'atfNumber'
       OR v_registry.temporary_number::text IS DISTINCT FROM v_voucher.data->>'temporaryNumber' THEN
      RAISE EXCEPTION 'FINORA_DRAFT_DELETE_IDENTITY_MISMATCH' USING ERRCODE='23514';
    END IF;
  END IF;

  -- Both existing rows are still visible to all earlier guards. The nested
  -- delete validates the same pair but does not repeat the cascade.
  IF OLD.collection='journalVouchers' THEN
    IF v_source.id IS NOT NULL AND pg_trigger_depth()=1 THEN
      DELETE FROM public.records
       WHERE organization_id=v_source.organization_id AND owner_id=v_source.owner_id
         AND collection=v_source.collection AND id=v_source.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_DRAFT_DELETE_SOURCE_NOT_REMOVED' USING ERRCODE='23514'; END IF;
    END IF;
    -- Children are removed before the draft voucher disappears; their
    -- existing financial immutability/scope guards still run.
    DELETE FROM public.records
      WHERE organization_id=v_voucher.organization_id AND collection='journalLineDimensions'
        AND data->>'voucherId'=v_voucher.id;
    DELETE FROM public.records
      WHERE organization_id=v_voucher.organization_id AND collection='journalLines'
        AND data->>'voucherId'=v_voucher.id;
    PERFORM public.finora_journal_delete_identity(
      v_voucher.organization_id,v_voucher.id,'حذف سند موقت توسط کاربر',auth.uid());
  ELSIF v_voucher.id IS NOT NULL AND pg_trigger_depth()=1 THEN
    DELETE FROM public.records
      WHERE organization_id=v_voucher.organization_id AND owner_id=v_voucher.owner_id
        AND collection='journalVouchers' AND id=v_voucher.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_DRAFT_DELETE_VOUCHER_NOT_REMOVED' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN OLD;
END $delete$;

REVOKE ALL ON FUNCTION private.finora_wp4_guarded_draft_delete() FROM PUBLIC,anon,authenticated;
DROP TRIGGER finora_journal_document_lifecycle_trg ON public.records;
CREATE TRIGGER finora_journal_document_lifecycle_trg
BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.finora_journal_document_lifecycle_trigger();
CREATE TRIGGER zz_finora_wp4_guarded_draft_delete_trg
BEFORE DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION private.finora_wp4_guarded_draft_delete();

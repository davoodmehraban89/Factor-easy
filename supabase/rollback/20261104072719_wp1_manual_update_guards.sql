-- Conservative DOWN restores the exact prior update function and removes only
-- the new manual-header guards. All financial rows/audit/counters remain intact.
DROP TRIGGER IF EXISTS trg_finora_wp1_manual_header_insert ON public.records;
DROP TRIGGER IF EXISTS trg_finora_wp1_manual_header_update ON public.records;
DROP FUNCTION IF EXISTS private.finora_wp1_guard_manual_header();
CREATE OR REPLACE FUNCTION public.finora_journal_update_draft(
 p_organization_id uuid,p_voucher_id text,p_expected_version bigint,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v public.records%rowtype;v_actor uuid:=auth.uid();v_fp text;
BEGIN
 PERFORM private.finora_phase1a_authorize(p_organization_id,'edit',NULL);
 IF jsonb_typeof(p_header)<>'object' OR p_header ?| ARRAY[
 'status','number','postedAt','postedBy','reversedAt','reversalVoucherId','sourceType','sourceId','sourceVersion']
 THEN RAISE EXCEPTION 'FINORA_INVALID_DRAFT_UPDATE' USING ERRCODE='23514';END IF;
 SELECT * INTO v FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalVouchers' AND id=p_voucher_id FOR UPDATE;
 IF NOT FOUND OR v.data->>'status'<>'draft' OR coalesce(v.data->>'sourceType','manual')<>'manual'
 THEN RAISE EXCEPTION 'FINORA_MANUAL_DRAFT_REQUIRED' USING ERRCODE='23514';END IF;
 IF v.version<>p_expected_version THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 IF p_header ? 'companyId' AND p_header->>'companyId'<>v.data->>'companyId'
 OR p_header ? 'fiscalYearId' AND p_header->>'fiscalYearId'<>v.data->>'fiscalYearId'
 THEN RAISE EXCEPTION 'FINORA_DRAFT_SCOPE_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.records fy WHERE fy.organization_id=p_organization_id
  AND fy.collection='fiscalYears' AND fy.id=v.data->>'fiscalYearId'
  AND coalesce(fy.data->>'status','open')<>'locked') THEN
   RAISE EXCEPTION 'FINORA_FISCAL_YEAR_LOCKED' USING ERRCODE='23514';END IF;
 DELETE FROM public.records WHERE organization_id=p_organization_id
 AND collection='journalLineDimensions' AND data->>'voucherId'=p_voucher_id;
 DELETE FROM public.records WHERE organization_id=p_organization_id
 AND collection='journalLines' AND data->>'voucherId'=p_voucher_id;
 PERFORM private.finora_phase1a_write_lines(p_organization_id,v_actor,p_voucher_id,v.data->>'companyId',p_lines);
 PERFORM private.finora_phase1a_validate_saved(p_organization_id,p_voucher_id,v.data->>'companyId');
 v_fp:=md5(jsonb_build_object('header',p_header,'lines',p_lines)::text);
 UPDATE public.records SET data=(v.data||jsonb_build_object(
  'date',coalesce(p_header->>'date',v.data->>'date'),
  'description',coalesce(p_header->>'description',v.data->>'description'),
  'reference',coalesce(p_header->>'reference',v.data->>'reference'),
  'voucherType',coalesce(p_header->>'voucherType',v.data->>'voucherType'),
  'requestFingerprint',v_fp,'editedBy',v_actor,'editedAt',clock_timestamp()))
 WHERE organization_id=p_organization_id AND collection='journalVouchers' AND id=p_voucher_id
 RETURNING * INTO v;
 PERFORM private.finora_phase1a_audit_event(p_organization_id,p_voucher_id,v_actor,'draft_updated','',jsonb_build_object('version',v.version));
 RETURN jsonb_build_object('voucher',v.data||jsonb_build_object('id',v.id,'version',v.version));
END $fn$;

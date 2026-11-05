-- Additive WP1 manual update/posting validation; CLI-generated; G1 HOLD.
CREATE OR REPLACE FUNCTION public.finora_journal_update_draft(
 p_organization_id uuid,p_voucher_id text,p_expected_version bigint,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v public.records%rowtype;v_actor uuid:=auth.uid();v_fp text;
BEGIN
 PERFORM private.finora_phase1a_authorize(p_organization_id,'edit',NULL);
 IF jsonb_typeof(p_header) IS DISTINCT FROM 'object' OR p_header ?| ARRAY[
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
 -- Validate the resulting header before replacing any child rows. Explicit
 -- RPC operations keep the same strict fiscal contract in audit/off as creation.
 PERFORM private.finora_wp1_validate_scope(p_organization_id,v.data->>'companyId',v.data->>'fiscalYearId',
   CASE WHEN p_header ? 'date' THEN p_header->>'date' ELSE v.data->>'date' END);
 IF private.finora_phase1a_mode(p_organization_id)='enforce'
 AND coalesce(p_header->>'voucherType',v.data->>'voucherType','manual') NOT IN ('manual','adjustment') THEN
  RAISE EXCEPTION 'FINORA_OPENING_CLOSING_NOT_APPROVED' USING ERRCODE='23514';
 END IF;
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

-- A guarded RPC alone is insufficient: direct UPDATE and sync-v2 must not turn
-- a manual draft into opening/closing or a fictitious source before posting.
CREATE OR REPLACE FUNCTION private.finora_wp1_guard_manual_header()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
DECLARE enforce_mode boolean; old_manual boolean:=false; new_manual boolean;
BEGIN
 enforce_mode:=private.finora_phase1a_mode(new.organization_id)='enforce';
 new_manual:=new.collection='journalVouchers' AND coalesce(new.data->>'sourceType','manual') IN ('manual','');
 IF TG_OP='UPDATE' AND old.collection='journalVouchers' THEN
  old_manual:=coalesce(old.data->>'sourceType','manual') IN ('manual','');
  enforce_mode:=enforce_mode OR private.finora_phase1a_mode(old.organization_id)='enforce';
 END IF;
 IF NOT enforce_mode OR NOT (old_manual OR new_manual) THEN RETURN new; END IF;
 IF old_manual AND (NOT new_manual OR coalesce(new.data->>'sourceId','')<>'') THEN
  RAISE EXCEPTION 'FINORA_MANUAL_DRAFT_SOURCE_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 IF new_manual THEN
  IF coalesce(new.data->>'sourceId','')<>'' THEN
   RAISE EXCEPTION 'FINORA_MANUAL_DRAFT_SOURCE_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF coalesce(new.data->>'voucherType','manual') NOT IN ('manual','adjustment') THEN
   RAISE EXCEPTION 'FINORA_OPENING_CLOSING_NOT_APPROVED' USING ERRCODE='23514';
  END IF;
  PERFORM private.finora_wp1_validate_scope(new.organization_id,new.data->>'companyId',new.data->>'fiscalYearId',new.data->>'date');
 END IF;
 RETURN new;
END $guard$;
REVOKE ALL ON FUNCTION private.finora_wp1_guard_manual_header() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_finora_wp1_manual_header_insert BEFORE INSERT ON public.records
FOR EACH ROW WHEN (NEW.collection='journalVouchers') EXECUTE FUNCTION private.finora_wp1_guard_manual_header();
CREATE TRIGGER trg_finora_wp1_manual_header_update BEFORE UPDATE ON public.records
FOR EACH ROW WHEN (OLD.collection='journalVouchers' OR NEW.collection='journalVouchers') EXECUTE FUNCTION private.finora_wp1_guard_manual_header();

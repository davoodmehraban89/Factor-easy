-- Stage 2.2: organization-owned, audited server guard flag. CI-local only.
-- No change to Production mode and no automatic ENFORCE.
CREATE OR REPLACE FUNCTION public.finora_journal_get_guard_mode(p_organization_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.organization_members
 WHERE organization_id=p_organization_id AND user_id=auth.uid() AND status='active')
 THEN RAISE EXCEPTION 'FINORA_ORG_FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN private.finora_phase1a_mode(p_organization_id);
END $f$;
CREATE OR REPLACE FUNCTION public.finora_journal_set_guard_mode(
 p_organization_id uuid,p_expected_mode text,p_mode text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE before_mode text;v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.organization_members
 WHERE organization_id=p_organization_id AND user_id=v_actor
 AND is_owner=true AND status='active')
 THEN RAISE EXCEPTION 'FINORA_GUARD_MODE_OWNER_ONLY' USING ERRCODE='42501';END IF;
 IF p_expected_mode NOT IN ('off','audit','enforce')
 OR p_mode NOT IN ('off','audit','enforce')
 OR length(trim(coalesce(p_reason,'')))<8 THEN
  RAISE EXCEPTION 'FINORA_GUARD_MODE_INVALID' USING ERRCODE='23514';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('finora-guard-mode:'||p_organization_id::text,20261017));
 SELECT private.finora_phase1a_mode(p_organization_id) INTO before_mode;
 IF before_mode IS DISTINCT FROM p_expected_mode THEN
  RAISE EXCEPTION 'FINORA_GUARD_MODE_CONFLICT' USING ERRCODE='40001'; END IF;
 IF before_mode=p_mode THEN RETURN jsonb_build_object('mode',before_mode,'changed',false);END IF;
 INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode,updated_at)
 VALUES(p_organization_id,p_mode,clock_timestamp())
 ON CONFLICT(organization_id) DO UPDATE SET mode=excluded.mode,updated_at=excluded.updated_at;
 PERFORM private.finora_phase1a_audit_event(
 p_organization_id,NULL,v_actor,'guard_mode_changed',p_reason,
 jsonb_build_object('before',before_mode,'after',p_mode));
 RETURN jsonb_build_object('mode',p_mode,'previous',before_mode,'changed',true);
END $f$;
REVOKE ALL ON FUNCTION public.finora_journal_get_guard_mode(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finora_journal_set_guard_mode(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finora_journal_get_guard_mode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_set_guard_mode(uuid,text,text,text) TO authenticated;

-- Stage 2.2 manual workflows must refuse opening/closing voucher creation
-- in enforce mode. Source/commercial autopost remains separate and untouched.
CREATE OR REPLACE FUNCTION public.finora_journal_create_draft(
 p_organization_id uuid,p_voucher_id text,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 PERFORM private.finora_phase1a_authorize(p_organization_id,'create',NULL);
 IF coalesce(p_header->>'sourceType','manual')<>'manual'
 OR coalesce(p_header->>'sourceId','')<>'' THEN
  RAISE EXCEPTION 'FINORA_MANUAL_DRAFT_ONLY' USING ERRCODE='42501'; END IF;
 IF private.finora_phase1a_mode(p_organization_id)='enforce'
 AND coalesce(p_header->>'voucherType','manual') NOT IN ('manual','adjustment')
 THEN RAISE EXCEPTION 'FINORA_OPENING_CLOSING_NOT_APPROVED'
  USING ERRCODE='42501';END IF;
 RETURN private.finora_phase1a_create_core(p_organization_id,p_voucher_id,p_header,p_lines);
END $f$;

-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

CREATE OR REPLACE FUNCTION public.finora_journal_create_draft(p_organization_id uuid, p_voucher_id text, p_header jsonb, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM private.finora_phase1a_authorize(p_organization_id,'create',NULL);
 IF coalesce(p_header->>'sourceType','manual')<>'manual' OR coalesce(p_header->>'sourceId','')<>'' THEN
  RAISE EXCEPTION 'FINORA_MANUAL_DRAFT_ONLY' USING ERRCODE='42501';
 END IF;
 RETURN private.finora_phase1a_create_core(p_organization_id,p_voucher_id,p_header,p_lines);
END $function$
;

REVOKE ALL ON FUNCTION public.finora_journal_create_draft(p_organization_id uuid, p_voucher_id text, p_header jsonb, p_lines jsonb) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.finora_journal_create_draft(p_organization_id uuid, p_voucher_id text, p_header jsonb, p_lines jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.finora_journal_get_guard_mode(p_organization_id uuid) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.finora_journal_set_guard_mode(p_organization_id uuid, p_expected_mode text, p_mode text, p_reason text) FROM PUBLIC,anon,authenticated,service_role;

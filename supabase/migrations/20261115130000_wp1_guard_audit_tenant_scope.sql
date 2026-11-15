-- WP1 security correction: guard audit logging must stay within the caller tenant.
-- Additive and disposable-proof only; does not change guard mode or enable enforcement.
CREATE OR REPLACE FUNCTION private.finora_phase1a_log_guard(
 p_org uuid,p_voucher text,p_message text,p_state text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR p_org IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.organization_members
   WHERE organization_id=p_org AND user_id=v_actor AND status='active') THEN
  RAISE EXCEPTION 'FINORA_GUARD_AUDIT_SCOPE_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 IF coalesce(length(p_message),0)>2000 OR coalesce(p_state,'') !~ '^[0-9A-Z]{5}$' THEN
  RAISE EXCEPTION 'FINORA_GUARD_AUDIT_INPUT_INVALID' USING ERRCODE='22023';
 END IF;
 PERFORM private.finora_phase1a_audit_event(
  p_org,p_voucher,v_actor,'guard_violation',coalesce(p_message,''),
  jsonb_build_object('sqlstate',p_state));
END $fn$;
-- EXECUTE remains available to authenticated because SECURITY INVOKER trigger
-- functions call this SECURITY DEFINER writer. Tenant membership is now checked
-- inside the writer; anon/public access remains revoked by the prior migration.

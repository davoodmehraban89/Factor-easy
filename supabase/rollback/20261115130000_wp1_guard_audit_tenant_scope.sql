-- Conservative DOWN: restore the previous WP1/Phase 1A logger body.
-- This does not remove audit history or other WP1 objects.
CREATE OR REPLACE FUNCTION private.finora_phase1a_log_guard(p_org uuid,p_voucher text,p_message text,p_state text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $a$
BEGIN
 PERFORM private.finora_phase1a_audit_event(p_org,p_voucher,auth.uid(),'guard_violation',p_message,jsonb_build_object('sqlstate',p_state));
END $a$;

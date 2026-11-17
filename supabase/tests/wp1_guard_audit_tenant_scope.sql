-- Cross-tenant guard-audit injection must fail; own-tenant audit stays usable.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
 ('fa000000-0000-4000-8000-000000000001','wp1-audit-a@example.invalid',now(),'{}'),
 ('fa000000-0000-4000-8000-000000000002','wp1-audit-b@example.invalid',now(),'{}');
SELECT set_config('wp1.audit_org_a',(SELECT id::text FROM public.organizations WHERE owner_user_id='fa000000-0000-4000-8000-000000000001'),true);
SELECT set_config('wp1.audit_org_b',(SELECT id::text FROM public.organizations WHERE owner_user_id='fa000000-0000-4000-8000-000000000002'),true);
SELECT set_config('request.jwt.claim.sub','fa000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
 BEGIN
  PERFORM private.finora_phase1a_log_guard(current_setting('wp1.audit_org_b')::uuid,
   'WP1_CROSS_ORG_SPOOF','forged cross-tenant audit event','23514');
  RAISE EXCEPTION 'WP1_CROSS_TENANT_AUDIT_INJECTION_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM<>'FINORA_GUARD_AUDIT_SCOPE_FORBIDDEN' THEN RAISE; END IF;
 END;
 PERFORM private.finora_phase1a_log_guard(current_setting('wp1.audit_org_a')::uuid,
  'WP1_OWN_ORG_AUDIT','synthetic same-tenant audit event','23514');
END $test$;
RESET ROLE;
DO $verify$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.finora_phase1a_journal_audit
  WHERE organization_id=current_setting('wp1.audit_org_a')::uuid
   AND voucher_id='WP1_OWN_ORG_AUDIT' AND actor_id='fa000000-0000-4000-8000-000000000001'
   AND action='guard_violation' AND reason='synthetic same-tenant audit event') THEN
  RAISE EXCEPTION 'WP1_OWN_TENANT_AUDIT_NOT_WRITTEN';
 END IF;
 IF EXISTS(SELECT 1 FROM private.finora_phase1a_journal_audit
  WHERE organization_id=current_setting('wp1.audit_org_b')::uuid
   AND voucher_id='WP1_CROSS_ORG_SPOOF') THEN
  RAISE EXCEPTION 'WP1_CROSS_TENANT_AUDIT_ROW_WRITTEN';
 END IF;
 RAISE NOTICE 'WP1_GUARD_AUDIT_SCOPE_PASS: cross-tenant spoof denied, own-tenant trigger logging retained';
END $verify$;
ROLLBACK;

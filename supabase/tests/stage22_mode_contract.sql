\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data) VALUES
('eeee5555-5555-4555-8555-555555555555','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stage22-owner@example.invalid',now(),'{}'::jsonb),
('ffff6666-6666-4666-8666-666666666666','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stage22-member@example.invalid',now(),'{}'::jsonb);
SELECT set_config('stage22.org',(SELECT organization_id::text FROM public.organization_members WHERE user_id='eeee5555-5555-4555-8555-555555555555' LIMIT 1),true);
UPDATE public.licenses SET max_users=greatest(max_users,3) WHERE organization_id=current_setting('stage22.org')::uuid;
INSERT INTO public.organization_members(organization_id,user_id,status,is_owner)
 VALUES(current_setting('stage22.org')::uuid,'ffff6666-6666-4666-8666-666666666666','active',false);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ffff6666-6666-4666-8666-666666666666',true);
DO $t$
DECLARE org uuid:=current_setting('stage22.org')::uuid;mode text;
BEGIN
 mode:=public.finora_journal_get_guard_mode(org);
 IF mode<>'off' THEN RAISE EXCEPTION 'STAGE22_NOT_OFF';END IF;
 BEGIN
  PERFORM public.finora_journal_set_guard_mode(org,'off','audit','Unauthorized member');
  RAISE EXCEPTION 'STAGE22_UNAUTHORIZED_FLAG_CHANGE';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM NOT LIKE '%FINORA_GUARD_MODE_OWNER_ONLY%' THEN RAISE;END IF;
 END;
END $t$;
SELECT set_config('request.jwt.claim.sub','eeee5555-5555-4555-8555-555555555555',true);
DO $t$
DECLARE org uuid:=current_setting('stage22.org')::uuid;v jsonb;
BEGIN
 v:=public.finora_journal_set_guard_mode(org,'off','audit','Owner Stage 2.2 audit review');
 IF v->>'mode'<>'audit' OR public.finora_journal_get_guard_mode(org)<>'audit' THEN
  RAISE EXCEPTION 'STAGE22_OWNER_MODE_NOT_AUDIT';END IF;
 v:=public.finora_journal_set_guard_mode(org,'audit','enforce','Owner explicitly tests local enforce');
 IF v->>'mode'<>'enforce' THEN RAISE EXCEPTION 'STAGE22_OWNER_MODE_NOT_ENFORCE';END IF;
 BEGIN
  PERFORM public.finora_journal_set_guard_mode(org,'off','audit','Owner stale version conflict');
  RAISE EXCEPTION 'STAGE22_STALE_MODE_CHANGE_ACCEPTED';
 EXCEPTION WHEN serialization_failure THEN
  IF SQLERRM NOT LIKE '%FINORA_GUARD_MODE_CONFLICT%' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.finora_journal_create_draft(org,'OPENING_STAGE22_TEST',
   '{"companyId":"X","fiscalYearId":"Y","date":"1405/07/26","voucherType":"opening"}',
   '[]'::jsonb);
  RAISE EXCEPTION 'STAGE22_OPENING_WAS_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM NOT LIKE '%FINORA_OPENING_CLOSING_NOT_APPROVED%' THEN RAISE;END IF;
 END;
END $t$;
RESET ROLE;
DO $t$
DECLARE org uuid:=current_setting('stage22.org')::uuid;
BEGIN
 IF (SELECT count(*) FROM private.finora_phase1a_journal_audit
  WHERE organization_id=org AND action='guard_mode_changed'
  AND actor_id='eeee5555-5555-4555-8555-555555555555'
  AND details->>'before' IN ('off','audit') AND details->>'after' IN ('audit','enforce'))<>2
 THEN RAISE EXCEPTION 'STAGE22_GUARD_MODE_AUDIT_MISSING';END IF;
 RAISE NOTICE 'STAGE22_GUARD_OWNER_NONOWNER_CAS_AUDIT_AND_OPENING_BLOCK_PASS';
END $t$;
ROLLBACK;

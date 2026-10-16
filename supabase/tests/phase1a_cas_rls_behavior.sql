-- Phase 1A: versioned CAS behavior using actual Supabase CLI auth roles/RLS.
-- Synthetic identity, no persistent test data. Execute with psql -v ON_ERROR_STOP=1.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES
('44444444-4444-4444-8444-444444444444','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-cas-a@example.invalid',now(),'{}'::jsonb),
('55555555-5555-4555-8555-555555555555','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-cas-b@example.invalid',now(),'{}'::jsonb);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
DO $test$
DECLARE
  org_a uuid;
  org_b uuid;
  v jsonb;
  current_version bigint;
  current_data jsonb;
  conflict_detected boolean:=false;
  forbidden_detected boolean:=false;
BEGIN
 SELECT organization_id INTO org_a FROM public.organization_members
 WHERE user_id='44444444-4444-4444-8444-444444444444' LIMIT 1;
 SELECT organization_id INTO org_b FROM public.organization_members
 WHERE user_id='55555555-5555-4555-8555-555555555555' LIMIT 1;
 IF org_a IS NULL OR org_b IS NULL OR org_a=org_b THEN
   RAISE EXCEPTION 'FINORA_TEST_ACTOR_BOOTSTRAP_FAILED';
 END IF;
 v:=public.finora_sync_records_v2(
   '[{"collection":"settings","id":"main","data":{"phase1a":"first"},"expected_version":0}]'::jsonb,
   '[]'::jsonb,org_a);
 IF (v #>> '{upserts,0,version}')::bigint<>1 THEN
   RAISE EXCEPTION 'FINORA_V2_CREATE_VERSION_MISMATCH: %',v;
 END IF;
 v:=public.finora_sync_records_v2(
   '[{"collection":"settings","id":"main","data":{"phase1a":"second"},"expected_version":1}]'::jsonb,
   '[]'::jsonb,org_a);
 IF (v #>> '{upserts,0,version}')::bigint<>2 THEN
   RAISE EXCEPTION 'FINORA_V2_UPDATE_VERSION_MISMATCH: %',v;
 END IF;
 BEGIN
   PERFORM public.finora_sync_records_v2(
   '[{"collection":"settings","id":"main","data":{"phase1a":"stale"},"expected_version":1}]'::jsonb,
   '[]'::jsonb,org_a);
 EXCEPTION WHEN serialization_failure THEN
   conflict_detected:=true;
 END;
 IF NOT conflict_detected THEN
   RAISE EXCEPTION 'FINORA_CAS_ALLOWED_STALE_WRITE';
 END IF;
 SELECT version,data INTO current_version,current_data FROM public.records
 WHERE organization_id=org_a AND collection='settings' AND id='main';
 IF current_version<>2 OR current_data->>'phase1a'<>'second' THEN
   RAISE EXCEPTION 'FINORA_CAS_CORRUPTED_WINNER';
 END IF;
 BEGIN
   PERFORM public.finora_sync_records_v2(
   '[{"collection":"settings","id":"foreign","data":{"phase1a":"cross"},"expected_version":0}]'::jsonb,
   '[]'::jsonb,org_b);
 EXCEPTION WHEN insufficient_privilege THEN
   forbidden_detected:=true;
 END;
 IF NOT forbidden_detected THEN
   RAISE EXCEPTION 'FINORA_CROSS_TENANT_CAS_LEAK';
 END IF;
 RAISE NOTICE 'FINORA_1A_CAS_PASS create=1 update=2 stale_rejected=true winner_preserved=true cross_tenant_denied=true';
END
$test$;
ROLLBACK;

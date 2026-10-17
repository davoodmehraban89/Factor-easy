-- Phase 1A SECURITY DEFINER/search_path/execute-grants invariants.
-- Read-only catalog checks inside disposable Supabase CLI.
\set ON_ERROR_STOP on
DO $test$
DECLARE invalid integer; n integer; anon_exposed integer; writes text[];
BEGIN
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname LIKE 'finora_phase1a_%';
 IF n<5 THEN RAISE EXCEPTION 'FINORA_SECURITY_EXPECTED_FUNCTIONS_MISSING';END IF;
 SELECT count(*) INTO invalid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('private','public') AND p.proname LIKE 'finora_phase1a_%'
 AND p.prosecdef AND NOT EXISTS(
 SELECT 1 FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) s WHERE s IN ('search_path=','search_path=""')
 );
 IF invalid>0 THEN RAISE EXCEPTION 'FINORA_SECURITY_DEFINER_UNSAFE_SEARCH_PATH (%)',invalid;END IF;
 SELECT count(*) INTO anon_exposed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('private','public') AND p.proname LIKE 'finora_phase1a_%'
 AND has_function_privilege('anon',p.oid,'EXECUTE');
 IF anon_exposed>0 THEN RAISE EXCEPTION 'FINORA_ANON_EXECUTE_EXPOSED (%)',anon_exposed;END IF;
 IF has_function_privilege('anon','public.finora_sync_records_v2(jsonb,jsonb,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'FINORA_ANON_CAN_CALL_SYNC_V2';
 END IF;
 IF NOT has_function_privilege('authenticated','public.finora_sync_records_v2(jsonb,jsonb,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'FINORA_AUTH_SYNC_V2_NOT_GRANTED';
 END IF;
 RAISE NOTICE 'FINORA_1A_SECURITY_PASS private 1A routines=% unsafe search_path=% anon execute=%',n,invalid,anon_exposed;
END $test$;

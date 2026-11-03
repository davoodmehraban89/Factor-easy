-- Read-only SECURITY DEFINER audit in disposable Supabase CLI.
-- Fail for ANY public/private SECURITY DEFINER routine with an unsafe path
-- OR executable by PUBLIC/anon. This scans historic functions too.
\set ON_ERROR_STOP on
DO $check$
DECLARE x record;n integer:=0;
BEGIN
 FOR x IN
 SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS routine,
  NOT EXISTS(SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) cfg
     WHERE cfg IN ('search_path=','search_path=""')) AS bad_path,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
  EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_exec
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private') AND p.prosecdef
 LOOP
  IF x.bad_path OR x.anon_exec OR x.public_exec THEN
   RAISE WARNING 'FINORA_SECURITY_DEFECT routine=% bad_path=% anon_exec=% public_exec=%',
     x.routine,x.bad_path,x.anon_exec,x.public_exec;
   n:=n+1;
  END IF;
 END LOOP;
 IF n>0 THEN RAISE EXCEPTION 'FINORA_SECURITY_DEFINER_AUDIT_FAILED violations=%',n;END IF;
 RAISE NOTICE 'FINORA_SECURITY_DEFINER_AUDIT_PASS zero unsafe defs and anon/public grants';
END $check$;

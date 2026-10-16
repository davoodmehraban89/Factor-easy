SELECT COALESCE(jsonb_agg(jsonb_build_object(
 'key',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
 'exact',md5(p.prosrc),
 'compact',md5(regexp_replace(p.prosrc,'[[:space:]]+','','g')),
 'config',COALESCE(to_jsonb(p.proconfig),'null'::jsonb),
 'secdef',p.prosecdef, 'volatile',p.provolatile,
 'arguments',pg_get_function_arguments(p.oid),
 'return',pg_get_function_result(p.oid)
 ) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)::text AS fingerprints
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private');

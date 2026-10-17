SELECT COALESCE(jsonb_agg(jsonb_build_object(
'key',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
'source',p.prosrc
) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)::text AS functions
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private');

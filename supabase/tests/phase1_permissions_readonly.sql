-- Finora Phase 1 production-catalog access audit (READ-ONLY).
-- SELECT metadata only. No customer rows, JWTs, passwords, mutation or auth bypass.
-- Run with the authorized Supabase read-only SQL interface; do NOT run service changes.
WITH
pub AS (
  SELECT c.oid,c.relrowsecurity
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
),
prv AS (
  SELECT c.oid,c.relrowsecurity
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='private' AND c.relkind IN ('r','p')
),
def AS (
  SELECT p.oid,n.nspname AS schema_name,coalesce(array_to_string(p.proconfig,','),'') AS config
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prosecdef AND n.nspname IN ('public','private')
),
checks AS (
  SELECT 10 AS sort_order,'PUBLIC_ALL_RLS' AS check_id,
    CASE WHEN COUNT(*)>0 AND COUNT(*)=COUNT(*) FILTER (WHERE relrowsecurity)
      THEN 'PASS' ELSE 'FAIL' END AS status,
    (COUNT(*) FILTER (WHERE relrowsecurity))::text||'/'||COUNT(*)::text AS observed,
    'Every public table has RLS enabled' AS requirement
  FROM pub
  UNION ALL
  SELECT 20,'PRIVATE_NO_CLIENT_DIRECT_READ',
    CASE WHEN COUNT(*)>0 AND COUNT(*) FILTER (WHERE
      pg_catalog.has_table_privilege('anon',oid,'SELECT')
      OR pg_catalog.has_table_privilege('authenticated',oid,'SELECT'))=0
      THEN 'PASS' ELSE 'FAIL' END,
    (COUNT(*) FILTER (WHERE
      pg_catalog.has_table_privilege('anon',oid,'SELECT')
      OR pg_catalog.has_table_privilege('authenticated',oid,'SELECT')))::text||' of '||COUNT(*)::text||' have direct client SELECT',
    'No anon/authenticated direct SELECT grant on private tables'
  FROM prv
  UNION ALL
  SELECT 30,'PUBLIC_DEFINER_NO_ANON_EXEC',
    CASE WHEN COUNT(*)>0 AND COUNT(*) FILTER
      (WHERE pg_catalog.has_function_privilege('anon',oid,'EXECUTE'))=0
      THEN 'PASS' ELSE 'FAIL' END,
    (COUNT(*) FILTER (WHERE pg_catalog.has_function_privilege('anon',oid,'EXECUTE')))::text||' of '||COUNT(*)::text||' callable by anon',
    'No exposed-schema SECURITY DEFINER functions callable by anon'
  FROM def WHERE schema_name='public'
  UNION ALL
  SELECT 40,'DEFINER_EXPLICIT_SEARCH_PATH',
    CASE WHEN COUNT(*)>0 AND COUNT(*)=COUNT(*) FILTER (WHERE config LIKE '%search_path=%')
      THEN 'PASS' ELSE 'FAIL' END,
    (COUNT(*) FILTER (WHERE config LIKE '%search_path=%'))::text||'/'||COUNT(*)::text AS observed,
    'All inspected SECURITY DEFINER routines pin search_path'
  FROM def
  UNION ALL
  SELECT 50,'PUBLIC_AUTHENTICATED_DEFINER_REVIEW',
    'REVIEW',
    (COUNT(*) FILTER (WHERE pg_catalog.has_function_privilege('authenticated',oid,'EXECUTE')))::text||
      ' publicly exposed SECURITY DEFINER functions callable by authenticated',
    'Require per-function authorization/source review; not automatically a flaw'
  FROM def WHERE schema_name='public'
  UNION ALL
  SELECT 60,'PRIVATE_RLS_COVERAGE_REVIEW',
    'REVIEW',
    (COUNT(*) FILTER (WHERE relrowsecurity))::text||'/'||COUNT(*)::text AS observed,
    'Private tables without RLS need separate schema/grant/RPC-path analysis'
  FROM prv
)
SELECT check_id,status,observed,requirement
FROM checks ORDER BY sort_order;

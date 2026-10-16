-- Read-only cross-environment catalog fingerprint for Finora Phase 1A.
-- Scopes application schemas public/private and the custom auth.users trigger.
-- Safe to execute on production using SELECT: NO row data, NO DDL/DML.
WITH objects AS (
SELECT 'relation'::text AS kind, n.nspname||'.'||c.relname AS object_key,
 md5(concat_ws('|',c.relkind::text,c.relpersistence::text,c.relrowsecurity::text,c.relforcerowsecurity::text)) AS fingerprint
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','v','m','S','f')
UNION ALL
SELECT 'column',n.nspname||'.'||c.relname||'.'||a.attname,
 md5(concat_ws('|',format_type(a.atttypid,a.atttypmod),a.attnotnull::text,a.attidentity::text,a.attgenerated::text,coalesce(pg_get_expr(d.adbin,d.adrelid),'∅')))
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped
UNION ALL
SELECT 'function',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
 md5(concat_ws('|',p.prosecdef::text,p.provolatile::text,coalesce(p.proconfig::text,'∅'),pg_get_functiondef(p.oid)))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,
 md5(concat_ws('|',t.tgenabled::text,pg_get_triggerdef(t.oid)))
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND (n.nspname IN ('public','private') OR (n.nspname='auth' AND c.relname='users'))
UNION ALL
SELECT 'policy',n.nspname||'.'||c.relname||'.'||p.polname,
 md5(concat_ws('|',p.polpermissive::text,p.polcmd::text,p.polroles::text,coalesce(pg_get_expr(p.polqual,p.polrelid),'∅'),coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'∅')))
FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'index',n.nspname||'.'||i.relname,md5(pg_get_indexdef(ix.indexrelid))
FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_class t ON t.oid=ix.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'constraint',n.nspname||'.'||c.relname||'.'||con.conname,md5(pg_get_constraintdef(con.oid,true))
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'relation_grants',n.nspname||'.'||c.relname,
 md5(COALESCE((SELECT string_agg(concat_ws(':',COALESCE(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable::text),',' ORDER BY COALESCE(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable::text)
 FROM aclexplode(COALESCE(c.relacl,acldefault((CASE WHEN c.relkind='S' THEN 'S' ELSE 'r' END)::"char",c.relowner))) a
 LEFT JOIN pg_roles r ON r.oid=a.grantee),''))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','v','m','S','f')
UNION ALL
SELECT 'function_grants',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
 md5(COALESCE((SELECT string_agg(concat_ws(':',COALESCE(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable::text),',' ORDER BY COALESCE(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable::text)
 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
 LEFT JOIN pg_roles r ON r.oid=a.grantee),''))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private')
)
SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',kind,'key',object_key,'hash',fingerprint) ORDER BY kind,object_key),'[]'::jsonb)::text AS catalog FROM objects;

-- Read-only, metadata-only diagnostic. Run against the exact configured project:
-- hcsixhqbyuhpshfwqpjx. Do not infer access denial from list_projects alone.
-- No customer rows, auth tokens, keys or server-side files are selected.
select jsonb_build_object(
  'checked_at', now(),
  'query_role', current_user,
  'transaction_read_only', current_setting('transaction_read_only'),
  'can_create_public', has_schema_privilege(current_user, 'public', 'CREATE'),
  'records_rls', (
    select c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'records'
  ),
  'records_role_privileges', (
    select jsonb_agg(jsonb_build_object(
      'role', role_name,
      'select', has_table_privilege(role_name, 'public.records', 'SELECT'),
      'insert', has_table_privilege(role_name, 'public.records', 'INSERT'),
      'update', has_table_privilege(role_name, 'public.records', 'UPDATE'),
      'delete', has_table_privilege(role_name, 'public.records', 'DELETE')
    ) order by role_name)
    from (values ('anon'), ('authenticated')) roles(role_name)
  ),
  'records_policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', policyname, 'roles', roles, 'command', cmd,
      'using', qual, 'check', with_check
    ) order by policyname), '[]'::jsonb)
    from pg_policies where schemaname = 'public' and tablename = 'records'
  ),
  'records_constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', conname, 'definition', pg_get_constraintdef(oid)
    ) order by conname), '[]'::jsonb)
    from pg_constraint where conrelid = 'public.records'::regclass
  ),
  'records_indexes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', indexname, 'definition', indexdef
    ) order by indexname), '[]'::jsonb)
    from pg_indexes where schemaname = 'public' and tablename = 'records'
  ),
  'records_triggers', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', tgname, 'definition', pg_get_triggerdef(oid)
    ) order by tgname), '[]'::jsonb)
    from pg_trigger where tgrelid = 'public.records'::regclass and not tgisinternal
  ),
  'public_functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef
    ) order by p.proname, p.oid), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  )
) as phase3_server_audit;

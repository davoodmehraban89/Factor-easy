begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claim.member_active','true',true);
select set_config('request.jwt.claim.entitled','true',true);
select set_config('request.jwt.claim.write','true',true);
select set_config('request.jwt.claim.readable','true',true);
select set_config('request.jwt.claim.capabilities','read,refer,edit,approve,configure',true);

do $$ begin
  if private.office_workflow_read_impl('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_RACE',-1,10)->'instance' is null then raise exception 'private read path failed legitimate request'; end if;
  perform set_config('request.jwt.claim.member_active','false',true);
  begin perform private.office_workflow_read_impl('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_RACE',-1,10); raise exception 'private read bypassed suspended membership'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.member_active','true',true);
  perform set_config('request.jwt.claim.write','false',true);
  begin perform private.office_workflow_attach_impl('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_RACE','race',1,'20000000-0000-4000-8000-000000000001'); raise exception 'private attach bypassed read-only entitlement'; exception when insufficient_privilege then null; end;
end $$;

do $$ begin
  if not exists(select 1 from pg_indexes where schemaname='private' and indexname='office_workflow_policy_versions_published_by_idx') then raise exception 'policy published_by FK index missing'; end if;
  if not exists(select 1 from pg_indexes where schemaname='private' and indexname='office_workflow_instances_attached_by_idx') then raise exception 'attached_by FK index missing'; end if;
  if not exists(select 1 from pg_indexes where schemaname='private' and indexname='office_workflow_events_actor_fk_idx') then raise exception 'actor_id FK index missing'; end if;
  if has_table_privilege('anon','private.office_workflow_instances','SELECT') or has_table_privilege('authenticated','private.office_workflow_instances','SELECT') then raise exception 'runtime instance table leaked to client roles'; end if;
  if has_table_privilege('anon','private.office_workflow_events','SELECT') or has_table_privilege('authenticated','private.office_workflow_events','SELECT') then raise exception 'runtime event table leaked to client roles'; end if;
end $$;
rollback;

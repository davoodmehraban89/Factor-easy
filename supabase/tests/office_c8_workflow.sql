-- Office Slice C8 policy validation/publication behavioral contract.
-- Run against the zero-cost disposable PostgreSQL CI harness after applying the C8 migration.
-- The test is transaction-safe and leaves no fixtures.

begin;

do $$
declare
  valid jsonb := '{"stages":[{"id":"start","label":"شروع","start":true,"terminal":false},{"id":"done","label":"پایان","start":false,"terminal":true}],"edges":[{"id":"approve","from":"start","to":"done","label":"تأیید","capability":"approve"}]}'::jsonb;
  bad jsonb;
begin
  perform private.office_workflow_validate_definition(valid);
  begin perform private.office_workflow_validate_definition(null); raise exception 'expected null rejection'; exception when sqlstate '22023' then null; end;
  bad := '{"stages":[{"id":"only","label":"تنها","start":true,"terminal":true}],"edges":[]}'::jsonb;
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected one-stage rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_build_object('stages',(select jsonb_agg(jsonb_build_object('id','s'||g,'label','مرحله','start',g=1,'terminal',g=21)) from generate_series(1,21) g),'edges','[]'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected 21-stage rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_build_object('stages',valid->'stages','edges',(select jsonb_agg(jsonb_build_object('id','e'||g,'from','start','to','done','label','عبور','capability','edit')) from generate_series(1,61) g));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected 61-edge rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{edges,0,capability}','"delete"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected capability rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{edges,0,to}','"missing"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unknown-target rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{edges,0,to}','"start"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected self-edge rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{stages,1,terminal}','false'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected no-terminal rejection'; exception when sqlstate '22023' then null; end;
  bad := valid || '{"unknown":true}'::jsonb;
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unknown-root-key rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{stages,0}',(valid->'stages'->0)||'{"unknown":true}'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unknown-stage-key rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{edges,0}',(valid->'edges'->0)||'{"unknown":true}'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unknown-edge-key rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{stages,0,start}','"true"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected non-boolean flag rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{stages,1,id}','"start"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected duplicate-stage-id rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{edges}',(valid->'edges')||jsonb_build_array((valid->'edges'->0)||'{"label":"دوباره"}'::jsonb));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected duplicate-edge-id rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{edges}',(valid->'edges')||jsonb_build_array((valid->'edges'->0)||'{"id":"again"}'::jsonb));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected duplicate-edge-pair rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{edges}',jsonb_build_array((valid->'edges'->0),jsonb_build_object('id','back','from','done','to','start','label','بازگشت','capability','edit')));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected terminal-outgoing rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_set(valid,'{stages,1}',jsonb_build_object('id','orphan','label','یتیم','start',false,'terminal',true));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unreachable-stage rejection'; exception when sqlstate '22023' then null; end;
  bad := '{"stages":[{"id":"start","label":"شروع","start":true,"terminal":false},{"id":"done","label":"پایان","start":false,"terminal":true},{"id":"loop1","label":"حلقه ۱","start":false,"terminal":false},{"id":"loop2","label":"حلقه ۲","start":false,"terminal":false}],"edges":[{"id":"finish","from":"start","to":"done","label":"پایان","capability":"approve"},{"id":"branch","from":"start","to":"loop1","label":"شاخه","capability":"edit"},{"id":"l12","from":"loop1","to":"loop2","label":"بعدی","capability":"edit"},{"id":"l21","from":"loop2","to":"loop1","label":"برگشت","capability":"edit"}]}'::jsonb;
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected no-exit-cycle rejection'; exception when sqlstate '22023' then null; end;
  bad := jsonb_build_object('stages',valid->'stages','edges',valid->'edges','padding',repeat('x',70000));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected size rejection'; exception when sqlstate '22023' then null; end;
end $$;

do $$
declare
  v_user constant uuid := '11111111-1111-4111-8111-111111111111';
  v_org constant uuid := '22222222-2222-4222-8222-222222222222';
  valid constant jsonb := '{"stages":[{"id":"start","label":"شروع","start":true,"terminal":false},{"id":"done","label":"پایان","start":false,"terminal":true}],"edges":[{"id":"approve","from":"start","to":"done","label":"تأیید","capability":"approve"}]}'::jsonb;
  v_version integer;
  v_catalog jsonb;
  v_rls boolean;
begin
  insert into public.profiles(id) values(v_user);
  insert into public.organizations(id,owner_user_id) values(v_org,v_user);
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.org',v_org::text,true);
  perform set_config('request.jwt.claim.write','true',true);
  perform set_config('request.jwt.claim.capabilities','configure,read',true);

  v_version := public.office_workflow_publish(v_org,'approval_flow','گردش تأیید',valid);
  if v_version <> 1 then raise exception 'expected first policy version 1'; end if;
  v_version := public.office_workflow_publish(v_org,'approval_flow','گردش تأیید نسخه دوم',valid);
  if v_version <> 2 then raise exception 'expected second policy version 2'; end if;

  perform set_config('request.jwt.claim.capabilities','read',true);
  v_catalog := public.office_workflow_catalog(v_org);
  if jsonb_array_length(v_catalog) <> 1 or v_catalog->0->>'version' <> '2' or v_catalog->0->>'title' <> 'گردش تأیید نسخه دوم' then
    raise exception 'catalog must return latest policy version only';
  end if;

  perform set_config('request.jwt.claim.write','false',true);
  v_catalog := public.office_workflow_catalog(v_org);
  if jsonb_array_length(v_catalog) <> 1 then raise exception 'expired/read-only catalog access must remain available'; end if;
  perform set_config('request.jwt.claim.capabilities','configure,read',true);
  begin perform public.office_workflow_publish(v_org,'blocked','نباید منتشر شود',valid); raise exception 'expected read-only publication denial';
  exception when sqlstate '42501' then null; end;

  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.office_workflow_publish(v_org,'anon','ناشناس',valid); raise exception 'expected anonymous denial';
  exception when sqlstate '42501' then null; end;

  begin update private.office_workflow_policy_versions set title='mutated' where organization_id=v_org and policy_key='approval_flow' and version=1; raise exception 'expected immutable update rejection';
  exception when sqlstate '55000' then null; end;
  begin delete from private.office_workflow_policy_versions where organization_id=v_org and policy_key='approval_flow' and version=1; raise exception 'expected immutable delete rejection';
  exception when sqlstate '55000' then null; end;

  select c.relrowsecurity into v_rls from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='office_workflow_policy_versions';
  if not coalesce(v_rls,false) then raise exception 'policy table RLS must be enabled'; end if;
  if has_table_privilege('authenticated','private.office_workflow_policy_versions','select')
     or has_table_privilege('authenticated','private.office_workflow_policy_versions','insert')
     or has_table_privilege('authenticated','private.office_workflow_policy_versions','update')
     or has_table_privilege('authenticated','private.office_workflow_policy_versions','delete') then
    raise exception 'authenticated must not have direct workflow-policy table DML';
  end if;
end $$;

rollback;

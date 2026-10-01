-- Office Slice C8 policy validation behavioral contract.
-- Run against a disposable/nonproduction database after applying the C8 migration.
-- This file is intentionally transaction-safe and creates no persistent fixtures.

begin;

do $$
declare
  valid jsonb := '{"stages":[{"id":"start","label":"شروع","start":true,"terminal":false},{"id":"done","label":"پایان","start":false,"terminal":true}],"edges":[{"id":"approve","from":"start","to":"done","label":"تأیید","capability":"approve"}]}'::jsonb;
  bad jsonb;
begin
  -- Persian labels and the minimal valid graph must pass.
  perform private.office_workflow_validate_definition(valid);

  begin perform private.office_workflow_validate_definition(null); raise exception 'expected null rejection';
  exception when sqlstate '22023' then null; end;

  bad := '{"stages":[{"id":"only","label":"تنها","start":true,"terminal":true}],"edges":[]}'::jsonb;
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected one-stage rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_build_object('stages',(select jsonb_agg(jsonb_build_object('id','s'||g,'label','مرحله','start',g=1,'terminal',g=21)) from generate_series(1,21) g),'edges','[]'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected 21-stage rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_build_object('stages',valid->'stages','edges',(select jsonb_agg(jsonb_build_object('id','e'||g,'from','start','to','done','label','عبور','capability','edit')) from generate_series(1,61) g));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected 61-edge rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{edges,0,capability}','"delete"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected capability rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{edges,0,to}','"missing"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unknown-target rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{edges,0,to}','"start"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected self-edge rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{stages,1,terminal}','false'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected no-terminal rejection';
  exception when sqlstate '22023' then null; end;

  bad := valid || '{"unknown":true}'::jsonb;
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unknown-root-key rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{stages,0}',(valid->'stages'->0)||'{"unknown":true}'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unknown-stage-key rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{edges,0}',(valid->'edges'->0)||'{"unknown":true}'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unknown-edge-key rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{stages,0,start}','"true"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected non-boolean flag rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{stages,1,id}','"start"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected duplicate-stage-id rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{edges}',(valid->'edges')||jsonb_build_array((valid->'edges'->0)||'{"label":"دوباره"}'::jsonb));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected duplicate-edge-id rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{edges}',(valid->'edges')||jsonb_build_array((valid->'edges'->0)||'{"id":"again"}'::jsonb));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected duplicate-edge-pair rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{edges}',jsonb_build_array((valid->'edges'->0),jsonb_build_object('id','back','from','done','to','start','label','بازگشت','capability','edit')));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected terminal-outgoing rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{stages,1}',jsonb_build_object('id','orphan','label','یتیم','start',false,'terminal',true));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unreachable-stage rejection';
  exception when sqlstate '22023' then null; end;

  bad := '{"stages":[{"id":"start","label":"شروع","start":true,"terminal":false},{"id":"done","label":"پایان","start":false,"terminal":true},{"id":"loop1","label":"حلقه ۱","start":false,"terminal":false},{"id":"loop2","label":"حلقه ۲","start":false,"terminal":false}],"edges":[{"id":"finish","from":"start","to":"done","label":"پایان","capability":"approve"},{"id":"branch","from":"start","to":"loop1","label":"شاخه","capability":"edit"},{"id":"l12","from":"loop1","to":"loop2","label":"بعدی","capability":"edit"},{"id":"l21","from":"loop2","to":"loop1","label":"برگشت","capability":"edit"}]}'::jsonb;
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected no-exit-cycle rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_build_object('stages',valid->'stages','edges',valid->'edges','padding',repeat('x',70000));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected size rejection';
  exception when sqlstate '22023' then null; end;
end $$;

rollback;

-- Office Slice C8 policy validation behavioral contract.
-- Run against a disposable/nonproduction database after applying the C8 migration.
-- This file is intentionally transaction-safe and creates no persistent fixtures.

begin;

do $$
declare
  valid jsonb := '{"stages":[{"id":"start","label":"شروع","start":true,"terminal":false},{"id":"done","label":"پایان","start":false,"terminal":true}],"edges":[{"id":"approve","from":"start","to":"done","label":"تأیید","capability":"approve"}]}'::jsonb;
  bad jsonb;
begin
  perform private.office_workflow_validate_definition(valid);

  bad := '{"stages":[{"id":"only","label":"تنها","start":true,"terminal":true}],"edges":[]}'::jsonb;
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected one-stage rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_build_object('stages',(select jsonb_agg(jsonb_build_object('id','s'||g,'label','مرحله','start',g=1,'terminal',g=21)) from generate_series(1,21) g),'edges','[]'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected 21-stage rejection';
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

  bad := jsonb_set(valid,'{stages,0,start}','"true"'::jsonb);
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected non-boolean flag rejection';
  exception when sqlstate '22023' then null; end;

  bad := jsonb_set(valid,'{stages,1}',jsonb_build_object('id','orphan','label','یتیم','start',false,'terminal',true));
  begin perform private.office_workflow_validate_definition(bad); raise exception 'expected unreachable-stage rejection';
  exception when sqlstate '22023' then null; end;
end $$;

rollback;

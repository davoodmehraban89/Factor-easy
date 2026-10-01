\set ON_ERROR_STOP on
insert into public.profiles(id) values ('44444444-4444-4444-4444-444444444444') on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.write','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);

create temporary table d3b_ids(k text primary key,v uuid);
insert into d3b_ids
select 'type',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D3B_COND','گردش شرطی','Workflow',
 '{"schemaVersion":1,"fields":[{"key":"amount","label":"مبلغ","type":"number","required":true}]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"manager","title":"مدیر","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","condition":{"field":"amount","op":"gte","value":1000}},{"key":"finance","title":"مالی","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve"}]}'::jsonb,
 0
);
insert into d3b_ids values('instance',public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d3b_ids where k='type'),'{"amount":500}'::jsonb,'d3b-create-0001'));

reset role;
do $$ declare i uuid; begin
 i=(select v from d3b_ids where k='instance');
 if not exists(select 1 from private.request_step_instances where request_instance_id=i and step_key='manager' and state='skipped' and condition_matched=false) then raise exception 'false condition was not retained as skipped evidence'; end if;
 if not exists(select 1 from private.request_step_instances where request_instance_id=i and step_key='finance' and state='active' and condition_matched=true) then raise exception 'first matched step was not activated'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
do $$ declare t jsonb; begin
 t:=public.request_workflow_timeline((select v from d3b_ids where k='instance'));
 if jsonb_array_length(t->'steps')<>2 then raise exception 'timeline step count mismatch'; end if;
 if (t->'steps'->0->>'state')<>'skipped' then raise exception 'timeline did not expose skipped step'; end if;
 if (t->'steps'->1->>'state')<>'active' then raise exception 'timeline did not expose active step'; end if;
 if (t->'steps'->0->>'conditionMatched')::boolean<>false then raise exception 'timeline lost condition evidence'; end if;
end $$;

do $$ begin
 begin
  perform * from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D3B_BAD_OP','bad',null,'{}'::jsonb,'{"schemaVersion":2,"steps":[{"key":"x","title":"X","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","condition":{"field":"amount","op":"sql","value":"drop table"}}]}'::jsonb,0);
  raise exception 'unsafe condition operator unexpectedly published';
 exception when others then if position('condition operator is not allowed' in sqlerrm)=0 then raise; end if; end;
end $$;

do $$ begin
 begin
  perform * from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D3B_BAD_FIELD','bad',null,'{}'::jsonb,'{"schemaVersion":2,"steps":[{"key":"x","title":"X","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","condition":{"field":"amount;drop","op":"eq","value":1}}]}'::jsonb,0);
  raise exception 'unsafe condition field unexpectedly published';
 exception when others then if position('condition field is invalid' in sqlerrm)=0 then raise; end if; end;
end $$;

select set_config('request.jwt.claim.org','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
do $$ begin
 begin perform public.request_workflow_timeline((select v from d3b_ids where k='instance')); raise exception 'cross-tenant timeline unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

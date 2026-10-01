\set ON_ERROR_STOP on
\ir ../migrations/20261001230500_request_workflow_d3a_security_hardening.sql
insert into public.profiles(id) values ('33333333-3333-3333-3333-333333333333') on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.write','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);

create temporary table d3_ids(k text primary key,v uuid);
insert into d3_ids
select 'type',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D3_APPROVAL','تأیید چندمرحله‌ای','Workflow',
 '{"schemaVersion":1,"fields":[{"key":"subject","label":"موضوع","type":"text","required":true}]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"manager","title":"مدیر","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve"},{"key":"finance","title":"مالی","mode":"parallel","requiredApprovals":2,"requiredCapability":"approve"}]}'::jsonb,
 0
);
insert into d3_ids values('instance',public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d3_ids where k='type'),'{"subject":"خرید"}'::jsonb,'d3-create-000001'));

do $$ declare i uuid; begin
 i=(select v from d3_ids where k='instance');
 if (select count(*) from private.request_step_instances where request_instance_id=i)<>2 then raise exception 'expected two D3 step instances'; end if;
 if not exists(select 1 from private.request_step_instances where request_instance_id=i and step_key='manager' and state='active' and required_approvals=1) then raise exception 'first sequential step was not activated'; end if;
 if not exists(select 1 from private.request_step_instances where request_instance_id=i and step_key='finance' and state='pending' and required_approvals=2) then raise exception 'parallel step was not initialized pending'; end if;
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select set_config('request.jwt.claim.capabilities','read,approve',false);
select * from public.request_step_decide((select v from d3_ids where k='instance'),'approve',1,'d3-vote-000001','manager ok');
do $$ declare i uuid; begin
 i=(select v from d3_ids where k='instance');
 if (select revision from public.request_instances where id=i)<>2 then raise exception 'manager approval did not advance revision'; end if;
 if (select status from public.request_instances where id=i)<>'submitted' then raise exception 'request completed before final step'; end if;
 if not exists(select 1 from private.request_step_instances where request_instance_id=i and step_key='manager' and state='completed') then raise exception 'manager step not completed'; end if;
 if not exists(select 1 from private.request_step_instances where request_instance_id=i and step_key='finance' and state='active') then raise exception 'finance step not activated'; end if;
end $$;

select * from public.request_step_decide((select v from d3_ids where k='instance'),'approve',2,'d3-vote-000002','finance 1');
do $$ declare i uuid; begin
 i=(select v from d3_ids where k='instance');
 if (select status from public.request_instances where id=i)<>'submitted' then raise exception 'parallel quorum completed too early'; end if;
 if (select revision from public.request_instances where id=i)<>3 then raise exception 'first parallel vote did not advance revision'; end if;
 if (select count(*) from private.request_step_votes v join private.request_step_instances s on s.id=v.step_instance_id where s.request_instance_id=i and s.step_key='finance' and v.decision='approve')<>1 then raise exception 'first parallel vote missing'; end if;
end $$;

select * from public.request_step_decide((select v from d3_ids where k='instance'),'approve',2,'d3-vote-000002','retry');
do $$ declare i uuid; begin i=(select v from d3_ids where k='instance'); if (select revision from public.request_instances where id=i)<>3 then raise exception 'idempotent vote retry changed revision'; end if; end $$;

select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
select set_config('request.jwt.claim.capabilities','read,approve',false);
select * from public.request_step_decide((select v from d3_ids where k='instance'),'approve',3,'d3-vote-000003','finance 2');
do $$ declare i uuid; begin
 i=(select v from d3_ids where k='instance');
 if (select status from public.request_instances where id=i)<>'approved' then raise exception 'parallel quorum did not approve request'; end if;
 if (select revision from public.request_instances where id=i)<>4 then raise exception 'final approval did not advance revision'; end if;
 if not exists(select 1 from private.request_step_instances where request_instance_id=i and step_key='finance' and state='completed') then raise exception 'finance step not completed'; end if;
 if (select count(*) from public.request_instance_events where request_instance_id=i and action like 'step_approve:%')<>3 then raise exception 'step decision evidence incomplete'; end if;
end $$;

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
do $$ begin
 begin
  perform * from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D3_BAD','bad',null,'{}'::jsonb,'{"schemaVersion":2,"steps":[{"key":"x","mode":"parallel","requiredApprovals":1,"requiredCapability":"approve"}]}'::jsonb,0);
  raise exception 'invalid parallel schema unexpectedly published';
 exception when others then if position('parallel step requires at least two approvals' in sqlerrm)=0 then raise; end if; end;
end $$;

insert into d3_ids
select 'type2',request_type_version_id from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D3_CAP','capability',null,'{}'::jsonb,'{"schemaVersion":2,"steps":[{"key":"approval","title":"Approval","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve"}]}'::jsonb,0);
insert into d3_ids values('instance2',public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d3_ids where k='type2'),'{}'::jsonb,'d3-create-000002'));
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select set_config('request.jwt.claim.capabilities','read',false);
do $$ begin
 begin perform * from public.request_step_decide((select v from d3_ids where k='instance2'),'approve',1,'d3-vote-000004',null); raise exception 'step decision without capability unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

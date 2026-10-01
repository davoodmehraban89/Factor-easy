\set ON_ERROR_STOP on
insert into public.profiles(id) values ('55555555-5555-5555-5555-555555555555') on conflict do nothing;
insert into public.organization_members(organization_id,user_id,status,is_owner,position_title) values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555','active',false,'جانشین') on conflict(organization_id,user_id) do update set status='active';

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.write','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
create temporary table d3c_ids(k text primary key,v uuid);
insert into d3c_ids select 'type',request_type_version_id from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D3C_OPS','عملیات درخواست','Workflow','{"schemaVersion":1,"fields":[{"key":"amount","label":"مبلغ","type":"number","required":true}]}'::jsonb,'{"schemaVersion":2,"steps":[{"key":"approve","title":"تأیید","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","slaHours":1}],"onApproved":[{"targetModule":"commerce","actionKey":"create_purchase_draft","payload":{"source":"request"}}]}'::jsonb,0);
insert into d3c_ids values('instance',public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d3c_ids where k='type'),'{"amount":"500"}'::jsonb,'d3c-create-0001'));
insert into d3c_ids values('delegation',public.request_create_delegation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555','approve',now(),now()+interval '2 days','مرخصی'));
reset role;

do $$ declare i uuid; begin i=(select v from d3c_ids where k='instance');if not exists(select 1 from private.request_step_instances where request_instance_id=i and state='active' and sla_hours=1 and due_at is not null) then raise exception 'SLA deadline was not materialized';end if;end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.capabilities','read',false);
do $$ declare r record; begin select * into r from public.request_step_decide((select v from d3c_ids where k='instance'),'approve',1,'d3c-vote-0001','به جانشینی') limit 1;if r.status<>'approved' then raise exception 'delegated approval did not complete request';end if;end $$;
reset role;

do $$ declare i uuid; begin i=(select v from d3c_ids where k='instance');if not exists(select 1 from private.request_step_votes where request_instance_id=i and actor_user_id='55555555-5555-5555-5555-555555555555' and delegated_from_user_id='11111111-1111-1111-1111-111111111111') then raise exception 'delegation provenance missing from vote';end if;if not exists(select 1 from private.request_outbox where request_instance_id=i and target_module='commerce' and action_key='create_purchase_draft' and status='pending') then raise exception 'approved request did not atomically enqueue outbox action';end if;end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
insert into d3c_ids values('sla_instance',public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d3c_ids where k='type'),'{"amount":"700"}'::jsonb,'d3c-create-0002'));
reset role;
update private.request_step_instances set due_at=now()-interval '5 minutes' where request_instance_id=(select v from d3c_ids where k='sla_instance') and state='active';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
do $$ declare n integer; begin n:=public.request_escalate_overdue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');if n<>1 then raise exception 'expected one overdue escalation, got %',n;end if;end $$;
reset role;
do $$ declare i uuid; begin i=(select v from d3c_ids where k='sla_instance');if not exists(select 1 from private.request_step_instances where request_instance_id=i and escalated_at is not null and escalation_level=1) then raise exception 'escalation evidence missing';end if;if not exists(select 1 from public.request_instance_events where request_instance_id=i and action='step_escalated:approve') then raise exception 'immutable escalation event missing';end if;end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
do $$ declare x jsonb; begin x:=public.request_outbox_status((select v from d3c_ids where k='instance'));if jsonb_array_length(x)<>1 or x->0->>'status'<>'pending' then raise exception 'outbox status RPC mismatch';end if;end $$;
select public.request_revoke_delegation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d3c_ids where k='delegation'));

do $$ begin begin perform * from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D3C_BAD_SLA','bad',null,'{}'::jsonb,'{"schemaVersion":2,"steps":[{"key":"x","title":"X","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","slaHours":0}]}'::jsonb,0);raise exception 'invalid SLA unexpectedly published';exception when others then if position('slaHours must be between' in sqlerrm)=0 then raise;end if;end;end $$;
do $$ begin begin perform * from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D3C_BAD_OUTBOX','bad',null,'{}'::jsonb,'{"schemaVersion":2,"steps":[{"key":"x","title":"X","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve"}],"onApproved":[{"targetModule":"accounting","actionKey":"DROP TABLE","payload":{}}]}'::jsonb,0);raise exception 'unsafe outbox action unexpectedly published';exception when others then if position('outbox actionKey is invalid' in sqlerrm)=0 then raise;end if;end;end $$;
reset role;

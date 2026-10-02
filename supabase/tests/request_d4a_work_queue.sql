\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);

create temporary table d4a_ids(k text primary key,v uuid);
insert into d4a_ids
select 'type',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','D4A_QUEUE','کارتابل اقدام',null,
 '{"schemaVersion":1,"fields":[{"key":"subject","label":"موضوع","type":"text","required":true}]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"manager","title":"تأیید مدیر","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","slaHours":4}]}'::jsonb,0
);
insert into d4a_ids values('direct',public.request_create_instance(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d4a_ids where k='type'),'{"subject":"direct"}'::jsonb,'d4a-create-direct-0001'
));

do $$ declare q jsonb; begin
 q:=public.request_work_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 if not exists(select 1 from jsonb_array_elements(q) x where x->>'requestInstanceId'=(select v::text from d4a_ids where k='direct')) then raise exception 'direct approver item missing from queue'; end if;
 if not exists(select 1 from jsonb_array_elements(q) x where x->>'requestInstanceId'=(select v::text from d4a_ids where k='direct') and x->>'stepKey'='manager' and x->>'requestTypeTitle'='کارتابل اقدام' and x->>'delegatedFromUserId' is null) then raise exception 'direct work queue projection mismatch'; end if;
end $$;

select * from public.request_step_decide((select v from d4a_ids where k='direct'),'approve',1,'d4a-direct-vote-0001','ok');
do $ declare q jsonb; begin q:=public.request_work_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');if exists(select 1 from jsonb_array_elements(q) x where x->>'requestInstanceId'=(select v::text from d4a_ids where k='direct')) then raise exception 'completed request remained actionable';end if;end $;

reset role;
insert into public.profiles(id) values ('55555555-5555-5555-5555-555555555555') on conflict do nothing;
insert into public.organization_members(organization_id,user_id,status,is_owner,position_title)
values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555','active',false,'جانشین')
on conflict(organization_id,user_id) do update set status='active';

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
insert into d4a_ids values('delegated',public.request_create_instance(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d4a_ids where k='type'),'{"subject":"delegated"}'::jsonb,'d4a-create-delegated-01'
));
insert into d4a_ids values('delegation',public.request_create_delegation(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555','approve',now(),now()+interval '1 day','coverage'
));

select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false);
select set_config('request.jwt.claim.capabilities','read',false);
do $$ declare q jsonb; begin
 q:=public.request_work_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 if not exists(select 1 from jsonb_array_elements(q) x where x->>'requestInstanceId'=(select v::text from d4a_ids where k='delegated') and x->>'delegatedFromUserId'='11111111-1111-1111-1111-111111111111') then raise exception 'delegated item or provenance missing from queue'; end if;
end $$;
select * from public.request_step_decide((select v from d4a_ids where k='delegated'),'approve',1,'d4a-delegate-vote-01','delegated');
do $ declare q jsonb; begin q:=public.request_work_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');if exists(select 1 from jsonb_array_elements(q) x where x->>'requestInstanceId'=(select v::text from d4a_ids where k='delegated')) then raise exception 'delegate completed item remained actionable';end if;end $;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select set_config('request.jwt.claim.capabilities','read',false);
do $$ declare q jsonb; begin q:=public.request_work_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');if jsonb_array_length(q)<>0 then raise exception 'unauthorized read-only actor received actionable queue';end if;end $$;
reset role;

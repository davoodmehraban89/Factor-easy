\set ON_ERROR_STOP on

insert into public.profiles(id) values
 ('66666666-6666-6666-6666-666666666666'),
 ('77777777-7777-7777-7777-777777777777')
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.write','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);

create temporary table wave3_ids(k text primary key,v uuid);
insert into wave3_ids
select 'type',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W3_REPLAY','Wave 3 replay','Workflow',
 '{"schemaVersion":1,"fields":[{"key":"subject","label":"Subject","type":"text","required":true}]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"approval","title":"Approval","mode":"parallel","requiredApprovals":2,"requiredCapability":"approve"}]}'::jsonb,0
);
insert into wave3_ids values('instance',public.request_create_instance(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave3_ids where k='type'),
 '{"subject":"stable replay"}'::jsonb,'wave3-create-0001'
));
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.capabilities','read,approve',false);
create temporary table wave3_first_response as
select * from public.request_step_decide((select v from wave3_ids where k='instance'),'approve',1,'wave3-vote-0001','first vote');
reset role;

do $$ begin
 if not exists(select 1 from wave3_first_response where status='submitted' and revision=2 and step_key='approval' and step_state='active' and approvals_received=1 and approvals_required=2) then
  raise exception 'F-416 baseline first response is not the expected immutable outcome';
 end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-7777-7777-777777777777',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.capabilities','read,approve',false);
create temporary table wave3_second_response as
select * from public.request_step_decide((select v from wave3_ids where k='instance'),'approve',2,'wave3-vote-0002','second vote');
reset role;

do $$ begin
 if not exists(select 1 from wave3_second_response where status='approved' and revision=3 and step_key='approval' and step_state='completed' and approvals_received=2 and approvals_required=2) then
  raise exception 'parallel quorum did not reach the expected terminal outcome';
 end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.capabilities','read',false);
do $$ begin
 begin
  perform * from public.request_step_decide((select v from wave3_ids where k='instance'),'approve',1,'wave3-vote-0001','retry');
  raise exception 'F-415 unauthorized decision replay unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-7777-7777-777777777777',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.capabilities','read,approve',false);
do $$ begin
 begin
  perform * from public.request_step_decide((select v from wave3_ids where k='instance'),'approve',1,'wave3-vote-0001','foreign retry');
  raise exception 'actor-bound decision replay unexpectedly succeeded for another actor';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.capabilities','read,approve',false);
create temporary table wave3_replay_response as
select * from public.request_step_decide((select v from wave3_ids where k='instance'),'approve',1,'wave3-vote-0001','retry');
reset role;

do $$ begin
 if (select row_to_json(x)::text from wave3_first_response x) is distinct from (select row_to_json(x)::text from wave3_replay_response x) then
  raise exception 'F-416 replay response drifted from original command outcome';
 end if;
 if (select status from public.request_instances where id=(select v from wave3_ids where k='instance'))<>'approved' then
  raise exception 'replay mutated the already-approved request';
 end if;
 if (select revision from public.request_instances where id=(select v from wave3_ids where k='instance'))<>3 then
  raise exception 'replay changed request revision';
 end if;
end $$;

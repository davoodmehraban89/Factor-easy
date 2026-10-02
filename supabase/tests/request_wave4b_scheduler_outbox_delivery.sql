\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
create temporary table w4b_ids(k text primary key,v uuid);
insert into w4b_ids select 'type',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W4B_OPS','Wave 4b operations',null,
 '{"schemaVersion":1,"fields":[{"key":"subject","label":"Subject","type":"text","required":true}]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"approve","title":"Approve","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","slaHours":1}],"onApproved":[{"targetModule":"commerce","actionKey":"create_purchase_draft","payload":{"source":"wave4b"}}]}'::jsonb,0);
insert into w4b_ids values('sla_instance',public.request_create_instance(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from w4b_ids where k='type'),'{"subject":"sla"}'::jsonb,'wave4b-create-sla-0001'));
reset role;
update private.request_step_instances set due_at=statement_timestamp()-interval '5 minutes' where request_instance_id=(select v from w4b_ids where k='sla_instance') and state='active';

create temporary table w4b_scheduler as
select * from public.request_run_sla_scheduler('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','wave4b-scheduler-run-0001',date_trunc('hour',statement_timestamp()),100);
do $$ declare r record;i uuid;begin
 select * into r from w4b_scheduler;i=(select v from w4b_ids where k='sla_instance');
 if r.processed_count<>1 or r.replayed then raise exception 'scheduler first run contract mismatch';end if;
 if not exists(select 1 from private.request_step_instances where request_instance_id=i and escalated_at is not null and escalation_level=1) then raise exception 'scheduler did not escalate overdue step';end if;
 if not exists(select 1 from private.request_scheduler_run_items x where x.scheduler_run_id=r.run_id and x.request_instance_id=i and x.outcome='escalated') then raise exception 'scheduler claim evidence missing';end if;
 if not exists(select 1 from public.organization_audit a where a.action='request_step_sla_escalated_system' and a.actor_user_id is null and a.after_data->>'schedulerRunId'=r.run_id::text) then raise exception 'scheduler system audit evidence missing';end if;
end $$;
do $$ declare r record;begin
 select * into r from public.request_run_sla_scheduler('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','wave4b-scheduler-run-0001',date_trunc('hour',statement_timestamp()),100);
 if r.processed_count<>1 or not r.replayed then raise exception 'scheduler replay was not stable';end if;
end $$;
do $$ begin begin
 perform * from public.request_run_sla_scheduler('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','wave4b-scheduler-run-0002',date_trunc('hour',statement_timestamp()),100);
 raise exception 'duplicate scheduler slot unexpectedly succeeded';
 exception when unique_violation then null;end;end $$;
do $$ begin begin
 perform * from public.request_run_sla_scheduler('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','wave4b-scheduler-future',date_trunc('hour',statement_timestamp())+interval '2 hours',100);
 raise exception 'future scheduler clock unexpectedly accepted';
 exception when others then if position('server-clock window' in sqlerrm)=0 then raise;end if;end;end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
insert into w4b_ids values('delivery_instance',public.request_create_instance(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from w4b_ids where k='type'),'{"subject":"delivery"}'::jsonb,'wave4b-create-delivery-0001'));
do $$ declare r record;begin select * into r from public.request_step_decide((select v from w4b_ids where k='delivery_instance'),'approve',1,'wave4b-approve-delivery-0001','approve') limit 1;if r.status<>'approved' then raise exception 'delivery request did not approve';end if;end $$;
reset role;
insert into w4b_ids select 'outbox',id from private.request_outbox where request_instance_id=(select v from w4b_ids where k='delivery_instance');
create temporary table w4b_claim1 as select * from public.request_claim_outbox('wave4b-worker-a',10) where outbox_id=(select v from w4b_ids where k='outbox');
do $$ declare r record;begin select * into r from w4b_claim1;if r.attempts<>1 or r.destination_command_key<>'request-outbox:'||r.outbox_id::text or r.claim_token is null then raise exception 'first outbox claim contract mismatch';end if;end $$;
select public.request_fail_outbox((select v from w4b_ids where k='outbox'),(select claim_token from w4b_claim1),'temporary destination failure');
do $$ begin if not exists(select 1 from private.request_outbox where id=(select v from w4b_ids where k='outbox') and status='failed' and attempts=1 and available_at>last_attempt_at) then raise exception 'retry scheduling state mismatch';end if;end $$;
update private.request_outbox set available_at=statement_timestamp()-interval '1 second' where id=(select v from w4b_ids where k='outbox');
create temporary table w4b_claim2 as select * from public.request_claim_outbox('wave4b-worker-b',10) where outbox_id=(select v from w4b_ids where k='outbox');
do $$ declare a text;b text;begin a=(select destination_command_key from w4b_claim1);b=(select destination_command_key from w4b_claim2);if a<>b or (select attempts from w4b_claim2)<>2 then raise exception 'destination command identity was not stable across retry';end if;end $$;
select public.request_complete_outbox((select v from w4b_ids where k='outbox'),(select claim_token from w4b_claim2),'destination-receipt-1');
do $$ begin if not exists(select 1 from private.request_outbox where id=(select v from w4b_ids where k='outbox') and status='dispatched' and dispatched_at is not null and destination_receipt='destination-receipt-1') then raise exception 'outbox completion state mismatch';end if;end $$;
do $$ begin begin perform public.request_complete_outbox((select v from w4b_ids where k='outbox'),(select claim_token from w4b_claim2),'duplicate');raise exception 'stale claim unexpectedly completed twice';exception when serialization_failure then null;end;end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
insert into w4b_ids values('dead_instance',public.request_create_instance(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from w4b_ids where k='type'),'{"subject":"dead"}'::jsonb,'wave4b-create-dead-0001'));
do $$ declare r record;begin select * into r from public.request_step_decide((select v from w4b_ids where k='dead_instance'),'approve',1,'wave4b-approve-dead-0001','approve') limit 1;if r.status<>'approved' then raise exception 'dead-letter request did not approve';end if;end $$;
reset role;
insert into w4b_ids select 'dead_outbox',id from private.request_outbox where request_instance_id=(select v from w4b_ids where k='dead_instance');
do $$ declare n integer;tok uuid;s text;begin
 for n in 1..5 loop
  update private.request_outbox set available_at=statement_timestamp()-interval '1 second' where id=(select v from w4b_ids where k='dead_outbox');
  select claim_token into tok from public.request_claim_outbox('wave4b-dead-worker',10) where outbox_id=(select v from w4b_ids where k='dead_outbox');
  if tok is null then raise exception 'dead-letter attempt % was not claimable',n;end if;
  s:=public.request_fail_outbox((select v from w4b_ids where k='dead_outbox'),tok,'persistent failure');
  if n<5 and s<>'failed' then raise exception 'attempt % should schedule retry',n;end if;
  if n=5 and s<>'dead_letter' then raise exception 'attempt 5 should dead-letter';end if;
 end loop;
end $$;
do $$ begin if not exists(select 1 from private.request_outbox where id=(select v from w4b_ids where k='dead_outbox') and status='dead_letter' and attempts=5 and dead_lettered_at is not null) then raise exception 'dead-letter terminal state missing';end if;end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
select public.request_replay_dead_letter('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from w4b_ids where k='dead_outbox'),'wave4b-replay-dead-0001','operator reviewed destination');
select public.request_replay_dead_letter('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from w4b_ids where k='dead_outbox'),'wave4b-replay-dead-0001','operator reviewed destination');
reset role;
do $ declare v_destination_key text;begin
 select o.destination_command_key into v_destination_key from private.request_outbox o where o.id=(select x.v from w4b_ids x where x.k='dead_outbox');
 if not exists(select 1 from private.request_outbox where id=(select x.v from w4b_ids x where x.k='dead_outbox') and status='pending' and attempts=0 and replay_count=1 and last_replay_key='wave4b-replay-dead-0001') then raise exception 'dead-letter replay state mismatch';end if;
 if v_destination_key<>'request-outbox:'||(select x.v from w4b_ids x where x.k='dead_outbox')::text then raise exception 'destination command key changed across dead-letter replay';end if;
 if (select count(*) from public.organization_audit where action='request_outbox_replayed' and entity_id=(select x.v from w4b_ids x where x.k='dead_outbox')::text)<>1 then raise exception 'replay idempotency duplicated audit evidence';end if;
end $$;

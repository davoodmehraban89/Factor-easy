-- Wave 4b: explicit SLA scheduler policy and durable outbox delivery state machine.
-- D4c destination consumers remain disabled; this migration only establishes the server-side contract.

create table if not exists private.request_scheduler_runs(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 job_key text not null check(job_key in ('request_sla_escalation')),
 run_key text not null check(char_length(trim(run_key)) between 8 and 200),
 schedule_slot timestamptz not null,
 server_clock timestamptz not null,
 batch_limit integer not null check(batch_limit between 1 and 200),
 processed_count integer not null default 0 check(processed_count between 0 and 200),
 status text not null default 'running' check(status in ('running','completed')),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(organization_id,job_key,run_key),
 unique(organization_id,job_key,schedule_slot)
);
create table if not exists private.request_scheduler_run_items(
 id uuid primary key default gen_random_uuid(),
 scheduler_run_id uuid not null references private.request_scheduler_runs(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 request_instance_id uuid not null references public.request_instances(id) on delete cascade,
 step_instance_id uuid not null references private.request_step_instances(id) on delete cascade,
 due_at timestamptz not null,
 claimed_at timestamptz not null,
 outcome text not null check(outcome='escalated'),
 created_at timestamptz not null default now(),
 unique(step_instance_id)
);
create index if not exists request_scheduler_runs_org_created_idx on private.request_scheduler_runs(organization_id,created_at desc);
create index if not exists request_scheduler_items_run_idx on private.request_scheduler_run_items(scheduler_run_id,created_at);
revoke all on private.request_scheduler_runs,private.request_scheduler_run_items from public,anon,authenticated;

alter table private.request_outbox add column if not exists claim_token uuid;
alter table private.request_outbox add column if not exists claimed_at timestamptz;
alter table private.request_outbox add column if not exists last_attempt_at timestamptz;
alter table private.request_outbox add column if not exists last_worker_id text;
alter table private.request_outbox add column if not exists dead_lettered_at timestamptz;
alter table private.request_outbox add column if not exists replay_count integer not null default 0 check(replay_count between 0 and 100);
alter table private.request_outbox add column if not exists last_replay_key text;
alter table private.request_outbox add column if not exists destination_command_key text;
alter table private.request_outbox add column if not exists destination_receipt text;
update private.request_outbox set destination_command_key='request-outbox:'||id::text where destination_command_key is null;
alter table private.request_outbox alter column destination_command_key set not null;
create unique index if not exists request_outbox_destination_command_uidx on private.request_outbox(destination_command_key);
alter table private.request_outbox drop constraint if exists request_outbox_status_check;
alter table private.request_outbox add constraint request_outbox_status_check check(status in ('pending','processing','dispatched','failed','dead_letter'));
alter table private.request_outbox drop constraint if exists request_outbox_last_worker_id_check;
alter table private.request_outbox add constraint request_outbox_last_worker_id_check check(last_worker_id is null or char_length(trim(last_worker_id)) between 3 and 120);
alter table private.request_outbox drop constraint if exists request_outbox_last_replay_key_check;
alter table private.request_outbox add constraint request_outbox_last_replay_key_check check(last_replay_key is null or char_length(trim(last_replay_key)) between 8 and 200);

create or replace function private.enqueue_request_outbox(p_request_instance_id uuid,p_workflow_schema jsonb,p_revision bigint)
returns integer language plpgsql security definer set search_path=''
as $$
declare v_action jsonb;v_org uuid;v_count integer:=0;v_id uuid;
begin
 select organization_id into v_org from public.request_instances where id=p_request_instance_id;
 if v_org is null then raise exception 'request instance not found';end if;
 if jsonb_typeof(p_workflow_schema->'onApproved')<>'array' then return 0;end if;
 for v_action in select value from jsonb_array_elements(p_workflow_schema->'onApproved') loop
  v_id:=gen_random_uuid();
  insert into private.request_outbox(id,organization_id,request_instance_id,event_key,target_module,action_key,payload,destination_command_key)
  values(v_id,v_org,p_request_instance_id,'approved:'||p_revision::text,lower(trim(v_action->>'targetModule')),lower(trim(v_action->>'actionKey')),jsonb_build_object('requestInstanceId',p_request_instance_id,'requestRevision',p_revision,'config',coalesce(v_action->'payload','{}'::jsonb)),'request-outbox:'||v_id::text)
  on conflict(request_instance_id,event_key,target_module,action_key) do nothing;
  if found then v_count:=v_count+1;end if;
 end loop;
 return v_count;
end $$;
revoke all on function private.enqueue_request_outbox(uuid,jsonb,bigint) from public,anon,authenticated;

create or replace function private.request_run_sla_scheduler(p_organization_id uuid,p_run_key text,p_schedule_slot timestamptz,p_limit integer default 100)
returns table(run_id uuid,processed_count integer,server_clock timestamptz,replayed boolean)
language plpgsql security definer set search_path=''
as $$
declare v_clock timestamptz:=statement_timestamp();v_run private.request_scheduler_runs%rowtype;v_step private.request_step_instances%rowtype;v_count integer:=0;
begin
 if char_length(trim(coalesce(p_run_key,''))) not between 8 and 200 then raise exception 'scheduler run_key must be between 8 and 200 characters';end if;
 if p_limit is null or p_limit<1 or p_limit>200 then raise exception 'scheduler batch limit must be between 1 and 200';end if;
 if p_schedule_slot is null or mod(extract(epoch from p_schedule_slot)::bigint,300)<>0 then raise exception 'scheduler slot must align to a 5-minute UTC boundary';end if;
 if p_schedule_slot>v_clock+interval '30 seconds' or p_schedule_slot<v_clock-interval '1 hour' then raise exception 'scheduler slot is outside the accepted server-clock window';end if;
 select * into v_run from private.request_scheduler_runs r where r.organization_id=p_organization_id and r.job_key='request_sla_escalation' and r.run_key=trim(p_run_key);
 if found then
  if v_run.schedule_slot<>p_schedule_slot or v_run.batch_limit<>p_limit then raise exception 'scheduler run_key is already bound to a different command' using errcode='23505';end if;
  return query select v_run.id,v_run.processed_count,v_run.server_clock,true;return;
 end if;
 if exists(select 1 from private.request_scheduler_runs r where r.organization_id=p_organization_id and r.job_key='request_sla_escalation' and r.schedule_slot=p_schedule_slot) then raise exception 'scheduler slot is already claimed' using errcode='23505';end if;
 insert into private.request_scheduler_runs(organization_id,job_key,run_key,schedule_slot,server_clock,batch_limit)
 values(p_organization_id,'request_sla_escalation',trim(p_run_key),p_schedule_slot,v_clock,p_limit) returning * into v_run;
 for v_step in
  select * from private.request_step_instances s
  where s.organization_id=p_organization_id and s.state='active' and s.due_at is not null and s.due_at<=v_clock and s.escalated_at is null
  order by s.due_at,s.id for update skip locked limit p_limit
 loop
  update private.request_step_instances set escalated_at=v_clock,escalation_level=escalation_level+1 where id=v_step.id and escalated_at is null;
  if found then
   insert into private.request_scheduler_run_items(scheduler_run_id,organization_id,request_instance_id,step_instance_id,due_at,claimed_at,outcome)
   values(v_run.id,p_organization_id,v_step.request_instance_id,v_step.id,v_step.due_at,v_clock,'escalated');
   insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
   values(p_organization_id,null,'request_step_sla_escalated_system','request_step_instance',v_step.id::text,
    jsonb_build_object('requestInstanceId',v_step.request_instance_id,'stepKey',v_step.step_key,'dueAt',v_step.due_at,'serverClock',v_clock,'schedulerRunId',v_run.id));
   v_count:=v_count+1;
  end if;
 end loop;
 update private.request_scheduler_runs set processed_count=v_count,status='completed',completed_at=statement_timestamp() where id=v_run.id returning * into v_run;
 return query select v_run.id,v_run.processed_count,v_run.server_clock,false;
end $$;
revoke all on function private.request_run_sla_scheduler(uuid,text,timestamptz,integer) from public,anon,authenticated;

create or replace function public.request_run_sla_scheduler(p_organization_id uuid,p_run_key text,p_schedule_slot timestamptz,p_limit integer default 100)
returns table(run_id uuid,processed_count integer,server_clock timestamptz,replayed boolean)
language sql security definer set search_path=''
as $$ select * from private.request_run_sla_scheduler(p_organization_id,p_run_key,p_schedule_slot,p_limit) $$;
revoke all on function public.request_run_sla_scheduler(uuid,text,timestamptz,integer) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.request_run_sla_scheduler(uuid,text,timestamptz,integer) to service_role';end if;end $$;

create or replace function private.request_claim_outbox(p_worker_id text,p_limit integer default 25)
returns table(outbox_id uuid,organization_id uuid,request_instance_id uuid,target_module text,action_key text,payload jsonb,destination_command_key text,claim_token uuid,attempts integer,server_clock timestamptz)
language plpgsql security definer set search_path=''
as $$
declare v_clock timestamptz:=statement_timestamp();
begin
 if char_length(trim(coalesce(p_worker_id,''))) not between 3 and 120 then raise exception 'worker_id must be between 3 and 120 characters';end if;
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'outbox claim limit must be between 1 and 100';end if;
 update private.request_outbox o set status='dead_letter',dead_lettered_at=v_clock,claim_token=null,claimed_at=null,last_error=coalesce(o.last_error,'claim lease expired after maximum attempts')
 where o.status='processing' and o.claimed_at<v_clock-interval '10 minutes' and o.attempts>=5;
 return query
 with candidates as (
  select o.id from private.request_outbox o
  where ((o.status in('pending','failed') and o.available_at<=v_clock) or (o.status='processing' and o.claimed_at<v_clock-interval '10 minutes'))
    and o.attempts<5
  order by o.available_at,o.created_at,o.id
  for update skip locked limit p_limit
 ), claimed as (
  update private.request_outbox o set status='processing',claim_token=gen_random_uuid(),claimed_at=v_clock,last_attempt_at=v_clock,last_worker_id=trim(p_worker_id),attempts=o.attempts+1,last_error=case when o.status='processing' then coalesce(o.last_error,'stale claim recovered') else o.last_error end
  from candidates c where o.id=c.id
  returning o.id,o.organization_id,o.request_instance_id,o.target_module,o.action_key,o.payload,o.destination_command_key,o.claim_token,o.attempts
 )
 select c.id,c.organization_id,c.request_instance_id,c.target_module,c.action_key,c.payload,c.destination_command_key,c.claim_token,c.attempts,v_clock from claimed c;
end $$;
revoke all on function private.request_claim_outbox(text,integer) from public,anon,authenticated;

create or replace function public.request_claim_outbox(p_worker_id text,p_limit integer default 25)
returns table(outbox_id uuid,organization_id uuid,request_instance_id uuid,target_module text,action_key text,payload jsonb,destination_command_key text,claim_token uuid,attempts integer,server_clock timestamptz)
language sql security definer set search_path=''
as $$ select * from private.request_claim_outbox(p_worker_id,p_limit) $$;
revoke all on function public.request_claim_outbox(text,integer) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.request_claim_outbox(text,integer) to service_role';end if;end $$;

create or replace function private.request_complete_outbox(p_outbox_id uuid,p_claim_token uuid,p_destination_receipt text default null)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_org uuid;v_clock timestamptz:=statement_timestamp();v_key text;
begin
 if p_claim_token is null then raise exception 'claim token is required';end if;
 update private.request_outbox o set status='dispatched',dispatched_at=v_clock,destination_receipt=nullif(left(trim(coalesce(p_destination_receipt,'')),500),''),claim_token=null,claimed_at=null,last_error=null
 where o.id=p_outbox_id and o.status='processing' and o.claim_token=p_claim_token
 returning o.organization_id,o.destination_command_key into v_org,v_key;
 if not found then raise exception 'outbox claim is stale or invalid' using errcode='40001';end if;
 insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
 values(v_org,null,'request_outbox_dispatched','request_outbox',p_outbox_id::text,jsonb_build_object('destinationCommandKey',v_key,'serverClock',v_clock));
 return true;
end $$;
revoke all on function private.request_complete_outbox(uuid,uuid,text) from public,anon,authenticated;
create or replace function public.request_complete_outbox(p_outbox_id uuid,p_claim_token uuid,p_destination_receipt text default null)
returns boolean language sql security definer set search_path='' as $$ select private.request_complete_outbox(p_outbox_id,p_claim_token,p_destination_receipt) $$;
revoke all on function public.request_complete_outbox(uuid,uuid,text) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.request_complete_outbox(uuid,uuid,text) to service_role';end if;end $$;

create or replace function private.request_fail_outbox(p_outbox_id uuid,p_claim_token uuid,p_error text)
returns text language plpgsql security definer set search_path=''
as $$
declare v_row private.request_outbox%rowtype;v_clock timestamptz:=statement_timestamp();v_next text;v_delay interval;
begin
 if p_claim_token is null then raise exception 'claim token is required';end if;
 select * into v_row from private.request_outbox o where o.id=p_outbox_id and o.status='processing' and o.claim_token=p_claim_token for update;
 if not found then raise exception 'outbox claim is stale or invalid' using errcode='40001';end if;
 if v_row.attempts>=5 then v_next:='dead_letter';v_delay:=interval '0';else v_next:='failed';v_delay:=make_interval(secs=>least(3600,60*(2^greatest(v_row.attempts-1,0))::integer));end if;
 update private.request_outbox set status=v_next,available_at=v_clock+v_delay,last_error=left(coalesce(nullif(trim(p_error),''),'delivery failed'),1000),dead_lettered_at=case when v_next='dead_letter' then v_clock else null end,claim_token=null,claimed_at=null where id=p_outbox_id;
 insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
 values(v_row.organization_id,null,case when v_next='dead_letter' then 'request_outbox_dead_lettered' else 'request_outbox_retry_scheduled' end,'request_outbox',p_outbox_id::text,
 jsonb_build_object('destinationCommandKey',v_row.destination_command_key,'attempts',v_row.attempts,'nextState',v_next,'availableAt',v_clock+v_delay,'serverClock',v_clock));
 return v_next;
end $$;
revoke all on function private.request_fail_outbox(uuid,uuid,text) from public,anon,authenticated;
create or replace function public.request_fail_outbox(p_outbox_id uuid,p_claim_token uuid,p_error text)
returns text language sql security definer set search_path='' as $$ select private.request_fail_outbox(p_outbox_id,p_claim_token,p_error) $$;
revoke all on function public.request_fail_outbox(uuid,uuid,text) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.request_fail_outbox(uuid,uuid,text) to service_role';end if;end $$;

create or replace function private.request_replay_dead_letter(p_organization_id uuid,p_outbox_id uuid,p_idempotency_key text,p_reason text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_row private.request_outbox%rowtype;v_clock timestamptz:=statement_timestamp();v_before integer;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;
 if p_organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;
 if not private.has_org_capability(p_organization_id,'requests_workflow','configure') then raise exception 'requests_workflow configure capability required' using errcode='42501';end if;
 if char_length(trim(coalesce(p_idempotency_key,''))) not between 8 and 200 then raise exception 'replay idempotency_key must be between 8 and 200 characters';end if;
 select * into v_row from private.request_outbox o where o.id=p_outbox_id and o.organization_id=p_organization_id for update;
 if not found then raise exception 'outbox item not found';end if;
 if v_row.last_replay_key=trim(p_idempotency_key) then return true;end if;
 if v_row.status<>'dead_letter' then raise exception 'only dead-letter outbox items can be replayed';end if;
 v_before:=v_row.attempts;
 update private.request_outbox set status='pending',attempts=0,available_at=v_clock,last_error=null,dead_lettered_at=null,claim_token=null,claimed_at=null,replay_count=replay_count+1,last_replay_key=trim(p_idempotency_key) where id=p_outbox_id;
 insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data)
 values(p_organization_id,auth.uid(),'request_outbox_replayed','request_outbox',p_outbox_id::text,jsonb_build_object('status','dead_letter','attempts',v_before),
 jsonb_build_object('status','pending','destinationCommandKey',v_row.destination_command_key,'reason',left(coalesce(p_reason,''),500),'serverClock',v_clock,'idempotencyKey',trim(p_idempotency_key)));
 return true;
end $$;
revoke all on function private.request_replay_dead_letter(uuid,uuid,text,text) from public,anon;
grant execute on function private.request_replay_dead_letter(uuid,uuid,text,text) to authenticated;
create or replace function public.request_replay_dead_letter(p_organization_id uuid,p_outbox_id uuid,p_idempotency_key text,p_reason text default null)
returns boolean language sql security invoker set search_path='' as $$ select private.request_replay_dead_letter(p_organization_id,p_outbox_id,p_idempotency_key,p_reason) $$;
revoke all on function public.request_replay_dead_letter(uuid,uuid,text,text) from public,anon;
grant execute on function public.request_replay_dead_letter(uuid,uuid,text,text) to authenticated;

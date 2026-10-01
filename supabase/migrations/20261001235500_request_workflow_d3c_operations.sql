-- Slice D3c: request SLA/escalation evidence, explicit delegation/substitution, and transactional cross-module outbox.

alter table private.request_step_instances add column if not exists sla_hours integer check(sla_hours is null or sla_hours between 1 and 8760);
alter table private.request_step_instances add column if not exists due_at timestamptz;
alter table private.request_step_instances add column if not exists escalated_at timestamptz;
alter table private.request_step_instances add column if not exists escalation_level integer not null default 0 check(escalation_level between 0 and 20);
alter table private.request_step_votes add column if not exists delegated_from_user_id uuid references public.profiles(id) on delete set null;
create index if not exists request_step_votes_delegated_from_idx on private.request_step_votes(delegated_from_user_id) where delegated_from_user_id is not null;
create index if not exists request_step_instances_due_idx on private.request_step_instances(organization_id,due_at) where state='active' and due_at is not null;

create table if not exists private.request_delegations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 from_user_id uuid not null references public.profiles(id) on delete cascade,to_user_id uuid not null references public.profiles(id) on delete cascade,
 capability text not null check(capability in ('approve','edit','configure')),valid_from timestamptz not null,valid_to timestamptz not null,
 reason text,created_by uuid not null references public.profiles(id) on delete restrict,revoked_at timestamptz,created_at timestamptz not null default now(),
 check(from_user_id<>to_user_id),check(valid_to>valid_from),check(char_length(coalesce(reason,''))<=500)
);
create index if not exists request_delegations_org_to_idx on private.request_delegations(organization_id,to_user_id,capability,valid_from,valid_to) where revoked_at is null;
create index if not exists request_delegations_from_idx on private.request_delegations(from_user_id,organization_id) where revoked_at is null;
create index if not exists request_delegations_created_by_idx on private.request_delegations(created_by);
revoke all on private.request_delegations from public,anon,authenticated;

create table if not exists private.request_outbox(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 request_instance_id uuid not null references public.request_instances(id) on delete cascade,event_key text not null,
 target_module text not null,action_key text not null,payload jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check(status in ('pending','processing','dispatched','failed')),
 attempts integer not null default 0 check(attempts between 0 and 100),available_at timestamptz not null default now(),
 last_error text,created_at timestamptz not null default now(),dispatched_at timestamptz,
 unique(request_instance_id,event_key,target_module,action_key)
);
create index if not exists request_outbox_org_status_idx on private.request_outbox(organization_id,status,available_at);
create index if not exists request_outbox_request_idx on private.request_outbox(request_instance_id,created_at);
revoke all on private.request_outbox from public,anon,authenticated;

create or replace function private.user_has_org_capability(p_organization_id uuid,p_user_id uuid,p_module_key text,p_capability text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=p_user_id and m.status='active' and (
  (p_module_key='core' and p_capability='read') or m.is_owner or
  exists(select 1 from public.member_module_permissions p where p.organization_id=p_organization_id and p.member_id=m.id and (p.module_key=p_module_key or p.module_key='full_suite') and p_capability=any(p.capabilities)) or
  exists(select 1 from public.organization_member_roles mr join public.organization_roles r on r.id=mr.role_id and r.organization_id=mr.organization_id and r.active join public.organization_role_permissions rp on rp.role_id=r.id and rp.organization_id=r.organization_id where mr.organization_id=p_organization_id and mr.member_id=m.id and mr.active and (rp.module_key=p_module_key or rp.module_key='full_suite') and p_capability=any(rp.capabilities))
 ))
$$;
revoke all on function private.user_has_org_capability(uuid,uuid,text,text) from public,anon,authenticated;

create or replace function private.request_valid_delegator(p_organization_id uuid,p_to_user_id uuid,p_capability text,p_at timestamptz default now())
returns uuid language sql stable security definer set search_path=''
as $$
 select d.from_user_id from private.request_delegations d where d.organization_id=p_organization_id and d.to_user_id=p_to_user_id and d.capability=p_capability and d.revoked_at is null and d.valid_from<=p_at and d.valid_to>p_at and private.user_has_org_capability(p_organization_id,d.from_user_id,'requests_workflow',p_capability) order by d.valid_to,d.created_at limit 1
$$;
revoke all on function private.request_valid_delegator(uuid,uuid,text,timestamptz) from public,anon,authenticated;

create or replace function private.request_create_delegation(p_organization_id uuid,p_to_user_id uuid,p_capability text,p_valid_from timestamptz,p_valid_to timestamptz,p_reason text default null)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid;v_cap text;begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;
 if p_organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;
 if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501';end if;
 v_cap:=lower(trim(coalesce(p_capability,'')));if v_cap not in('approve','edit','configure') then raise exception 'delegation capability is not allowed';end if;
 if not private.has_org_capability(p_organization_id,'requests_workflow',v_cap) then raise exception 'cannot delegate a capability you do not hold' using errcode='42501';end if;
 if p_to_user_id=auth.uid() then raise exception 'cannot delegate to self';end if;
 if not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=p_to_user_id and m.status='active') then raise exception 'delegate target must be an active organization member';end if;
 if p_valid_from is null or p_valid_to is null or p_valid_to<=p_valid_from or p_valid_to>p_valid_from+interval '90 days' then raise exception 'delegation window must be positive and no longer than 90 days';end if;
 insert into private.request_delegations(organization_id,from_user_id,to_user_id,capability,valid_from,valid_to,reason,created_by) values(p_organization_id,auth.uid(),p_to_user_id,v_cap,p_valid_from,p_valid_to,nullif(trim(p_reason),''),auth.uid()) returning id into v_id;
 insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,after_data) values(p_organization_id,auth.uid(),'request_delegation_created','request_delegation',v_id::text,jsonb_build_object('toUserId',p_to_user_id,'capability',v_cap,'validFrom',p_valid_from,'validTo',p_valid_to));
 return v_id;
end $$;
revoke all on function private.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text) from public,anon;
grant execute on function private.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;
create or replace function public.request_create_delegation(p_organization_id uuid,p_to_user_id uuid,p_capability text,p_valid_from timestamptz,p_valid_to timestamptz,p_reason text default null) returns uuid language sql security invoker set search_path='' as $$ select private.request_create_delegation(p_organization_id,p_to_user_id,p_capability,p_valid_from,p_valid_to,p_reason) $$;
revoke all on function public.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text) from public,anon;grant execute on function public.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;

create or replace function private.request_revoke_delegation(p_organization_id uuid,p_delegation_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$ declare v_from uuid;begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;
 if p_organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;
 select from_user_id into v_from from private.request_delegations where id=p_delegation_id and organization_id=p_organization_id for update;if not found then raise exception 'delegation not found';end if;
 if v_from<>auth.uid() and not private.has_org_capability(p_organization_id,'requests_workflow','configure') then raise exception 'delegation revoke denied' using errcode='42501';end if;
 update private.request_delegations set revoked_at=coalesce(revoked_at,now()) where id=p_delegation_id;
 insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id) values(p_organization_id,auth.uid(),'request_delegation_revoked','request_delegation',p_delegation_id::text);
 return true;
end $$;
revoke all on function private.request_revoke_delegation(uuid,uuid) from public,anon;grant execute on function private.request_revoke_delegation(uuid,uuid) to authenticated;
create or replace function public.request_revoke_delegation(p_organization_id uuid,p_delegation_id uuid) returns boolean language sql security invoker set search_path='' as $$ select private.request_revoke_delegation(p_organization_id,p_delegation_id) $$;
revoke all on function public.request_revoke_delegation(uuid,uuid) from public,anon;grant execute on function public.request_revoke_delegation(uuid,uuid) to authenticated;

create or replace function private.request_list_delegations(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_result jsonb;begin
 if auth.uid() is null or p_organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'fromUserId',d.from_user_id,'toUserId',d.to_user_id,'capability',d.capability,'validFrom',d.valid_from,'validTo',d.valid_to,'reason',d.reason,'revokedAt',d.revoked_at,'active',(d.revoked_at is null and d.valid_from<=now() and d.valid_to>now())) order by d.created_at desc),'[]'::jsonb) into v_result from private.request_delegations d where d.organization_id=p_organization_id and (d.from_user_id=auth.uid() or d.to_user_id=auth.uid() or private.has_org_capability(p_organization_id,'requests_workflow','configure'));
 return v_result;
end $$;
revoke all on function private.request_list_delegations(uuid) from public,anon;grant execute on function private.request_list_delegations(uuid) to authenticated;
create or replace function public.request_list_delegations(p_organization_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.request_list_delegations(p_organization_id) $$;
revoke all on function public.request_list_delegations(uuid) from public,anon;grant execute on function public.request_list_delegations(uuid) to authenticated;

create or replace function private.validate_request_workflow_schema(p_schema jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare v_version integer;v_steps jsonb;v_step jsonb;v_key text;v_mode text;v_required integer;v_cap text;v_seen text[]:=array[]::text[];v_sla integer;v_actions jsonb;v_action jsonb;v_target text;v_action_key text;
begin
 if jsonb_typeof(coalesce(p_schema,'{}'::jsonb))<>'object' then raise exception 'workflow schema must be a JSON object';end if;
 begin v_version:=coalesce((p_schema->>'schemaVersion')::integer,1);exception when others then raise exception 'workflow schema version must be an integer';end;
 if v_version=1 then return;end if;if v_version<>2 then raise exception 'unsupported request workflow schema version';end if;
 v_steps:=p_schema->'steps';if jsonb_typeof(v_steps)<>'array' or jsonb_array_length(v_steps)<1 or jsonb_array_length(v_steps)>50 then raise exception 'D3 workflow requires between 1 and 50 steps';end if;
 for v_step in select value from jsonb_array_elements(v_steps) loop
  if jsonb_typeof(v_step)<>'object' then raise exception 'workflow step must be an object';end if;v_key:=lower(trim(coalesce(v_step->>'key','')));if v_key='' or v_key!~'^[a-z][a-z0-9_]{0,63}$' then raise exception 'workflow step key is invalid';end if;if v_key=any(v_seen) then raise exception 'workflow step keys must be unique';end if;v_seen:=array_append(v_seen,v_key);if nullif(trim(v_step->>'title'),'') is null then raise exception 'workflow step title is required';end if;
  v_mode:=lower(trim(coalesce(v_step->>'mode','sequential')));if v_mode not in('sequential','parallel') then raise exception 'workflow step mode must be sequential or parallel';end if;begin v_required:=coalesce((v_step->>'requiredApprovals')::integer,1);exception when others then raise exception 'requiredApprovals must be an integer';end;if v_required<1 or v_required>20 then raise exception 'requiredApprovals must be between 1 and 20';end if;if v_mode='sequential' and v_required<>1 then raise exception 'sequential step requires exactly one approval';end if;if v_mode='parallel' and v_required<2 then raise exception 'parallel step requires at least two approvals';end if;
  v_cap:=lower(trim(coalesce(v_step->>'requiredCapability','approve')));if v_cap not in('approve','edit','configure') then raise exception 'workflow step capability is not allowed';end if;if v_step?'condition' then perform private.validate_request_condition(v_step->'condition');end if;
  if v_step?'slaHours' then begin v_sla:=(v_step->>'slaHours')::integer;exception when others then raise exception 'slaHours must be an integer';end;if v_sla<1 or v_sla>8760 then raise exception 'slaHours must be between 1 and 8760';end if;end if;
 end loop;
 if p_schema?'onApproved' then v_actions:=p_schema->'onApproved';if jsonb_typeof(v_actions)<>'array' or jsonb_array_length(v_actions)>10 then raise exception 'onApproved must be an array with at most 10 actions';end if;for v_action in select value from jsonb_array_elements(v_actions) loop if jsonb_typeof(v_action)<>'object' then raise exception 'outbox action must be an object';end if;if exists(select 1 from jsonb_object_keys(v_action) as k(key) where key not in('targetModule','actionKey','payload')) then raise exception 'outbox action contains unsupported keys';end if;v_target:=lower(trim(coalesce(v_action->>'targetModule','')));if v_target not in('accounting','commerce','treasury','contracting','inventory','assets','hr_payroll','office_automation','crm','transport','manufacturing','maintenance','group_consolidation','analytics') then raise exception 'outbox targetModule is not allowed';end if;v_action_key:=lower(trim(coalesce(v_action->>'actionKey','')));if v_action_key!~'^[a-z][a-z0-9_]{1,63}$' then raise exception 'outbox actionKey is invalid';end if;if v_action?'payload' and jsonb_typeof(v_action->'payload')<>'object' then raise exception 'outbox payload must be an object';end if;if octet_length(coalesce((v_action->'payload')::text,'{}'))>8192 then raise exception 'outbox payload is too large';end if;end loop;end if;
end $$;
revoke all on function private.validate_request_workflow_schema(jsonb) from public,anon,authenticated;

create or replace function private.enqueue_request_outbox(p_request_instance_id uuid,p_workflow_schema jsonb,p_revision bigint)
returns integer language plpgsql security definer set search_path=''
as $$ declare v_action jsonb;v_org uuid;v_count integer:=0;begin
 select organization_id into v_org from public.request_instances where id=p_request_instance_id;if v_org is null then raise exception 'request instance not found';end if;
 if jsonb_typeof(p_workflow_schema->'onApproved')<>'array' then return 0;end if;
 for v_action in select value from jsonb_array_elements(p_workflow_schema->'onApproved') loop insert into private.request_outbox(organization_id,request_instance_id,event_key,target_module,action_key,payload) values(v_org,p_request_instance_id,'approved:'||p_revision::text,lower(trim(v_action->>'targetModule')),lower(trim(v_action->>'actionKey')),jsonb_build_object('requestInstanceId',p_request_instance_id,'requestRevision',p_revision,'config',coalesce(v_action->'payload','{}'::jsonb))) on conflict(request_instance_id,event_key,target_module,action_key) do nothing;if found then v_count:=v_count+1;end if;end loop;return v_count;
end $$;
revoke all on function private.enqueue_request_outbox(uuid,jsonb,bigint) from public,anon,authenticated;

create or replace function private.request_create_instance(p_organization_id uuid,p_request_type_version_id uuid,p_values jsonb,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_existing uuid;v_workflow uuid;v_id uuid;v_schema jsonb;v_step jsonb;v_ord bigint;v_match boolean;v_activated integer;v_sla integer;begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;if p_organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501';end if;if not private.has_org_capability(p_organization_id,'requests_workflow','create') then raise exception 'requests_workflow create capability required' using errcode='42501';end if;if char_length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'idempotency_key is required';end if;
 select id into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;if found then return v_existing;end if;select w.id,w.workflow_schema into v_workflow,v_schema from public.request_workflow_versions w join public.request_type_versions v on v.id=w.request_type_version_id where w.organization_id=p_organization_id and v.organization_id=p_organization_id and v.id=p_request_type_version_id;if v_workflow is null then raise exception 'published request type version not found';end if;perform private.validate_request_workflow_schema(coalesce(v_schema,'{}'::jsonb));
 insert into public.request_instances(organization_id,request_type_version_id,workflow_version_id,requester_user_id,values_json,status,revision,idempotency_key) values(p_organization_id,p_request_type_version_id,v_workflow,auth.uid(),coalesce(p_values,'{}'::jsonb),'submitted',1,p_idempotency_key) returning id into v_id;insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,idempotency_key) values(p_organization_id,v_id,auth.uid(),'create',null,'submitted',1,'create:'||p_idempotency_key);
 if coalesce((v_schema->>'schemaVersion')::integer,1)=2 then for v_step,v_ord in select value,ordinality from jsonb_array_elements(v_schema->'steps') with ordinality loop v_match:=private.evaluate_request_condition(v_step->'condition',coalesce(p_values,'{}'::jsonb));v_sla:=case when v_step?'slaHours' then (v_step->>'slaHours')::integer else null end;insert into private.request_step_instances(organization_id,request_instance_id,workflow_version_id,step_key,step_title,step_index,mode,required_approvals,required_capability,state,activated_at,condition_json,condition_matched,sla_hours) values(p_organization_id,v_id,v_workflow,lower(trim(v_step->>'key')),trim(v_step->>'title'),v_ord::integer,lower(trim(coalesce(v_step->>'mode','sequential'))),coalesce((v_step->>'requiredApprovals')::integer,1),lower(trim(coalesce(v_step->>'requiredCapability','approve'))),case when v_match then 'pending' else 'skipped' end,null,v_step->'condition',v_match,v_sla);end loop;
  with first_pending as(select id from private.request_step_instances where request_instance_id=v_id and state='pending' order by step_index limit 1) update private.request_step_instances s set state='active',activated_at=now(),due_at=case when s.sla_hours is null then null else now()+make_interval(hours=>s.sla_hours) end from first_pending f where s.id=f.id;get diagnostics v_activated=row_count;
  if v_activated=0 then update public.request_instances set status='approved',revision=2,updated_at=now() where id=v_id;insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,idempotency_key) values(p_organization_id,v_id,auth.uid(),'workflow_auto_complete','submitted','approved',2,'auto:'||p_idempotency_key);perform private.enqueue_request_outbox(v_id,v_schema,2);end if;
 end if;return v_id;
exception when unique_violation then select id into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;if v_existing is not null then return v_existing;end if;raise;end $$;
revoke all on function private.request_create_instance(uuid,uuid,jsonb,text) from public,anon;grant execute on function private.request_create_instance(uuid,uuid,jsonb,text) to authenticated;

create or replace function private.request_step_decide(p_request_instance_id uuid,p_decision text,p_expected_revision bigint,p_idempotency_key text,p_note text default null)
returns table(request_instance_id uuid,status text,revision bigint,step_key text,step_state text,approvals_received integer,approvals_required integer)
language plpgsql security definer set search_path=''
as $$ declare v_row public.request_instances%rowtype;v_step private.request_step_instances%rowtype;v_vote private.request_step_votes%rowtype;v_next private.request_step_instances%rowtype;v_decision text;v_approvals integer;v_status text;v_delegated_from uuid;v_schema jsonb;begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;if char_length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'idempotency_key is required';end if;select * into v_vote from private.request_step_votes v where v.request_instance_id=p_request_instance_id and v.idempotency_key=p_idempotency_key;if found then select * into v_row from public.request_instances r where r.id=p_request_instance_id;select * into v_step from private.request_step_instances s where s.id=v_vote.step_instance_id;select count(*)::integer into v_approvals from private.request_step_votes x where x.step_instance_id=v_step.id and x.decision='approve';return query select v_row.id,v_row.status,v_row.revision,v_step.step_key,v_step.state,v_approvals,v_step.required_approvals;return;end if;
 select * into v_row from public.request_instances r where r.id=p_request_instance_id for update;if not found then raise exception 'request instance not found';end if;if v_row.organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;if not private.organization_has_module_entitlement(v_row.organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501';end if;if p_expected_revision is null or p_expected_revision<>v_row.revision then raise exception 'stale revision';end if;if v_row.status in('approved','rejected','cancelled') then raise exception 'terminal request cannot transition';end if;select * into v_step from private.request_step_instances s where s.request_instance_id=v_row.id and s.state='active' order by s.step_index limit 1 for update;if not found then raise exception 'active workflow step not found';end if;
 if not private.has_org_capability(v_row.organization_id,'requests_workflow',v_step.required_capability) then v_delegated_from:=private.request_valid_delegator(v_row.organization_id,auth.uid(),v_step.required_capability,now());if v_delegated_from is null then raise exception 'active step capability or valid delegation required' using errcode='42501';end if;end if;
 v_decision:=lower(trim(coalesce(p_decision,'')));if v_decision not in('approve','reject') then raise exception 'unsupported step decision';end if;begin insert into private.request_step_votes(organization_id,request_instance_id,step_instance_id,actor_user_id,decision,note,idempotency_key,delegated_from_user_id) values(v_row.organization_id,v_row.id,v_step.id,auth.uid(),v_decision,p_note,p_idempotency_key,v_delegated_from) returning * into v_vote;exception when unique_violation then if exists(select 1 from private.request_step_votes x where x.step_instance_id=v_step.id and x.actor_user_id=auth.uid()) then raise exception 'actor already decided this step';end if;raise;end;
 if v_decision='reject' then update private.request_step_instances set state='rejected',completed_at=now() where id=v_step.id returning * into v_step;v_status:='rejected';else select count(*)::integer into v_approvals from private.request_step_votes x where x.step_instance_id=v_step.id and x.decision='approve';if v_approvals>=v_step.required_approvals then update private.request_step_instances set state='completed',completed_at=now() where id=v_step.id returning * into v_step;select * into v_next from private.request_step_instances s where s.request_instance_id=v_row.id and s.state='pending' and s.step_index>v_step.step_index order by s.step_index limit 1 for update;if found then update private.request_step_instances set state='active',activated_at=now(),due_at=case when sla_hours is null then null else now()+make_interval(hours=>sla_hours) end where id=v_next.id;v_status:='submitted';else v_status:='approved';end if;else v_status:='submitted';end if;end if;
 update public.request_instances as ri set status=v_status,revision=ri.revision+1,updated_at=now() where ri.id=v_row.id returning ri.* into v_row;insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,note,idempotency_key) values(v_row.organization_id,v_row.id,auth.uid(),'step_'||v_decision||':'||v_step.step_key,'submitted',v_status,v_row.revision,p_note,p_idempotency_key);if v_status='approved' then select workflow_schema into v_schema from public.request_workflow_versions where id=v_row.workflow_version_id;perform private.enqueue_request_outbox(v_row.id,coalesce(v_schema,'{}'::jsonb),v_row.revision);end if;select count(*)::integer into v_approvals from private.request_step_votes x where x.step_instance_id=v_step.id and x.decision='approve';return query select v_row.id,v_row.status,v_row.revision,v_step.step_key,v_step.state,v_approvals,v_step.required_approvals;
end $$;
revoke all on function private.request_step_decide(uuid,text,bigint,text,text) from public,anon;grant execute on function private.request_step_decide(uuid,text,bigint,text,text) to authenticated;

create or replace function private.request_escalate_overdue(p_organization_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$ declare v_step private.request_step_instances%rowtype;v_revision bigint;v_status text;v_count integer:=0;begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;if p_organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) or not private.has_org_capability(p_organization_id,'requests_workflow','configure') then raise exception 'requests_workflow configure capability required' using errcode='42501';end if;
 for v_step in select * from private.request_step_instances s where s.organization_id=p_organization_id and s.state='active' and s.due_at is not null and s.due_at<now() and s.escalated_at is null order by s.due_at for update skip locked loop update private.request_step_instances set escalated_at=now(),escalation_level=escalation_level+1 where id=v_step.id;select revision,status into v_revision,v_status from public.request_instances where id=v_step.request_instance_id;insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,note,idempotency_key) values(p_organization_id,v_step.request_instance_id,auth.uid(),'step_escalated:'||v_step.step_key,v_status,v_status,v_revision,'SLA overdue','escalate:'||v_step.id::text||':1') on conflict(request_instance_id,idempotency_key) do nothing;v_count:=v_count+1;end loop;return v_count;
end $$;
revoke all on function private.request_escalate_overdue(uuid) from public,anon;grant execute on function private.request_escalate_overdue(uuid) to authenticated;
create or replace function public.request_escalate_overdue(p_organization_id uuid) returns integer language sql security invoker set search_path='' as $$ select private.request_escalate_overdue(p_organization_id) $$;
revoke all on function public.request_escalate_overdue(uuid) from public,anon;grant execute on function public.request_escalate_overdue(uuid) to authenticated;

create or replace function private.request_outbox_status(p_request_instance_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_row public.request_instances%rowtype;v_result jsonb;begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;select * into v_row from public.request_instances where id=p_request_instance_id;if not found then raise exception 'request instance not found';end if;if v_row.organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;if v_row.requester_user_id<>auth.uid() and not private.has_org_capability(v_row.organization_id,'requests_workflow','approve') and not private.has_org_capability(v_row.organization_id,'requests_workflow','edit') and not private.has_org_capability(v_row.organization_id,'requests_workflow','configure') then raise exception 'request outbox access denied' using errcode='42501';end if;select coalesce(jsonb_agg(jsonb_build_object('targetModule',o.target_module,'actionKey',o.action_key,'status',o.status,'attempts',o.attempts,'availableAt',o.available_at,'createdAt',o.created_at,'dispatchedAt',o.dispatched_at,'lastError',o.last_error) order by o.created_at),'[]'::jsonb) into v_result from private.request_outbox o where o.request_instance_id=v_row.id;return v_result;
end $$;
revoke all on function private.request_outbox_status(uuid) from public,anon;grant execute on function private.request_outbox_status(uuid) to authenticated;
create or replace function public.request_outbox_status(p_request_instance_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.request_outbox_status(p_request_instance_id) $$;
revoke all on function public.request_outbox_status(uuid) from public,anon;grant execute on function public.request_outbox_status(uuid) to authenticated;

create or replace function private.request_workflow_timeline(p_request_instance_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_row public.request_instances%rowtype;v_steps jsonb;v_events jsonb;begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;select * into v_row from public.request_instances r where r.id=p_request_instance_id;if not found then raise exception 'request instance not found';end if;if v_row.organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;if not private.organization_has_module_entitlement(v_row.organization_id,'requests_workflow',false) then raise exception 'requests_workflow entitlement required' using errcode='42501';end if;if v_row.requester_user_id<>auth.uid() and not private.has_org_capability(v_row.organization_id,'requests_workflow','approve') and not private.has_org_capability(v_row.organization_id,'requests_workflow','edit') and private.request_valid_delegator(v_row.organization_id,auth.uid(),'approve',now()) is null and private.request_valid_delegator(v_row.organization_id,auth.uid(),'edit',now()) is null and private.request_valid_delegator(v_row.organization_id,auth.uid(),'configure',now()) is null then raise exception 'request timeline access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('key',s.step_key,'title',s.step_title,'index',s.step_index,'mode',s.mode,'state',s.state,'requiredApprovals',s.required_approvals,'approvalsReceived',(select count(*) from private.request_step_votes v where v.step_instance_id=s.id and v.decision='approve'),'requiredCapability',s.required_capability,'condition',s.condition_json,'conditionMatched',s.condition_matched,'slaHours',s.sla_hours,'activatedAt',s.activated_at,'dueAt',s.due_at,'escalatedAt',s.escalated_at,'escalationLevel',s.escalation_level,'completedAt',s.completed_at,'votes',(select coalesce(jsonb_agg(jsonb_build_object('actorUserId',v.actor_user_id,'delegatedFromUserId',v.delegated_from_user_id,'decision',v.decision,'createdAt',v.created_at) order by v.created_at),'[]'::jsonb) from private.request_step_votes v where v.step_instance_id=s.id)) order by s.step_index),'[]'::jsonb) into v_steps from private.request_step_instances s where s.request_instance_id=v_row.id;
 select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'fromStatus',e.from_status,'toStatus',e.to_status,'revision',e.revision,'note',e.note,'createdAt',e.created_at) order by e.created_at,e.id),'[]'::jsonb) into v_events from public.request_instance_events e where e.request_instance_id=v_row.id and e.organization_id=v_row.organization_id;return jsonb_build_object('request',jsonb_build_object('id',v_row.id,'status',v_row.status,'revision',v_row.revision,'createdAt',v_row.created_at,'updatedAt',v_row.updated_at),'steps',v_steps,'events',v_events);
end $$;
revoke all on function private.request_workflow_timeline(uuid) from public,anon;grant execute on function private.request_workflow_timeline(uuid) to authenticated;

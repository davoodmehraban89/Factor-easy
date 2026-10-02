-- Wave 4 remediation: F-420 outbox intent uniqueness, F-422 delegation idempotency/overlap/revoke retry.
-- F-421 is a client binding fix archived in js/request-workflow-d3c.js.
alter table private.request_delegations add column if not exists idempotency_key text;
alter table private.request_delegations drop constraint if exists request_delegations_idempotency_key_check;
alter table private.request_delegations add constraint request_delegations_idempotency_key_check check(idempotency_key is null or char_length(idempotency_key) between 8 and 200);
create unique index if not exists request_delegations_actor_idempotency_uidx on private.request_delegations(organization_id,from_user_id,idempotency_key) where idempotency_key is not null;

create or replace function private.validate_request_workflow_schema(p_schema jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare v_version integer;v_steps jsonb;v_step jsonb;v_key text;v_mode text;v_required integer;v_cap text;v_seen text[]:=array[]::text[];v_sla integer;v_actions jsonb;v_action jsonb;v_target text;v_action_key text;v_action_identity text;v_action_seen text[]:=array[]::text[];
begin
 if jsonb_typeof(coalesce(p_schema,'{}'::jsonb))<>'object' then raise exception 'workflow schema must be a JSON object';end if;
 begin v_version:=coalesce((p_schema->>'schemaVersion')::integer,1);exception when others then raise exception 'workflow schema version must be an integer';end;
 if v_version=1 then return;end if;if v_version<>2 then raise exception 'unsupported request workflow schema version';end if;
 v_steps:=p_schema->'steps';if jsonb_typeof(v_steps)<>'array' or jsonb_array_length(v_steps)<1 or jsonb_array_length(v_steps)>50 then raise exception 'D3 workflow requires between 1 and 50 steps';end if;
 for v_step in select value from jsonb_array_elements(v_steps) loop
  if jsonb_typeof(v_step)<>'object' then raise exception 'workflow step must be an object';end if;v_key:=lower(trim(coalesce(v_step->>'key','')));if v_key='' or v_key!~'^[a-z][a-z0-9_]{0,63}$' then raise exception 'workflow step key is invalid';end if;if v_key=any(v_seen) then raise exception 'workflow step keys must be unique';end if;v_seen:=array_append(v_seen,v_key);if nullif(trim(v_step->>'title'),'') is null then raise exception 'workflow step title is required';end if;
  v_mode:=lower(trim(coalesce(v_step->>'mode','sequential')));if v_mode not in('sequential','parallel') then raise exception 'workflow step mode must be sequential or parallel';end if;begin v_required:=coalesce((v_step->>'requiredApprovals')::integer,1);exception when others then raise exception 'requiredApprovals must be an integer';end;if v_required<1 or v_required>20 then raise exception 'requiredApprovals must be between 1 and 20';end if;if v_mode='sequential' and v_required<>1 then raise exception 'sequential step requires exactly one approval';end if;if v_mode='parallel' and v_required<2 then raise exception 'parallel step requires at least two approvals';end if;
  v_cap:=lower(trim(coalesce(v_step->>'requiredCapability','approve')));if v_cap not in('approve','edit','configure') then raise exception 'workflow step capability is not allowed';end if;if v_step?'condition' then perform private.validate_request_condition(v_step->'condition');end if;if v_step?'slaHours' then begin v_sla:=(v_step->>'slaHours')::integer;exception when others then raise exception 'slaHours must be an integer';end;if v_sla<1 or v_sla>8760 then raise exception 'slaHours must be between 1 and 8760';end if;end if;
 end loop;
 if p_schema?'onApproved' then
  v_actions:=p_schema->'onApproved';if jsonb_typeof(v_actions)<>'array' or jsonb_array_length(v_actions)>10 then raise exception 'onApproved must be an array with at most 10 actions';end if;
  for v_action in select value from jsonb_array_elements(v_actions) loop
   if jsonb_typeof(v_action)<>'object' then raise exception 'outbox action must be an object';end if;if exists(select 1 from jsonb_object_keys(v_action) as k(key) where key not in('targetModule','actionKey','payload')) then raise exception 'outbox action contains unsupported keys';end if;
   v_target:=lower(trim(coalesce(v_action->>'targetModule','')));if v_target not in('accounting','commerce','treasury','contracting','inventory','assets','hr_payroll','office_automation','crm','transport','manufacturing','maintenance','group_consolidation','analytics') then raise exception 'outbox targetModule is not allowed';end if;
   v_action_key:=lower(trim(coalesce(v_action->>'actionKey','')));if v_action_key!~'^[a-z][a-z0-9_]{1,63}$' then raise exception 'outbox actionKey is invalid';end if;v_action_identity:=v_target||':'||v_action_key;if v_action_identity=any(v_action_seen) then raise exception 'duplicate outbox target/action intent is not allowed';end if;v_action_seen:=array_append(v_action_seen,v_action_identity);
   if v_action?'payload' and jsonb_typeof(v_action->'payload')<>'object' then raise exception 'outbox payload must be an object';end if;if octet_length(coalesce((v_action->'payload')::text,'{}'))>8192 then raise exception 'outbox payload is too large';end if;
  end loop;
 end if;
end $$;
revoke all on function private.validate_request_workflow_schema(jsonb) from public,anon,authenticated;

create or replace function private.request_create_delegation(p_organization_id uuid,p_to_user_id uuid,p_capability text,p_valid_from timestamptz,p_valid_to timestamptz,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_cap text;v_reason text;v_existing private.request_delegations%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;if p_organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501';end if;
 v_cap:=lower(trim(coalesce(p_capability,'')));v_reason:=nullif(trim(p_reason),'');if v_cap not in('approve','edit','configure') then raise exception 'delegation capability is not allowed';end if;if not private.has_org_capability(p_organization_id,'requests_workflow',v_cap) then raise exception 'cannot delegate a capability you do not hold' using errcode='42501';end if;if p_to_user_id=auth.uid() then raise exception 'cannot delegate to self';end if;if not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=p_to_user_id and m.status='active') then raise exception 'delegate target must be an active organization member';end if;if p_valid_from is null or p_valid_to is null or p_valid_to<=p_valid_from or p_valid_to>p_valid_from+interval '90 days' then raise exception 'delegation window must be positive and no longer than 90 days';end if;if char_length(trim(coalesce(p_idempotency_key,'')))<8 or char_length(trim(p_idempotency_key))>200 then raise exception 'delegation idempotency_key must be between 8 and 200 characters';end if;
 select * into v_existing from private.request_delegations d where d.organization_id=p_organization_id and d.from_user_id=auth.uid() and d.idempotency_key=trim(p_idempotency_key);
 if found then if v_existing.to_user_id<>p_to_user_id or v_existing.capability<>v_cap or v_existing.valid_from<>p_valid_from or v_existing.valid_to<>p_valid_to or coalesce(v_existing.reason,'')<>coalesce(v_reason,'') then raise exception 'delegation idempotency key is already bound to a different command' using errcode='23505';end if;return v_existing.id;end if;
 if exists(select 1 from private.request_delegations d where d.organization_id=p_organization_id and d.from_user_id=auth.uid() and d.capability=v_cap and d.revoked_at is null and tstzrange(d.valid_from,d.valid_to,'[)') && tstzrange(p_valid_from,p_valid_to,'[)')) then raise exception 'overlapping active delegation for this capability is not allowed' using errcode='23P01';end if;
 insert into private.request_delegations(organization_id,from_user_id,to_user_id,capability,valid_from,valid_to,reason,created_by,idempotency_key) values(p_organization_id,auth.uid(),p_to_user_id,v_cap,p_valid_from,p_valid_to,v_reason,auth.uid(),trim(p_idempotency_key)) returning id into v_id;
 insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,after_data) values(p_organization_id,auth.uid(),'request_delegation_created','request_delegation',v_id::text,jsonb_build_object('toUserId',p_to_user_id,'capability',v_cap,'validFrom',p_valid_from,'validTo',p_valid_to,'idempotencyKey',trim(p_idempotency_key)));return v_id;
end $$;
revoke all on function private.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text,text) from public,anon;grant execute on function private.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text,text) to authenticated;
create or replace function public.request_create_delegation(p_organization_id uuid,p_to_user_id uuid,p_capability text,p_valid_from timestamptz,p_valid_to timestamptz,p_reason text,p_idempotency_key text)
returns uuid language sql security invoker set search_path='' as $$ select private.request_create_delegation(p_organization_id,p_to_user_id,p_capability,p_valid_from,p_valid_to,p_reason,p_idempotency_key) $$;
revoke all on function public.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text,text) from public,anon;grant execute on function public.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text,text) to authenticated;
revoke execute on function public.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text) from authenticated;
revoke execute on function private.request_create_delegation(uuid,uuid,text,timestamptz,timestamptz,text) from authenticated;

create or replace function private.request_revoke_delegation(p_organization_id uuid,p_delegation_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_from uuid;v_changed uuid;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;if p_organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;select from_user_id into v_from from private.request_delegations where id=p_delegation_id and organization_id=p_organization_id for update;if not found then raise exception 'delegation not found';end if;if v_from<>auth.uid() and not private.has_org_capability(p_organization_id,'requests_workflow','configure') then raise exception 'delegation revoke denied' using errcode='42501';end if;
 update private.request_delegations set revoked_at=now() where id=p_delegation_id and organization_id=p_organization_id and revoked_at is null returning id into v_changed;
 if v_changed is not null then insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id) values(p_organization_id,auth.uid(),'request_delegation_revoked','request_delegation',p_delegation_id::text);end if;return true;
end $$;
revoke all on function private.request_revoke_delegation(uuid,uuid) from public,anon;grant execute on function private.request_revoke_delegation(uuid,uuid) to authenticated;

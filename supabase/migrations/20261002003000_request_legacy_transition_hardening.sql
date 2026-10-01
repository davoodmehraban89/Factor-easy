-- Wave 1 remediation: close legacy request-transition authorization and workflow-bypass paths.
-- F-409/F-410: legacy transition RPC must never bypass D3 step runtime, and idempotent
-- replays must be authorized for the same actor before returning evidence.

create or replace function private.request_transition_instance(
  p_request_instance_id uuid,
  p_action text,
  p_expected_revision bigint,
  p_idempotency_key text,
  p_note text default null
) returns table(request_instance_id uuid,status text,revision bigint)
language plpgsql security definer set search_path=''
as $$
declare
  v_row public.request_instances%rowtype;
  v_event public.request_instance_events%rowtype;
  v_action text;
  v_next text;
  v_from text;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if char_length(trim(coalesce(p_idempotency_key,''))) < 8 then
    raise exception 'idempotency_key is required';
  end if;

  -- Lock and authorize the request before consulting idempotency evidence.  The old
  -- implementation returned an event first, which could disclose another actor's result.
  select * into v_row
  from public.request_instances r
  where r.id=p_request_instance_id
  for update;
  if not found then raise exception 'request instance not found'; end if;
  if v_row.organization_id not in (select private.current_organization_ids()) then
    raise exception 'organization access denied' using errcode='42501';
  end if;
  if not private.organization_has_module_entitlement(v_row.organization_id,'requests_workflow',true) then
    raise exception 'active requests_workflow entitlement required' using errcode='42501';
  end if;

  -- D3 workflows are governed exclusively by request_step_decide.  Keeping this legacy
  -- endpoint usable for them would let an approver skip ordered/quorum/condition controls.
  if exists(select 1 from private.request_step_instances s where s.request_instance_id=v_row.id) then
    raise exception 'legacy transition disabled for step workflow' using errcode='42501';
  end if;

  v_action:=lower(trim(coalesce(p_action,'')));
  if v_action not in ('approve','reject','return','submit','cancel') then
    raise exception 'unsupported transition action';
  end if;

  -- Decision actions require approve.  Edit alone is not an approval authority.
  if v_action in ('approve','reject','return') then
    if not private.has_org_capability(v_row.organization_id,'requests_workflow','approve') then
      raise exception 'requests_workflow approve capability required' using errcode='42501';
    end if;
  elsif v_action='submit' then
    if not (v_row.requester_user_id=auth.uid() or private.has_org_capability(v_row.organization_id,'requests_workflow','edit')) then
      raise exception 'requester or requests_workflow edit capability required' using errcode='42501';
    end if;
  else
    if not (v_row.requester_user_id=auth.uid() or private.has_org_capability(v_row.organization_id,'requests_workflow','edit')) then
      raise exception 'requester or requests_workflow edit capability required' using errcode='42501';
    end if;
  end if;

  select e.* into v_event
  from public.request_instance_events e
  where e.request_instance_id=v_row.id
    and e.organization_id=v_row.organization_id
    and e.idempotency_key=p_idempotency_key;
  if found then
    if v_event.actor_user_id<>auth.uid() or v_event.action<>v_action then
      raise exception 'idempotency key already used by another actor or action' using errcode='42501';
    end if;
    return query select v_row.id,v_event.to_status,v_event.revision;
    return;
  end if;

  if p_expected_revision is null or p_expected_revision<>v_row.revision then
    raise exception 'stale revision';
  end if;
  if v_row.status in ('approved','rejected','cancelled') then
    raise exception 'terminal request cannot transition';
  end if;

  -- Explicit legacy state machine.  In particular, a returned request cannot be approved
  -- without being resubmitted, and draft/returned requests cannot be rejected directly.
  v_next:=case
    when v_action='approve' and v_row.status='submitted' then 'approved'
    when v_action='reject' and v_row.status='submitted' then 'rejected'
    when v_action='return' and v_row.status='submitted' then 'returned'
    when v_action='submit' and v_row.status in ('draft','returned') then 'submitted'
    when v_action='cancel' and v_row.status in ('draft','submitted','returned') then 'cancelled'
    else null
  end;
  if v_next is null then raise exception 'transition not allowed from current status'; end if;

  v_from:=v_row.status;
  update public.request_instances as ri
  set status=v_next,revision=ri.revision+1,updated_at=now()
  where ri.id=v_row.id
  returning ri.* into v_row;

  insert into public.request_instance_events(
    organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,note,idempotency_key
  ) values(
    v_row.organization_id,v_row.id,auth.uid(),v_action,v_from,v_next,v_row.revision,p_note,p_idempotency_key
  );
  return query select v_row.id,v_next,v_row.revision;
end $$;

revoke all on function private.request_transition_instance(uuid,text,bigint,text,text) from public,anon;
grant execute on function private.request_transition_instance(uuid,text,bigint,text,text) to authenticated;

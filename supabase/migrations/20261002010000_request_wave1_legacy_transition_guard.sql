-- Wave 1 / F-409 + F-410
-- Re-authorize every legacy transition replay and prohibit the legacy transition API
-- from mutating requests that have D3 step-runtime state.

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
  v_next text;
  v_from text;
  v_action text;
  v_event public.request_instance_events%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if char_length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'idempotency_key is required'; end if;

  -- Lock and authorize the current caller before consulting replay evidence.
  select * into v_row from public.request_instances r where r.id=p_request_instance_id for update;
  if not found then raise exception 'request instance not found'; end if;
  if v_row.organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(v_row.organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;
  if not (private.has_org_capability(v_row.organization_id,'requests_workflow','approve') or private.has_org_capability(v_row.organization_id,'requests_workflow','edit')) then raise exception 'requests_workflow approve or edit capability required' using errcode='42501'; end if;

  -- D3 requests are exclusively mutated through request_step_decide. The legacy
  -- endpoint must never collapse quorum/step semantics into a direct status change.
  if exists(select 1 from private.request_step_instances s where s.request_instance_id=v_row.id) then
    raise exception 'D3 workflow requires request_step_decide' using errcode='55000';
  end if;

  v_action:=lower(trim(coalesce(p_action,'')));
  if v_action not in ('approve','reject','return','submit','cancel') then raise exception 'unsupported transition action'; end if;

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

  if p_expected_revision is null or p_expected_revision<>v_row.revision then raise exception 'stale revision'; end if;
  v_from:=v_row.status;
  v_next:=case v_action
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    when 'return' then 'returned'
    when 'submit' then 'submitted'
    when 'cancel' then 'cancelled'
    else null end;
  if v_next is null then raise exception 'unsupported transition action'; end if;
  if v_from in ('approved','rejected','cancelled') then raise exception 'terminal request cannot transition'; end if;

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

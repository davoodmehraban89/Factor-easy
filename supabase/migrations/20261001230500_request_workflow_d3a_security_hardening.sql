-- D3a hardening: authorize tenant/module access before idempotent replay and cover private step FK.
create index if not exists request_step_instances_organization_idx on private.request_step_instances(organization_id);

create or replace function private.request_step_decide(p_request_instance_id uuid,p_decision text,p_expected_revision bigint,p_idempotency_key text,p_note text default null)
returns table(request_instance_id uuid,status text,revision bigint,step_key text,step_state text,approvals_received integer,approvals_required integer)
language plpgsql security definer set search_path=''
as $$
declare
  v_row public.request_instances%rowtype; v_step private.request_step_instances%rowtype; v_vote private.request_step_votes%rowtype; v_next private.request_step_instances%rowtype; v_decision text; v_approvals integer; v_status text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if char_length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'idempotency_key is required'; end if;
  select * into v_row from public.request_instances r where r.id=p_request_instance_id;
  if not found then raise exception 'request instance not found'; end if;
  if v_row.organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(v_row.organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;

  select * into v_vote from private.request_step_votes v where v.request_instance_id=p_request_instance_id and v.idempotency_key=p_idempotency_key;
  if found then
    select * into v_step from private.request_step_instances s where s.id=v_vote.step_instance_id;
    select count(*)::integer into v_approvals from private.request_step_votes x where x.step_instance_id=v_step.id and x.decision='approve';
    return query select v_row.id,v_row.status,v_row.revision,v_step.step_key,v_step.state,v_approvals,v_step.required_approvals; return;
  end if;

  select * into v_row from public.request_instances r where r.id=p_request_instance_id for update;
  if p_expected_revision is null or p_expected_revision<>v_row.revision then raise exception 'stale revision'; end if;
  if v_row.status in ('approved','rejected','cancelled') then raise exception 'terminal request cannot transition'; end if;
  select * into v_step from private.request_step_instances s where s.request_instance_id=v_row.id and s.state='active' order by s.step_index limit 1 for update;
  if not found then raise exception 'active workflow step not found'; end if;
  if not private.has_org_capability(v_row.organization_id,'requests_workflow',v_step.required_capability) then raise exception 'active step capability required' using errcode='42501'; end if;
  v_decision:=lower(trim(coalesce(p_decision,'')));
  if v_decision not in ('approve','reject') then raise exception 'unsupported step decision'; end if;
  begin
    insert into private.request_step_votes(organization_id,request_instance_id,step_instance_id,actor_user_id,decision,note,idempotency_key) values(v_row.organization_id,v_row.id,v_step.id,auth.uid(),v_decision,p_note,p_idempotency_key) returning * into v_vote;
  exception when unique_violation then
    if exists(select 1 from private.request_step_votes x where x.step_instance_id=v_step.id and x.actor_user_id=auth.uid()) then raise exception 'actor already decided this step'; end if;
    raise;
  end;
  if v_decision='reject' then
    update private.request_step_instances set state='rejected',completed_at=now() where id=v_step.id returning * into v_step;
    v_status:='rejected';
  else
    select count(*)::integer into v_approvals from private.request_step_votes x where x.step_instance_id=v_step.id and x.decision='approve';
    if v_approvals>=v_step.required_approvals then
      update private.request_step_instances set state='completed',completed_at=now() where id=v_step.id returning * into v_step;
      select * into v_next from private.request_step_instances s where s.request_instance_id=v_row.id and s.state='pending' and s.step_index>v_step.step_index order by s.step_index limit 1 for update;
      if found then update private.request_step_instances set state='active',activated_at=now() where id=v_next.id; v_status:='submitted'; else v_status:='approved'; end if;
    else v_status:='submitted'; end if;
  end if;
  update public.request_instances as ri set status=v_status,revision=ri.revision+1,updated_at=now() where ri.id=v_row.id returning ri.* into v_row;
  insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,note,idempotency_key) values(v_row.organization_id,v_row.id,auth.uid(),'step_'||v_decision||':'||v_step.step_key,'submitted',v_status,v_row.revision,p_note,p_idempotency_key);
  select count(*)::integer into v_approvals from private.request_step_votes x where x.step_instance_id=v_step.id and x.decision='approve';
  return query select v_row.id,v_row.status,v_row.revision,v_step.step_key,v_step.state,v_approvals,v_step.required_approvals;
end $$;
revoke all on function private.request_step_decide(uuid,text,bigint,text,text) from public,anon;
grant execute on function private.request_step_decide(uuid,text,bigint,text,text) to authenticated;

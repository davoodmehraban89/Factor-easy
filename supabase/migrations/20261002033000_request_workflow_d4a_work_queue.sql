-- D4a: authorized approver/delegate work queue.
-- Read-only queue projection; decisions continue through request_step_decide.
create or replace function private.request_work_queue(p_organization_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',false) then raise exception 'requests_workflow entitlement required' using errcode='42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'requestInstanceId',q.request_instance_id,
    'requestTypeTitle',q.request_type_title,
    'requestTypeVersion',q.request_type_version,
    'requesterUserId',q.requester_user_id,
    'status',q.request_status,
    'revision',q.revision,
    'stepKey',q.step_key,
    'stepTitle',q.step_title,
    'requiredCapability',q.required_capability,
    'approvalsReceived',q.approvals_received,
    'approvalsRequired',q.required_approvals,
    'dueAt',q.due_at,
    'escalatedAt',q.escalated_at,
    'delegatedFromUserId',q.delegated_from_user_id,
    'createdAt',q.created_at,
    'updatedAt',q.updated_at
  ) order by q.overdue desc,q.due_at nulls last,q.updated_at,q.request_instance_id),'[]'::jsonb)
  into v_result
  from (
    select r.id request_instance_id,
           tv.title request_type_title,
           tv.version_no request_type_version,
           r.requester_user_id,
           r.status request_status,
           r.revision,
           s.step_key,s.step_title,s.required_capability,s.required_approvals,s.due_at,s.escalated_at,
           (select count(*)::integer from private.request_step_votes v where v.step_instance_id=s.id and v.decision='approve') approvals_received,
           case when private.has_org_capability(r.organization_id,'requests_workflow',s.required_capability) then null
                else private.request_valid_delegator(r.organization_id,auth.uid(),s.required_capability,now()) end delegated_from_user_id,
           (s.due_at is not null and s.due_at<now()) overdue,
           r.created_at,r.updated_at
    from public.request_instances r
    join public.request_type_versions tv on tv.id=r.request_type_version_id and tv.organization_id=r.organization_id
    join private.request_step_instances s on s.request_instance_id=r.id and s.organization_id=r.organization_id and s.state='active'
    where r.organization_id=p_organization_id
      and r.status='submitted'
      and not exists(select 1 from private.request_step_votes mine where mine.step_instance_id=s.id and mine.actor_user_id=auth.uid())
      and (
        private.has_org_capability(r.organization_id,'requests_workflow',s.required_capability)
        or private.request_valid_delegator(r.organization_id,auth.uid(),s.required_capability,now()) is not null
      )
  ) q;
  return v_result;
end $$;
revoke all on function private.request_work_queue(uuid) from public,anon;
grant execute on function private.request_work_queue(uuid) to authenticated;

create or replace function public.request_work_queue(p_organization_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select private.request_work_queue(p_organization_id) $$;
revoke all on function public.request_work_queue(uuid) from public,anon;
grant execute on function public.request_work_queue(uuid) to authenticated;

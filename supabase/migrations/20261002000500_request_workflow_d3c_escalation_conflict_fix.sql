-- D3c follow-up: request_instance_events uniqueness is organization-scoped.
create or replace function private.request_escalate_overdue(p_organization_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$ declare v_step private.request_step_instances%rowtype;v_revision bigint;v_status text;v_count integer:=0;begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000';end if;
 if p_organization_id not in(select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501';end if;
 if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) or not private.has_org_capability(p_organization_id,'requests_workflow','configure') then raise exception 'requests_workflow configure capability required' using errcode='42501';end if;
 for v_step in select * from private.request_step_instances s where s.organization_id=p_organization_id and s.state='active' and s.due_at is not null and s.due_at<now() and s.escalated_at is null order by s.due_at for update skip locked loop
  update private.request_step_instances set escalated_at=now(),escalation_level=escalation_level+1 where id=v_step.id;
  select revision,status into v_revision,v_status from public.request_instances where id=v_step.request_instance_id;
  insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,note,idempotency_key)
  values(p_organization_id,v_step.request_instance_id,auth.uid(),'step_escalated:'||v_step.step_key,v_status,v_status,v_revision,'SLA overdue','escalate:'||v_step.id::text||':1')
  on conflict(organization_id,idempotency_key) do nothing;
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function private.request_escalate_overdue(uuid) from public,anon;
grant execute on function private.request_escalate_overdue(uuid) to authenticated;

-- C5 provides internal approval/attestation evidence only; it is NOT a qualified digital signature.
create or replace function private.office_request_approval_impl(
  p_organization_id uuid,p_correspondence_id text,p_approver_member_id uuid,p_note text,p_due_at timestamptz
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid()); v_source public.records%rowtype; v_approver public.organization_members%rowtype;
  v_approval_id text; v_event_id text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
     or not (private.has_org_capability(p_organization_id,'office_automation','edit') or private.has_org_capability(p_organization_id,'office_automation','refer'))
  then raise exception 'approval request permission required' using errcode='42501'; end if;
  select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id;
  if not found or v_source.data->>'status'='draft'
     or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read')
  then raise exception 'registered correspondence not found or not readable' using errcode='42501'; end if;
  select * into v_approver from public.organization_members m where m.id=p_approver_member_id and m.organization_id=p_organization_id and m.status='active';
  if not found then raise exception 'approver member not found' using errcode='42501'; end if;
  if v_approver.user_id=v_uid then raise exception 'requester cannot approve own request' using errcode='22023'; end if;
  if not private.member_can_access_record(v_approver.id,'office_automation',v_source.owner_id,v_source.data,'read')
     or not private.member_can_access_record(v_approver.id,'office_automation',v_source.owner_id,v_source.data,'approve')
  then raise exception 'approver lacks approve/read access to correspondence' using errcode='42501'; end if;
  if exists(
    select 1 from public.records req
    where req.organization_id=p_organization_id and req.collection='correspondenceAudit'
      and req.data->>'event'='approval_requested' and req.data->>'correspondenceId'=p_correspondence_id
      and not exists(select 1 from public.records act where act.organization_id=p_organization_id and act.collection='correspondenceAudit'
        and act.data->>'approvalId'=req.data->>'approvalId' and act.data->>'event' in ('approval_approved','approval_rejected'))
  ) then raise exception 'active approval request already exists' using errcode='23505'; end if;
  v_approval_id:='AP_'||replace(gen_random_uuid()::text,'-',''); v_event_id:='APE_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(p_organization_id,v_uid,'correspondenceAudit',v_event_id,
    jsonb_build_object('event','approval_requested','approvalId',v_approval_id,'correspondenceId',p_correspondence_id,
      'requestedByUserId',v_uid,'approverMemberId',v_approver.id,'approverUserId',v_approver.user_id,
      'note',coalesce(p_note,''),'dueAt',p_due_at,'aal',coalesce((select auth.jwt()->>'aal'),'aal1'),'at',clock_timestamp()));
  return v_approval_id;
end $$;
revoke all on function private.office_request_approval_impl(uuid,text,uuid,text,timestamptz) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.office_request_approval_impl(uuid,text,uuid,text,timestamptz) to authenticated;

create or replace function public.office_request_approval(
  p_organization_id uuid,p_correspondence_id text,p_approver_member_id uuid,p_note text default null,p_due_at timestamptz default null
) returns text language sql security invoker set search_path=''
as $$ select private.office_request_approval_impl(p_organization_id,p_correspondence_id,p_approver_member_id,p_note,p_due_at) $$;
revoke all on function public.office_request_approval(uuid,text,uuid,text,timestamptz) from public,anon;
grant execute on function public.office_request_approval(uuid,text,uuid,text,timestamptz) to authenticated;

create or replace function private.office_act_on_approval_impl(
  p_organization_id uuid,p_approval_id text,p_action text,p_note text
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid()); v_req public.records%rowtype; v_source public.records%rowtype;
  v_member_id uuid; v_event_id text; v_event text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_action not in ('approved','rejected') then raise exception 'invalid approval action' using errcode='22023'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
  then raise exception 'office automation entitlement required' using errcode='42501'; end if;
  select * into v_req from public.records r where r.organization_id=p_organization_id and r.collection='correspondenceAudit'
    and r.data->>'event'='approval_requested' and r.data->>'approvalId'=p_approval_id
  order by nullif(r.data->>'at','')::timestamptz desc limit 1;
  if not found then raise exception 'approval request not found' using errcode='42501'; end if;
  if v_req.data->>'approverUserId' is distinct from v_uid::text then raise exception 'only assigned approver may decide' using errcode='42501'; end if;
  if exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
      and a.data->>'approvalId'=p_approval_id and a.data->>'event' in ('approval_approved','approval_rejected'))
  then raise exception 'approval request already decided' using errcode='23505'; end if;
  begin v_member_id:=(v_req.data->>'approverMemberId')::uuid; exception when others then raise exception 'invalid approver membership' using errcode='42501'; end;
  if not exists(select 1 from public.organization_members m where m.id=v_member_id and m.organization_id=p_organization_id and m.user_id=v_uid and m.status='active')
  then raise exception 'approver membership inactive' using errcode='42501'; end if;
  select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=v_req.data->>'correspondenceId';
  if not found or not private.member_can_access_record(v_member_id,'office_automation',v_source.owner_id,v_source.data,'read')
     or not private.member_can_access_record(v_member_id,'office_automation',v_source.owner_id,v_source.data,'approve')
  then raise exception 'approver no longer has approve/read access' using errcode='42501'; end if;
  v_event:='approval_'||p_action; v_event_id:='APE_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(p_organization_id,v_uid,'correspondenceAudit',v_event_id,
    jsonb_build_object('event',v_event,'approvalId',p_approval_id,'correspondenceId',v_req.data->>'correspondenceId',
      'actorUserId',v_uid,'note',coalesce(p_note,''),'aal',coalesce((select auth.jwt()->>'aal'),'aal1'),'at',clock_timestamp()));
  return v_event_id;
end $$;
revoke all on function private.office_act_on_approval_impl(uuid,text,text,text) from public,anon;
grant execute on function private.office_act_on_approval_impl(uuid,text,text,text) to authenticated;

create or replace function public.office_act_on_approval(
  p_organization_id uuid,p_approval_id text,p_action text,p_note text default null
) returns text language sql security invoker set search_path=''
as $$ select private.office_act_on_approval_impl(p_organization_id,p_approval_id,p_action,p_note) $$;
revoke all on function public.office_act_on_approval(uuid,text,text,text) from public,anon;
grant execute on function public.office_act_on_approval(uuid,text,text,text) to authenticated;

create or replace function private.office_approval_work_queue_impl(p_organization_id uuid)
returns table(
  approval_id text,correspondence_id text,register_number text,subject text,
  requested_by_user_id uuid,approver_user_id uuid,note text,due_at timestamptz,
  requested_at timestamptz,state text,overdue boolean,decision_note text,decision_at timestamptz,decision_aal text
)
language sql stable security definer set search_path=''
as $$
  with caller as (
    select m.id,m.user_id,m.is_owner from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active'
  ), reqs as (
    select r.data as request_data,c.data as correspondence_data,c.owner_id as correspondence_owner
    from public.records r
    join public.records c on c.organization_id=r.organization_id and c.collection='correspondence' and c.id=r.data->>'correspondenceId'
    where r.organization_id=p_organization_id and r.collection='correspondenceAudit' and r.data->>'event'='approval_requested'
  )
  select
    r.request_data->>'approvalId',r.request_data->>'correspondenceId',
    r.correspondence_data->>'registerNumber',r.correspondence_data->>'subject',
    nullif(r.request_data->>'requestedByUserId','')::uuid,nullif(r.request_data->>'approverUserId','')::uuid,
    coalesce(r.request_data->>'note',''),nullif(r.request_data->>'dueAt','')::timestamptz,
    nullif(r.request_data->>'at','')::timestamptz,
    case when d.event='approval_approved' then 'approved' when d.event='approval_rejected' then 'rejected' else 'pending' end,
    (d.event is null and nullif(r.request_data->>'dueAt','')::timestamptz < clock_timestamp()),
    coalesce(d.note,''),d.at,d.aal
  from reqs r
  left join lateral (
    select a.data->>'event' as event,a.data->>'note' as note,nullif(a.data->>'at','')::timestamptz as at,a.data->>'aal' as aal
    from public.records a
    where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
      and a.data->>'approvalId'=r.request_data->>'approvalId' and a.data->>'event' in ('approval_approved','approval_rejected')
    order by nullif(a.data->>'at','')::timestamptz desc limit 1
  ) d on true
  where exists(select 1 from caller)
    and private.organization_has_module_entitlement(p_organization_id,'office_automation',false)
    and ((select is_owner from caller limit 1)
      or r.request_data->>'requestedByUserId'=(select auth.uid())::text
      or r.request_data->>'approverUserId'=(select auth.uid())::text)
    and private.can_access_record(p_organization_id,'correspondence',r.correspondence_owner,r.correspondence_data,'read')
  order by (d.event is null and nullif(r.request_data->>'dueAt','')::timestamptz < clock_timestamp()) desc,
           nullif(r.request_data->>'at','')::timestamptz desc
$$;
revoke all on function private.office_approval_work_queue_impl(uuid) from public,anon;
grant execute on function private.office_approval_work_queue_impl(uuid) to authenticated;

create or replace function public.office_approval_work_queue(p_organization_id uuid)
returns table(
  approval_id text,correspondence_id text,register_number text,subject text,
  requested_by_user_id uuid,approver_user_id uuid,note text,due_at timestamptz,
  requested_at timestamptz,state text,overdue boolean,decision_note text,decision_at timestamptz,decision_aal text
)
language sql stable security invoker set search_path=''
as $$ select * from private.office_approval_work_queue_impl(p_organization_id) $$;
revoke all on function public.office_approval_work_queue(uuid) from public,anon;
grant execute on function public.office_approval_work_queue(uuid) to authenticated;

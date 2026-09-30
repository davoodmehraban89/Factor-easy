
-- Office Slice C6: internal SLA reminder/escalation evidence.
-- No external delivery is performed by this slice; email/SMS/webhook adapters remain out of scope.

create or replace function private.office_emit_sla_event_impl(
  p_organization_id uuid,
  p_work_type text,
  p_work_id text,
  p_event text
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.organization_members%rowtype;
  v_source public.records%rowtype;
  v_work public.records%rowtype;
  v_correspondence_id text;
  v_requester_user_id uuid;
  v_target_user_id uuid;
  v_due_at timestamptz;
  v_pending boolean := false;
  v_policy_window text;
  v_event_id text;
  v_content_digest text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_work_type not in ('referral','approval') then raise exception 'invalid SLA work type' using errcode='22023'; end if;
  if p_event not in ('sla_reminder','sla_escalated') then raise exception 'invalid SLA event' using errcode='22023'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
  then raise exception 'office automation entitlement required' using errcode='42501'; end if;

  select * into v_member
  from public.organization_members m
  where m.organization_id=p_organization_id and m.user_id=v_uid and m.status='active'
  limit 1;
  if not found then raise exception 'active organization membership required' using errcode='42501'; end if;

  if p_work_type='referral' then
    select * into v_work
    from public.records r
    where r.organization_id=p_organization_id and r.collection='correspondenceReferrals' and r.id=p_work_id;
    if not found then raise exception 'SLA work item not found' using errcode='42501'; end if;

    v_correspondence_id:=v_work.data->>'correspondenceId';
    begin v_requester_user_id:=nullif(v_work.data->>'fromUserId','')::uuid;
    exception when others then raise exception 'invalid referral requester' using errcode='42501'; end;
    begin v_target_user_id:=nullif(v_work.data->>'toUserId','')::uuid;
    exception when others then raise exception 'invalid referral target' using errcode='42501'; end;
    begin v_due_at:=nullif(v_work.data->>'dueAt','')::timestamptz;
    exception when others then raise exception 'invalid referral due time' using errcode='22023'; end;

    v_pending:=not exists(
      select 1 from public.records a
      where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
        and a.data->>'referralId'=p_work_id and a.data->>'event'='referral_completed'
    );
  else
    select * into v_work
    from public.records r
    where r.organization_id=p_organization_id and r.collection='correspondenceAudit'
      and r.data->>'event'='approval_requested' and r.data->>'approvalId'=p_work_id
    order by nullif(r.data->>'at','')::timestamptz desc
    limit 1;
    if not found then raise exception 'SLA work item not found' using errcode='42501'; end if;

    v_correspondence_id:=v_work.data->>'correspondenceId';
    begin v_requester_user_id:=nullif(v_work.data->>'requestedByUserId','')::uuid;
    exception when others then raise exception 'invalid approval requester' using errcode='42501'; end;
    begin v_target_user_id:=nullif(v_work.data->>'approverUserId','')::uuid;
    exception when others then raise exception 'invalid approval target' using errcode='42501'; end;
    begin v_due_at:=nullif(v_work.data->>'dueAt','')::timestamptz;
    exception when others then raise exception 'invalid approval due time' using errcode='22023'; end;

    v_pending:=not exists(
      select 1 from public.records a
      where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
        and a.data->>'approvalId'=p_work_id and a.data->>'event' in ('approval_approved','approval_rejected')
    );
  end if;

  select * into v_source
  from public.records r
  where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=v_correspondence_id;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read')
  then raise exception 'source correspondence not readable' using errcode='42501'; end if;

  if p_work_type='approval' then
    v_content_digest:=private.office_correspondence_content_digest(v_source.data);
    if coalesce(v_work.data->>'contentDigest','')='' or v_work.data->>'contentDigest'<>v_content_digest
    then v_pending:=false; end if;
  end if;

  if not v_pending then raise exception 'pending work required for SLA event' using errcode='22023'; end if;
  if v_due_at is null or v_due_at>clock_timestamp()
  then raise exception 'overdue work required for SLA event' using errcode='22023'; end if;

  if not (
    v_member.is_owner
    or v_requester_user_id=v_uid
    or private.has_org_capability(p_organization_id,'office_automation','configure')
  ) then raise exception 'SLA event permission required' using errcode='42501'; end if;

  if p_event='sla_escalated' and v_due_at>clock_timestamp()-interval '24 hours'
  then raise exception '24 hours overdue required for escalation' using errcode='22023'; end if;

  -- policyWindow is server-derived so clients cannot bypass deduplication by inventing a window.
  v_policy_window:=case
    when p_event='sla_reminder'
      then 'reminder:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')
    else 'escalation:overdue-24h'
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text||':office-sla:'||p_work_type||':'||p_work_id||':'||p_event||':'||v_policy_window,0
    )
  );

  if exists(
    select 1 from public.records a
    where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
      and a.data->>'event'=p_event
      and a.data->>'workType'=p_work_type
      and a.data->>'workId'=p_work_id
      and a.data->>'policyWindow'=v_policy_window
  ) then raise exception 'SLA event already emitted for policy window' using errcode='23505'; end if;

  v_event_id:='SLA_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(
    p_organization_id,v_uid,'correspondenceAudit',v_event_id,
    jsonb_build_object(
      'event',p_event,
      'workType',p_work_type,
      'workId',p_work_id,
      'correspondenceId',v_correspondence_id,
      'requesterUserId',v_requester_user_id,
      'targetUserId',v_target_user_id,
      'dueAt',v_due_at,
      'policyWindow',v_policy_window,
      'actorUserId',v_uid,
      'deliveryMode','internal_only',
      'externalDelivery',false,
      'at',clock_timestamp()
    )
  );
  return v_event_id;
end $$;
revoke all on function private.office_emit_sla_event_impl(uuid,text,text,text) from public,anon;
grant execute on function private.office_emit_sla_event_impl(uuid,text,text,text) to authenticated;

create or replace function public.office_emit_sla_event(
  p_organization_id uuid,
  p_work_type text,
  p_work_id text,
  p_event text
) returns text
language sql security invoker set search_path=''
as $$ select private.office_emit_sla_event_impl(p_organization_id,p_work_type,p_work_id,p_event) $$;
revoke all on function public.office_emit_sla_event(uuid,text,text,text) from public,anon;
grant execute on function public.office_emit_sla_event(uuid,text,text,text) to authenticated;

create or replace function private.office_sla_work_queue_impl(p_organization_id uuid)
returns table(
  work_type text,
  work_id text,
  correspondence_id text,
  register_number text,
  subject text,
  requester_user_id uuid,
  target_user_id uuid,
  due_at timestamptz,
  work_state text,
  overdue boolean,
  overdue_hours integer,
  last_reminder_at timestamptz,
  escalated_at timestamptz,
  can_emit boolean
)
language sql stable security definer set search_path=''
as $$
  with caller as (
    select m.id,m.user_id,m.is_owner
    from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active'
    limit 1
  ),
  referral_work as (
    select
      'referral'::text work_type,
      r.id work_id,
      r.data->>'correspondenceId' correspondence_id,
      nullif(r.data->>'fromUserId','')::uuid requester_user_id,
      nullif(r.data->>'toUserId','')::uuid target_user_id,
      nullif(r.data->>'dueAt','')::timestamptz due_at,
      case
        when exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
          and a.data->>'referralId'=r.id and a.data->>'event'='referral_completed') then 'completed'
        when exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
          and a.data->>'referralId'=r.id and a.data->>'event'='referral_acknowledged') then 'acknowledged'
        else 'sent' end work_state,
      c.owner_id correspondence_owner,
      c.data correspondence_data
    from public.records r
    join public.records c on c.organization_id=r.organization_id and c.collection='correspondence' and c.id=r.data->>'correspondenceId'
    where r.organization_id=p_organization_id and r.collection='correspondenceReferrals'
  ),
  approval_work as (
    select
      'approval'::text work_type,
      r.data->>'approvalId' work_id,
      r.data->>'correspondenceId' correspondence_id,
      nullif(r.data->>'requestedByUserId','')::uuid requester_user_id,
      nullif(r.data->>'approverUserId','')::uuid target_user_id,
      nullif(r.data->>'dueAt','')::timestamptz due_at,
      case
        when exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
          and a.data->>'approvalId'=r.data->>'approvalId' and a.data->>'event'='approval_approved') then 'approved'
        when exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
          and a.data->>'approvalId'=r.data->>'approvalId' and a.data->>'event'='approval_rejected') then 'rejected'
        when coalesce(r.data->>'contentDigest','')<>private.office_correspondence_content_digest(c.data) then 'stale'
        else 'pending' end work_state,
      c.owner_id correspondence_owner,
      c.data correspondence_data
    from public.records r
    join public.records c on c.organization_id=r.organization_id and c.collection='correspondence' and c.id=r.data->>'correspondenceId'
    where r.organization_id=p_organization_id and r.collection='correspondenceAudit' and r.data->>'event'='approval_requested'
  ),
  work as (
    select * from referral_work
    union all
    select * from approval_work
  )
  select
    w.work_type,w.work_id,w.correspondence_id,w.correspondence_data->>'registerNumber',w.correspondence_data->>'subject',
    w.requester_user_id,w.target_user_id,w.due_at,w.work_state,
    (w.due_at is not null and w.due_at<clock_timestamp() and w.work_state in ('sent','acknowledged','pending')),
    greatest(0,floor(extract(epoch from (clock_timestamp()-w.due_at))/3600)::integer),
    (
      select max(nullif(a.data->>'at','')::timestamptz)
      from public.records a
      where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
        and a.data->>'event'='sla_reminder' and a.data->>'workType'=w.work_type and a.data->>'workId'=w.work_id
    ),
    (
      select max(nullif(a.data->>'at','')::timestamptz)
      from public.records a
      where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
        and a.data->>'event'='sla_escalated' and a.data->>'workType'=w.work_type and a.data->>'workId'=w.work_id
    ),
    (
      (select is_owner from caller limit 1)
      or w.requester_user_id=(select auth.uid())
      or private.has_org_capability(p_organization_id,'office_automation','configure')
    )
  from work w
  where exists(select 1 from caller)
    and private.organization_has_module_entitlement(p_organization_id,'office_automation',false)
    and w.due_at is not null
    and (
      (select is_owner from caller limit 1)
      or w.requester_user_id=(select auth.uid())
      or w.target_user_id=(select auth.uid())
      or private.has_org_capability(p_organization_id,'office_automation','configure')
    )
    and private.can_access_record(p_organization_id,'correspondence',w.correspondence_owner,w.correspondence_data,'read')
  order by
    (w.due_at<clock_timestamp() and w.work_state in ('sent','acknowledged','pending')) desc,
    w.due_at asc nulls last
$$;
revoke all on function private.office_sla_work_queue_impl(uuid) from public,anon;
grant execute on function private.office_sla_work_queue_impl(uuid) to authenticated;

create or replace function public.office_sla_work_queue(p_organization_id uuid)
returns table(
  work_type text,
  work_id text,
  correspondence_id text,
  register_number text,
  subject text,
  requester_user_id uuid,
  target_user_id uuid,
  due_at timestamptz,
  work_state text,
  overdue boolean,
  overdue_hours integer,
  last_reminder_at timestamptz,
  escalated_at timestamptz,
  can_emit boolean
)
language sql stable security invoker set search_path=''
as $$ select * from private.office_sla_work_queue_impl(p_organization_id) $$;
revoke all on function public.office_sla_work_queue(uuid) from public,anon;
grant execute on function public.office_sla_work_queue(uuid) to authenticated;

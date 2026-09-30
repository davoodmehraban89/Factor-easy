create or replace function private.member_can_access_record(
  p_member_id uuid,
  p_module_key text,
  p_owner_id uuid,
  p_data jsonb,
  p_capability text
) returns boolean
language sql stable security definer set search_path=''
as $$
  with member_row as (
    select m.id,m.organization_id,m.user_id,m.is_owner
    from public.organization_members m
    where m.id=p_member_id and m.status='active'
  ), grants as (
    select p.organization_id,p.member_id,p.module_key,p.capabilities,p.scope_type,p.scope_id,p.confidentiality_level
    from public.member_module_permissions p
    join member_row m on m.id=p.member_id and m.organization_id=p.organization_id
    union all
    select rp.organization_id,mr.member_id,rp.module_key,rp.capabilities,rp.scope_type,rp.scope_id,rp.confidentiality_level
    from public.organization_member_roles mr
    join member_row m on m.id=mr.member_id and m.organization_id=mr.organization_id
    join public.organization_roles r on r.id=mr.role_id and r.organization_id=mr.organization_id and r.active
    join public.organization_role_permissions rp on rp.role_id=r.id and rp.organization_id=r.organization_id
    where mr.active
  ), access_grants as (
    select g.*,m.user_id
    from grants g join member_row m on m.id=g.member_id
    where (g.module_key=p_module_key or g.module_key='full_suite')
      and p_capability=any(g.capabilities)
      and (
        g.scope_type='organization'
        or (g.scope_type='own' and p_owner_id=m.user_id)
        or (g.scope_type='company' and g.scope_id=coalesce(p_data->>'companyId',p_data->>'company_id'))
        or (g.scope_type='branch' and g.scope_id=coalesce(p_data->>'branchId',p_data->>'branch_id'))
        or (g.scope_type='unit' and g.scope_id=coalesce(p_data->>'unitId',p_data->>'unit_id'))
      )
  )
  select exists(
    select 1 from member_row m
    where m.is_owner
       or (
         exists(select 1 from access_grants)
         and coalesce((
           select max(g.confidentiality_level)
           from grants g
           where g.module_key=p_module_key or g.module_key='full_suite'
         ),-1) >= case lower(coalesce(p_data->>'confidentiality','normal'))
           when 'محرمانه' then 1 when 'confidential' then 1
           when 'خیلی محرمانه' then 2 when 'very_confidential' then 2
           when 'سری' then 3 when 'secret' then 3 else 0 end
       )
  )
$$;
revoke all on function private.member_can_access_record(uuid,text,uuid,jsonb,text) from public,anon,authenticated;

create or replace function public.office_refer_correspondence_v2(
  p_organization_id uuid,
  p_correspondence_id text,
  p_to_member_id uuid,
  p_note text,
  p_due_at timestamptz
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_source public.records%rowtype;
  v_target public.organization_members%rowtype;
  v_id text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
     or not private.has_org_capability(p_organization_id,'office_automation','refer')
  then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_source from public.records r
  where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read')
  then raise exception 'correspondence not found or not readable' using errcode='42501'; end if;
  select * into v_target from public.organization_members m
  where m.id=p_to_member_id and m.organization_id=p_organization_id and m.status='active';
  if not found then raise exception 'target member not found' using errcode='42501'; end if;
  if v_target.user_id=v_uid then raise exception 'self referral is not allowed' using errcode='22023'; end if;
  if not private.member_can_access_record(v_target.id,'office_automation',v_source.owner_id,v_source.data,'read')
  then raise exception 'target member cannot read correspondence' using errcode='42501'; end if;
  v_id:='REF_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(p_organization_id,v_target.user_id,'correspondenceReferrals',v_id,
    jsonb_build_object(
      'correspondenceId',p_correspondence_id,'fromUserId',v_uid,'toMemberId',v_target.id,'toUserId',v_target.user_id,
      'note',coalesce(p_note,''),'status','sent','createdAt',now(),'dueAt',p_due_at,
      'companyId',coalesce(v_source.data->>'companyId',v_source.data->>'company_id',''),
      'unitId',coalesce(v_source.data->>'unitId',v_source.data->>'unit_id',''),
      'branchId',coalesce(v_source.data->>'branchId',v_source.data->>'branch_id',''),
      'confidentiality',coalesce(v_source.data->>'confidentiality','normal')
    ));
  return v_id;
end $$;
revoke all on function public.office_refer_correspondence_v2(uuid,text,uuid,text,timestamptz) from public,anon;
grant execute on function public.office_refer_correspondence_v2(uuid,text,uuid,text,timestamptz) to authenticated;

create or replace function public.office_refer_correspondence(
  p_organization_id uuid,p_correspondence_id text,p_to_member_id uuid,p_note text default null
) returns text
language sql security invoker set search_path=''
as $$
  select public.office_refer_correspondence_v2(
    p_organization_id,p_correspondence_id,p_to_member_id,p_note,null::timestamptz
  )
$$;
revoke all on function public.office_refer_correspondence(uuid,text,uuid,text) from public,anon;
grant execute on function public.office_refer_correspondence(uuid,text,uuid,text) to authenticated;

create or replace function public.office_act_on_referral(
  p_organization_id uuid,p_referral_id text,p_action text,p_note text default null
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_ref public.records%rowtype;
  v_source public.records%rowtype;
  v_member_id uuid;
  v_event text;
  v_id text;
  v_ack boolean;
  v_done boolean;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_action not in ('acknowledged','completed') then raise exception 'invalid referral action' using errcode='22023'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
  then raise exception 'office automation entitlement required' using errcode='42501'; end if;
  select * into v_ref from public.records r
  where r.organization_id=p_organization_id and r.collection='correspondenceReferrals' and r.id=p_referral_id;
  if not found then raise exception 'referral not found' using errcode='42501'; end if;
  if v_ref.data->>'toUserId' is distinct from v_uid::text
  then raise exception 'only referral target may act' using errcode='42501'; end if;
  begin v_member_id:=(v_ref.data->>'toMemberId')::uuid;
  exception when others then raise exception 'invalid referral target' using errcode='42501'; end;
  if not exists(select 1 from public.organization_members m
    where m.id=v_member_id and m.organization_id=p_organization_id and m.user_id=v_uid and m.status='active')
  then raise exception 'referral target membership is inactive' using errcode='42501'; end if;
  select * into v_source from public.records r
  where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=v_ref.data->>'correspondenceId';
  if not found or not private.member_can_access_record(v_member_id,'office_automation',v_source.owner_id,v_source.data,'read')
  then raise exception 'correspondence no longer readable by referral target' using errcode='42501'; end if;
  select exists(select 1 from public.records a
    where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
      and a.data->>'referralId'=p_referral_id and a.data->>'event'='referral_acknowledged') into v_ack;
  select exists(select 1 from public.records a
    where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
      and a.data->>'referralId'=p_referral_id and a.data->>'event'='referral_completed') into v_done;
  if p_action='acknowledged' and v_ack then raise exception 'referral already acknowledged' using errcode='22023'; end if;
  if p_action='completed' and not v_ack then raise exception 'completion requires acknowledgement' using errcode='22023'; end if;
  if p_action='completed' and v_done then raise exception 'referral already completed' using errcode='22023'; end if;
  v_event:='referral_'||p_action;
  v_id:='RA_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(p_organization_id,v_uid,'correspondenceAudit',v_id,
    jsonb_build_object('event',v_event,'referralId',p_referral_id,'correspondenceId',v_ref.data->>'correspondenceId',
      'actorUserId',v_uid,'note',coalesce(p_note,''),'at',now()));
  return v_id;
end $$;
revoke all on function public.office_act_on_referral(uuid,text,text,text) from public,anon;
grant execute on function public.office_act_on_referral(uuid,text,text,text) to authenticated;

create or replace function public.office_referral_work_queue(p_organization_id uuid)
returns table(
  referral_id text,correspondence_id text,register_number text,subject text,
  from_user_id uuid,to_user_id uuid,note text,created_at timestamptz,due_at timestamptz,state text,overdue boolean
)
language sql stable security definer set search_path=''
as $$
  with caller as (
    select m.id,m.user_id,m.is_owner from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active'
  ), refs as (
    select r.*,c.data as correspondence_data,c.owner_id as correspondence_owner
    from public.records r
    join public.records c on c.organization_id=r.organization_id and c.collection='correspondence' and c.id=r.data->>'correspondenceId'
    where r.organization_id=p_organization_id and r.collection='correspondenceReferrals'
  )
  select r.id,r.data->>'correspondenceId',r.correspondence_data->>'registerNumber',r.correspondence_data->>'subject',
    nullif(r.data->>'fromUserId','')::uuid,nullif(r.data->>'toUserId','')::uuid,coalesce(r.data->>'note',''),
    nullif(r.data->>'createdAt','')::timestamptz,nullif(r.data->>'dueAt','')::timestamptz,
    case
      when exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'referralId'=r.id and a.data->>'event'='referral_completed') then 'completed'
      when exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'referralId'=r.id and a.data->>'event'='referral_acknowledged') then 'acknowledged'
      else 'sent'
    end,
    (nullif(r.data->>'dueAt','')::timestamptz < now()
      and not exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'referralId'=r.id and a.data->>'event'='referral_completed'))
  from refs r
  where exists(select 1 from caller)
    and private.organization_has_module_entitlement(p_organization_id,'office_automation',false)
    and ((select is_owner from caller limit 1)
      or r.data->>'fromUserId'=(select auth.uid())::text
      or r.data->>'toUserId'=(select auth.uid())::text)
    and private.can_access_record(p_organization_id,'correspondence',r.correspondence_owner,r.correspondence_data,'read')
  order by (nullif(r.data->>'dueAt','')::timestamptz < now()) desc,
    nullif(r.data->>'createdAt','')::timestamptz desc
$$;
revoke all on function public.office_referral_work_queue(uuid) from public,anon;
grant execute on function public.office_referral_work_queue(uuid) to authenticated;

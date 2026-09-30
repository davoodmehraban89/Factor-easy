create or replace function public.office_link_correspondence(
  p_organization_id uuid,
  p_source_id text,
  p_target_id text,
  p_relation_type text
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_source public.records%rowtype;
  v_target public.records%rowtype;
  v_id text;
  v_cycle boolean;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_relation_type not in ('reply_to','related') then raise exception 'invalid relation type' using errcode='22023'; end if;
  if p_source_id=p_target_id then raise exception 'self relation is not allowed' using errcode='22023'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
     or not (private.has_org_capability(p_organization_id,'office_automation','edit') or private.has_org_capability(p_organization_id,'office_automation','refer'))
  then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_source_id;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read')
  then raise exception 'source correspondence not found or not readable' using errcode='42501'; end if;
  select * into v_target from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_target_id;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_target.owner_id,v_target.data,'read')
  then raise exception 'target correspondence not found or not readable' using errcode='42501'; end if;
  if p_relation_type='reply_to' then
    if exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'event'='relation_created' and a.data->>'relationType'='reply_to' and a.data->>'sourceId'=p_source_id)
    then raise exception 'reply parent already exists' using errcode='23505'; end if;
    with recursive edges as (
      select a.data->>'sourceId' as source_id,a.data->>'targetId' as target_id
      from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'event'='relation_created' and a.data->>'relationType'='reply_to'
    ), walk(node) as (
      select p_target_id union select e.target_id from edges e join walk w on e.source_id=w.node
    )
    select exists(select 1 from walk where node=p_source_id) into v_cycle;
    if v_cycle then raise exception 'reply cycle is not allowed' using errcode='22023'; end if;
  else
    if exists(select 1 from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'event'='relation_created' and a.data->>'relationType'='related' and ((a.data->>'sourceId'=p_source_id and a.data->>'targetId'=p_target_id) or (a.data->>'sourceId'=p_target_id and a.data->>'targetId'=p_source_id)))
    then raise exception 'related correspondence link already exists' using errcode='23505'; end if;
  end if;
  v_id:='REL_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(p_organization_id,v_uid,'correspondenceAudit',v_id,jsonb_build_object('event','relation_created','relationType',p_relation_type,'sourceId',p_source_id,'targetId',p_target_id,'actorUserId',v_uid,'at',now()));
  return v_id;
end $$;
revoke all on function public.office_link_correspondence(uuid,text,text,text) from public,anon;
grant execute on function public.office_link_correspondence(uuid,text,text,text) to authenticated;

create or replace function public.office_classify_correspondence(
  p_organization_id uuid,p_correspondence_id text,p_folder text,p_classification_code text,p_tags text[]
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_source public.records%rowtype;
  v_id text;
  v_tags text[]:=coalesce(p_tags,array[]::text[]);
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
     or not (private.has_org_capability(p_organization_id,'office_automation','archive') or private.has_org_capability(p_organization_id,'office_automation','configure'))
  then raise exception 'archive permission required' using errcode='42501'; end if;
  select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read')
  then raise exception 'correspondence not found or not readable' using errcode='42501'; end if;
  if length(coalesce(p_folder,''))>120 then raise exception 'archive folder too long' using errcode='22023'; end if;
  if length(coalesce(p_classification_code,''))>64 then raise exception 'classification code too long' using errcode='22023'; end if;
  if cardinality(v_tags)>20 or exists(select 1 from unnest(v_tags) t where length(t)>64)
  then raise exception 'invalid archive tags' using errcode='22023'; end if;
  v_id:='ARC_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(p_organization_id,v_uid,'correspondenceAudit',v_id,jsonb_build_object('event','archive_classified','correspondenceId',p_correspondence_id,'folder',trim(coalesce(p_folder,'')),'classificationCode',trim(coalesce(p_classification_code,'')),'tags',to_jsonb(v_tags),'actorUserId',v_uid,'at',now()));
  return v_id;
end $$;
revoke all on function public.office_classify_correspondence(uuid,text,text,text,text[]) from public,anon;
grant execute on function public.office_classify_correspondence(uuid,text,text,text,text[]) to authenticated;

create or replace function public.office_archive_search(
  p_organization_id uuid,p_query text default null,p_folder text default null,p_classification_code text default null,p_related_to text default null
) returns table(
  correspondence_id text,register_number text,subject text,counterparty text,status text,folder text,classification_code text,tags text[],related_count bigint
)
language sql stable security definer set search_path=''
as $$
  select c.id,c.data->>'registerNumber',c.data->>'subject',c.data->>'counterparty',c.data->>'status',
    coalesce(cls.data->>'folder',''),coalesce(cls.data->>'classificationCode',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(cls.data->'tags','[]'::jsonb))),array[]::text[]),
    (select count(*) from public.records rel where rel.organization_id=p_organization_id and rel.collection='correspondenceAudit' and rel.data->>'event'='relation_created' and (rel.data->>'sourceId'=c.id or rel.data->>'targetId'=c.id))
  from public.records c
  left join lateral (
    select a.data from public.records a
    where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'event'='archive_classified' and a.data->>'correspondenceId'=c.id
    order by nullif(a.data->>'at','')::timestamptz desc limit 1
  ) cls on true
  where c.organization_id=p_organization_id and c.collection='correspondence'
    and private.can_access_record(p_organization_id,'correspondence',c.owner_id,c.data,'read')
    and (nullif(trim(coalesce(p_query,'')),'') is null or lower(concat_ws(' ',c.data->>'registerNumber',c.data->>'subject',c.data->>'counterparty',c.data->>'externalNumber',c.data->>'body',coalesce(cls.data->>'folder',''),coalesce(cls.data->>'classificationCode',''),coalesce((cls.data->'tags')::text,''))) like '%'||lower(trim(p_query))||'%')
    and (nullif(trim(coalesce(p_folder,'')),'') is null or cls.data->>'folder'=trim(p_folder))
    and (nullif(trim(coalesce(p_classification_code,'')),'') is null or cls.data->>'classificationCode'=trim(p_classification_code))
    and (nullif(trim(coalesce(p_related_to,'')),'') is null or c.id=p_related_to or exists(select 1 from public.records rel where rel.organization_id=p_organization_id and rel.collection='correspondenceAudit' and rel.data->>'event'='relation_created' and ((rel.data->>'sourceId'=p_related_to and rel.data->>'targetId'=c.id) or (rel.data->>'targetId'=p_related_to and rel.data->>'sourceId'=c.id))))
  order by coalesce(c.data->>'registeredAt',c.data->>'createdAt','') desc
$$;
revoke all on function public.office_archive_search(uuid,text,text,text,text) from public,anon;
grant execute on function public.office_archive_search(uuid,text,text,text,text) to authenticated;

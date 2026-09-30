create or replace function public.office_classify_correspondence(
  p_organization_id uuid,
  p_correspondence_id text,
  p_folder text,
  p_classification_code text,
  p_tags text[]
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
     or not (
       private.has_org_capability(p_organization_id,'office_automation','archive')
       or private.has_org_capability(p_organization_id,'office_automation','configure')
     )
  then raise exception 'archive permission required' using errcode='42501'; end if;
  select * into v_source from public.records r
  where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read')
  then raise exception 'correspondence not found or not readable' using errcode='42501'; end if;
  if length(coalesce(p_folder,''))>120 then raise exception 'archive folder too long' using errcode='22023'; end if;
  if length(coalesce(p_classification_code,''))>64 then raise exception 'classification code too long' using errcode='22023'; end if;
  if cardinality(v_tags)>20 or exists(select 1 from unnest(v_tags) t where length(t)>64)
  then raise exception 'invalid archive tags' using errcode='22023'; end if;
  v_id:='ARC_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(
    p_organization_id,v_uid,'correspondenceAudit',v_id,
    jsonb_build_object(
      'event','archive_classified','correspondenceId',p_correspondence_id,
      'folder',trim(coalesce(p_folder,'')),
      'classificationCode',trim(coalesce(p_classification_code,'')),
      'tags',to_jsonb(v_tags),'actorUserId',v_uid,'at',clock_timestamp()
    )
  );
  return v_id;
end $$;
revoke all on function public.office_classify_correspondence(uuid,text,text,text,text[]) from public,anon;
grant execute on function public.office_classify_correspondence(uuid,text,text,text,text[]) to authenticated;

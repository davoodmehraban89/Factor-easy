
-- Office Slice C7: ranked full-text archive search + OCR-text provenance/correction.
-- C7 connects no OCR provider and makes no OCR accuracy claim; real Persian OCR accuracy remains unverified.

create or replace function private.office_record_ocr_text_impl(
  p_organization_id uuid,
  p_correspondence_id text,
  p_mode text,
  p_raw_text text,
  p_corrected_text text,
  p_source_engine text,
  p_source_ref text,
  p_confidence numeric
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_source public.records%rowtype;
  v_latest public.records%rowtype;
  v_event_id text;
  v_version integer := 1;
  v_raw_text text;
  v_corrected_text text;
  v_engine text;
  v_source_ref text;
  v_confidence numeric;
  v_previous_id text;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_mode not in ('provider_output','human_correction') then raise exception 'invalid OCR evidence mode' using errcode='22023'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
     or not (private.has_org_capability(p_organization_id,'office_automation','archive')
             or private.has_org_capability(p_organization_id,'office_automation','configure'))
  then raise exception 'archive permission required' using errcode='42501'; end if;

  select * into v_source from public.records r
  where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read')
  then raise exception 'correspondence not found or not readable' using errcode='42501'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text||':office-ocr:'||p_correspondence_id,0)
  );

  select * into v_latest from public.records a
  where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
    and a.data->>'event'='ocr_text_recorded' and a.data->>'correspondenceId'=p_correspondence_id
  order by coalesce(nullif(a.data->>'version','')::integer,0) desc,
           nullif(a.data->>'at','')::timestamptz desc
  limit 1;

  if found then
    v_version:=coalesce(nullif(v_latest.data->>'version','')::integer,0)+1;
    v_previous_id:=v_latest.id;
  end if;

  if p_mode='provider_output' then
    v_raw_text:=trim(coalesce(p_raw_text,''));
    v_corrected_text:=null;
    v_engine:=trim(coalesce(p_source_engine,''));
    v_source_ref:=trim(coalesce(p_source_ref,''));
    v_confidence:=p_confidence;
    if v_raw_text='' then raise exception 'provider OCR raw text required' using errcode='22023'; end if;
    if v_engine='' then raise exception 'OCR source engine required' using errcode='22023'; end if;
    if p_confidence is not null and (p_confidence<0 or p_confidence>1)
    then raise exception 'OCR confidence must be between 0 and 1' using errcode='22023'; end if;
  else
    if not found then raise exception 'prior OCR evidence required for human correction' using errcode='22023'; end if;
    v_corrected_text:=trim(coalesce(p_corrected_text,''));
    if v_corrected_text='' then raise exception 'corrected OCR text required' using errcode='22023'; end if;
    v_raw_text:=coalesce(v_latest.data->>'rawText','');
    v_engine:=coalesce(v_latest.data->>'sourceEngine','');
    v_source_ref:=coalesce(v_latest.data->>'sourceRef','');
    begin v_confidence:=nullif(v_latest.data->>'confidence','')::numeric; exception when others then v_confidence:=null; end;
  end if;

  if length(v_raw_text)>250000 or length(coalesce(v_corrected_text,''))>250000
  then raise exception 'OCR text too long' using errcode='22023'; end if;
  if length(v_engine)>120 or length(v_source_ref)>500
  then raise exception 'OCR provenance field too long' using errcode='22023'; end if;

  v_event_id:='OCR_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(
    p_organization_id,v_uid,'correspondenceAudit',v_event_id,
    jsonb_build_object(
      'event','ocr_text_recorded',
      'correspondenceId',p_correspondence_id,
      'version',v_version,
      'sourceKind',p_mode,
      'rawText',v_raw_text,
      'correctedText',v_corrected_text,
      'effectiveText',coalesce(v_corrected_text,v_raw_text),
      'sourceEngine',v_engine,
      'sourceRef',v_source_ref,
      'confidence',v_confidence,
      'previousOcrEventId',v_previous_id,
      'providerVerified',false,
      'accuracyVerified',false,
      'actorUserId',v_uid,
      'at',clock_timestamp()
    )
  );
  return v_event_id;
end $$;
revoke all on function private.office_record_ocr_text_impl(uuid,text,text,text,text,text,text,numeric) from public,anon;
grant execute on function private.office_record_ocr_text_impl(uuid,text,text,text,text,text,text,numeric) to authenticated;

create or replace function public.office_record_ocr_text(
  p_organization_id uuid,
  p_correspondence_id text,
  p_mode text,
  p_raw_text text default null,
  p_corrected_text text default null,
  p_source_engine text default null,
  p_source_ref text default null,
  p_confidence numeric default null
) returns text
language sql security invoker set search_path=''
as $$
  select private.office_record_ocr_text_impl(
    p_organization_id,p_correspondence_id,p_mode,p_raw_text,p_corrected_text,p_source_engine,p_source_ref,p_confidence
  )
$$;
revoke all on function public.office_record_ocr_text(uuid,text,text,text,text,text,text,numeric) from public,anon;
grant execute on function public.office_record_ocr_text(uuid,text,text,text,text,text,text,numeric) to authenticated;

create or replace function private.office_latest_ocr_text_impl(p_organization_id uuid,p_correspondence_id text)
returns table(
  event_id text,version integer,source_kind text,raw_text text,corrected_text text,effective_text text,
  source_engine text,source_ref text,confidence numeric,recorded_at timestamptz,recorded_by uuid
)
language sql stable security definer set search_path=''
as $$
  select
    a.id,
    coalesce(nullif(a.data->>'version','')::integer,0),
    a.data->>'sourceKind',
    coalesce(a.data->>'rawText',''),
    nullif(a.data->>'correctedText',''),
    coalesce(nullif(a.data->>'correctedText',''),a.data->>'rawText',''),
    coalesce(a.data->>'sourceEngine',''),
    coalesce(a.data->>'sourceRef',''),
    case when nullif(a.data->>'confidence','') is null then null else (a.data->>'confidence')::numeric end,
    nullif(a.data->>'at','')::timestamptz,
    nullif(a.data->>'actorUserId','')::uuid
  from public.records c
  join lateral (
    select x.*
    from public.records x
    where x.organization_id=p_organization_id and x.collection='correspondenceAudit'
      and x.data->>'event'='ocr_text_recorded' and x.data->>'correspondenceId'=p_correspondence_id
    order by coalesce(nullif(x.data->>'version','')::integer,0) desc,
             nullif(x.data->>'at','')::timestamptz desc
    limit 1
  ) a on true
  where c.organization_id=p_organization_id and c.collection='correspondence' and c.id=p_correspondence_id
    and private.organization_has_module_entitlement(p_organization_id,'office_automation',false)
    and private.can_access_record(p_organization_id,'correspondence',c.owner_id,c.data,'read')
$$;
revoke all on function private.office_latest_ocr_text_impl(uuid,text) from public,anon;
grant execute on function private.office_latest_ocr_text_impl(uuid,text) to authenticated;

create or replace function public.office_latest_ocr_text(p_organization_id uuid,p_correspondence_id text)
returns table(
  event_id text,version integer,source_kind text,raw_text text,corrected_text text,effective_text text,
  source_engine text,source_ref text,confidence numeric,recorded_at timestamptz,recorded_by uuid
)
language sql stable security invoker set search_path=''
as $$ select * from private.office_latest_ocr_text_impl(p_organization_id,p_correspondence_id) $$;
revoke all on function public.office_latest_ocr_text(uuid,text) from public,anon;
grant execute on function public.office_latest_ocr_text(uuid,text) to authenticated;

create or replace function private.office_archive_full_text_search_impl(
  p_organization_id uuid,
  p_query text,
  p_folder text,
  p_classification_code text,
  p_related_to text
) returns table(
  correspondence_id text,register_number text,subject text,counterparty text,status text,
  folder text,classification_code text,tags text[],related_count bigint,
  search_rank real,ocr_state text,ocr_version integer,ocr_source_engine text
)
language sql stable security definer set search_path=''
as $$
  with params as (
    select case
      when nullif(trim(coalesce(p_query,'')),'') is null then null::tsquery
      else websearch_to_tsquery('simple',trim(p_query))
    end as tsq
  ),
  source as (
    select
      c.*,cls.data classification_data,ocr.data ocr_data,
      (
        setweight(to_tsvector('simple',concat_ws(' ',coalesce(c.data->>'registerNumber',''),coalesce(c.data->>'subject',''))),'A') ||
        setweight(to_tsvector('simple',concat_ws(' ',coalesce(c.data->>'counterparty',''),coalesce(c.data->>'externalNumber',''))),'B') ||
        setweight(to_tsvector('simple',coalesce(c.data->>'body','')),'C') ||
        setweight(to_tsvector('simple',concat_ws(' ',
          coalesce(cls.data->>'folder',''),coalesce(cls.data->>'classificationCode',''),coalesce((cls.data->'tags')::text,''),
          coalesce(ocr.data->>'effectiveText',ocr.data->>'correctedText',ocr.data->>'rawText','')
        )),'D')
      ) as search_document
    from public.records c
    left join lateral (
      select a.data from public.records a
      where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
        and a.data->>'event'='archive_classified' and a.data->>'correspondenceId'=c.id
      order by nullif(a.data->>'at','')::timestamptz desc limit 1
    ) cls on true
    left join lateral (
      select a.data from public.records a
      where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
        and a.data->>'event'='ocr_text_recorded' and a.data->>'correspondenceId'=c.id
      order by coalesce(nullif(a.data->>'version','')::integer,0) desc,
               nullif(a.data->>'at','')::timestamptz desc limit 1
    ) ocr on true
    where c.organization_id=p_organization_id and c.collection='correspondence'
      and private.can_access_record(p_organization_id,'correspondence',c.owner_id,c.data,'read')
  )
  select
    s.id,s.data->>'registerNumber',s.data->>'subject',s.data->>'counterparty',s.data->>'status',
    coalesce(s.classification_data->>'folder',''),coalesce(s.classification_data->>'classificationCode',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(s.classification_data->'tags','[]'::jsonb))),array[]::text[]),
    (select count(*) from public.records rel
      where rel.organization_id=p_organization_id and rel.collection='correspondenceAudit'
        and rel.data->>'event'='relation_created'
        and (rel.data->>'sourceId'=s.id or rel.data->>'targetId'=s.id)),
    case when p.tsq is null then 0::real else ts_rank_cd(s.search_document,p.tsq) end,
    case
      when s.ocr_data is null then 'none'
      when s.ocr_data->>'sourceKind'='human_correction' then 'corrected'
      else 'provider_output'
    end,
    coalesce(nullif(s.ocr_data->>'version','')::integer,0),
    coalesce(s.ocr_data->>'sourceEngine','')
  from source s cross join params p
  where private.organization_has_module_entitlement(p_organization_id,'office_automation',false)
    and (p.tsq is null or s.search_document @@ p.tsq)
    and (nullif(trim(coalesce(p_folder,'')),'') is null or s.classification_data->>'folder'=trim(p_folder))
    and (nullif(trim(coalesce(p_classification_code,'')),'') is null or s.classification_data->>'classificationCode'=trim(p_classification_code))
    and (nullif(trim(coalesce(p_related_to,'')),'') is null or s.id=p_related_to or exists(
      select 1 from public.records rel
      where rel.organization_id=p_organization_id and rel.collection='correspondenceAudit'
        and rel.data->>'event'='relation_created'
        and ((rel.data->>'sourceId'=p_related_to and rel.data->>'targetId'=s.id)
          or (rel.data->>'targetId'=p_related_to and rel.data->>'sourceId'=s.id))
    ))
  order by
    case when p.tsq is null then 0::real else ts_rank_cd(s.search_document,p.tsq) end desc,
    coalesce(s.data->>'registeredAt',s.data->>'createdAt','') desc
$$;
revoke all on function private.office_archive_full_text_search_impl(uuid,text,text,text,text) from public,anon;
grant execute on function private.office_archive_full_text_search_impl(uuid,text,text,text,text) to authenticated;

create or replace function public.office_archive_full_text_search(
  p_organization_id uuid,
  p_query text default null,
  p_folder text default null,
  p_classification_code text default null,
  p_related_to text default null
) returns table(
  correspondence_id text,register_number text,subject text,counterparty text,status text,
  folder text,classification_code text,tags text[],related_count bigint,
  search_rank real,ocr_state text,ocr_version integer,ocr_source_engine text
)
language sql stable security invoker set search_path=''
as $$
  select * from private.office_archive_full_text_search_impl(
    p_organization_id,p_query,p_folder,p_classification_code,p_related_to
  )
$$;
revoke all on function public.office_archive_full_text_search(uuid,text,text,text,text) from public,anon;
grant execute on function public.office_archive_full_text_search(uuid,text,text,text,text) to authenticated;

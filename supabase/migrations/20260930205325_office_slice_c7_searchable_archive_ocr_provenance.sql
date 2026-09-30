-- Office Slice C7 searchable archive and OCR provenance.
-- C7 does not perform OCR and makes no real Persian OCR accuracy claim.

create or replace function private.office_record_ocr_evidence_impl(p_organization_id uuid,p_correspondence_id text,p_source_ref text,p_provider text,p_language text,p_confidence numeric,p_text text) returns text language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_source public.records%rowtype; v_id text;
begin
 if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
 if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true) or not (private.has_org_capability(p_organization_id,'office_automation','archive') or private.has_org_capability(p_organization_id,'office_automation','configure')) then raise exception 'archive permission required' using errcode='42501'; end if;
 select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id;
 if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read') then raise exception 'correspondence not found or not readable' using errcode='42501'; end if;
 if length(trim(coalesce(p_source_ref,'')))<1 or length(p_source_ref)>500 then raise exception 'invalid OCR source reference' using errcode='22023'; end if;
 if length(trim(coalesce(p_provider,'')))<1 or length(p_provider)>120 then raise exception 'invalid OCR provider' using errcode='22023'; end if;
 if length(trim(coalesce(p_language,'')))<1 or length(p_language)>32 then raise exception 'invalid OCR language' using errcode='22023'; end if;
 if p_confidence is not null and (p_confidence<0 or p_confidence>1) then raise exception 'invalid OCR confidence' using errcode='22023'; end if;
 if length(trim(coalesce(p_text,'')))<1 or length(p_text)>200000 then raise exception 'invalid OCR text' using errcode='22023'; end if;
 v_id:='OCR_'||replace(gen_random_uuid()::text,'-','');
 insert into public.records(organization_id,owner_id,collection,id,data) values(p_organization_id,v_uid,'correspondenceAudit',v_id,jsonb_build_object('event','ocr_text_captured','correspondenceId',p_correspondence_id,'sourceRef',trim(p_source_ref),'provider',trim(p_provider),'language',trim(p_language),'confidence',p_confidence,'rawText',p_text,'actorUserId',v_uid,'at',clock_timestamp(),'performsOcr',false,'persianAccuracyVerified',false));
 return v_id;
end $$;
revoke all on function private.office_record_ocr_evidence_impl(uuid,text,text,text,text,numeric,text) from public,anon; grant execute on function private.office_record_ocr_evidence_impl(uuid,text,text,text,text,numeric,text) to authenticated;
create or replace function public.office_record_ocr_evidence(p_organization_id uuid,p_correspondence_id text,p_source_ref text,p_provider text,p_language text,p_confidence numeric,p_text text) returns text language sql security invoker set search_path='' as $$ select private.office_record_ocr_evidence_impl(p_organization_id,p_correspondence_id,p_source_ref,p_provider,p_language,p_confidence,p_text) $$;
revoke all on function public.office_record_ocr_evidence(uuid,text,text,text,text,numeric,text) from public,anon; grant execute on function public.office_record_ocr_evidence(uuid,text,text,text,text,numeric,text) to authenticated;

create or replace function private.office_correct_ocr_evidence_impl(p_organization_id uuid,p_ocr_evidence_id text,p_corrected_text text,p_note text) returns text language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_ocr public.records%rowtype; v_source public.records%rowtype; v_id text;
begin
 if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
 if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true) or not (private.has_org_capability(p_organization_id,'office_automation','archive') or private.has_org_capability(p_organization_id,'office_automation','configure')) then raise exception 'archive permission required' using errcode='42501'; end if;
 select * into v_ocr from public.records r where r.organization_id=p_organization_id and r.collection='correspondenceAudit' and r.id=p_ocr_evidence_id and r.data->>'event'='ocr_text_captured';
 if not found then raise exception 'OCR evidence not found' using errcode='42501'; end if;
 select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=v_ocr.data->>'correspondenceId';
 if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read') then raise exception 'correspondence not found or not readable' using errcode='42501'; end if;
 if length(trim(coalesce(p_corrected_text,'')))<1 or length(p_corrected_text)>200000 then raise exception 'invalid corrected OCR text' using errcode='22023'; end if;
 if length(coalesce(p_note,''))>1000 then raise exception 'OCR correction note too long' using errcode='22023'; end if;
 v_id:='OCRC_'||replace(gen_random_uuid()::text,'-','');
 insert into public.records(organization_id,owner_id,collection,id,data) values(p_organization_id,v_uid,'correspondenceAudit',v_id,jsonb_build_object('event','ocr_text_corrected','correspondenceId',v_ocr.data->>'correspondenceId','ocrEvidenceId',v_ocr.id,'correctedText',p_corrected_text,'note',coalesce(p_note,''),'actorUserId',v_uid,'at',clock_timestamp()));
 return v_id;
end $$;
revoke all on function private.office_correct_ocr_evidence_impl(uuid,text,text,text) from public,anon; grant execute on function private.office_correct_ocr_evidence_impl(uuid,text,text,text) to authenticated;
create or replace function public.office_correct_ocr_evidence(p_organization_id uuid,p_ocr_evidence_id text,p_corrected_text text,p_note text default null) returns text language sql security invoker set search_path='' as $$ select private.office_correct_ocr_evidence_impl(p_organization_id,p_ocr_evidence_id,p_corrected_text,p_note) $$;
revoke all on function public.office_correct_ocr_evidence(uuid,text,text,text) from public,anon; grant execute on function public.office_correct_ocr_evidence(uuid,text,text,text) to authenticated;

create or replace function private.office_archive_search_v2_impl(p_organization_id uuid,p_query text,p_folder text,p_classification_code text,p_related_to text,p_limit integer)
returns table(correspondence_id text,register_number text,subject text,counterparty text,status text,folder text,classification_code text,tags text[],related_count bigint,match_source text,ocr_evidence_id text,ocr_provider text,ocr_language text,ocr_confidence numeric,ocr_corrected boolean)
language sql stable security definer set search_path='' as $$
with params as (select nullif(trim(coalesce(p_query,'')),'') q,least(greatest(coalesce(p_limit,100),1),200) lim), docs as (
 select c.*,coalesce(cls.data->>'folder','') folder,coalesce(cls.data->>'classificationCode','') classification_code,coalesce(array(select jsonb_array_elements_text(coalesce(cls.data->'tags','[]'::jsonb))),array[]::text[]) tags,ocr.id ocr_id,ocr.data ocr_data,corr.data correction_data,
 concat_ws(' ',c.data->>'registerNumber',c.data->>'externalNumber',c.data->>'subject',c.data->>'counterparty',c.data->>'body',coalesce(cls.data->>'folder',''),coalesce(cls.data->>'classificationCode',''),coalesce((cls.data->'tags')::text,'')) metadata_text,coalesce(corr.data->>'correctedText',ocr.data->>'rawText','') ocr_text
 from public.records c
 left join lateral (select a.data from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'event'='archive_classified' and a.data->>'correspondenceId'=c.id order by nullif(a.data->>'at','')::timestamptz desc limit 1) cls on true
 left join lateral (select a.id,a.data from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'event'='ocr_text_captured' and a.data->>'correspondenceId'=c.id order by nullif(a.data->>'at','')::timestamptz desc limit 1) ocr on true
 left join lateral (select a.data from public.records a where a.organization_id=p_organization_id and a.collection='correspondenceAudit' and a.data->>'event'='ocr_text_corrected' and a.data->>'ocrEvidenceId'=ocr.id order by nullif(a.data->>'at','')::timestamptz desc limit 1) corr on true
 where c.organization_id=p_organization_id and c.collection='correspondence' and private.can_access_record(p_organization_id,'correspondence',c.owner_id,c.data,'read'))
select d.id,d.data->>'registerNumber',d.data->>'subject',d.data->>'counterparty',d.data->>'status',d.folder,d.classification_code,d.tags,
 (select count(*) from public.records rel where rel.organization_id=p_organization_id and rel.collection='correspondenceAudit' and rel.data->>'event'='relation_created' and (rel.data->>'sourceId'=d.id or rel.data->>'targetId'=d.id)),
 case when p.q is null then 'metadata' when to_tsvector('simple',d.ocr_text) @@ websearch_to_tsquery('simple',p.q) then 'ocr' when to_tsvector('simple',d.metadata_text) @@ websearch_to_tsquery('simple',p.q) then case when to_tsvector('simple',coalesce(d.data->>'body','')) @@ websearch_to_tsquery('simple',p.q) then 'body' else 'metadata' end else 'metadata' end,
 d.ocr_id,d.ocr_data->>'provider',d.ocr_data->>'language',nullif(d.ocr_data->>'confidence','')::numeric,(d.correction_data is not null)
from docs d cross join params p
where (p.q is null or (length(p.q)<=200 and (to_tsvector('simple',d.metadata_text)||to_tsvector('simple',d.ocr_text)) @@ websearch_to_tsquery('simple',p.q)))
 and (nullif(trim(coalesce(p_folder,'')),'') is null or d.folder=trim(p_folder))
 and (nullif(trim(coalesce(p_classification_code,'')),'') is null or d.classification_code=trim(p_classification_code))
 and (nullif(trim(coalesce(p_related_to,'')),'') is null or d.id=p_related_to or exists(select 1 from public.records rel where rel.organization_id=p_organization_id and rel.collection='correspondenceAudit' and rel.data->>'event'='relation_created' and ((rel.data->>'sourceId'=p_related_to and rel.data->>'targetId'=d.id) or (rel.data->>'targetId'=p_related_to and rel.data->>'sourceId'=d.id))))
order by coalesce(d.data->>'registeredAt',d.data->>'createdAt','') desc limit (select lim from params)
$$;
revoke all on function private.office_archive_search_v2_impl(uuid,text,text,text,text,integer) from public,anon; grant execute on function private.office_archive_search_v2_impl(uuid,text,text,text,text,integer) to authenticated;

create or replace function public.office_archive_search_v2(p_organization_id uuid,p_query text default null,p_folder text default null,p_classification_code text default null,p_related_to text default null,p_limit integer default 100)
returns table(correspondence_id text,register_number text,subject text,counterparty text,status text,folder text,classification_code text,tags text[],related_count bigint,match_source text,ocr_evidence_id text,ocr_provider text,ocr_language text,ocr_confidence numeric,ocr_corrected boolean)
language sql stable security invoker set search_path='' as $$ select * from private.office_archive_search_v2_impl(p_organization_id,p_query,p_folder,p_classification_code,p_related_to,p_limit) $$;
revoke all on function public.office_archive_search_v2(uuid,text,text,text,text,integer) from public,anon; grant execute on function public.office_archive_search_v2(uuid,text,text,text,text,integer) to authenticated;

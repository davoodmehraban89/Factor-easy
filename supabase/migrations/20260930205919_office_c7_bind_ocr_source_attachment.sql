
create or replace function private.office_record_ocr_evidence_impl(
 p_organization_id uuid,p_correspondence_id text,p_source_ref text,p_provider text,p_language text,p_confidence numeric,p_text text
) returns text language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid:=(select auth.uid());
 v_source public.records%rowtype;
 v_attachment public.records%rowtype;
 v_id text;
begin
 if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
 if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
    or not (private.has_org_capability(p_organization_id,'office_automation','archive')
            or private.has_org_capability(p_organization_id,'office_automation','configure'))
 then raise exception 'archive permission required' using errcode='42501'; end if;

 select * into v_source from public.records r
 where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id;
 if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read')
 then raise exception 'correspondence not found or not readable' using errcode='42501'; end if;

 if length(trim(coalesce(p_source_ref,'')))<1 or length(p_source_ref)>500
 then raise exception 'invalid OCR source reference' using errcode='22023'; end if;

 select * into v_attachment from public.records a
 where a.organization_id=p_organization_id
   and a.collection='correspondenceAttachments'
   and a.id=trim(p_source_ref)
   and a.data->>'correspondenceId'=p_correspondence_id
   and nullif(trim(coalesce(a.data->>'storagePath','')),'') is not null
 limit 1;
 if not found then raise exception 'OCR source attachment not found for correspondence' using errcode='42501'; end if;

 if length(trim(coalesce(p_provider,'')))<1 or length(p_provider)>120 then raise exception 'invalid OCR provider' using errcode='22023'; end if;
 if length(trim(coalesce(p_language,'')))<1 or length(p_language)>32 then raise exception 'invalid OCR language' using errcode='22023'; end if;
 if p_confidence is not null and (p_confidence<0 or p_confidence>1) then raise exception 'invalid OCR confidence' using errcode='22023'; end if;
 if length(trim(coalesce(p_text,'')))<1 or length(p_text)>200000 then raise exception 'invalid OCR text' using errcode='22023'; end if;

 v_id:='OCR_'||replace(gen_random_uuid()::text,'-','');
 insert into public.records(organization_id,owner_id,collection,id,data)
 values(p_organization_id,v_uid,'correspondenceAudit',v_id,
   jsonb_build_object(
    'event','ocr_text_captured','correspondenceId',p_correspondence_id,
    'sourceRef',v_attachment.id,'sourceStoragePath',v_attachment.data->>'storagePath',
    'provider',trim(p_provider),'language',trim(p_language),'confidence',p_confidence,'rawText',p_text,
    'actorUserId',v_uid,'at',clock_timestamp(),'performsOcr',false,'persianAccuracyVerified',false
   ));
 return v_id;
end $$;
revoke all on function private.office_record_ocr_evidence_impl(uuid,text,text,text,text,numeric,text) from public,anon;
grant execute on function private.office_record_ocr_evidence_impl(uuid,text,text,text,text,numeric,text) to authenticated;

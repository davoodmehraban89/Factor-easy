create or replace function public.office_archive_search_v2(p_organization_id uuid,p_query text default null,p_folder text default null,p_classification_code text default null,p_related_to text default null,p_limit integer default 100)
returns table(correspondence_id text,register_number text,subject text,counterparty text,status text,folder text,classification_code text,tags text[],related_count bigint,match_source text,ocr_evidence_id text,ocr_provider text,ocr_language text,ocr_confidence numeric,ocr_corrected boolean)
language plpgsql stable security invoker set search_path='' as $$
begin
 if length(coalesce(p_query,''))>200 then raise exception 'archive query too long' using errcode='22023'; end if;
 if coalesce(p_limit,100)<1 or coalesce(p_limit,100)>200 then raise exception 'archive result limit out of range' using errcode='22023'; end if;
 return query select * from private.office_archive_search_v2_impl(p_organization_id,p_query,p_folder,p_classification_code,p_related_to,p_limit);
end $$;
revoke all on function public.office_archive_search_v2(uuid,text,text,text,text,integer) from public,anon;
grant execute on function public.office_archive_search_v2(uuid,text,text,text,text,integer) to authenticated;

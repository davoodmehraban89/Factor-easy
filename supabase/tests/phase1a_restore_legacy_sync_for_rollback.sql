-- LEGACY SYNC FUNCTION BODY REPLAY IN DISPOSABLE TEST ROLLBACK ONLY.
-- Captured read-only from Production 2026-10-16. NEVER run against Production.
-- Only SQL function definitions; no tenant records, PII or credentials.
DROP FUNCTION IF EXISTS public.finora_sync_records(jsonb,jsonb);
DROP FUNCTION IF EXISTS public.finora_sync_records(jsonb,jsonb,uuid);
CREATE OR REPLACE FUNCTION public.finora_sync_records(p_upserts jsonb DEFAULT '[]'::jsonb, p_deletes jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_active_license() then raise exception 'active license required'; end if;
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_upserts,'[]'::jsonb)) as x(collection text,id text,data jsonb)
    where not private.has_collection_entitlement(x.collection)
  ) or exists (
    select 1 from jsonb_to_recordset(coalesce(p_deletes,'[]'::jsonb)) as d(collection text,id text)
    where not private.has_collection_entitlement(d.collection)
  ) then raise exception 'module entitlement required' using errcode='42501'; end if;

  insert into public.records(owner_id, collection, id, data)
  select auth.uid(), x.collection, x.id, x.data
  from jsonb_to_recordset(coalesce(p_upserts,'[]'::jsonb)) as x(collection text,id text,data jsonb)
  on conflict (owner_id,collection,id) do update set data=excluded.data;

  delete from public.records r
  using jsonb_to_recordset(coalesce(p_deletes,'[]'::jsonb)) as d(collection text,id text)
  where r.owner_id=auth.uid() and r.collection=d.collection and r.id=d.id;
end $function$;

CREATE OR REPLACE FUNCTION public.finora_sync_records(p_upserts jsonb DEFAULT '[]'::jsonb, p_deletes jsonb DEFAULT '[]'::jsonb, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_org uuid:=coalesce(p_organization_id,private.default_organization_id());
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if v_org is null or v_org not in (select private.current_organization_ids()) then raise exception 'organization membership required' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(v_org,'core',true) then raise exception 'active license required' using errcode='42501'; end if;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_upserts,'[]'::jsonb)) as x(collection text,id text,data jsonb) where not private.organization_has_module_entitlement(v_org,private.collection_module(x.collection),true)) or exists(select 1 from jsonb_to_recordset(coalesce(p_deletes,'[]'::jsonb)) as d(collection text,id text) where not private.organization_has_module_entitlement(v_org,private.collection_module(d.collection),true)) then raise exception 'module entitlement required' using errcode='42501'; end if;
  insert into public.records(organization_id,owner_id,collection,id,data)
  select v_org,(select auth.uid()),x.collection,x.id,x.data from jsonb_to_recordset(coalesce(p_upserts,'[]'::jsonb)) as x(collection text,id text,data jsonb)
  on conflict (organization_id,collection,id) do update set data=excluded.data;
  delete from public.records r using jsonb_to_recordset(coalesce(p_deletes,'[]'::jsonb)) as d(collection text,id text) where r.organization_id=v_org and r.collection=d.collection and r.id=d.id;
end $function$;
REVOKE ALL ON FUNCTION public.finora_sync_records(jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finora_sync_records(jsonb,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finora_sync_records(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_sync_records(jsonb,jsonb,uuid) TO authenticated;

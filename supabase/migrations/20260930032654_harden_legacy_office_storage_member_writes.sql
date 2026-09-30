create or replace function private.can_access_office_storage(p_name text,p_capability text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare parts text[]:=string_to_array(p_name,'/'); v_org uuid; v_cor text; v_row public.records%rowtype;
begin
  if array_length(parts,1) is null then return false; end if;
  if parts[1]=(select auth.uid())::text then
    if p_capability='read' then return private.has_module_entitlement('office_automation'); end if;
    return exists(select 1 from private.current_organization_ids() org_id where private.is_org_owner(org_id) and private.organization_has_module_entitlement(org_id,'office_automation',true));
  end if;
  if parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  v_org:=parts[1]::uuid;
  if p_capability='create' then return parts[2]=(select auth.uid())::text and private.organization_has_module_entitlement(v_org,'office_automation',true) and private.has_org_capability(v_org,'office_automation','create'); end if;
  v_cor:=parts[3];
  select * into v_row from public.records where organization_id=v_org and collection='correspondence' and id=v_cor;
  if not found then return false; end if;
  return private.can_access_record(v_org,'correspondence',v_row.owner_id,v_row.data,p_capability);
end $$;

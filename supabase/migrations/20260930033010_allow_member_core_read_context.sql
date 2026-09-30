create or replace function private.has_org_capability(p_organization_id uuid,p_module_key text,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active'
      and ((p_module_key='core' and p_capability='read') or m.is_owner or exists(select 1 from public.member_module_permissions p where p.organization_id=p_organization_id and p.member_id=m.id and (p.module_key=p_module_key or p.module_key='full_suite') and p_capability=any(p.capabilities))))
$$;
create or replace function private.record_in_member_scope(p_organization_id uuid,p_module_key text,p_owner_id uuid,p_data jsonb,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active'
      and ((p_module_key='core' and p_capability='read') or m.is_owner or exists(select 1 from public.member_module_permissions p where p.organization_id=p_organization_id and p.member_id=m.id and (p.module_key=p_module_key or p.module_key='full_suite') and p_capability=any(p.capabilities) and (p.scope_type='organization' or (p.scope_type='own' and p_owner_id=(select auth.uid())) or (p.scope_type='company' and p.scope_id=coalesce(p_data->>'companyId',p_data->>'company_id')) or (p.scope_type='branch' and p.scope_id=coalesce(p_data->>'branchId',p_data->>'branch_id')) or (p.scope_type='unit' and p.scope_id=coalesce(p_data->>'unitId',p_data->>'unit_id'))))))
$$;
create or replace function private.record_confidentiality_allowed(p_organization_id uuid,p_module_key text,p_data jsonb) returns boolean
language sql stable security definer set search_path='' as $$
  select case when p_module_key='core' then p_organization_id in (select private.current_organization_ids()) else exists(
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active'
      and (m.is_owner or coalesce((select max(p.confidentiality_level) from public.member_module_permissions p where p.organization_id=p_organization_id and p.member_id=m.id and (p.module_key=p_module_key or p.module_key='full_suite')),-1) >= (case lower(coalesce(p_data->>'confidentiality','normal')) when 'محرمانه' then 1 when 'confidential' then 1 when 'خیلی محرمانه' then 2 when 'very_confidential' then 2 when 'سری' then 3 when 'secret' then 3 else 0 end))
  ) end
$$;

-- ELI-2 follow-up: enforce tenant integrity and entitlement on direct table mutation paths.

create or replace function private.enforce_organization_role_tenant_integrity()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if tg_table_name='organization_role_permissions' then
    if not exists(
      select 1 from public.organization_roles r
      where r.id=new.role_id and r.organization_id=new.organization_id
    ) then raise exception 'role/organization mismatch' using errcode='23514'; end if;
    if not private.role_permission_allowed(new.organization_id,new.module_key) then
      raise exception 'module not licensed' using errcode='42501';
    end if;
  elsif tg_table_name='organization_member_roles' then
    if not exists(
      select 1 from public.organization_members m
      where m.id=new.member_id and m.organization_id=new.organization_id and not m.is_owner
    ) then raise exception 'member/organization mismatch' using errcode='23514'; end if;
    if not exists(
      select 1 from public.organization_roles r
      where r.id=new.role_id and r.organization_id=new.organization_id and r.active
    ) then raise exception 'role/organization mismatch' using errcode='23514'; end if;
  end if;
  return new;
end $$;

revoke all on function private.enforce_organization_role_tenant_integrity() from public,anon,authenticated;

drop trigger if exists trg_role_permission_tenant_integrity on public.organization_role_permissions;
create trigger trg_role_permission_tenant_integrity
before insert or update on public.organization_role_permissions
for each row execute function private.enforce_organization_role_tenant_integrity();

drop trigger if exists trg_member_role_tenant_integrity on public.organization_member_roles;
create trigger trg_member_role_tenant_integrity
before insert or update on public.organization_member_roles
for each row execute function private.enforce_organization_role_tenant_integrity();

drop policy if exists organization_role_permissions_mutate_insert on public.organization_role_permissions;
drop policy if exists organization_role_permissions_mutate_update on public.organization_role_permissions;
create policy organization_role_permissions_mutate_insert on public.organization_role_permissions for insert to authenticated
with check (
  (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'))
  and private.role_permission_allowed(organization_id,module_key)
);
create policy organization_role_permissions_mutate_update on public.organization_role_permissions for update to authenticated
using (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'))
with check (
  (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'))
  and private.role_permission_allowed(organization_id,module_key)
);

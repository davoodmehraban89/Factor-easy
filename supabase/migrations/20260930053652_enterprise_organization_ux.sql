-- ELI-4: typed organization hierarchy, tenant-integrity guard, capacity summary.

alter table public.organization_units add column if not exists unit_kind text not null default 'unit';
alter table public.organization_units drop constraint if exists organization_units_unit_kind_check;
alter table public.organization_units add constraint organization_units_unit_kind_check
check (unit_kind in ('region','branch','department','unit','subunit'));
create index if not exists organization_units_org_kind_idx on public.organization_units(organization_id,unit_kind,active);

create or replace function private.enforce_organization_unit_tree()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id=new.id then raise exception 'organization unit cannot parent itself' using errcode='23514'; end if;
  if not exists(select 1 from public.organization_units p where p.id=new.parent_id and p.organization_id=new.organization_id) then
    raise exception 'parent unit belongs to another organization' using errcode='23514';
  end if;
  if tg_op='UPDATE' and exists(
    with recursive descendants as (
      select u.id from public.organization_units u where u.parent_id=new.id
      union all
      select u.id from public.organization_units u join descendants d on u.parent_id=d.id
    ) select 1 from descendants where id=new.parent_id
  ) then raise exception 'organization unit cycle detected' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function private.enforce_organization_unit_tree() from public,anon,authenticated;
drop trigger if exists trg_organization_unit_tree on public.organization_units;
create trigger trg_organization_unit_tree before insert or update of organization_id,parent_id on public.organization_units
for each row execute function private.enforce_organization_unit_tree();

create or replace function public.organization_capacity_summary(p_organization_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
  if not (private.is_org_owner(p_organization_id) or private.has_org_capability(p_organization_id,'core','configure')) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select jsonb_build_object(
    'plan',l.plan,'status',l.status,'ends_at',l.ends_at,'modules',l.modules,
    'max_users',l.max_users,
    'active_users',(select count(*) from public.organization_members m where m.organization_id=p_organization_id and m.status='active'),
    'max_companies',l.max_companies,
    'company_count',(select count(*) from public.records r where r.organization_id=p_organization_id and r.collection='companies')
  ) into v from public.licenses l where l.organization_id=p_organization_id;
  if v is null then raise exception 'organization license not found'; end if;
  return v;
end $$;
revoke all on function public.organization_capacity_summary(uuid) from public,anon;
grant execute on function public.organization_capacity_summary(uuid) to authenticated;

create or replace function private.organization_unit_audit_capture()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_org uuid; v_id text;
begin
  v_org:=case when tg_op='DELETE' then old.organization_id else new.organization_id end;
  v_id:=case when tg_op='DELETE' then old.id::text else new.id::text end;
  insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data)
  values(v_org,(select auth.uid()),'organization_unit_'||lower(tg_op),'organization_unit',v_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.organization_unit_audit_capture() from public,anon,authenticated;
drop trigger if exists organization_units_audit on public.organization_units;
create trigger organization_units_audit after insert or update or delete on public.organization_units
for each row execute function private.organization_unit_audit_capture();

-- Prepared 2026-09-30. DO NOT apply without explicit schema/RPC approval.
-- Commercial license capacity: every license defaults to one company.
alter table public.licenses
  add column if not exists max_companies integer not null default 1;

alter table public.licenses
  drop constraint if exists licenses_max_companies_check;
alter table public.licenses
  add constraint licenses_max_companies_check check (max_companies between 1 and 1000);

-- Preserve existing tenants: default is one for new licenses, but never retroactively
-- place an existing owner below the number of companies already stored.
update public.licenses l
set max_companies = greatest(
  l.max_companies,
  coalesce((select count(*)::integer from public.records r where r.owner_id=l.user_id and r.collection='companies'),0),
  1
);

create or replace function public.admin_set_company_limit(target uuid, new_max_companies integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare existing_count integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new_max_companies is null or new_max_companies < 1 or new_max_companies > 1000 then
    raise exception 'invalid company limit';
  end if;
  select count(*) into existing_count
  from public.records
  where owner_id = target and collection = 'companies';
  if existing_count > new_max_companies then
    raise exception 'company limit below existing company count';
  end if;
  update public.licenses
     set max_companies = new_max_companies,
         updated_at = now()
   where user_id = target;
  if not found then raise exception 'user not found'; end if;
end
$$;

create or replace function public.finora_enforce_company_license_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare allowed_count integer;
declare actual_count integer;
begin
  if new.collection <> 'companies' then return new; end if;
  select max_companies into allowed_count
  from public.licenses
  where user_id = new.owner_id;
  if allowed_count is null then allowed_count := 1; end if;
  select count(*) into actual_count
  from public.records
  where owner_id = new.owner_id and collection = 'companies';
  if actual_count > allowed_count then
    raise exception 'company license limit exceeded' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function public.finora_enforce_company_license_limit() from public, anon, authenticated;

drop trigger if exists trg_finora_company_license_limit on public.records;
create trigger trg_finora_company_license_limit
after insert on public.records
for each row
when (new.collection = 'companies')
execute function public.finora_enforce_company_license_limit();

revoke all on function public.admin_set_company_limit(uuid, integer) from public;
grant execute on function public.admin_set_company_limit(uuid, integer) to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.licenses
  add column if not exists modules text[] not null default array['full_suite']::text[];

create or replace function private.is_valid_finora_module(module_key text)
returns boolean
language sql immutable security invoker set search_path = '' as $$
  select module_key = any(array[
    'full_suite','core','accounting','commerce','treasury','contracting','inventory','assets',
    'hr_payroll','office_automation','requests_workflow','crm','transport','manufacturing',
    'maintenance','group_consolidation','analytics'
  ]::text[])
$$;

create or replace function private.has_module_entitlement(module_key text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when module_key = 'core' then true
    else exists (
      select 1 from public.licenses l
      where l.user_id = (select auth.uid())
        and l.status in ('trial','active')
        and (l.plan = 'lifetime' or l.ends_at >= (now() at time zone 'Asia/Tehran')::date)
        and ('full_suite' = any(l.modules) or module_key = any(l.modules))
    )
  end
$$;

create or replace function private.collection_module(collection_key text)
returns text
language sql immutable security invoker set search_path = '' as $$
  select case
    when collection_key = any(array['companies','settings','importBatches','integrationConnections','integrationOutbox','phase5Audit','enterpriseAudit']::text[]) then 'core'
    when collection_key = any(array['fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','postingProfiles','journalVouchers','journalLines','journalLineDimensions','currencies','exchangeRates','costCenters','expenses','complianceRules','budgets','costDrivers','costAllocations']::text[]) then 'accounting'
    when collection_key = any(array['contacts','products','invoices','purchases']::text[]) then 'commerce'
    when collection_key = any(array['cheques','payments','cashboxes','pettyCashFunds','pettyCashTransactions']::text[]) then 'treasury'
    when collection_key = any(array['projects','projectLinks','contracts','contractAmendments','contractParties','contractDeductions','guarantees','guaranteeEvents','contractStatements','phase4Audit']::text[]) then 'contracting'
    when collection_key = any(array['warehouses','stockMovements','inventoryCounts']::text[]) then 'inventory'
    when collection_key = any(array['fixedAssets','assetDepreciations']::text[]) then 'assets'
    when collection_key = any(array['employees','employmentContracts','employeeLeave','payrollRuns','payrollLines','employeeBenefitAccruals']::text[]) then 'hr_payroll'
    when collection_key = 'intercompanyTransactions' then 'group_consolidation'
    when collection_key = any(array['officeRegistries','correspondence','correspondenceAttachments','correspondenceReferrals','correspondenceAudit']::text[]) then 'office_automation'
    when collection_key = any(array['requestTypes','requests','requestActions']::text[]) then 'requests_workflow'
    else null
  end
$$;

create or replace function private.has_collection_entitlement(collection_key text)
returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce(private.has_module_entitlement(private.collection_module(collection_key)), false)
$$;

revoke all on function private.is_valid_finora_module(text) from public, anon;
revoke all on function private.has_module_entitlement(text) from public, anon;
revoke all on function private.collection_module(text) from public, anon;
revoke all on function private.has_collection_entitlement(text) from public, anon;
grant execute on function private.is_valid_finora_module(text) to authenticated;
grant execute on function private.has_module_entitlement(text) to authenticated;
grant execute on function private.collection_module(text) to authenticated;
grant execute on function private.has_collection_entitlement(text) to authenticated;

create or replace function public.admin_set_license_modules(target uuid, new_modules text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare normalized text[];
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if new_modules is null or cardinality(new_modules)=0 then raise exception 'at least one module is required'; end if;
  if exists (select 1 from unnest(new_modules) m where not private.is_valid_finora_module(m)) then
    raise exception 'invalid module entitlement';
  end if;
  if 'full_suite' = any(new_modules) then normalized := array['full_suite']::text[];
  else select array_agg(distinct m order by m) into normalized from unnest(new_modules) m;
  end if;
  update public.licenses set modules=normalized, updated_at=now() where user_id=target;
  if not found then raise exception 'user not found'; end if;
end
$$;
revoke all on function public.admin_set_license_modules(uuid,text[]) from public, anon;
grant execute on function public.admin_set_license_modules(uuid,text[]) to authenticated;

alter table public.records drop constraint if exists records_collection_check;
alter table public.records add constraint records_collection_check check (collection = any(array[
  'companies','contacts','products','invoices','cheques','expenses','settings','purchases','payments',
  'fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','projects','projectLinks','postingProfiles',
  'journalVouchers','journalLines','journalLineDimensions','contracts','contractAmendments','contractParties','contractDeductions','guarantees','guaranteeEvents','contractStatements','phase4Audit',
  'warehouses','stockMovements','inventoryCounts','fixedAssets','assetDepreciations','currencies','exchangeRates','costCenters','importBatches','integrationConnections','integrationOutbox','phase5Audit',
  'employees','employmentContracts','employeeLeave','cashboxes','pettyCashFunds','complianceRules','payrollRuns','payrollLines','employeeBenefitAccruals','pettyCashTransactions','budgets','costDrivers','costAllocations','intercompanyTransactions','enterpriseAudit',
  'officeRegistries','correspondence','correspondenceAttachments','correspondenceReferrals','correspondenceAudit','requestTypes','requests','requestActions'
]::text[]));

-- Module entitlement is enforced at the data boundary, not only in the UI.
drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;
create policy records_select on public.records for select to authenticated
  using (owner_id=(select auth.uid()) and private.has_collection_entitlement(collection));
create policy records_insert on public.records for insert to authenticated
  with check (owner_id=(select auth.uid()) and public.has_active_license() and private.has_collection_entitlement(collection));
create policy records_update on public.records for update to authenticated
  using (owner_id=(select auth.uid()) and public.has_active_license() and private.has_collection_entitlement(collection))
  with check (owner_id=(select auth.uid()) and public.has_active_license() and private.has_collection_entitlement(collection));
create policy records_delete on public.records for delete to authenticated
  using (owner_id=(select auth.uid()) and public.has_active_license() and private.has_collection_entitlement(collection));

create or replace function public.finora_sync_records(p_upserts jsonb default '[]'::jsonb, p_deletes jsonb default '[]'::jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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
end $$;
revoke all on function public.finora_sync_records(jsonb,jsonb) from public, anon;
grant execute on function public.finora_sync_records(jsonb,jsonb) to authenticated;

-- Private office-document bucket. Object operations remain through Storage API; SQL only defines the bucket and RLS policies.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('office-attachments','office-attachments',false,20971520,array['application/pdf','image/jpeg','image/png','image/tiff']::text[])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists finora_office_files_select on storage.objects;
drop policy if exists finora_office_files_insert on storage.objects;
drop policy if exists finora_office_files_update on storage.objects;
drop policy if exists finora_office_files_delete on storage.objects;
create policy finora_office_files_select on storage.objects for select to authenticated
using (bucket_id='office-attachments' and owner_id=(select auth.uid()::text) and private.has_module_entitlement('office_automation'));
create policy finora_office_files_insert on storage.objects for insert to authenticated
with check (bucket_id='office-attachments' and (storage.foldername(name))[1]=(select auth.uid()::text) and private.has_module_entitlement('office_automation') and public.has_active_license());
create policy finora_office_files_update on storage.objects for update to authenticated
using (bucket_id='office-attachments' and owner_id=(select auth.uid()::text) and private.has_module_entitlement('office_automation') and public.has_active_license())
with check (bucket_id='office-attachments' and owner_id=(select auth.uid()::text) and private.has_module_entitlement('office_automation') and public.has_active_license());
create policy finora_office_files_delete on storage.objects for delete to authenticated
using (bucket_id='office-attachments' and owner_id=(select auth.uid()::text) and private.has_module_entitlement('office_automation') and public.has_active_license());
alter table public.records drop constraint if exists records_collection_check;
alter table public.records add constraint records_collection_check check (collection = any (array[
'companies','contacts','products','invoices','cheques','expenses','settings','purchases','payments',
'fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','projects','projectLinks',
'postingProfiles','journalVouchers','journalLines','journalLineDimensions',
'contracts','contractAmendments','contractParties','contractDeductions','guarantees','guaranteeEvents','contractStatements','phase4Audit',
'warehouses','stockMovements','inventoryCounts','fixedAssets','assetDepreciations','currencies','exchangeRates','costCenters',
'importBatches','integrationConnections','integrationOutbox','phase5Audit'
]::text[]));

create or replace function public.finora_guard_phase5_posted_records()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if old.collection not in ('stockMovements','inventoryCounts','assetDepreciations') or coalesce(old.data->>'status','') <> 'posted' then
    return case when tg_op='DELETE' then old else new end;
  end if;
  if tg_op='UPDATE' and new.data=old.data then return new; end if;
  raise exception 'posted Phase 5 operational record is immutable';
end $$;
drop trigger if exists trg_finora_guard_phase5_posted_records on public.records;
create trigger trg_finora_guard_phase5_posted_records before update or delete on public.records
for each row execute function public.finora_guard_phase5_posted_records();

create unique index if not exists ux_finora_warehouse_code on public.records(owner_id,(data->>'companyId'),upper(data->>'code')) where collection='warehouses';
create unique index if not exists ux_finora_asset_code on public.records(owner_id,(data->>'companyId'),upper(data->>'code')) where collection='fixedAssets';
create unique index if not exists ux_finora_currency_code on public.records(owner_id,(data->>'companyId'),upper(data->>'code')) where collection='currencies';
create unique index if not exists ux_finora_exchange_rate_day on public.records(owner_id,(data->>'companyId'),(data->>'currencyCode'),(data->>'date')) where collection='exchangeRates';
create unique index if not exists ux_finora_asset_depreciation_period on public.records(owner_id,(data->>'companyId'),(data->>'assetId'),(data->>'period')) where collection='assetDepreciations' and data->>'status'='posted';

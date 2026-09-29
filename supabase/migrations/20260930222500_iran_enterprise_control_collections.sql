-- Prepared 2026-09-30. DO NOT APPLY without explicit schema approval under AGENTS.md.
-- Iran enterprise control collections for HR/leave/treasury/compliance registry.
alter table public.records drop constraint if exists records_collection_check;
alter table public.records add constraint records_collection_check check (collection = any (array[
'companies','contacts','products','invoices','cheques','expenses','settings','purchases','payments',
'fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','projects','projectLinks',
'postingProfiles','journalVouchers','journalLines','journalLineDimensions',
'contracts','contractAmendments','contractParties','contractDeductions','guarantees','guaranteeEvents','contractStatements','phase4Audit',
'warehouses','stockMovements','inventoryCounts','fixedAssets','assetDepreciations','currencies','exchangeRates','costCenters',
'importBatches','integrationConnections','integrationOutbox','phase5Audit',
'employees','employmentContracts','employeeLeave','cashboxes','pettyCashFunds','complianceRules'
]::text[]));

create unique index if not exists ux_finora_employee_personnel_no
on public.records(owner_id,(data->>'companyId'),upper(data->>'personnelNo')) where collection='employees';

create unique index if not exists ux_finora_employee_leave_year
on public.records(owner_id,(data->>'companyId'),(data->>'employeeId'),(data->>'year')) where collection='employeeLeave';

create unique index if not exists ux_finora_cashbox_code
on public.records(owner_id,(data->>'companyId'),upper(data->>'code')) where collection='cashboxes';

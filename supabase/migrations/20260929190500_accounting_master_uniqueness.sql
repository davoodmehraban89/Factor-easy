-- PREPARED, NOT YET APPLIED: requires explicit schema-change approval.
-- Concurrency-safe uniqueness for accounting/master-data business keys.

create unique index if not exists ux_finora_account_code
on public.records(owner_id,(data->>'companyId'),upper(data->>'code'))
where collection='accounts' and coalesce(data->>'code','')<>'';

create unique index if not exists ux_finora_dimension_type_code
on public.records(owner_id,(data->>'companyId'),upper(data->>'code'))
where collection='dimensionTypes' and coalesce(data->>'code','')<>'';

create unique index if not exists ux_finora_dimension_value_code
on public.records(owner_id,(data->>'companyId'),(data->>'dimensionTypeId'),upper(data->>'code'))
where collection='dimensionValues' and coalesce(data->>'code','')<>'';

create unique index if not exists ux_finora_branch_code
on public.records(owner_id,(data->>'companyId'),upper(data->>'code'))
where collection='branches' and coalesce(data->>'code','')<>'';

create unique index if not exists ux_finora_project_code
on public.records(owner_id,(data->>'companyId'),upper(data->>'code'))
where collection='projects' and coalesce(data->>'code','')<>'';

create unique index if not exists ux_finora_cost_center_code
on public.records(owner_id,(data->>'companyId'),upper(data->>'code'))
where collection='costCenters' and coalesce(data->>'code','')<>'';

create unique index if not exists ux_finora_contract_number
on public.records(owner_id,(data->>'companyId'),upper(data->>'number'))
where collection='contracts' and coalesce(data->>'number','')<>'';

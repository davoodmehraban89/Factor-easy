alter table public.records drop constraint if exists records_collection_check;
alter table public.records add constraint records_collection_check check (collection = any (array[
'companies','contacts','products','invoices','cheques','expenses','settings','purchases','payments',
'fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','projects','projectLinks',
'postingProfiles','journalVouchers','journalLines','journalLineDimensions'
]::text[]));\n
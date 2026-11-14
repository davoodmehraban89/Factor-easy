-- Read-only aggregates; no business row contents. Does not prove strict scope/currency/date invariants.
with vouchers as (
 select organization_id,id,data from public.records where collection='journalVouchers' and data->>'status' in ('posted','reversed')
), lines as (
 select organization_id,id,data,
 case when coalesce(data->>'debit','') ~ '^(0|[1-9][0-9]{0,27})$' then (data->>'debit')::numeric end as debit,
 case when coalesce(data->>'credit','') ~ '^(0|[1-9][0-9]{0,27})$' then (data->>'credit')::numeric end as credit
 from public.records where collection='journalLines'
), totals as (
 select v.organization_id,v.id,count(l.id) as n,coalesce(sum(l.debit),0) as d,coalesce(sum(l.credit),0) as c,
 count(l.id) filter(where l.debit is null or l.credit is null or (l.debit=0 and l.credit=0) or (l.debit>0 and l.credit>0)) as invalid
 from vouchers v left join lines l on l.organization_id=v.organization_id and l.data->>'voucherId'=v.id group by v.organization_id,v.id
), dup as (
 select organization_id,data->>'companyId',data->>'fiscalYearId',data->>'number',count(*) from vouchers
 where coalesce(data->>'number','')<>'' group by 1,2,3,4 having count(*)>1
)
select (select count(*) from vouchers) as posted_vouchers,
(select count(*) from totals where n<2) as missing_minimum_lines,
(select count(*) from totals where d<>c) as unbalanced_vouchers,
(select count(*) from totals where invalid>0) as invalid_amount_vouchers,
(select count(*) from dup) as duplicate_number_groups,
(select count(*) from lines l where not exists(select from public.records v where v.collection='journalVouchers' and v.organization_id=l.organization_id and v.id=l.data->>'voucherId')) as orphan_lines;


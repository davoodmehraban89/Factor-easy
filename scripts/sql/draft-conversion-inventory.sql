-- READ ONLY. Run as the authorized operator for the owner's global conversion.
-- Opaque keys are correlation tokens, not anonymous/public datasets. Keep the
-- result outside Git. This query does not export descriptions or source items.
-- Source identity aggregates are PRE-MIGRATION signals, not conversion approval.
-- Operational/pre-invoice sale kinds are not counted as financial sources.
with vouchers as (
  select v.*, case v.data->>'sourceType'
    when 'sale' then 'invoices' when 'purchase' then 'purchases'
    when 'receipt' then 'payments' when 'payment' then 'payments'
    when 'expense' then 'expenses' when 'income' then 'expenses'
    when 'contract_statement' then 'contractStatements'
    when 'payroll_run' then 'payrollRuns'
    when 'employee_benefit_accrual' then 'employeeBenefitAccruals'
    when 'petty_cash' then 'pettyCashTransactions'
    when 'inventory_adjustment' then 'stockMovements'
    when 'asset_depreciation' then 'assetDepreciations'
    end source_collection
  from public.records v where v.collection='journalVouchers'
), inventory as (
  select jsonb_build_object(
    'key',md5(v.owner_id::text||'|'||v.id),
    'owner',md5(v.owner_id::text), 'organization',md5(v.organization_id::text),
    'company',md5(nullif(v.data->>'companyId','')),
    'status',v.data->>'status', 'sourceType',v.data->>'sourceType',
    'parent',case when v.data->>'sourceType'='reversal' then md5(v.owner_id::text||'|'||(v.data->>'sourceId')) end,
    'reversal',case when nullif(v.data->>'reversalVoucherId','') is not null then md5(v.owner_id::text||'|'||(v.data->>'reversalVoucherId')) end,
    'fiscalOpen',exists(select 1 from public.records f where f.collection='fiscalYears'
      and f.owner_id=v.owner_id and f.organization_id=v.organization_id
      and f.id=v.data->>'fiscalYearId' and f.data->>'companyId'=v.data->>'companyId'
      and f.data->>'status'='open'
      and translate(v.data->>'date','۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789') between f.data->>'startDate' and f.data->>'endDate'),
    'totalDebit',v.data->>'totalDebit','totalCredit',v.data->>'totalCredit',
    'childrenScopeValid',coalesce(graph.scope_valid,false),
    'lines',coalesce(graph.lines,'[]'::jsonb),
    'source',case when s.id is not null then jsonb_build_object(
      'key',md5(s.owner_id::text||'|'||s.collection||'|'||s.id),
      'owner',md5(s.owner_id::text),'organization',md5(s.organization_id::text),
      'company',md5(nullif(s.data->>'companyId','')),
      'voucher',case when nullif(s.data->>'journalVoucherId','') is not null then md5(s.owner_id::text||'|'||(s.data->>'journalVoucherId')) end,
      'electronicMetadata',coalesce(s.data->>'electronicDoc','') not in ('','null','{}'),
      'dependencyCount',(select count(*) from public.records dep where dep.owner_id=s.owner_id and dep.organization_id=s.organization_id
        and dep.collection in ('payments','stockMovements','contractStatements','integrationOutbox')
        and s.id in (dep.data->>'invoiceId',dep.data->>'sourceInvoiceId',dep.data->>'relatedInvoiceId',
          dep.data->>'purchaseId',dep.data->>'sourceId',dep.data->>'chequeId'))
    ) end
  ) as item
  from vouchers v
  left join public.records s on s.owner_id=v.owner_id and s.organization_id=v.organization_id
    and s.collection=v.source_collection and s.id=v.data->>'sourceId'
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'account',md5(nullif(l.data->>'accountId','')),
      'counterparty',md5(nullif(l.data->>'counterpartyId','')),
      'project',md5(nullif(l.data->>'projectId','')),
      'debit',l.data->>'debit','credit',l.data->>'credit',
      'dimensions',coalesce((select jsonb_agg(md5((d.data->>'dimensionTypeId')||'|'||(d.data->>'dimensionValueId')) order by d.id)
        from public.records d where d.collection='journalLineDimensions' and d.owner_id=l.owner_id
          and d.organization_id=l.organization_id
          and d.data->>'journalLineId'=l.id),'[]'::jsonb)
      ) order by l.id) as lines,
      bool_and(l.organization_id is not distinct from v.organization_id
        and l.data->>'companyId' is not distinct from v.data->>'companyId'
        and not exists(select 1 from public.records d where d.collection='journalLineDimensions'
          and d.owner_id=l.owner_id and d.organization_id=l.organization_id
          and d.data->>'journalLineId'=l.id and (
            d.organization_id is distinct from v.organization_id or d.data->>'companyId' is distinct from v.data->>'companyId'
            or d.data->>'voucherId' is distinct from v.id))) as scope_valid
    from public.records l where l.collection='journalLines' and l.owner_id=v.owner_id
      and l.organization_id=v.organization_id and l.data->>'voucherId'=v.id
  ) graph on true
), source_rows as (
  -- Include only invoice kinds which create accounting entries, plus purchases.
  select s.organization_id,s.owner_id,s.collection,s.id,s.data,
    case s.collection when 'invoices' then 'sale' else 'purchase' end kind,
    nullif(btrim(s.data->>'journalVoucherId'),'') linked_id
  from public.records s
  where s.collection='purchases' or
    (s.collection='invoices' and s.data->>'kind' in ('formal','non_formal'))
), generated as (
  select v.organization_id,v.owner_id,v.id,v.data,
    v.data->>'sourceType' kind,nullif(btrim(v.data->>'sourceId'),'') source_id
  from public.records v
  where v.collection='journalVouchers' and v.data->>'sourceType' in ('sale','purchase')
    and nullif(btrim(v.data->>'sourceId'),'') is not null
), generated_by_identity as (
  select organization_id,kind,source_id,
    count(*) as voucher_count,
    count(*) filter (where data->>'status'='draft') as draft_count
  from generated group by organization_id,kind,source_id
), source_observations as (
  select s.*,v.id matched_link_id,v.owner_id linked_owner,v.data linked_data,
    coalesce(g.voucher_count,0) generated_count
  from source_rows s
  left join public.records v on v.organization_id=s.organization_id
    and v.collection='journalVouchers' and v.id=s.linked_id
  left join generated_by_identity g on g.organization_id=s.organization_id
    and g.kind=s.kind and g.source_id=s.id
), source_health as (
  select count(*) sources_considered,
    count(*) filter (where generated_count=0) without_generated_voucher,
    count(*) filter (where linked_id is null and generated_count>0) unlinked_with_generated_voucher,
    count(*) filter (where linked_id is not null and matched_link_id is null) dangling_links,
    count(*) filter (where matched_link_id is not null and (
      linked_owner is distinct from owner_id or
      linked_data->>'sourceType' is distinct from kind or
      linked_data->>'sourceId' is distinct from id or
      linked_data->>'companyId' is distinct from data->>'companyId'
    )) wrong_identity_links,
    count(*) filter (where matched_link_id is not null and
      linked_data->>'sourceType'=kind and linked_data->>'sourceId'=id
      and linked_owner=owner_id and linked_data->>'companyId'=data->>'companyId'
      and linked_data->>'status'='draft') linked_draft_sources,
    count(*) filter (where matched_link_id is not null and
      linked_data->>'sourceType'=kind and linked_data->>'sourceId'=id
      and linked_owner=owner_id and linked_data->>'companyId'=data->>'companyId'
      and linked_data->>'status'='draft' and
      (data->>'documentStatus' is distinct from 'draft' or
       data->>'accountingStatus' is distinct from 'draft')) linked_draft_projection_mismatches,
    count(*) filter (where matched_link_id is not null and
      linked_data->>'sourceType'=kind and linked_data->>'sourceId'=id
      and linked_owner=owner_id and linked_data->>'companyId'=data->>'companyId'
      and linked_data->>'status'='posted' and
      (data->>'documentStatus' is distinct from 'posted' or
       data->>'accountingStatus' is distinct from 'posted')) posted_projection_mismatches
  from source_observations
), generated_health as (
  select
    count(*) filter (where s.id is null) as orphan_generated_vouchers,
    count(*) filter (where s.id is not null and
      (s.owner_id is distinct from g.owner_id or
       s.data->>'companyId' is distinct from g.data->>'companyId'))
       as cross_scope_generated_vouchers
  from generated g
  left join public.records s on s.organization_id=g.organization_id
    and s.collection=case g.kind when 'sale' then 'invoices' else 'purchases' end
    and s.id=g.source_id
)
select jsonb_build_object(
  'journals',coalesce((select jsonb_agg(item order by item->>'key') from inventory),'[]'::jsonb),
  'sourceIdentityAudit',(select jsonb_build_object(
    'sourcesConsidered',h.sources_considered,
    'withoutGeneratedVoucher',h.without_generated_voucher,
    'unlinkedWithGeneratedVoucher',h.unlinked_with_generated_voucher,
    'danglingSourceLinks',h.dangling_links,
    'wrongIdentitySourceLinks',h.wrong_identity_links,
    'linkedDraftSources',h.linked_draft_sources,
    'linkedDraftProjectionMismatches',h.linked_draft_projection_mismatches,
    'postedProjectionMismatches',h.posted_projection_mismatches,
    'duplicateDraftSourceIdentities',
      (select count(*) from generated_by_identity where draft_count>1),
    'orphanGeneratedVouchers',g.orphan_generated_vouchers,
    'crossScopeGeneratedVouchers',g.cross_scope_generated_vouchers
  ) from source_health h cross join generated_health g),
  'snapshotAt',statement_timestamp(),
  'financialFingerprint',(select md5(string_agg(md5(row(r.owner_id,r.organization_id,r.collection,r.id,r.data,r.updated_at)::text),'' order by r.owner_id,r.collection,r.id))
    from public.records r where r.collection in ('journalVouchers','journalLines','journalLineDimensions','invoices','purchases','payments','cheques','fiscalYears','stockMovements'))
) as inventory;

-- PREPARED, NOT YET APPLIED: requires explicit schema-change approval.
-- High-assurance guard for operational source records already tied to posted/reversed accounting history.

create or replace function public.finora_guard_posted_source_records()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  vid text := coalesce(old.data->>'journalVoucherId','');
  voucher_status text := '';
  source_locked boolean := false;
begin
  if old.collection not in ('invoices','purchases','payments','expenses','contractStatements') then
    return case when tg_op='DELETE' then old else new end;
  end if;

  if vid <> '' then
    select coalesce(r.data->>'status','') into voucher_status
    from public.records r
    where r.owner_id=old.owner_id
      and r.collection='journalVouchers'
      and r.id=vid;
  end if;

  source_locked :=
    coalesce(old.data->>'accountingStatus','')='posted'
    or (old.collection='contractStatements' and coalesce(old.data->>'status','') in ('posted','reversed'))
    or voucher_status in ('posted','reversed');

  if not source_locked then
    return case when tg_op='DELETE' then old else new end;
  end if;

  if tg_op='UPDATE' and new.data=old.data then return new; end if;
  raise exception 'source record linked to posted/reversed accounting history is immutable';
end $$;

drop trigger if exists trg_finora_guard_posted_source_records on public.records;
create trigger trg_finora_guard_posted_source_records
before update or delete on public.records
for each row execute function public.finora_guard_posted_source_records();

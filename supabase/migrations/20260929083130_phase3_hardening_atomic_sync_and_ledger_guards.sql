create or replace function public.finora_sync_records(p_upserts jsonb default '[]'::jsonb, p_deletes jsonb default '[]'::jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_active_license() then raise exception 'active license required'; end if;

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

create or replace function public.finora_guard_posted_journal()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_status text := old.data->>'status';
  new_status text;
begin
  if old.collection <> 'journalVouchers' or old_status not in ('posted','reversed') then
    return case when tg_op='DELETE' then old else new end;
  end if;
  if tg_op='DELETE' then raise exception 'posted/reversed journal voucher is immutable'; end if;
  new_status := new.data->>'status';
  if old_status='posted' and new_status='reversed'
     and (old.data - array['status','reversalVoucherId','reversedAt']) =
         (new.data - array['status','reversalVoucherId','reversedAt'])
     and coalesce(new.data->>'reversalVoucherId','') <> '' then
    return new;
  end if;
  if new.data = old.data then return new; end if;
  raise exception 'posted/reversed journal voucher is immutable';
end $$;

drop trigger if exists trg_finora_guard_posted_journal on public.records;
create trigger trg_finora_guard_posted_journal
before update or delete on public.records
for each row execute function public.finora_guard_posted_journal();

create or replace function public.finora_guard_posted_journal_children()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare vid text; parent_status text;
begin
  if old.collection not in ('journalLines','journalLineDimensions') then return case when tg_op='DELETE' then old else new end; end if;
  vid := old.data->>'voucherId';
  select r.data->>'status' into parent_status
  from public.records r
  where r.owner_id=old.owner_id and r.collection='journalVouchers' and r.id=vid;
  if parent_status in ('posted','reversed') then raise exception 'posted/reversed journal lines are immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists trg_finora_guard_posted_journal_children on public.records;
create trigger trg_finora_guard_posted_journal_children
before update or delete on public.records
for each row execute function public.finora_guard_posted_journal_children();

create unique index if not exists ux_finora_journal_number
on public.records(owner_id,(data->>'companyId'),(data->>'fiscalYearId'),(data->>'number'))
where collection='journalVouchers' and data->>'status' in ('posted','reversed');

create unique index if not exists ux_finora_journal_source_version
on public.records(owner_id,(data->>'companyId'),(data->>'sourceType'),(data->>'sourceId'),((coalesce(data->>'sourceVersion','1'))::integer))
where collection='journalVouchers' and data->>'status' in ('posted','reversed') and coalesce(data->>'sourceId','') <> '';\n
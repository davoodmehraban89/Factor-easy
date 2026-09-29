-- Safety: refuse to drop anything that holds data.
do $$
declare t text; n bigint;
begin
  foreach t in array array['invoice_lines','invoices','cheques','ledger_entries','items','parties','companies'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then raise exception 'table % is not empty, aborting', t; end if;
  end loop;
end $$;

drop table public.invoice_lines, public.invoices, public.cheques, public.ledger_entries,
           public.items, public.parties, public.companies;

-- One generic per-user record store. Keeps every client field losslessly (accounting data must never be dropped silently).
create table public.records (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection text not null check (collection in ('companies','contacts','products','invoices','cheques','expenses','settings')),
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  data jsonb not null check (octet_length(data::text) < 1000000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, collection, id)
);

alter table public.records enable row level security;

create policy records_select on public.records for select to authenticated
  using (owner_id = (select auth.uid()));
create policy records_insert on public.records for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.has_active_license());
create policy records_update on public.records for update to authenticated
  using (owner_id = (select auth.uid()) and public.has_active_license())
  with check (owner_id = (select auth.uid()) and public.has_active_license());
create policy records_delete on public.records for delete to authenticated
  using (owner_id = (select auth.uid()) and public.has_active_license());

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger records_touch before update on public.records
  for each row execute function public.touch_updated_at();\n
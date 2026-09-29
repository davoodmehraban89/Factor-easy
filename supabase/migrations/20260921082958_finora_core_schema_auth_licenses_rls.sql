-- ============ Identity & licensing ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,32}$'),
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table public.licenses (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('trial','monthly','three_months','annual','lifetime')),
  status text not null check (status in ('trial','active','cancelled')),
  starts_at date not null default current_date,
  ends_at date not null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.has_active_license() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.licenses l
    where l.user_id = auth.uid()
      and l.status in ('trial','active')
      and (l.plan = 'lifetime' or l.ends_at >= (now() at time zone 'Asia/Tehran')::date)
  );
$$;

-- Role is NEVER read from client-controlled metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  uname := lower(coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)));
  insert into public.profiles (id, username, role) values (new.id, uname, 'user');
  insert into public.licenses (user_id, plan, status, starts_at, ends_at)
  values (new.id, 'trial', 'trial', current_date, current_date + 15);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.admin_set_license(target uuid, new_plan text, days int default null, new_status text default 'active')
returns void language plpgsql security definer set search_path = public as $$
declare d int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if new_plan not in ('trial','monthly','three_months','annual','lifetime') then raise exception 'invalid plan'; end if;
  d := coalesce(days, case new_plan when 'trial' then 15 when 'monthly' then 30 when 'three_months' then 90 when 'annual' then 365 else 0 end);
  update public.licenses
     set plan = new_plan,
         status = new_status,
         starts_at = current_date,
         ends_at = case when new_plan = 'lifetime' then date '2099-01-01' else current_date + d end,
         updated_at = now()
   where user_id = target;
  if not found then raise exception 'user not found'; end if;
end $$;

create or replace function public.admin_extend_license(target uuid, days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if days is null or days < 1 or days > 3650 then raise exception 'invalid days'; end if;
  update public.licenses
     set ends_at = greatest(ends_at, current_date) + days,
         status = case when status = 'trial' then 'trial' else 'active' end,
         updated_at = now()
   where user_id = target and plan <> 'lifetime';
  if not found then raise exception 'user not found or lifetime'; end if;
end $$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_active_license() from public, anon;
revoke all on function public.admin_set_license(uuid,text,int,text) from public, anon;
revoke all on function public.admin_extend_license(uuid,int) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_active_license() to authenticated;
grant execute on function public.admin_set_license(uuid,text,int,text) to authenticated;
grant execute on function public.admin_extend_license(uuid,int) to authenticated;

alter table public.profiles enable row level security;
alter table public.licenses enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy licenses_select on public.licenses for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
-- No insert/update/delete policies: licenses change only via trigger or admin RPCs.

-- ============ Business data ============
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_type text not null default 'legal' check (person_type in ('legal','natural')),
  name text not null,
  phone text, national_id text, economic_code text, reg_no text, postal_code text,
  address text, footer text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_type text not null default 'natural' check (person_type in ('legal','natural')),
  prefix text,
  name text not null,
  role text not null default 'customer' check (role in ('customer','supplier')),
  mobile text, national_id text, economic_code text, reg_no text, postal_code text, address text,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text,
  title text not null,
  spec text, unit text,
  buy_price bigint not null default 0 check (buy_price >= 0),
  sell_price bigint not null default 0 check (sell_price >= 0),
  internal_id text,
  created_at timestamptz not null default now()
);
create unique index items_owner_code_uq on public.items (owner_id, code) where code is not null and code <> '';

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid,
  party_id uuid,
  number text not null,
  kind text not null default 'informal' check (kind in ('informal','formal','proforma')),
  invoice_date date not null,
  vat_mode text not null default 'none' check (vat_mode in ('none','with_vat')),
  vat_type text not null default 'percent' check (vat_type in ('percent','fixed')),
  vat_rate numeric(8,2) not null default 0 check (vat_rate >= 0),
  discount_type text not null default 'fixed' check (discount_type in ('percent','fixed')),
  discount_input numeric(18,2) not null default 0 check (discount_input >= 0),
  subtotal bigint not null default 0 check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  vat bigint not null default 0 check (vat >= 0),
  total bigint not null default 0 check (total >= 0),
  notes text,
  moodian jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, number),
  unique (id, owner_id),
  foreign key (company_id, owner_id) references public.companies (id, owner_id) on delete set null (company_id),
  foreign key (party_id, owner_id) references public.parties (id, owner_id) on delete set null (party_id)
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invoice_id uuid not null,
  position int not null default 0,
  description text not null,
  unit text,
  qty numeric(18,3) not null default 1 check (qty >= 0),
  unit_price bigint not null default 0 check (unit_price >= 0),
  vat_rate numeric(8,2) not null default 0 check (vat_rate >= 0),
  line_total bigint not null default 0 check (line_total >= 0),
  foreign key (invoice_id, owner_id) references public.invoices (id, owner_id) on delete cascade
);

create table public.cheques (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direction text not null check (direction in ('received','paid')),
  party_id uuid,
  party_name text,
  sayad_id text check (sayad_id is null or sayad_id ~ '^[0-9]{16}$'),
  bank text,
  amount bigint not null default 0 check (amount >= 0),
  due_date date,
  status text not null default 'open' check (status in ('open','cleared')),
  created_at timestamptz not null default now(),
  foreign key (party_id, owner_id) references public.parties (id, owner_id) on delete set null (party_id)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  category text,
  description text,
  amount bigint not null default 0 check (amount >= 0),
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- RLS: read always allowed for owner (so expired users can still export);
-- any write requires an ACTIVE license, enforced server-side.
do $$
declare t text;
begin
  foreach t in array array['companies','parties','items','invoices','invoice_lines','cheques','ledger_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create index %I on public.%I (owner_id)', t || '_owner_idx', t);
    execute format('create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()) and public.has_active_license())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid()) and public.has_active_license()) with check (owner_id = (select auth.uid()) and public.has_active_license())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()) and public.has_active_license())', t || '_delete', t);
  end loop;
end $$;

create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);
create index invoices_party_idx on public.invoices (party_id);
create index invoices_company_idx on public.invoices (company_id);
create index cheques_party_idx on public.cheques (party_id);\n
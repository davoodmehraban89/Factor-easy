-- 1) email column on profiles, decoupled from the client-chosen username
alter table public.profiles add column if not exists email text;

-- backfill (table is empty right now, but safe if it isn't)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

alter table public.profiles alter column email set not null;
create unique index if not exists profiles_email_unique_idx on public.profiles (lower(email));

-- username stays for display only; no longer the identity/derivation key
alter table public.profiles alter column username drop not null;

-- 2) trigger: populate email from auth.users; username becomes a best-effort,
--    non-unique display label derived from the email's local part (collisions allowed)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare uname text;
begin
  uname := lower(coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)));
  insert into public.profiles (id, email, username, role)
  values (new.id, lower(new.email), uname, 'user')
  on conflict (id) do update set email = excluded.email;
  insert into public.licenses (user_id, plan, status, starts_at, ends_at)
  values (new.id, 'trial', 'trial', current_date, current_date + 15)
  on conflict (user_id) do nothing;
  return new;
end $function$;\n
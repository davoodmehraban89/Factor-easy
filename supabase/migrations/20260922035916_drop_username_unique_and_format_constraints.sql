-- username is now a cosmetic display label only, not an identity key;
-- the real identity is auth.users.email / profiles.email (unique, verified by Supabase Auth).
alter table public.profiles drop constraint if exists profiles_username_key;
alter table public.profiles drop constraint if exists profiles_username_check;

-- keep username reasonably short/sane if present, but never unique and never required
alter table public.profiles add constraint profiles_username_check
  check (username is null or char_length(username) between 1 and 64);\n
-- Disposable PostgreSQL 17 only: minimal Supabase platform surfaces.
-- Application tables, RLS, triggers and functions come from source migrations.
-- Auth service, Storage service, JWT verification, gateway and network are NOT modelled.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users (
 id uuid primary key, instance_id uuid, aud text, role text, email text, phone text,
 encrypted_password text, email_confirmed_at timestamptz,
 raw_app_meta_data jsonb not null default '{}'::jsonb,
 raw_user_meta_data jsonb not null default '{}'::jsonb,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
 nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
 select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]
$$;
grant usage on schema auth,storage,extensions to authenticated,anon,service_role;
-- Supabase platform table defaults, not replacements for application RLS policies.
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
alter default privileges in schema public grant usage,select on sequences to authenticated;

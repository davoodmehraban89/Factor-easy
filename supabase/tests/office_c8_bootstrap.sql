-- Minimal zero-cost PostgreSQL harness for C8 task-1 migration tests.
-- This is test-only scaffolding; production authorization helpers are not replaced.
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists private;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

create table if not exists public.profiles(id uuid primary key);
create table if not exists public.organizations(id uuid primary key, owner_user_id uuid references public.profiles(id));

create or replace function auth.uid() returns uuid
language sql stable set search_path=''
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

create or replace function private.current_organization_ids() returns setof uuid
language sql stable security definer set search_path=''
as $$ select nullif(current_setting('request.jwt.claim.org',true),'')::uuid where (select auth.uid()) is not null $$;

create or replace function private.organization_has_module_entitlement(p_organization_id uuid,p_module_key text,p_require_active boolean default false)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_module_key='office_automation'
    and p_organization_id=nullif(current_setting('request.jwt.claim.org',true),'')::uuid
    and (not p_require_active or coalesce(nullif(current_setting('request.jwt.claim.write',true),''),'true')='true')
$$;

create or replace function private.has_org_capability(p_organization_id uuid,p_module_key text,p_capability text)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_module_key='office_automation'
    and p_organization_id=nullif(current_setting('request.jwt.claim.org',true),'')::uuid
    and p_capability=any(string_to_array(coalesce(current_setting('request.jwt.claim.capabilities',true),''),','))
$$;

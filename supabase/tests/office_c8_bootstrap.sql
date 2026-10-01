-- Minimal zero-cost PostgreSQL harness for C8 migration tests.
-- Test-only scaffolding: production authorization helpers are not replaced.
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists private;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

create table if not exists public.profiles(id uuid primary key);
create table if not exists public.organizations(id uuid primary key, owner_user_id uuid references public.profiles(id));
create table if not exists public.records(
  organization_id uuid not null references public.organizations(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(organization_id,collection,id)
);

create or replace function auth.uid() returns uuid
language sql stable set search_path=''
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

create or replace function private.current_organization_ids() returns setof uuid
language sql stable security definer set search_path=''
as $$
  select nullif(current_setting('request.jwt.claim.org',true),'')::uuid
  where (select auth.uid()) is not null
    and coalesce(nullif(current_setting('request.jwt.claim.member_active',true),''),'true')='true'
$$;

create or replace function private.organization_has_module_entitlement(p_organization_id uuid,p_module_key text,p_require_active boolean default false)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_module_key='office_automation'
    and p_organization_id=nullif(current_setting('request.jwt.claim.org',true),'')::uuid
    and coalesce(nullif(current_setting('request.jwt.claim.entitled',true),''),'true')='true'
    and (not p_require_active or coalesce(nullif(current_setting('request.jwt.claim.write',true),''),'true')='true')
$$;

create or replace function private.has_org_capability(p_organization_id uuid,p_module_key text,p_capability text)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_module_key='office_automation'
    and p_organization_id=nullif(current_setting('request.jwt.claim.org',true),'')::uuid
    and p_capability=any(string_to_array(coalesce(current_setting('request.jwt.claim.capabilities',true),''),','))
$$;

create or replace function private.can_access_record(p_organization_id uuid,p_collection text,p_owner_id uuid,p_data jsonb,p_capability text)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_collection='correspondence'
    and p_organization_id in (select private.current_organization_ids())
    and private.organization_has_module_entitlement(p_organization_id,'office_automation',false)
    and private.has_org_capability(p_organization_id,'office_automation',p_capability)
    and coalesce(nullif(current_setting('request.jwt.claim.readable',true),''),'true')='true'
$$;

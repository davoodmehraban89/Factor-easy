-- F0-01/F0-07: Repair Auth bootstrap order after organization member-seat guard.
-- Verified live error (2026-10-12): 'organization license not found' (23503).
-- Minimal semantics: profiles -> organization -> trial license -> owner membership.
-- Preserve existing email/phone identities, ordinary role and unmodified seat policy.
-- This CREATE OR REPLACE does not rewrite any existing users, organizations, or licenses.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=''
as $function$
declare v_username text; v_org_name text; v_org_id uuid; v_identity text;
begin
  v_identity:=coalesce(nullif(lower(new.email),''),nullif(new.phone,''));
  if v_identity is null then
    raise exception 'Finora requires an email or phone identity for signup';
  end if;
  v_username:=lower(coalesce(
    nullif(new.raw_user_meta_data->>'username',''),
    case when new.email is not null then split_part(new.email,'@',1)
      else regexp_replace(new.phone,'[^0-9+]','','g') end
  ));
  v_org_name:=left(
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'),''),
      nullif(trim(new.raw_user_meta_data->>'name'),''),
      nullif(v_username,''),
      'Finora'
    )||' - شخصی',
    160
  );
  insert into public.profiles(id,email,phone,username,role,full_name)
  values(
    new.id,
    case when new.email is null then null else lower(new.email) end,
    new.phone,
    v_username,
    'user',
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','')),'')
  );
  insert into public.organizations(owner_user_id,name,status)
  values(new.id,v_org_name,'active') returning id into v_org_id;

  -- The BEFORE INSERT seat guard on organization_members checks this row.
  -- Seed the trial license FIRST, without weakening or disabling that guard.
  insert into public.licenses(user_id,organization_id,plan,status,starts_at,ends_at,max_companies,max_users,modules,limits)
  values(new.id,v_org_id,'trial','trial',current_date,current_date+15,1,1,array['full_suite']::text[],'{}'::jsonb);

  insert into public.organization_members(organization_id,user_id,status,is_owner)
  values(v_org_id,new.id,'active',true);
  return new;
end $function$;

-- Keep direct calls unavailable to browser-level roles.
revoke all on function public.handle_new_user() from public, anon, authenticated;

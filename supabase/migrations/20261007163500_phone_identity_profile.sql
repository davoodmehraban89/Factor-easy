-- Phone-capable identity bootstrap and self-service profile aliases.
alter table public.profiles alter column email drop not null;
alter table public.profiles add column if not exists phone text;
create unique index if not exists profiles_phone_unique on public.profiles(phone) where phone is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_username text;v_org_name text;v_org_id uuid;v_identity text;
begin
 v_identity:=coalesce(nullif(lower(new.email),''),nullif(new.phone,''));
 if v_identity is null then raise exception 'Finora requires an email or phone identity for signup';end if;
 v_username:=lower(coalesce(nullif(new.raw_user_meta_data->>'username',''),case when new.email is not null then split_part(new.email,'@',1) else regexp_replace(new.phone,'[^0-9+]','','g') end));
 v_org_name:=left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),nullif(trim(new.raw_user_meta_data->>'name'),''),nullif(v_username,''),'Finora')||' - شخصی',160);
 insert into public.profiles(id,email,phone,username,role,full_name)
 values(new.id,case when new.email is null then null else lower(new.email) end,new.phone,v_username,'user',nullif(trim(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','')),''));
 insert into public.organizations(owner_user_id,name,status) values(new.id,v_org_name,'active') returning id into v_org_id;
 insert into public.organization_members(organization_id,user_id,status,is_owner) values(v_org_id,new.id,'active',true);
 insert into public.licenses(user_id,organization_id,plan,status,starts_at,ends_at,max_companies,max_users,modules,limits)
 values(new.id,v_org_id,'trial','trial',current_date,current_date+15,1,1,array['full_suite']::text[],'{}'::jsonb);
 return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;

create or replace function public.update_my_identity_profile(new_username text,new_full_name text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_username text:=lower(trim(coalesce(new_username,'')));
begin
 if v_uid is null then raise exception 'Authentication required';end if;
 if v_username !~ '^[a-z0-9_.-]{3,40}$' then raise exception 'Username must be 3-40 latin letters, digits, dot, underscore or dash';end if;
 if exists(select 1 from public.profiles where lower(username)=v_username and id<>v_uid) then raise exception 'Username already in use';end if;
 update public.profiles set username=v_username,full_name=coalesce(nullif(trim(new_full_name),''),full_name) where id=v_uid;
end $$;
revoke all on function public.update_my_identity_profile(text,text) from public,anon;
grant execute on function public.update_my_identity_profile(text,text) to authenticated;

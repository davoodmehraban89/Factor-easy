-- Wave 5a: transactional identity bootstrap for new Auth users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_username text;v_org_name text;v_org_id uuid;
begin
 if new.email is null or position('@' in new.email)=0 then raise exception 'Finora requires an email identity for signup';end if;
 v_username:=lower(coalesce(nullif(new.raw_user_meta_data->>'username',''),split_part(new.email,'@',1)));
 v_org_name:=left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),nullif(trim(new.raw_user_meta_data->>'name'),''),nullif(split_part(lower(new.email),'@',1),''),'Finora')||' - شخصی',160);
 insert into public.profiles(id,email,username,role,full_name)
 values(new.id,lower(new.email),v_username,'user',nullif(trim(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','')),''));
 insert into public.organizations(owner_user_id,name,status) values(new.id,v_org_name,'active') returning id into v_org_id;
 insert into public.organization_members(organization_id,user_id,status,is_owner) values(v_org_id,new.id,'active',true);
 insert into public.licenses(user_id,organization_id,plan,status,starts_at,ends_at,max_companies,max_users,modules,limits)
 values(new.id,v_org_id,'trial','trial',current_date,current_date+15,1,1,array['full_suite']::text[],'{}'::jsonb);
 return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

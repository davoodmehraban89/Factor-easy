drop index if exists public.ux_finora_correspondence_registry_number;
create unique index ux_finora_correspondence_registry_number on public.records(organization_id,(data->>'registryId'),(data->>'registerNumber')) where collection='correspondence' and coalesce(data->>'registerNumber','')<>'';
create or replace function public.office_register_correspondence(p_id text,p_registry_id text,p_payload jsonb,p_organization_id uuid default null) returns text
language plpgsql security invoker set search_path='' as $$
declare v_org uuid:=coalesce(p_organization_id,private.default_organization_id()); registry_row public.records%rowtype; next_no integer; prefix text; assigned text;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if v_org is null or not private.organization_has_module_entitlement(v_org,'office_automation',true) or not private.has_org_capability(v_org,'office_automation','register') then raise exception 'forbidden' using errcode='42501'; end if;
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid correspondence id'; end if;
  if p_registry_id is null or p_registry_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid registry id'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid payload'; end if;
  select * into registry_row from public.records where organization_id=v_org and collection='officeRegistries' and id=p_registry_id for update;
  if not found then raise exception 'registry not found'; end if;
  next_no:=greatest(1,coalesce(nullif(registry_row.data->>'nextNumber','')::integer,1));
  prefix:=trim(coalesce(registry_row.data->>'prefix',''));
  assigned:=case when prefix='' then next_no::text else prefix||'-'||next_no::text end;
  update public.records set data=jsonb_set(registry_row.data,'{nextNumber}',to_jsonb(next_no+1),true) where organization_id=v_org and collection='officeRegistries' and id=p_registry_id;
  insert into public.records(organization_id,owner_id,collection,id,data) values(v_org,(select auth.uid()),'correspondence',p_id,p_payload||jsonb_build_object('registryId',p_registry_id,'registerNumber',assigned,'status','registered','registeredAt',now()))
  on conflict(organization_id,collection,id) do update set data=case when public.records.data->>'status'='registered' then public.records.data else excluded.data end;
  return assigned;
end $$;
revoke all on function public.office_register_correspondence(text,text,jsonb,uuid) from public,anon;
grant execute on function public.office_register_correspondence(text,text,jsonb,uuid) to authenticated;
create or replace function private.profile_id_by_email(p_email text) returns uuid language sql stable security definer set search_path='' as $$ select p.id from public.profiles p where lower(p.email)=lower(trim(p_email)) limit 1 $$;
revoke all on function private.profile_id_by_email(text) from public,anon;
grant execute on function private.profile_id_by_email(text) to authenticated;
create or replace function public.organization_add_member(p_organization_id uuid,p_email text,p_unit_id uuid default null,p_position_title text default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_user uuid; v_member uuid;
begin
  if not private.is_org_owner(p_organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  v_user:=private.profile_id_by_email(p_email);
  if v_user is null then raise exception 'Finora user not found for email'; end if;
  insert into public.organization_members(organization_id,user_id,unit_id,position_title,status,is_owner)
  values(p_organization_id,v_user,p_unit_id,nullif(trim(p_position_title),''),'active',false)
  on conflict(organization_id,user_id) do update set unit_id=excluded.unit_id,position_title=excluded.position_title,status='active',updated_at=now()
  returning id into v_member;
  return v_member;
end $$;
revoke all on function public.organization_add_member(uuid,text,uuid,text) from public,anon;
grant execute on function public.organization_add_member(uuid,text,uuid,text) to authenticated;
create or replace function public.organization_set_member_permission(p_organization_id uuid,p_member_id uuid,p_module_key text,p_capabilities text[],p_scope_type text default 'own',p_scope_id text default null,p_confidentiality_level smallint default 0) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  if not private.is_valid_finora_module(p_module_key) or p_module_key='core' then raise exception 'invalid module'; end if;
  if not (private.is_org_owner(p_organization_id) or private.has_org_capability(p_organization_id,p_module_key,'configure')) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.organization_members m where m.id=p_member_id and m.organization_id=p_organization_id and m.status='active' and not m.is_owner) then raise exception 'member not found or owner permission is implicit'; end if;
  insert into public.member_module_permissions(organization_id,member_id,module_key,capabilities,scope_type,scope_id,confidentiality_level)
  values(p_organization_id,p_member_id,p_module_key,p_capabilities,p_scope_type,p_scope_id,p_confidentiality_level)
  on conflict(organization_id,member_id,module_key,scope_type,scope_id) do update set capabilities=excluded.capabilities,confidentiality_level=excluded.confidentiality_level,updated_at=now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.organization_set_member_permission(uuid,uuid,text,text[],text,text,smallint) from public,anon;
grant execute on function public.organization_set_member_permission(uuid,uuid,text,text[],text,text,smallint) to authenticated;
create or replace function public.office_refer_correspondence(p_organization_id uuid,p_correspondence_id text,p_to_member_id uuid,p_note text default null) returns text
language plpgsql security invoker set search_path='' as $$
declare v_source public.records%rowtype; v_id text;
begin
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true) or not private.has_org_capability(p_organization_id,'office_automation','refer') then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_source from public.records where organization_id=p_organization_id and collection='correspondence' and id=p_correspondence_id;
  if not found then raise exception 'correspondence not found or not visible'; end if;
  if not exists(select 1 from public.organization_members m where m.id=p_to_member_id and m.organization_id=p_organization_id and m.status='active') then raise exception 'target member not found'; end if;
  v_id:='REF_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(p_organization_id,(select auth.uid()),'correspondenceReferrals',v_id,jsonb_build_object('correspondenceId',p_correspondence_id,'fromUserId',(select auth.uid()),'toMemberId',p_to_member_id,'note',coalesce(p_note,''),'status','sent','createdAt',now()));
  return v_id;
end $$;
revoke all on function public.office_refer_correspondence(uuid,text,uuid,text) from public,anon;
grant execute on function public.office_refer_correspondence(uuid,text,uuid,text) to authenticated;
create or replace function private.organization_audit_capture() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_action text; v_entity text; v_entity_id text;
begin
  if tg_table_name='member_module_permissions' then
    v_org:=case when tg_op='DELETE' then old.organization_id else new.organization_id end;
    v_action:='permission_'||lower(tg_op); v_entity:='member_module_permission'; v_entity_id:=case when tg_op='DELETE' then old.id::text else new.id::text end;
  elsif tg_table_name='records' then
    v_org:=new.organization_id; v_action:='referral_insert'; v_entity:='correspondence_referral'; v_entity_id:=new.id;
  else
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data)
  values(v_org,(select auth.uid()),v_action,v_entity,v_entity_id,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger correspondence_referrals_audit after insert on public.records for each row when (new.collection='correspondenceReferrals') execute function private.organization_audit_capture();
create or replace function private.referral_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'correspondence referral is immutable' using errcode='42501'; end $$;
revoke all on function private.referral_immutable() from public,anon,authenticated;
create trigger correspondence_referrals_immutable before update or delete on public.records for each row when (old.collection='correspondenceReferrals') execute function private.referral_immutable();
create or replace function private.can_access_office_storage(p_name text,p_capability text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare parts text[]:=string_to_array(p_name,'/'); v_org uuid; v_cor text; v_row public.records%rowtype;
begin
  if array_length(parts,1) is null then return false; end if;
  if parts[1]=(select auth.uid())::text then return private.has_module_entitlement('office_automation') and (p_capability='read' or public.has_active_license()); end if;
  if parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  v_org:=parts[1]::uuid;
  if p_capability='create' then return parts[2]=(select auth.uid())::text and private.organization_has_module_entitlement(v_org,'office_automation',true) and private.has_org_capability(v_org,'office_automation','create'); end if;
  v_cor:=parts[3];
  select * into v_row from public.records where organization_id=v_org and collection='correspondence' and id=v_cor;
  if not found then return false; end if;
  return private.can_access_record(v_org,'correspondence',v_row.owner_id,v_row.data,p_capability);
end $$;
revoke all on function private.can_access_office_storage(text,text) from public,anon;
grant execute on function private.can_access_office_storage(text,text) to authenticated;
drop policy if exists finora_office_files_select on storage.objects;
drop policy if exists finora_office_files_insert on storage.objects;
drop policy if exists finora_office_files_update on storage.objects;
drop policy if exists finora_office_files_delete on storage.objects;
create policy finora_office_files_select on storage.objects for select to authenticated using (bucket_id='office-attachments' and private.can_access_office_storage(name,'read'));
create policy finora_office_files_insert on storage.objects for insert to authenticated with check (bucket_id='office-attachments' and private.can_access_office_storage(name,'create'));
create policy finora_office_files_update on storage.objects for update to authenticated using (bucket_id='office-attachments' and private.can_access_office_storage(name,'edit')) with check (bucket_id='office-attachments' and private.can_access_office_storage(name,'edit'));
create policy finora_office_files_delete on storage.objects for delete to authenticated using (bucket_id='office-attachments' and private.can_access_office_storage(name,'delete'));
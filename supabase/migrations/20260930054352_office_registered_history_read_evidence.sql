-- Office Slice C1: protect registered history and add server-authoritative read evidence.

create or replace function private.protect_registered_correspondence_history()
returns trigger
language plpgsql set search_path=''
as $$
declare old_rank int; new_rank int;
begin
  if old.collection<>'correspondence' or coalesce(old.data->>'status','draft')='draft' then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='DELETE' then raise exception 'registered correspondence cannot be deleted' using errcode='42501'; end if;
  if new.organization_id is distinct from old.organization_id
     or new.owner_id is distinct from old.owner_id
     or new.collection is distinct from old.collection
     or new.id is distinct from old.id
     or new.data->>'registryId' is distinct from old.data->>'registryId'
     or new.data->>'registerNumber' is distinct from old.data->>'registerNumber'
     or new.data->>'registeredAt' is distinct from old.data->>'registeredAt' then
    raise exception 'registered correspondence identity is immutable' using errcode='42501';
  end if;
  old_rank:=case old.data->>'status' when 'registered' then 1 when 'submitted' then 2 when 'closed' then 3 else 1 end;
  new_rank:=case new.data->>'status' when 'registered' then 1 when 'submitted' then 2 when 'closed' then 3 else 0 end;
  if new_rank<old_rank then raise exception 'registered correspondence status cannot move backward' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function private.protect_registered_correspondence_history() from public,anon,authenticated;
drop trigger if exists trg_protect_registered_correspondence_history on public.records;
create trigger trg_protect_registered_correspondence_history
before update or delete on public.records
for each row when (old.collection='correspondence') execute function private.protect_registered_correspondence_history();

create or replace function private.office_correspondence_audit_capture()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data)
  values(new.organization_id,(select auth.uid()),case when tg_op='INSERT' then 'correspondence_registered' else 'correspondence_update' end,'correspondence',new.id,
    case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
  return new;
end $$;
revoke all on function private.office_correspondence_audit_capture() from public,anon,authenticated;
drop trigger if exists correspondence_registered_audit on public.records;
create trigger correspondence_registered_audit after insert or update on public.records
for each row when (new.collection='correspondence' and coalesce(new.data->>'status','draft')<>'draft')
execute function private.office_correspondence_audit_capture();

create or replace function private.office_audit_immutable()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'office audit evidence is immutable' using errcode='42501'; end $$;
revoke all on function private.office_audit_immutable() from public,anon,authenticated;
drop trigger if exists correspondence_audit_immutable on public.records;
create trigger correspondence_audit_immutable before update or delete on public.records
for each row when (old.collection='correspondenceAudit') execute function private.office_audit_immutable();

create or replace function public.office_mark_correspondence_read(p_organization_id uuid,p_correspondence_id text)
returns text
language plpgsql security definer set search_path=''
as $$
declare v_source public.records%rowtype; v_id text; v_uid uuid:=(select auth.uid());
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true) then raise exception 'office automation entitlement required' using errcode='42501'; end if;
  select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read') then raise exception 'correspondence not found or not readable' using errcode='42501'; end if;
  v_id:='READ_'||replace(gen_random_uuid()::text,'-','');
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(p_organization_id,v_uid,'correspondenceAudit',v_id,jsonb_build_object('event','read','correspondenceId',p_correspondence_id,'readerUserId',v_uid,'readAt',now()));
  return v_id;
end $$;
revoke all on function public.office_mark_correspondence_read(uuid,text) from public,anon;
grant execute on function public.office_mark_correspondence_read(uuid,text) to authenticated;

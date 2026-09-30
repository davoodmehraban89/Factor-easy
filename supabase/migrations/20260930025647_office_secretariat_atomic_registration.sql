create unique index if not exists ux_finora_correspondence_registry_number
on public.records(owner_id,(data->>'registryId'),(data->>'registerNumber'))
where collection='correspondence' and coalesce(data->>'registerNumber','')<>'';

create or replace function public.office_register_correspondence(p_id text, p_registry_id text, p_payload jsonb)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  registry_row public.records%rowtype;
  next_no integer;
  prefix text;
  assigned text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_active_license() or not private.has_module_entitlement('office_automation') then
    raise exception 'office automation entitlement required' using errcode='42501';
  end if;
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid correspondence id'; end if;
  if p_registry_id is null or p_registry_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid registry id'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid payload'; end if;

  select * into registry_row
  from public.records
  where owner_id=auth.uid() and collection='officeRegistries' and id=p_registry_id
  for update;
  if not found then raise exception 'registry not found'; end if;

  next_no := greatest(1,coalesce(nullif(registry_row.data->>'nextNumber','')::integer,1));
  prefix := trim(coalesce(registry_row.data->>'prefix',''));
  assigned := case when prefix='' then next_no::text else prefix||'-'||next_no::text end;

  update public.records
  set data=jsonb_set(registry_row.data,'{nextNumber}',to_jsonb(next_no+1),true)
  where owner_id=auth.uid() and collection='officeRegistries' and id=p_registry_id;

  insert into public.records(owner_id,collection,id,data)
  values(auth.uid(),'correspondence',p_id,
    p_payload || jsonb_build_object(
      'registryId',p_registry_id,
      'registerNumber',assigned,
      'status','registered',
      'registeredAt',now()
    ))
  on conflict(owner_id,collection,id) do update
  set data = case
    when public.records.data->>'status'='registered' then public.records.data
    else excluded.data
  end;

  return assigned;
end
$$;
revoke all on function public.office_register_correspondence(text,text,jsonb) from public, anon;
grant execute on function public.office_register_correspondence(text,text,jsonb) to authenticated;
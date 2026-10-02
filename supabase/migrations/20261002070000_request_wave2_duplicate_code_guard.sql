-- Wave 2 remainder / F-412: deterministic legacy request-type collision guard.
-- The historical D2 cutover is preserved. This guard makes any ambiguous same-org
-- legacy code fail explicitly instead of allowing the full migration chain to
-- complete after ON CONFLICT DO NOTHING has collapsed business identities.

create or replace function private.assert_legacy_request_type_code_uniqueness()
returns void
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_collision record;
begin
  select
    r.organization_id,
    upper(trim(r.data->>'code')) as normalized_code,
    array_agg(r.id order by r.id) as record_ids
  into v_collision
  from public.records r
  where r.collection='requestTypes'
    and nullif(trim(r.data->>'code'),'') is not null
    and nullif(trim(r.data->>'title'),'') is not null
  group by r.organization_id,upper(trim(r.data->>'code'))
  having count(*)>1
  order by r.organization_id,upper(trim(r.data->>'code'))
  limit 1;

  if found then
    raise exception 'legacy request type duplicate-code collision: organization %, code %, records %',
      v_collision.organization_id,v_collision.normalized_code,v_collision.record_ids
      using errcode='23505';
  end if;
end $$;

revoke all on function private.assert_legacy_request_type_code_uniqueness() from public,anon,authenticated;

select private.assert_legacy_request_type_code_uniqueness();

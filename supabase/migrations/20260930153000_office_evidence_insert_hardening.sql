create or replace function private.protect_office_evidence_insert()
returns trigger
language plpgsql set search_path=''
as $$
begin
  if new.collection in ('correspondenceReferrals','correspondenceAudit')
     and current_user not in ('postgres','service_role')
  then
    raise exception 'office evidence must be created by an authorized server operation' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function private.protect_office_evidence_insert() from public,anon,authenticated;

drop trigger if exists office_evidence_insert_guard on public.records;
create trigger office_evidence_insert_guard
before insert on public.records
for each row
when (new.collection in ('correspondenceReferrals','correspondenceAudit'))
execute function private.protect_office_evidence_insert();

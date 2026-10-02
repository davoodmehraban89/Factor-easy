\set ON_ERROR_STOP on

insert into public.profiles(id) values
 ('44444444-4444-4444-4444-444444444444')
on conflict do nothing;

insert into public.records(owner_id,organization_id,collection,id,data) values
 ('44444444-4444-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','requestTypes','AUDIT-TEST-F412-DUP',
  jsonb_build_object('id','AUDIT-TEST-F412-DUP','code',' purchase ','title','Duplicate purchase type','active',true,'fields','[]'::jsonb,'workflow',jsonb_build_object('mode','single_owner','steps','[]'::jsonb),'createdAt','2026-10-02T00:00:00Z'));

do $$
begin
  begin
    perform private.assert_legacy_request_type_code_uniqueness();
    raise exception 'F-412 duplicate legacy code unexpectedly passed preflight';
  exception
    when unique_violation then
      if position('legacy request type duplicate-code collision' in sqlerrm)=0
         or position('PURCHASE' in sqlerrm)=0
         or position('AUDIT-TEST-F412-DUP' in sqlerrm)=0 then
        raise;
      end if;
  end;
end $$;

delete from public.records
where owner_id='44444444-4444-4444-4444-444444444444'
  and collection='requestTypes'
  and id='AUDIT-TEST-F412-DUP';

select private.assert_legacy_request_type_code_uniqueness();

\set ON_ERROR_STOP on
-- Authenticated SQL boundary, not an HTTP/JWT integration test.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('ea000000-0000-4000-8000-000000000001','wp1-null-revision@example.invalid',now(),'{}');
select set_config('wp1.revision_org',(select id::text from public.organizations where owner_user_id='ea000000-0000-4000-8000-000000000001'),true);
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000001',true);
insert into public.records(owner_id,organization_id,collection,id,data) values
(auth.uid(),current_setting('wp1.revision_org')::uuid,'companies','RV_C','{"name":"Revision fixture"}'),
(auth.uid(),current_setting('wp1.revision_org')::uuid,'fiscalYears','RV_Y','{"companyId":"RV_C","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'),
(auth.uid(),current_setting('wp1.revision_org')::uuid,'accounts','RV_A','{"companyId":"RV_C","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.revision_org')::uuid,'accounts','RV_B','{"companyId":"RV_C","active":true,"postingAllowed":true}');
insert into private.finora_phase1a_guard_modes(organization_id,mode) values(current_setting('wp1.revision_org')::uuid,'enforce');
set local role authenticated;
select public.finora_journal_create_draft(current_setting('wp1.revision_org')::uuid,id,
 '{"companyId":"RV_C","fiscalYearId":"RV_Y","date":"1405/07/24","voucherType":"manual"}',
 '[{"accountId":"RV_A","debit":1000,"credit":0},{"accountId":"RV_B","debit":0,"credit":1000}]')
from unnest(array['RV_DRAFT','RV_ORIGINAL','RV_DELETE']) id;
select public.finora_journal_post(current_setting('wp1.revision_org')::uuid,'RV_ORIGINAL',1);
do $test$
declare org uuid:=current_setting('wp1.revision_org')::uuid; op text; rev bigint; r jsonb; current_rev bigint;
 failures text[]:='{}'; baseline text; after_attempt text;
 lines jsonb:='[{"accountId":"RV_A","debit":1500,"credit":0},{"accountId":"RV_B","debit":0,"credit":1500}]';
begin
 select md5(string_agg(row_to_json(x)::text,'' order by collection,id)) into baseline from public.records x where organization_id=org;
 foreach op in array array['update','delete','post','reverse'] loop
  foreach rev in array array[null::bigint,0,-1,999999] loop
   begin
    case op
     when 'update' then perform public.finora_journal_update_draft(org,'RV_DRAFT',rev,'{"description":"must reject"}',lines);
     when 'delete' then perform public.finora_journal_delete_draft(org,'RV_DRAFT',rev);
     when 'post' then perform public.finora_journal_post(org,'RV_DRAFT',rev);
     when 'reverse' then perform public.finora_journal_reverse(org,'RV_ORIGINAL','RV_REVERSE','1405/07/25','invalid revision',rev);
    end case;
    set constraints all immediate;
    raise exception 'RV_ACCEPTED';
   exception when others then
    if sqlerrm='RV_ACCEPTED' then failures:=array_append(failures,op||'_'||coalesce(rev::text,'null'));
    elsif sqlstate<>'40001' or sqlerrm<>'FINORA_VERSION_CONFLICT' then raise;
    else raise notice 'WP1_REVISION_NEGATIVE_PASS % %',op,coalesce(rev::text,'null');end if;
   end;
   select md5(string_agg(row_to_json(x)::text,'' order by collection,id)) into after_attempt from public.records x where organization_id=org;
   if after_attempt is distinct from baseline then raise exception 'RV_REJECTION_MUTATED_RECORDS';end if;
  end loop;
 end loop;
 if cardinality(failures)>0 then raise exception 'WP1_NULL_REVISION_MISSING: %',array_to_string(failures,',');end if;
 -- Current revisions still support every mutation; authorized exact replays do
 -- not mutate state and retain the pre-existing stale/NULL replay contract.
 r:=public.finora_journal_update_draft(org,'RV_DRAFT',1,'{"description":"valid edit"}',lines);
 if (r#>>'{voucher,version}')::bigint<>2 then raise exception 'RV_UPDATE_FAILED';end if;
 r:=public.finora_journal_post(org,'RV_DRAFT',2);
 if r#>>'{voucher,status}'<>'posted' or r#>>'{voucher,number}'<>'2' then raise exception 'RV_POST_FAILED';end if;
 r:=public.finora_journal_delete_draft(org,'RV_DELETE',1);
 if r->>'deleted'<>'true' or exists(select from public.records where organization_id=org and collection='journalVouchers' and id='RV_DELETE') then raise exception 'RV_DELETE_FAILED';end if;
 select version into current_rev from public.records where organization_id=org and collection='journalVouchers' and id='RV_ORIGINAL';
 r:=public.finora_journal_reverse(org,'RV_ORIGINAL','RV_REVERSE','1405/07/25','valid revision',current_rev);
 if r#>>'{voucher,status}'<>'posted' or r#>>'{voucher,number}'<>'3' then raise exception 'RV_REVERSE_FAILED';end if;
 select md5(string_agg(row_to_json(x)::text,'' order by collection,id)) into baseline from public.records x where organization_id=org;
 r:=public.finora_journal_post(org,'RV_DRAFT',null);
 if r->>'replayed'<>'true' then raise exception 'RV_POST_REPLAY_FAILED';end if;
 r:=public.finora_journal_reverse(org,'RV_ORIGINAL','RV_REVERSE','1405/07/25','valid revision',null);
 if r->>'replayed'<>'true' then raise exception 'RV_REVERSE_REPLAY_FAILED';end if;
 select md5(string_agg(row_to_json(x)::text,'' order by collection,id)) into after_attempt from public.records x where organization_id=org;
 if after_attempt is distinct from baseline then raise exception 'RV_REPLAY_MUTATED_RECORDS';end if;
 set constraints all immediate;
 raise notice 'WP1_NULL_REVISION_PASS: 16 rejected mutations, current versions accepted, read-only replay retained';
end $test$;
rollback;

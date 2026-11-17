\set ON_ERROR_STOP on
-- Synthetic authenticated SQL exercises the same RLS/trigger boundary used by
-- direct PostgREST UPDATE; this is not an HTTP/JWT integration test.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('e9000000-0000-4000-8000-000000000001','wp1-manual-guards@example.invalid',now(),'{}');
select set_config('wp1.manual_org',(select id::text from public.organizations where owner_user_id='e9000000-0000-4000-8000-000000000001'),true);
select set_config('request.jwt.claim.sub','e9000000-0000-4000-8000-000000000001',true);
insert into public.records(owner_id,organization_id,collection,id,data) values
(auth.uid(),current_setting('wp1.manual_org')::uuid,'companies','MG_C','{"name":"Manual guard fixture"}'),
(auth.uid(),current_setting('wp1.manual_org')::uuid,'fiscalYears','MG_Y','{"companyId":"MG_C","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'),
(auth.uid(),current_setting('wp1.manual_org')::uuid,'accounts','MG_A','{"companyId":"MG_C","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.manual_org')::uuid,'accounts','MG_B','{"companyId":"MG_C","active":true,"postingAllowed":true}');
-- Legacy/shadow drafts can legitimately predate ENFORCE activation. Posting
-- must validate their type rather than relying only on the create endpoint.
select public.finora_journal_create_draft(current_setting('wp1.manual_org')::uuid,'MG_'||kind,
 jsonb_build_object('companyId','MG_C','fiscalYearId','MG_Y','date','1405/07/24','voucherType',kind),
 '[{"accountId":"MG_A","debit":1000,"credit":0},{"accountId":"MG_B","debit":0,"credit":1000}]')
from unnest(array['manual','opening','closing']) kind;
insert into private.finora_phase1a_guard_modes(organization_id,mode) values(current_setting('wp1.manual_org')::uuid,'enforce');
set local role authenticated;
do $test$
declare org uuid:=current_setting('wp1.manual_org')::uuid; c text; patch jsonb; r jsonb; expected text;
 failures text[]:='{}'; baseline text; after_attempt text;
 lines jsonb:='[{"accountId":"MG_A","debit":1500,"credit":0},{"accountId":"MG_B","debit":0,"credit":1500}]';
begin
 select md5(string_agg(row_to_json(x)::text,'' order by collection,id)) into baseline
 from public.records x where organization_id=org;
 foreach c in array array['rpc_date_range','rpc_date_format','rpc_null_date','rpc_null_header','rpc_year_closed','rpc_year_company',
  'rpc_opening','rpc_closing','post_opening','post_closing',
  'direct_date','direct_null_date','direct_opening','direct_source_relabel',
  'v2_date','v2_closing','v2_source_relabel'] loop
  begin
   expected:='FINORA_(FISCAL|COMPANY|OPENING_CLOSING|MANUAL_DRAFT_SOURCE|INVALID_DRAFT_UPDATE)';
   patch:='{}';
   case c
    when 'rpc_date_range' then patch:='{"date":"1406/01/01"}';
    when 'rpc_date_format' then patch:='{"date":"1405/7/24"}';
    when 'rpc_null_date' then patch:='{"date":null}';
    when 'rpc_null_header' then patch:=null;
    when 'rpc_year_closed' then update public.records set data=data||'{"status":"closed"}' where organization_id=org and collection='fiscalYears' and id='MG_Y';
    when 'rpc_year_company' then update public.records set data=data||'{"companyId":"ANOTHER"}' where organization_id=org and collection='fiscalYears' and id='MG_Y';
    when 'rpc_opening' then patch:='{"voucherType":"opening"}';
    when 'rpc_closing' then patch:='{"voucherType":"closing"}';
    when 'direct_date' then patch:='{"date":"1406/01/01"}';
    when 'direct_null_date' then patch:='{"date":null}';
    when 'direct_opening' then patch:='{"voucherType":"opening"}';
    when 'direct_source_relabel' then patch:='{"sourceType":"expense","sourceId":"fake"}';
    when 'v2_date' then patch:='{"date":"1406/01/01"}';
    when 'v2_closing' then patch:='{"voucherType":"closing"}';
    when 'v2_source_relabel' then patch:='{"sourceType":"expense","sourceId":"fake"}';
    else null;
   end case;
   if c like 'rpc_%' then
    perform public.finora_journal_update_draft(org,'MG_manual',1,patch,lines);
   elsif c like 'post_%' then
    perform public.finora_journal_post(org,'MG_'||substr(c,6),1);
   elsif c like 'direct_%' then
    update public.records set data=data||patch where organization_id=org and collection='journalVouchers' and id='MG_manual';
   else
    select data into r from public.records where organization_id=org and collection='journalVouchers' and id='MG_manual';
    perform public.finora_sync_records_v2(jsonb_build_array(jsonb_build_object('collection','journalVouchers','id','MG_manual','data',r||patch,'expected_version',1)),'[]',org);
   end if;
   set constraints all immediate;
   raise exception 'MG_ACCEPTED_%',c;
  exception when others then
   if sqlerrm='MG_ACCEPTED_'||c then failures:=array_append(failures,c);
   elsif sqlerrm !~ expected or sqlstate not in ('23514','23503') then raise;
   else raise notice 'WP1_MANUAL_NEGATIVE_PASS %: %',c,sqlerrm;end if;
  end;
  select md5(string_agg(row_to_json(x)::text,'' order by collection,id)) into after_attempt
  from public.records x where organization_id=org;
  if after_attempt is distinct from baseline then raise exception 'MG_REJECTION_MUTATED_RECORDS_%',c;end if;
 end loop;
 if cardinality(failures)>0 then raise exception 'WP1_MANUAL_GUARDS_MISSING: %',array_to_string(failures,',');end if;
 -- Normal manual -> adjustment editing, boundary dates, posting, and exact
 -- replay remain usable. Original audit-created opening/closing are untouched.
 r:=public.finora_journal_update_draft(org,'MG_manual',1,'{"date":"1405/01/01","voucherType":"adjustment"}',lines);
 if r#>>'{voucher,date}'<>'1405/01/01' or (r#>>'{voucher,version}')::bigint<>2 then raise exception 'MG_VALID_UPDATE_FAILED';end if;
 r:=public.finora_journal_update_draft(org,'MG_manual',2,'{"date":"1405/12/29"}',lines);
 r:=public.finora_journal_post(org,'MG_manual',(r#>>'{voucher,version}')::bigint);
 if r#>>'{voucher,status}'<>'posted' or r#>>'{voucher,number}'<>'1' then raise exception 'MG_VALID_POST_FAILED';end if;
 r:=public.finora_journal_post(org,'MG_manual',1);
 if r->>'replayed'<>'true' then raise exception 'MG_POST_REPLAY_FAILED';end if;
 set constraints all immediate;
 raise notice 'WP1_MANUAL_UPDATE_GUARDS_PASS: 17 negatives, atomic rejection, valid adjustment, boundary dates, posting replay';
end $test$;
reset role;
-- Shadow/off generic compatibility remains deliberate. The explicit update RPC
-- still validates fiscal scope; no production modes or legacy rows are touched.
update private.finora_phase1a_guard_modes set mode='audit' where organization_id=current_setting('wp1.manual_org')::uuid;
set local role authenticated;
select public.finora_journal_create_draft(current_setting('wp1.manual_org')::uuid,'MG_AUDIT',
 '{"companyId":"MG_C","fiscalYearId":"MG_Y","date":"1405/07/24","voucherType":"opening"}',
 '[{"accountId":"MG_A","debit":10,"credit":0},{"accountId":"MG_B","debit":0,"credit":10}]');
update public.records set data=data||'{"date":"1406/01/01","voucherType":"closing"}' where organization_id=current_setting('wp1.manual_org')::uuid and collection='journalVouchers' and id='MG_AUDIT';
do $$begin
 if not exists(select from public.records where organization_id=current_setting('wp1.manual_org')::uuid and collection='journalVouchers' and id='MG_AUDIT' and data->>'date'='1406/01/01') then raise exception 'MG_SHADOW_COMPATIBILITY_FAILED';end if;
end $$;
reset role;
update private.finora_phase1a_guard_modes set mode='off' where organization_id=current_setting('wp1.manual_org')::uuid;
set local role authenticated;
update public.records set data=data||'{"date":"1407/01/01","voucherType":"opening"}' where organization_id=current_setting('wp1.manual_org')::uuid and collection='journalVouchers' and id='MG_AUDIT';
do $$begin
 if not exists(select from public.records where organization_id=current_setting('wp1.manual_org')::uuid and collection='journalVouchers' and id='MG_AUDIT' and data->>'date'='1407/01/01') then raise exception 'MG_OFF_COMPATIBILITY_FAILED';end if;
end $$;
rollback;

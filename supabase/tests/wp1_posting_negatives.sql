\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('b2000000-0000-4000-8000-000000000001','wp1-neg@example.invalid',now(),'{}');
select set_config('wp1.org',(select id::text from public.organizations where owner_user_id='b2000000-0000-4000-8000-000000000001'),true);
select set_config('request.jwt.claim.sub','b2000000-0000-4000-8000-000000000001',true);
insert into public.records(owner_id,organization_id,collection,id,data) values
(auth.uid(),current_setting('wp1.org')::uuid,'companies','WP1_C','{"name":"WP1 negative synthetic"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'fiscalYears','WP1_Y','{"companyId":"WP1_C","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','WP1_A','{"companyId":"WP1_C","code":"1101","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','WP1_INACTIVE','{"companyId":"WP1_C","code":"1102","active":false,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','WP1_B','{"companyId":"WP1_C","code":"4101","active":true,"postingAllowed":true}');
insert into private.finora_phase1a_guard_modes(organization_id,mode) values(current_setting('wp1.org')::uuid,'enforce');
set local role authenticated;
do $$declare org uuid:=current_setting('wp1.org')::uuid; r jsonb; h jsonb; ls jsonb; c text; vid text; expected text; failures text[]:='{}';
begin
 foreach c in array array['missing_amount','null_amount','negative','fraction','zero','two_sides','single','unbalanced','closed','out_of_range','wrong_company','wrong_year','currency','inactive_account'] loop
  begin
   h:='{"companyId":"WP1_C","fiscalYearId":"WP1_Y","date":"1405/07/24"}';
   ls:='[{"accountId":"WP1_A","debit":1000,"credit":0},{"accountId":"WP1_B","debit":0,"credit":1000}]';
   vid:='WP1_NEG_'||c;
   case c
    when 'missing_amount' then ls:=jsonb_set(ls,'{0}',(ls->0)-'credit');expected:='FINORA_INVALID_RIAL_AMOUNT';
    when 'null_amount' then ls:=jsonb_set(ls,'{0,credit}','null');expected:='FINORA_INVALID_RIAL_AMOUNT';
    when 'negative' then ls:=jsonb_set(ls,'{0,debit}','-1000');expected:='FINORA_INVALID_RIAL_AMOUNT';
    when 'fraction' then ls:=jsonb_set(ls,'{0,debit}','1000.5');expected:='FINORA_INVALID_RIAL_AMOUNT';
    when 'zero' then ls:=jsonb_set(ls,'{0,debit}','0');expected:='FINORA_INVALID_(DEBIT_CREDIT|RIAL)_LINE';
    when 'two_sides' then ls:=jsonb_set(ls,'{0,credit}','1000');expected:='FINORA_INVALID_(DEBIT_CREDIT|RIAL)_LINE';
    when 'single' then ls:=jsonb_build_array(ls->0);expected:='FINORA_INVALID_LINE_COUNT';
    when 'unbalanced' then ls:=jsonb_set(ls,'{1,credit}','300');expected:='FINORA_UNBALANCED_POSTED_JOURNAL';
    when 'out_of_range' then h:=jsonb_set(h,'{date}','"1404/12/29"');expected:='FINORA_.*(DATE|PERIOD|FISCAL)';
    when 'currency' then h:=h||'{"currencyCode":"USD"}';expected:='FINORA_.*CURRENCY';
    when 'closed' then expected:='FINORA_.*(CLOSED|PERIOD|FISCAL)';
    when 'wrong_company' then expected:='FINORA_.*(SCOPE|COMPANY)';
    when 'wrong_year' then expected:='FINORA_.*(SCOPE|FISCAL)';
    when 'inactive_account' then ls:=jsonb_set(ls,'{0,accountId}','"WP1_INACTIVE"');expected:='FINORA_ACCOUNT_OUT_OF_SCOPE';
   end case;
   r:=public.finora_journal_create_draft(org,vid,h,ls);
   if c='closed' then update public.records set data=data||'{"status":"closed"}' where organization_id=org and collection='fiscalYears' and id='WP1_Y';end if;
   if c='wrong_company' then update public.records set data=data||'{"companyId":"OTHER"}' where organization_id=org and collection='journalLines' and data->>'voucherId'=vid;end if;
   if c='wrong_year' then update public.records set data=data||'{"fiscalYearId":"OTHER"}' where organization_id=org and collection='journalLines' and data->>'voucherId'=vid;end if;
   perform public.finora_journal_post(org,vid,(r#>>'{voucher,version}')::bigint);
   set constraints all immediate;
   raise exception 'WP1_ACCEPTED_INVALID_%',c;
  exception when others then
   if sqlerrm='WP1_ACCEPTED_INVALID_'||c then failures:=array_append(failures,c);
   elsif sqlerrm !~ expected then raise;
   else raise notice 'WP1_NEGATIVE_PASS %: %',c,sqlerrm;end if;
  end;
 end loop;
 if cardinality(failures)>0 then raise exception 'WP1_INVALID_POSTING_ACCEPTED: %',array_to_string(failures,',');end if;
 raise notice 'WP1_POSTING_NEGATIVES_PASS: 14 cases';
end $$;
rollback;

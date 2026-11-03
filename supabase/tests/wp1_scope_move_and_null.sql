\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('b4000000-0000-4000-8000-000000000001','wp1-scope-a@example.invalid',now(),'{}'),
('b4000000-0000-4000-8000-000000000002','wp1-scope-b@example.invalid',now(),'{}');
select set_config('wp1.org',(select id::text from public.organizations where owner_user_id='b4000000-0000-4000-8000-000000000001'),true);
select set_config('wp1.org_b',(select id::text from public.organizations where owner_user_id='b4000000-0000-4000-8000-000000000002'),true);
select set_config('request.jwt.claim.sub','b4000000-0000-4000-8000-000000000001',true);
insert into public.records(owner_id,organization_id,collection,id,data) values
(auth.uid(),current_setting('wp1.org')::uuid,'companies','WP1_C','{"name":"Synthetic scope test"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'fiscalYears','WP1_Y','{"companyId":"WP1_C","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','WP1_A','{"companyId":"WP1_C","code":"1101","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','WP1_B','{"companyId":"WP1_C","code":"4101","active":true,"postingAllowed":true}');
insert into private.finora_phase1a_guard_modes(organization_id,mode) values(current_setting('wp1.org')::uuid,'enforce');
set local role authenticated;
do $$declare r jsonb; org uuid:=current_setting('wp1.org')::uuid; begin
 r:=public.finora_journal_create_draft(org,'WP1_MOVE_POSTED',
 '{"companyId":"WP1_C","fiscalYearId":"WP1_Y","date":"1405/07/24"}',
 '[{"accountId":"WP1_A","debit":1000,"credit":0},{"accountId":"WP1_B","debit":0,"credit":1000}]');
 perform public.finora_journal_post(org,'WP1_MOVE_POSTED',(r#>>'{voucher,version}')::bigint);
 set constraints all immediate;
end $$;
-- Isolate the trigger from RLS by using trusted SQL, with an actual owner JWT.
-- A failure must be the identity guard, never an unrelated tenant denial.
reset role;
do $$begin
 if private.finora_phase1a_mode(current_setting('wp1.org_b')::uuid)<>'audit' then raise exception 'WP1_SCOPE_TARGET_NOT_AUDIT';end if;
 begin
  update public.records set organization_id=current_setting('wp1.org_b')::uuid
  where organization_id=current_setting('wp1.org')::uuid and collection='journalVouchers' and id='WP1_MOVE_POSTED';
  raise exception 'WP1_ENFORCE_TO_AUDIT_MOVE_ACCEPTED';
 exception when check_violation then
  if sqlerrm<>'FINORA_POSTED_JOURNAL_IDENTITY_IMMUTABLE' then raise; end if;
 end;
 if not exists(select from public.records where organization_id=current_setting('wp1.org')::uuid and collection='journalVouchers' and id='WP1_MOVE_POSTED') then raise exception 'WP1_ORIGINAL_SCOPE_LOST';end if;
 raise notice 'WP1_ENFORCE_TO_AUDIT_IDENTITY_MOVE_DENIED';
end $$;
-- Missing/null amounts must fail in RPC validation even when guards only audit.
update private.finora_phase1a_guard_modes set mode='audit' where organization_id=current_setting('wp1.org')::uuid;
set local role authenticated;
do $$declare r jsonb; ls jsonb; kind text; begin
 foreach kind in array array['missing','null'] loop
  ls:='[{"accountId":"WP1_A","debit":1000,"credit":0},{"accountId":"WP1_B","debit":0,"credit":1000}]';
  if kind='missing' then ls:=jsonb_set(ls,'{0}',(ls->0)-'debit'); else ls:=jsonb_set(ls,'{0,debit}','null');end if;
  begin
   r:=public.finora_journal_create_draft(current_setting('wp1.org')::uuid,'WP1_NULL_'||kind,
    '{"companyId":"WP1_C","fiscalYearId":"WP1_Y","date":"1405/07/24"}',ls);
   perform public.finora_journal_post(current_setting('wp1.org')::uuid,'WP1_NULL_'||kind,(r#>>'{voucher,version}')::bigint);
   raise exception 'WP1_NULL_AMOUNT_ACCEPTED';
  exception when check_violation then
   if sqlerrm<>'FINORA_INVALID_RIAL_AMOUNT' then raise;end if;
  end;
 end loop;
 raise notice 'WP1_MISSING_AND_NULL_AMOUNTS_REJECTED_IN_SHADOW';
end $$;
reset role;
insert into private.finora_phase1a_guard_modes(organization_id,mode) values(current_setting('wp1.org_b')::uuid,'off');
update public.records set organization_id=current_setting('wp1.org_b')::uuid
where organization_id=current_setting('wp1.org')::uuid and collection='journalVouchers' and id='WP1_MOVE_POSTED';
set constraints all immediate;
do $$begin
 if not exists(select from public.records where organization_id=current_setting('wp1.org_b')::uuid and collection='journalVouchers' and id='WP1_MOVE_POSTED') then raise exception 'WP1_AUDIT_RELOCATION_BLOCKED';end if;
 if not exists(select from private.finora_phase1a_journal_audit where organization_id=current_setting('wp1.org_b')::uuid and reason='FINORA_POSTED_JOURNAL_IDENTITY_IMMUTABLE') then raise exception 'WP1_AUDIT_RELOCATION_NOT_LOGGED';end if;
 raise notice 'WP1_AUDIT_TO_OFF_RELOCATION_ALLOWED_AND_LOGGED';
end $$;
rollback;

\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('b3000000-0000-4000-8000-000000000001','wp1-shadow@example.invalid',now(),'{}');
select set_config('wp1.org',(select id::text from public.organizations where owner_user_id='b3000000-0000-4000-8000-000000000001'),true);
select set_config('request.jwt.claim.sub','b3000000-0000-4000-8000-000000000001',true);
do $$begin
 if private.finora_phase1a_mode(current_setting('wp1.org')::uuid)<>'audit' then raise exception 'WP1_DEFAULT_NOT_SHADOW';end if;
 if exists(select 1 from pg_trigger where tgrelid='public.records'::regclass and tgname like 'trg_finora%balance%' and (not tgdeferrable or not tginitdeferred or tgqual is null)) then raise exception 'WP1_CONSTRAINT_NOT_DEFERRED_OR_UNFILTERED';end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.records'::regclass and tgname like 'trg_finora%balance%') then raise exception 'WP1_CONSTRAINT_MISSING';end if;
end $$;
set local role authenticated;
do $$begin
 begin
  perform public.finora_journal_set_guard_mode(current_setting('wp1.org')::uuid,'audit','enforce','Unauthorized organization owner');
  raise exception 'WP1_ORG_OWNER_CHANGED_ENFORCEMENT';
 exception when insufficient_privilege then
  if sqlerrm not like 'FINORA_GUARD_MODE_ADMIN_ONLY%' then raise;end if;
 end;
end $$;
insert into public.records(owner_id,organization_id,collection,id,data) values
(auth.uid(),current_setting('wp1.org')::uuid,'journalVouchers','WP1_SHADOW','{"id":"WP1_SHADOW","status":"posted","companyId":"SHADOW_C","fiscalYearId":"SHADOW_Y","number":1}');
set constraints all immediate;
reset role;
do $$begin
 if not exists(select from public.records where organization_id=current_setting('wp1.org')::uuid and id='WP1_SHADOW') then raise exception 'WP1_SHADOW_BLOCKED_WRITE';end if;
 if not exists(select from private.finora_phase1a_journal_audit where organization_id=current_setting('wp1.org')::uuid and action='guard_violation') then raise exception 'WP1_SHADOW_NOT_AUDITED';end if;
 raise notice 'WP1_SHADOW_PASS: default audit, persisted violation evidence, non-admin setter denied, deferred ledger-only constraints';
end $$;
rollback;

-- Disposable fixture only. D1 and D2 are independent; no customer data.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','wp0-a@example.invalid','{}'),
 ('10000000-0000-4000-8000-000000000002','wp0-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare org uuid; begin
 select id into strict org from public.organizations where owner_user_id=auth.uid();
 insert into public.records(owner_id,organization_id,collection,id,data) values
 (auth.uid(),org,'journalVouchers','WP0_D1','{"id":"WP0_D1","status":"posted","companyId":"WP0_C","fiscalYearId":"WP0_Y","number":1}'),
 (auth.uid(),org,'journalLines','WP0_D1_L1','{"voucherId":"WP0_D1","lineNo":1,"accountId":"a","debit":1000,"credit":0}'),
 (auth.uid(),org,'journalLines','WP0_D1_L2','{"voucherId":"WP0_D1","lineNo":2,"accountId":"b","debit":0,"credit":300}');
 set constraints all immediate;
 if (select sum((data->>'debit')::numeric-(data->>'credit')::numeric) from public.records where collection='journalLines' and data->>'voucherId'='WP0_D1') <> 700 then raise exception 'D1 fixture did not persist expected imbalance'; end if;
 raise notice 'D1_REPRODUCED: unbalanced posted voucher accepted (1000/300)';
 -- A separate, balanced posted voucher makes D2 independent of D1.
 insert into public.records(owner_id,organization_id,collection,id,data) values
 (auth.uid(),org,'journalVouchers','WP0_D2','{"id":"WP0_D2","status":"posted","companyId":"WP0_C","fiscalYearId":"WP0_Y","number":2}'),
 (auth.uid(),org,'journalLines','WP0_D2_L1','{"voucherId":"WP0_D2","lineNo":1,"accountId":"a","debit":1000,"credit":0}'),
 (auth.uid(),org,'journalLines','WP0_D2_L2','{"voucherId":"WP0_D2","lineNo":2,"accountId":"b","debit":0,"credit":1000}');
 set constraints all immediate;
 if (select sum((data->>'debit')::numeric-(data->>'credit')::numeric) from public.records where collection='journalLines' and data->>'voucherId'='WP0_D2') <> 0 then raise exception 'D2 starting voucher not balanced'; end if;
 insert into public.records(owner_id,organization_id,collection,id,data) values
 (auth.uid(),org,'journalLines','WP0_D2_L3','{"voucherId":"WP0_D2","lineNo":3,"accountId":"c","debit":5000,"credit":0}');
 set constraints all immediate;
 if (select count(*) from public.records where collection='journalLines' and data->>'voucherId'='WP0_D2') <> 3 then raise exception 'D2 insertion not persisted'; end if;
 raise notice 'D2_REPRODUCED: new line accepted under independent balanced posted voucher';
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select from public.records where id like 'WP0_%') then raise exception 'Cross-tenant read leak'; end if;
 raise notice 'ISOLATION_READ_PASS: other tenant sees zero fixture rows';
end $$;
rollback;

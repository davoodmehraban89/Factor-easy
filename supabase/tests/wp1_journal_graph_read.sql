\set ON_ERROR_STOP on
\timing on
begin;
do $$begin
 if to_regprocedure('public.finora_journal_read_graph(uuid,text)') is null then raise exception 'WP1_GRAPH_RPC_MISSING';end if;
end $$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('ed000000-0000-4000-8000-000000000001','wp1-graph-owner@example.invalid',now(),'{}'),
('ed000000-0000-4000-8000-000000000002','wp1-graph-other@example.invalid',now(),'{}'),
('ed000000-0000-4000-8000-000000000003','wp1-graph-reader@example.invalid',now(),'{}');
select set_config('wp1.graph_org',(select id::text from public.organizations where owner_user_id='ed000000-0000-4000-8000-000000000001'),true);
select set_config('wp1.graph_other',(select id::text from public.organizations where owner_user_id='ed000000-0000-4000-8000-000000000002'),true);
select set_config('request.jwt.claim.sub','ed000000-0000-4000-8000-000000000001',true);
update public.licenses set max_users=3 where organization_id=current_setting('wp1.graph_org')::uuid;
insert into public.organization_members(organization_id,user_id,status,is_owner) values(current_setting('wp1.graph_org')::uuid,'ed000000-0000-4000-8000-000000000003','active',false);
insert into public.member_module_permissions(organization_id,member_id,module_key,capabilities,scope_type,confidentiality_level)
select organization_id,id,'full_suite',array['read'],'organization',0 from public.organization_members where organization_id=current_setting('wp1.graph_org')::uuid and user_id='ed000000-0000-4000-8000-000000000003';
insert into public.records(owner_id,organization_id,collection,id,data) values
(auth.uid(),current_setting('wp1.graph_org')::uuid,'companies','GR_C','{"name":"Graph fixture"}'),
(auth.uid(),current_setting('wp1.graph_org')::uuid,'fiscalYears','GR_Y','{"companyId":"GR_C","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'),
(auth.uid(),current_setting('wp1.graph_org')::uuid,'accounts','GR_A','{"companyId":"GR_C","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.graph_org')::uuid,'accounts','GR_B','{"companyId":"GR_C","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.graph_org')::uuid,'dimensionTypes','GR_TYPE','{"companyId":"GR_C","active":true}'),
(auth.uid(),current_setting('wp1.graph_org')::uuid,'dimensionValues','GR_VALUE','{"companyId":"GR_C","dimensionTypeId":"GR_TYPE","active":true}');
set local role authenticated;
select public.finora_journal_create_draft(current_setting('wp1.graph_org')::uuid,'GR_DOC',
 '{"companyId":"GR_C","fiscalYearId":"GR_Y","date":"1405/07/24"}',
 '[{"id":"GR_LINE_A","accountId":"GR_A","debit":100,"credit":0,"dimensions":[{"dimensionTypeId":"GR_TYPE","dimensionValueId":"GR_VALUE"}]},{"id":"GR_LINE_B","accountId":"GR_B","debit":0,"credit":100}]');
do $$declare r jsonb; expected jsonb;begin
 r:=public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC');
 select jsonb_agg(jsonb_build_object('collection',collection,'id',id,'data',data,'version',version) order by collection,id) into expected from public.records where organization_id=current_setting('wp1.graph_org')::uuid and ((collection='journalVouchers' and id='GR_DOC') or (collection in ('journalLines','journalLineDimensions') and data->>'voucherId'='GR_DOC'));
 if r->'records' is distinct from expected or jsonb_array_length(r->'records')<>4 or r->>'effective_status'<>'draft' or r->>'voucher_id'<>'GR_DOC' or r->>'organization_id'<>current_setting('wp1.graph_org') then raise exception 'GR_DRAFT_GRAPH_MISMATCH';end if;
 if public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'MISSING') is not null or public.finora_journal_read_graph(null,'GR_DOC') is not null or public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,null) is not null then raise exception 'GR_ABSENCE_NOT_NULL';end if;
end $$;
select public.finora_journal_post(current_setting('wp1.graph_org')::uuid,'GR_DOC',1);
do $$begin
 if public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC')->>'effective_status'<>'posted' then raise exception 'GR_POSTED_STATUS';end if;
end $$;
select public.finora_journal_reverse(current_setting('wp1.graph_org')::uuid,'GR_DOC','GR_PART1','1405/07/25','Graph partial reversal',2,'[{"lineId":"GR_LINE_A","amount":40},{"lineId":"GR_LINE_B","amount":40}]');
do $$declare r jsonb;begin
 r:=public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC');
 if r->>'effective_status'<>'partially_reversed' or jsonb_array_length(r->'records')<>4 then raise exception 'GR_PARTIAL_STATUS';end if;
 if public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_PART1')->>'effective_status'<>'posted' then raise exception 'GR_REVERSAL_STATUS';end if;
end $$;
select public.finora_journal_reverse(current_setting('wp1.graph_org')::uuid,'GR_DOC','GR_PART2','1405/07/26','Graph remaining reversal',2,'[{"lineId":"GR_LINE_A","amount":60},{"lineId":"GR_LINE_B","amount":60}]');
do $$begin
 if public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC')->>'effective_status'<>'reversed' then raise exception 'GR_REVERSED_STATUS';end if;
 if not exists(select from jsonb_array_elements(public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC')->'records') e where e->>'collection'='journalVouchers' and e#>>'{data,status}'='posted' and e->>'version'='2') then raise exception 'GR_DERIVED_STATUS_CHANGED_HEADER';end if;
end $$;
set constraints all immediate;
reset role;
-- Synthetic legacy fixture only: bulk large draft and deliberately malformed
-- graphs cannot be created through the guarded production mutation RPCs.
alter table public.records disable trigger user;
insert into public.records(owner_id,organization_id,collection,id,data) values
(auth.uid(),current_setting('wp1.graph_org')::uuid,'journalVouchers','GR_LARGE','{"companyId":"GR_C","fiscalYearId":"GR_Y","date":"1405/07/24","status":"draft","sourceType":"manual"}'),
('ed000000-0000-4000-8000-000000000002',current_setting('wp1.graph_other')::uuid,'journalVouchers','GR_DOC','{"companyId":"GR_C","status":"draft","description":"FOREIGN_SECRET"}'),
('ed000000-0000-4000-8000-000000000002',current_setting('wp1.graph_other')::uuid,'journalLines','GR_LINE_A','{"companyId":"GR_C","voucherId":"GR_DOC","description":"FOREIGN_SECRET"}'),
(auth.uid(),current_setting('wp1.graph_org')::uuid,'journalLines','GR_ORPHAN','{"companyId":"GR_C","voucherId":"NO_HEADER"}');
insert into public.records(owner_id,organization_id,collection,id,data)
select auth.uid(),current_setting('wp1.graph_org')::uuid,'journalLines','GR_BIG_'||lpad(n::text,4,'0'),jsonb_build_object('companyId','GR_C','voucherId','GR_LARGE','accountId',case when n%2=0 then 'GR_A' else 'GR_B' end,'debit',case when n%2=0 then 1 else 0 end,'credit',case when n%2=1 then 1 else 0 end) from generate_series(1,1002) n;
alter table public.records enable trigger user;
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_LARGE');
 if jsonb_array_length(r->'records')<>1003 then raise exception 'GR_LARGE_GRAPH_TRUNCATED';end if;
 if r is distinct from public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_LARGE') then raise exception 'GR_ORDER_UNSTABLE';end if;
 if public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'NO_HEADER') is not null or public.finora_journal_read_graph(current_setting('wp1.graph_other')::uuid,'GR_DOC') is not null then raise exception 'GR_ORPHAN_OR_TENANT_LEAK';end if;
 if public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC')::text like '%FOREIGN_SECRET%' then raise exception 'GR_FOREIGN_ID_COLLISION';end if;
end $$;
select set_config('request.jwt.claim.sub','ed000000-0000-4000-8000-000000000002',true);
do $$begin
 if public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC') is not null then raise exception 'GR_REVERSE_TENANT_LEAK';end if;
 if public.finora_journal_read_graph(current_setting('wp1.graph_other')::uuid,'GR_DOC')::text not like '%FOREIGN_SECRET%' then raise exception 'GR_OTHER_OWN_GRAPH_MISSING';end if;
end $$;
select set_config('request.jwt.claim.sub','ed000000-0000-4000-8000-000000000003',true);
do $$begin
 if public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC')->>'effective_status'<>'reversed' then raise exception 'GR_READ_ONLY_ROLE_DENIED';end if;
end $$;
reset role;
-- A hidden child/reversal must never yield a partial graph or false status.
alter table public.records disable trigger user;
update public.records set data=data||'{"confidentiality":"secret"}' where organization_id=current_setting('wp1.graph_org')::uuid and collection='journalLines' and id='GR_LINE_A';
alter table public.records enable trigger user;
set local role authenticated;
do $$begin
 begin perform public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC');raise exception 'GR_HIDDEN_CHILD_ACCEPTED';exception when insufficient_privilege then if sqlerrm<>'FINORA_JOURNAL_GRAPH_FORBIDDEN' then raise;end if;end;
end $$;
reset role;
alter table public.records disable trigger user;
update public.records set data=data-'confidentiality' where organization_id=current_setting('wp1.graph_org')::uuid and collection='journalLines' and id='GR_LINE_A';
update public.records set data=data||'{"confidentiality":"secret"}' where organization_id=current_setting('wp1.graph_org')::uuid and collection='journalVouchers' and id='GR_PART1';
alter table public.records enable trigger user;
set local role authenticated;
do $$begin
 begin perform public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC');raise exception 'GR_HIDDEN_REVERSAL_ACCEPTED';exception when insufficient_privilege then if sqlerrm<>'FINORA_JOURNAL_GRAPH_FORBIDDEN' then raise;end if;end;
end $$;
reset role;
update public.organization_members set status='suspended' where organization_id=current_setting('wp1.graph_org')::uuid and user_id='ed000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$begin
 if public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC') is not null then raise exception 'GR_REVOKED_MEMBER_VISIBLE';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','ed000000-0000-4000-8000-000000000001',true);
-- Corruption rejection, still read-only; each fixture mutation rolled back.
do $$declare kind text; dim_id text;begin
 select id into dim_id from public.records where organization_id=current_setting('wp1.graph_org')::uuid and collection='journalLineDimensions' and data->>'voucherId'='GR_DOC';
 foreach kind in array array['line_company','dimension_company','dimension_line','dimension_voucher'] loop
  begin
   alter table public.records disable trigger user;
   if kind='line_company' then update public.records set data=data||'{"companyId":"WRONG"}' where organization_id=current_setting('wp1.graph_org')::uuid and collection='journalLines' and id='GR_LINE_A';
   else update public.records set data=data||case kind when 'dimension_company' then '{"companyId":"WRONG"}'::jsonb when 'dimension_line' then '{"journalLineId":"MISSING"}'::jsonb else '{"voucherId":"WRONG"}'::jsonb end where organization_id=current_setting('wp1.graph_org')::uuid and collection='journalLineDimensions' and id=dim_id;end if;
   alter table public.records enable trigger user;
   set local role authenticated;
   perform public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC');
   raise exception 'GR_CORRUPTION_ACCEPTED_%',kind;
  exception when check_violation then if sqlerrm<>'FINORA_JOURNAL_GRAPH_INVALID' then raise;end if;
  end;
 end loop;
end $$;
set local role anon;
do $$begin
 begin perform public.finora_journal_read_graph(current_setting('wp1.graph_org')::uuid,'GR_DOC');raise exception 'GR_ANON_ACCESS';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin
 if exists(select from pg_proc p where p.oid='public.finora_journal_read_graph(uuid,text)'::regprocedure and (p.prosecdef or p.provolatile<>'s')) then raise exception 'GR_INVOKER_CONTRACT';end if;
 if has_function_privilege('anon','public.finora_journal_read_graph(uuid,text)','EXECUTE') or has_function_privilege('anon','private.finora_journal_graph_accessible(uuid,text)','EXECUTE') then raise exception 'GR_ANON_GRANT';end if;
 raise notice 'WP1_GRAPH_PASS: complete deterministic graph,1003 rows,statuses,tenant/member/child/reversal/anon isolation,malformed links';
end $$;
rollback;

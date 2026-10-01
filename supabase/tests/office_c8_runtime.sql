-- Office C8 Task 2 RED contract: attach / transition / read runtime.
-- This intentionally fails until the Task 2 migration exists.

begin;

do $$
begin
  if to_regclass('private.office_workflow_instances') is null then raise exception 'C8 runtime instances table missing'; end if;
  if to_regclass('private.office_workflow_events') is null then raise exception 'C8 runtime events table missing'; end if;
  if to_regprocedure('public.office_workflow_attach(uuid,text,text,integer,uuid)') is null then raise exception 'C8 attach RPC missing'; end if;
  if to_regprocedure('public.office_workflow_transition(uuid,uuid,text,bigint,uuid,text)') is null then raise exception 'C8 transition RPC missing'; end if;
  if to_regprocedure('public.office_workflow_read(uuid,text,bigint,integer)') is null then raise exception 'C8 read RPC missing'; end if;
end $$;

-- Behavioral fixtures and race assertions are added against the disposable PostgreSQL
-- harness before Task 2 production DDL is eligible for deployment.
rollback;

do $$
declare c integer;
begin
 select count(*) into c from public.request_type_definitions where legacy_record_id in ('RT_LEGACY_A','RT_LEGACY_B');
 if c<>2 then raise exception 'expected 2 migrated request definitions, got %',c; end if;
 select count(*) into c from public.request_type_versions v join public.request_type_definitions d on d.id=v.request_type_id where d.legacy_record_id in ('RT_LEGACY_A','RT_LEGACY_B') and v.version_no=1;
 if c<>2 then raise exception 'expected immutable version 1 for both legacy request types'; end if;
 select count(*) into c from public.request_workflow_versions w join public.request_type_versions v on v.id=w.request_type_version_id join public.request_type_definitions d on d.id=v.request_type_id where d.legacy_record_id in ('RT_LEGACY_A','RT_LEGACY_B');
 if c<>2 then raise exception 'expected workflow snapshots for both legacy request types'; end if;
 select count(*) into c from public.request_instances where legacy_record_id in ('REQ_LEGACY_A','REQ_LEGACY_B') and status='submitted';
 if c<>2 then raise exception 'expected 2 migrated submitted request instances'; end if;
 select count(*) into c from public.request_instance_events e join public.request_instances r on r.id=e.request_instance_id where r.legacy_record_id in ('REQ_LEGACY_A','REQ_LEGACY_B') and e.action='legacy_import' and e.revision=1;
 if c<>2 then raise exception 'expected immutable legacy import evidence'; end if;
 select count(*) into c from public.records where collection in ('requestTypes','requests');
 if c<>4 then raise exception 'legacy records must remain preserved after cutover'; end if;
 if (select legacy_number from public.request_instances where legacy_record_id='REQ_LEGACY_A')<>'REQ-2026-00001' then raise exception 'legacy request number not preserved'; end if;
 if (select values_json->>'f1' from public.request_instances where legacy_record_id='REQ_LEGACY_A')<>'لپ‌تاپ' then raise exception 'legacy request values not preserved'; end if;
end $$;

-- Re-running the migration must be idempotent: no duplicate definitions/versions/instances/events.
\ir ../migrations/20261001223500_request_workflow_d2_legacy_cutover.sql

do $$
declare c integer;
begin
 select count(*) into c from public.request_type_definitions where legacy_record_id in ('RT_LEGACY_A','RT_LEGACY_B'); if c<>2 then raise exception 'legacy definition import is not idempotent'; end if;
 select count(*) into c from public.request_instances where legacy_record_id in ('REQ_LEGACY_A','REQ_LEGACY_B'); if c<>2 then raise exception 'legacy instance import is not idempotent'; end if;
 select count(*) into c from public.request_instance_events e join public.request_instances r on r.id=e.request_instance_id where r.legacy_record_id in ('REQ_LEGACY_A','REQ_LEGACY_B') and e.action='legacy_import'; if c<>2 then raise exception 'legacy event import is not idempotent'; end if;
 select count(*) into c from pg_indexes where schemaname='public' and indexname in ('request_instance_events_actor_user_idx','request_instance_events_request_instance_fk_idx','request_instances_request_type_version_idx','request_instances_requester_user_idx','request_instances_workflow_version_idx','request_type_definitions_created_by_idx','request_type_versions_published_by_idx','request_workflow_versions_published_by_idx');
 if c<>8 then raise exception 'expected all 8 request workflow FK covering indexes, got %',c; end if;
end $$;

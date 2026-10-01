-- C8 Task 2 candidate hardening kept separate until the final migration archive is assembled.
create index office_workflow_instances_attached_by_idx on private.office_workflow_instances(attached_by);
create index office_workflow_events_actor_fk_idx on private.office_workflow_events(actor_id);

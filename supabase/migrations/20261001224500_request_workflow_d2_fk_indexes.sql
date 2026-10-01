-- Slice D2: cover request-workflow foreign keys reported by the production performance advisor.
create index if not exists request_instance_events_actor_user_idx on public.request_instance_events(actor_user_id);
create index if not exists request_instance_events_request_instance_fk_idx on public.request_instance_events(request_instance_id);
create index if not exists request_instances_request_type_version_idx on public.request_instances(request_type_version_id);
create index if not exists request_instances_requester_user_idx on public.request_instances(requester_user_id);
create index if not exists request_instances_workflow_version_idx on public.request_instances(workflow_version_id);
create index if not exists request_type_definitions_created_by_idx on public.request_type_definitions(created_by);
create index if not exists request_type_versions_published_by_idx on public.request_type_versions(published_by);
create index if not exists request_workflow_versions_published_by_idx on public.request_workflow_versions(published_by);

-- Keep privileged implementation outside the exposed API schema.
alter function public.request_publish_type_version(uuid,text,text,text,jsonb,jsonb,bigint) set schema private;
alter function public.request_create_instance(uuid,uuid,jsonb,text) set schema private;
alter function public.request_transition_instance(uuid,text,bigint,text,text) set schema private;

revoke all on function private.request_publish_type_version(uuid,text,text,text,jsonb,jsonb,bigint) from public,anon;
revoke all on function private.request_create_instance(uuid,uuid,jsonb,text) from public,anon;
revoke all on function private.request_transition_instance(uuid,text,bigint,text,text) from public,anon;
grant execute on function private.request_publish_type_version(uuid,text,text,text,jsonb,jsonb,bigint) to authenticated;
grant execute on function private.request_create_instance(uuid,uuid,jsonb,text) to authenticated;
grant execute on function private.request_transition_instance(uuid,text,bigint,text,text) to authenticated;

create or replace function public.request_publish_type_version(p_organization_id uuid,p_code text,p_title text,p_category text default null,p_form_schema jsonb default '{}'::jsonb,p_workflow_schema jsonb default '{}'::jsonb,p_expected_definition_revision bigint default null)
returns table(request_type_id uuid,request_type_version_id uuid,workflow_version_id uuid,version_no integer,definition_revision bigint)
language sql security invoker set search_path='' as $$ select * from private.request_publish_type_version(p_organization_id,p_code,p_title,p_category,p_form_schema,p_workflow_schema,p_expected_definition_revision) $$;
create or replace function public.request_create_instance(p_organization_id uuid,p_request_type_version_id uuid,p_values jsonb,p_idempotency_key text)
returns uuid language sql security invoker set search_path='' as $$ select private.request_create_instance(p_organization_id,p_request_type_version_id,p_values,p_idempotency_key) $$;
create or replace function public.request_transition_instance(p_request_instance_id uuid,p_action text,p_expected_revision bigint,p_idempotency_key text,p_note text default null)
returns table(request_instance_id uuid,status text,revision bigint)
language sql security invoker set search_path='' as $$ select * from private.request_transition_instance(p_request_instance_id,p_action,p_expected_revision,p_idempotency_key,p_note) $$;

revoke all on function public.request_publish_type_version(uuid,text,text,text,jsonb,jsonb,bigint) from public,anon;
revoke all on function public.request_create_instance(uuid,uuid,jsonb,text) from public,anon;
revoke all on function public.request_transition_instance(uuid,text,bigint,text,text) from public,anon;
grant execute on function public.request_publish_type_version(uuid,text,text,text,jsonb,jsonb,bigint) to authenticated;
grant execute on function public.request_create_instance(uuid,uuid,jsonb,text) to authenticated;
grant execute on function public.request_transition_instance(uuid,text,bigint,text,text) to authenticated;

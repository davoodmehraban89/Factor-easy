import fs from 'node:fs';
const src=fs.readFileSync('js/office-workflow.js','utf8');
const required=['officeWorkflowPolicies','officeWorkflowPublish','officeWorkflowMountAdmin','office_workflow_catalog','office_workflow_publish','textContent','replaceChildren'];
for(const token of required){if(!src.includes(token))throw new Error('C8 UI contract missing: '+token)}
if(/\.innerHTML\s*=/.test(src))throw new Error('C8 UI must not render workflow content through innerHTML');
if(!src.includes("['edit','refer','approve']"))throw new Error('C8 capability allowlist drift');
if(!src.includes('مرحله گردش، جایگزین ثبت دبیرخانه یا تأیید داخلی نامه نیست.'))throw new Error('C8 status/workflow separation notice missing');

const migrationPath='supabase/migrations/20261001173917_office_slice_c8_workflow_policy.sql';
if(!fs.existsSync(migrationPath))throw new Error('C8 workflow policy migration missing');
const sql=fs.readFileSync(migrationPath,'utf8');
for(const token of [
  'private.office_workflow_policy_versions','enable row level security','private.office_workflow_validate_definition',
  'private.office_workflow_publish_impl','public.office_workflow_publish','private.office_workflow_catalog_impl','public.office_workflow_catalog',
  "('edit','refer','approve')",'pg_advisory_xact_lock','published workflow policy is immutable','security invoker'
]){if(!sql.includes(token))throw new Error('C8 SQL contract missing: '+token)}
if(!sql.includes("revoke all on private.office_workflow_policy_versions from public,anon,authenticated"))throw new Error('C8 private table grants are not closed');
if(!sql.includes("p_organization_id not in (select private.current_organization_ids())"))throw new Error('C8 private entry points must verify active membership');
if(!sql.includes("organization_has_module_entitlement(p_organization_id,'office_automation',true)"))throw new Error('C8 publication must require writable entitlement');
if(!sql.includes("organization_has_module_entitlement(p_organization_id,'office_automation',false)"))throw new Error('C8 catalog must preserve read-only expired access');
console.log('Office Slice C8 policy UI + SQL contract: PASS');

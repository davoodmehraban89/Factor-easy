import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath='supabase/migrations/20261001204500_request_workflow_d1_foundation.sql';
assert.ok(fs.existsSync(migrationPath),'Slice D1 migration must exist');
const sql=fs.readFileSync(migrationPath,'utf8');
for(const token of [
  'request_type_definitions',
  'request_type_versions',
  'request_workflow_versions',
  'request_publish_type_version',
  'request_create_instance',
  'request_transition_instance',
  'expected_revision',
  'idempotency_key',
  'requests_workflow',
  "'configure'",
  'for update'
]) assert.ok(sql.toLowerCase().includes(token.toLowerCase()),`missing Slice D1 contract token: ${token}`);
assert.match(sql,/unique\s*\([^)]*organization_id[^)]*code[^)]*\)/i,'request type code must be tenant-unique');
assert.match(sql,/unique\s*\([^)]*organization_id[^)]*idempotency_key[^)]*\)/i,'instance creation must be idempotent per tenant');
assert.match(sql,/raise exception[^;]*(stale|revision)/i,'transition RPC must reject stale revisions');
assert.match(sql,/private\.has_org_capability\([^;]*requests_workflow[^;]*configure/i,'publishing must require requests_workflow.configure');
assert.match(sql,/private\.has_org_capability\([^;]*requests_workflow[^;]*(create|approve|edit)/i,'runtime mutation must enforce workflow capability');
console.log('Slice D1 request workflow foundation invariants: OK');

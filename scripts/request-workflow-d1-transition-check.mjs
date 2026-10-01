import fs from 'node:fs';
import assert from 'node:assert/strict';
const p='supabase/migrations/20261001205500_request_workflow_d1_transition_evidence.sql';
assert.ok(fs.existsSync(p),'D1 transition evidence hardening migration must exist');
const sql=fs.readFileSync(p,'utf8');
for(const token of ['v_from','for update','p_expected_revision','stale revision','request_instance_events','from_status','idempotency_key']) assert.ok(sql.toLowerCase().includes(token.toLowerCase()),`missing transition evidence token: ${token}`);
assert.match(sql,/v_from\s*:=\s*v_row\.status/i,'transition must snapshot the pre-transition status');
assert.match(sql,/values\s*\([^;]*v_from\s*,\s*v_next/i,'event must persist the pre-transition status');
console.log('Slice D1 transition evidence invariants: OK');

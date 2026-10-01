import fs from 'node:fs';
import assert from 'node:assert/strict';
const p='supabase/migrations/20261001210500_request_workflow_d1_rpc_security.sql';
assert.ok(fs.existsSync(p),'D1 RPC security hardening migration must exist');
const sql=fs.readFileSync(p,'utf8').toLowerCase();
for(const token of ['set schema private','security invoker','private.request_publish_type_version','private.request_create_instance','private.request_transition_instance','revoke all on function','grant execute']) assert.ok(sql.includes(token),`missing RPC security token: ${token}`);
assert.ok(!/create or replace function public\.request_[\s\S]{0,400}security definer/.test(sql),'public request RPC wrappers must not be SECURITY DEFINER');
console.log('Slice D1 RPC security invariants: OK');

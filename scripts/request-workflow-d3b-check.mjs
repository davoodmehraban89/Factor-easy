import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('js/request-workflow-d3b.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20261001233000_request_workflow_d3b_conditions_timeline.sql','utf8');
const bootstrap=fs.readFileSync('js/bootstrap.js','utf8');

assert.match(js,/requestD3bAddStep/,'D3b visual editor must expose step creation');
assert.match(js,/requestD3bPublishCombined/,'D3b editor must publish immutable workflow versions through the server RPC');
assert.match(js,/requestD3bOpenTimeline/,'D3b must expose the read-only runtime timeline');
assert.match(js,/schemaVersion\s*:\s*2/,'D3b editor must publish workflow schema v2');
assert.match(js,/condition/,'D3b editor must model bounded step conditions');
assert.match(migration,/validate_request_condition/,'D3b must validate the condition DSL on the server');
assert.match(migration,/evaluate_request_condition/,'D3b must evaluate conditions on the server');
assert.match(migration,/request_workflow_timeline/,'D3b must expose an authorized read-only timeline RPC');
assert.match(migration,/condition_matched/,'D3b runtime must retain condition evaluation evidence');
assert.match(migration,/skipped/,'D3b runtime must preserve skipped-step evidence');
assert.match(bootstrap,/request-workflow-d2\.js[\s\S]*request-workflow-d3b\.js/,'D3b must load after D2');
console.log('Request Workflow D3b invariants: OK');

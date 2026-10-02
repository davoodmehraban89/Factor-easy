import fs from 'node:fs';
const js=fs.readFileSync('js/request-workflow-d4a.js','utf8');
const sql=fs.readFileSync('supabase/migrations/20261002033000_request_workflow_d4a_work_queue.sql','utf8');
const shell=fs.readFileSync('js/platform-modules.js','utf8');
for(const token of ['request_work_queue','request_step_decide','workqueue','delegatedFromUserId'])if(!js.includes(token))throw new Error('D4a JS missing '+token);
for(const token of ['private.request_work_queue','public.request_work_queue','request_valid_delegator','request_step_votes','security invoker'])if(!sql.toLowerCase().includes(token.toLowerCase()))throw new Error('D4a SQL missing '+token);
if(!shell.includes("'workqueue'"))throw new Error('D4a work queue menu task missing');
console.log('Request Workflow D4a static invariants: PASS');

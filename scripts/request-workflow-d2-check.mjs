import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const ui=read('js/request-workflow-d2.js');
const bootstrap=read('js/bootstrap.js');
const migration=read('supabase/migrations/20261001223500_request_workflow_d2_legacy_cutover.sql');

const checks=[
  ['D2 runtime is loaded after legacy office UI',bootstrap.includes("office-automation.js")&&bootstrap.includes("request-workflow-d2.js")&&bootstrap.indexOf('request-workflow-d2.js')>bootstrap.indexOf('office-automation.js')],
  ['D2 reads server request definitions and immutable versions',ui.includes("sb.from('request_type_definitions')")&&ui.includes("sb.from('request_type_versions')")&&ui.includes("sb.from('request_instances')")],
  ['publishing uses the server-authorized D1 RPC',ui.includes("sb.rpc('request_publish_type_version'")&&ui.includes('p_expected_definition_revision')],
  ['runtime creation uses the server-authorized D1 RPC with idempotency',ui.includes("sb.rpc('request_create_instance'")&&ui.includes('p_idempotency_key')],
  ['configure actions are capability-gated',ui.includes("finoraCanConfigureModule('requests_workflow')")&&ui.includes('requestD2PublishType')],
  ['published version and draft-change state are visible',ui.includes('publishedVersionNo')&&ui.includes('request-d2-draft-state')&&ui.includes('تغییرات منتشرنشده')],
  ['legacy record-store request writes are not used by D2',!ui.includes("datastore.requestTypes")&&!ui.includes("datastore.requests")&&!ui.includes("saveDatastore()")],
  ['stale revision has an explicit recoverable surface',ui.includes('stale definition revision')&&ui.includes('نسخه فرم در سرور تغییر کرده است')],
  ['legacy cutover is traceable and non-destructive',migration.includes('legacy_record_id')&&migration.includes("'legacy_import'")&&migration.includes("where r.collection='requestTypes'")&&migration.includes("where r.collection='requests'")&&!/delete\s+from\s+public\.records/i.test(migration)]
];

let failed=false;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed=true;}
if(failed)process.exit(1);
console.log('Request Workflow D2 static contracts verified.');

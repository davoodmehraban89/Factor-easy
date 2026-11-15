// Disposable-only: no connection string or production endpoint accepted.
import {withDisposableLedger} from './wp0-ledger-harness.mjs';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const mode=process.argv[2]||'green';
assert.ok(['baseline','green','concurrency'].includes(mode),'Usage: node scripts/wp1-ledger-test.mjs baseline|green|concurrency');
const out=process.env.WP1_EVIDENCE_DIR||'/tmp/finora-wp1-evidence';
mkdirSync(out,{recursive:true});
await withDisposableLedger(async c=>{
 const evidence={baseline:c.evidence,mode,scope:mode==='concurrency'?'two-session concurrency only':process.env.WP1_TEST_FILTER?'filtered SQL selection':'full SQL selection and concurrency',completed:false,applied:[],tests:[],concurrency:null};
 const persist=()=>writeFileSync(out+'/'+mode+'-results.json',JSON.stringify(evidence,null,2)+'\n');
 persist();
 if(mode!=='baseline'){
  const files=readdirSync('supabase/migrations').filter(x=>(x.startsWith('2026101610')||x.includes('_wp1_'))&&x.endsWith('.sql')).sort();
  assert.ok(files.length>=10,'Staged financial migrations absent');
  for(const name of files){
   const bytes=readFileSync('supabase/migrations/'+name);
   c.requireSuccess(c.sql(bytes.toString()),name);
   evidence.applied.push({file:name,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
 }
 const tests=mode==='concurrency'?[]:mode==='baseline'?['wp1_direct_write_regressions.sql']:
 readdirSync('supabase/tests').filter(x=>x.startsWith('wp1_')&&x.endsWith('.sql')).sort();
 const selected=tests.filter(x=>!process.env.WP1_TEST_FILTER||x.includes(process.env.WP1_TEST_FILTER));
 assert.ok(mode==='concurrency'||selected.length>0,'No SQL tests match requested selection');
 assert.ok(mode!=='concurrency'||!process.env.WP1_TEST_FILTER,'Concurrency mode cannot filter SQL');
 evidence.selectedTests=selected;persist();
 for(const file of selected){
  const result=c.sql(readFileSync('supabase/tests/'+file,'utf8'));
  const output=(result.stdout||'')+(result.stderr||'');
  writeFileSync(out+'/'+mode+'-'+file+'.log',output);
  evidence.tests.push({file,status:result.status});
  persist();
  c.requireSuccess(result,file);
  console.log('PASS '+file);
 }
 if(mode!=='baseline'&&!process.env.WP1_TEST_FILTER){
  const result=spawnSync(process.execPath,['scripts/wp1-concurrency.mjs'],{env:{...process.env,WP1_CONTAINER:`finora-wp0-ledger-${process.pid}`},encoding:'utf8'});
  writeFileSync(out+'/'+mode+'-concurrency.log',(result.stdout||'')+(result.stderr||''));
  evidence.concurrency={status:result.status};persist();
  c.requireSuccess(result,'two-session concurrency');
  console.log('PASS two-session concurrency');
 }
 evidence.completed=true;persist();
 console.log('WP1 '+mode+' selected checks complete; source-derived disposable DB, not production parity or JWT gateway acceptance. Evidence '+out);
});

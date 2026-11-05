// Real two-session graph visibility on an isolated source-derived PostgreSQL.
import{withDisposableLedger}from'./wp0-ledger-harness.mjs';
import{readFileSync,readdirSync,mkdirSync,writeFileSync}from'node:fs';
import{spawn}from'node:child_process';import assert from'node:assert/strict';
const out=process.env.WP1_EVIDENCE_DIR||'docs/wp1/evidence/graph-snapshot';mkdirSync(out,{recursive:true});
await withDisposableLedger(async c=>{
 const applied=readdirSync('supabase/migrations').filter(f=>(f.startsWith('2026101610')||f.includes('_wp1_'))&&f.endsWith('.sql')).sort();for(const f of applied)c.apply('supabase/migrations/'+f);
 const auth="select set_config('request.jwt.claim.sub','ed000000-0000-4000-8000-000000000001',false);set role authenticated;";
 const org="(select id from public.organizations where owner_user_id='ed000000-0000-4000-8000-000000000001')";
 const fixture=readFileSync('supabase/tests/wp1_journal_graph_read.sql','utf8');
 c.requireSuccess(c.sql(fixture.slice(0,fixture.indexOf('set local role authenticated;'))+`set local role authenticated;select public.finora_journal_create_draft(${org},'GR_TXN','{"companyId":"GR_C","fiscalYearId":"GR_Y","date":"1405/07/24","description":"before"}','[{"id":"GR_TXN_A","accountId":"GR_A","debit":1000,"credit":0},{"id":"GR_TXN_B","accountId":"GR_B","debit":0,"credit":1000}]');commit;`),'setup');
 const child=spawn('docker',['exec','-i',`finora-wp0-ledger-${process.pid}`,'psql','-X','-U','postgres','-d','finora_wp0','-At','-v','ON_ERROR_STOP=1'],{env:{...process.env,DOCKER_HOST:'unix:///var/run/docker.sock',DOCKER_CONTEXT:'',DOCKER_TLS:'',DOCKER_TLS_VERIFY:'',DOCKER_CERT_PATH:''},stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const finished=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',status=>resolve(status));});
 try{
  // Materialized wait keeps the outer SELECT snapshot open while a different
  // session commits the edit; no application function or policy is patched.
  child.stdin.end(auth+`WITH snapshot_wait AS MATERIALIZED (SELECT pg_sleep(3)) SELECT public.finora_journal_read_graph(${org},'GR_TXN') FROM snapshot_wait /* WP1_GRAPH_SNAPSHOT_READER */;`);
  let waiting=false;
  for(let i=0;i<40;i++){const r=c.sql("select count(*) from pg_stat_activity where pid<>pg_backend_pid() and wait_event='PgSleep' and query like '%WP1_GRAPH_SNAPSHOT_READER%';");c.requireSuccess(r,'reader barrier');if(/\n\s*1\s*\n/.test(r.stdout)){waiting=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.ok(waiting,'Reader snapshot barrier not observed');
  const write=c.sql(auth+`select public.finora_journal_update_draft(${org},'GR_TXN',1,'{"description":"after"}','[{"id":"GR_TXN_A","accountId":"GR_A","debit":1500,"credit":0},{"id":"GR_TXN_B","accountId":"GR_B","debit":0,"credit":1500}]');`);c.requireSuccess(write,'concurrent commit');writeFileSync(out+'/writer.log',write.stdout+write.stderr);
  assert.equal(await finished,0,stderr);writeFileSync(out+'/reader.log',stdout+stderr);
  const old=JSON.parse(stdout.split('\n').find(s=>s.startsWith('{')));
  const fresh=c.sql('\\pset format unaligned\n\\pset tuples_only on\n'+auth+`select public.finora_journal_read_graph(${org},'GR_TXN');`);c.requireSuccess(fresh,'fresh graph');writeFileSync(out+'/fresh.log',fresh.stdout+fresh.stderr);
  const latest=JSON.parse(fresh.stdout.split('\n').find(s=>s.startsWith('{')));
  const check=(g,version,description,amount)=>{assert.equal(g.records.length,3);const h=g.records.find(r=>r.collection==='journalVouchers');assert.equal(h.version,version);assert.equal(h.data.description,description);const lines=g.records.filter(r=>r.collection==='journalLines');assert.equal(lines.reduce((s,r)=>s+r.data.debit,0),amount);assert.equal(lines.reduce((s,r)=>s+r.data.credit,0),amount);};
  check(old,1,'before',1000);check(latest,2,'after',1500);
  writeFileSync(out+'/result.json',JSON.stringify({result:'PASS',scope:'Two real SQL sessions; commit occurs after outer read snapshot begins and before graph evaluation. Not HTTP/JWT acceptance.',applied,oldVersion:1,newVersion:2,oldAmount:1000,newAmount:1500},null,2)+'\n');
  console.log('PASS graph snapshot: in-flight reader gets complete old graph; fresh reader gets complete committed edit.');
 }finally{if(child.exitCode===null)child.kill('SIGTERM');}
});

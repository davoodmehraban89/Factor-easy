import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

// QA ONLY: use two real PostgreSQL sessions against a separate-schema copy
// of the EXISTING ATF candidate; this does not integrate its code into Finora.
const db=process.env.DB_URL,api=process.env.API_URL;
assert.ok(db&&api,'Disposable Supabase CLI DB_URL and API_URL required');
const dbUrl=new URL(db),apiUrl=new URL(api);
const loopback=new Set(['127.0.0.1','localhost','[::1]','::1']);
assert.ok(['postgres:','postgresql:'].includes(dbUrl.protocol)&&
 loopback.has(dbUrl.hostname)&&dbUrl.port==='54322'&&
 loopback.has(apiUrl.hostname)&&apiUrl.port==='54321',
 'Refusing to run against any non-local Supabase environment');
const schema='finora_qa_atf_'+randomUUID().replaceAll('-','').slice(0,16);
const org=randomUUID(),otherOrg=randomUUID(),actor=randomUUID();
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const reserve=(voucher,company='C1',organization=org)=>
 'SELECT '+schema+'.finora_reserve_attachment('+
 quote(organization)+','+quote(company)+','+quote(voucher)+');';
function psql(sql,stdoutCallback){
 return new Promise((resolve,reject)=>{
  const child=spawn('psql',[db,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-f','-'],
   {stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.on('data',chunk=>{
   stdout+=chunk.toString();
   if(stdoutCallback)stdoutCallback(stdout);
  });
  child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
  child.on('error',reject);
  child.on('close',code=>resolve({code,stdout:stdout.trim(),stderr:stderr.trim()}));
  child.stdin.end(sql+'\n');
 });
}
async function execute(sql){
 const result=await psql(sql);
 assert.equal(result.code,0,'Disposable SQL failed: '+result.stderr.slice(-900));
 return result.stdout;
}
async function rejected(sql,error){
 const result=await psql(sql);
 assert.notEqual(result.code,0,'Illegal ATF operation succeeded');
 assert.ok((result.stderr+' '+result.stdout).includes(error),
  'Unexpected rejection: expected '+error+', got '+result.stderr.slice(-700));
}
async function scalar(sql){
 const txt=await execute(sql);
 const rows=txt.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 assert.equal(rows.length,1,'Wanted one scalar, received: '+txt);
 return rows[0];
}
function transactionNumber(result){
 assert.equal(result.code,0,'Transaction failed: '+result.stderr.slice(-800));
 const rows=result.stdout.split(/\r?\n/).map(x=>x.trim()).filter(x=>/^\d+$/.test(x));
 assert.equal(rows.length,1,'Wrong transaction output: '+result.stdout);
 return Number(rows[0]);
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let schemaCreated=false;
try{
 await execute('CREATE SCHEMA '+schema+';');
 schemaCreated=true;
 const candidate=await readFile(new URL('../supabase/candidates/0216_attachment_registry.sql',import.meta.url),'utf8');
 assert.match(candidate,/Candidate only: not a deployed migration/);
 assert.match(candidate,/CREATE FUNCTION private\.finora_reserve_attachment/);
 // Load exact candidate text with schema qualification replaced, no business
 // migrations, hosted records or real private registry changes.
 await execute(candidate.replaceAll('private.',schema+'.'));

 // Reserve V1, then keep the first session's transaction open. Start retry
 // only when the first result has been emitted while its lock is still held.
 let signal;
 const ready=new Promise(resolve=>{signal=resolve;});
 let signaled=false;
 const first=psql('BEGIN;\n'+reserve('V1')+'\nSELECT pg_sleep(1.1);\nCOMMIT;',output=>{
  if(!signaled&&/^\s*1\s*$/m.test(output)){signaled=true;signal();}
 });
 assert.equal(await Promise.race([ready.then(()=>true),delay(15000).then(()=>false)]),
  true,'Session A did not reserve V1 in time');
 let retried=false;
 const second=psql('BEGIN;\n'+reserve('V1')+'\nCOMMIT;')
  .then(x=>{retried=true;return x;});
 await delay(120);
 assert.equal(retried,false,'Session B bypassed the in-flight V1 transaction');
 const pair=await Promise.all([first,second]);
 assert.equal(transactionNumber(pair[0]),1);
 assert.equal(transactionNumber(pair[1]),1,'Concurrent retry changed the ATF number');
 assert.equal(await scalar('SELECT count(*) FROM '+schema+'.finora_attachment_registry WHERE organization_id='+
  quote(org)+" AND voucher_id='V1';"),'1');
 assert.equal(await scalar('SELECT last_number FROM '+schema+'.finora_attachment_counters WHERE organization_id='+
  quote(org)+" AND company_id='C1';"),'1');

 // Two new voucher identities can contend for the same company counter.
 const distinct=await Promise.all([psql(reserve('V2')),psql(reserve('V3'))]);
 assert.deepEqual(distinct.map(transactionNumber).sort((a,b)=>a-b),[2,3]);
 assert.equal(await scalar('SELECT count(DISTINCT attachment_number) FROM '+
  schema+'.finora_attachment_registry WHERE organization_id='+quote(org)+
  " AND company_id='C1';"),'3');

 // A voucher identifier is permanently bound to its original company.
 await rejected(reserve('V1','C2'),'FINORA_ATTACHMENT_COMPANY_IMMUTABLE');
 assert.equal(await scalar('SELECT count(*) FROM '+schema+
  '.finora_attachment_registry WHERE organization_id='+quote(org)+
  " AND company_id='C2';"),'0');

 // Aborted allocation isn't issued and must not leak the number or row.
 await execute('BEGIN;\n'+reserve('ABORTED')+'\nROLLBACK;');
 assert.equal(await scalar('SELECT count(*) FROM '+schema+
  '.finora_attachment_registry WHERE organization_id='+quote(org)+
  " AND voucher_id='ABORTED';"),'0');
 assert.equal(await scalar(reserve('V4')),'4');

 // A committed tombstone keeps the number consumed and blocks resurrection.
 await execute('SELECT '+schema+'.finora_tombstone_attachment('+
  quote(org)+",'C1','V1',"+quote(actor)+'::uuid);');
 await rejected(reserve('V1'),'FINORA_ATTACHMENT_DELETED');
 assert.equal(await scalar(reserve('V5')),'5');
 assert.equal(await scalar('SELECT attachment_number FROM '+schema+
  '.finora_attachment_registry WHERE organization_id='+quote(org)+
  " AND voucher_id='V1' AND deleted_by="+quote(actor)+'::uuid AND deleted_at IS NOT NULL;'),'1');

 // Identical display sequence numbers may exist in DIFFERENT org/company scopes.
 assert.equal(await scalar(reserve('C2_V1','C2')),'1');
 assert.equal(await scalar(reserve('V1','C1',otherOrg)),'1');
 // UPDATE/DELETE/TRUNCATE and direct privileges are already covered by the
 // existing transactional supabase/tests/0216_attachment_candidate.sql.
 console.log('FINORA_ATF_TWO_SESSION_CANDIDATE_PASS: two PostgreSQL sessions, in-flight idempotency, unique competing vouchers, immutable company, abort and tombstone, organization/company isolation; candidate only');
}finally{
 if(schemaCreated){
  const cleaned=await psql('DROP SCHEMA IF EXISTS '+schema+' CASCADE;');
  assert.equal(cleaned.code,0,'Disposable QA schema cleanup failed: '+cleaned.stderr.slice(-700));
 }
}

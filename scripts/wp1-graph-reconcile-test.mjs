import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

// Real synchronization code; only the network, clock and page boundary are simulated.
// Removing targeted publication or the context/dirty guards must break these tests.
function fixture(){
 const rows=[
  {collection:'companies',id:'C',version:4,data:{id:'C',name:'company'}},
  {collection:'journalVouchers',id:'V',version:2,data:{id:'V',companyId:'C',status:'draft',description:'old'}},
  {collection:'journalLines',id:'L',version:2,data:{id:'L',companyId:'C',voucherId:'V',debit:100,credit:0}},
  {collection:'journalLineDimensions',id:'D',version:2,data:{id:'D',companyId:'C',voucherId:'V',journalLineId:'L',dimensionValueId:'X'}},
  {collection:'journalVouchers',id:'OTHER',version:1,data:{id:'OTHER',companyId:'C',status:'draft'}}
 ];
 const graph={organization_id:'O',voucher_id:'V',effective_status:'posted',records:[
  {collection:'journalVouchers',id:'V',version:3,data:{id:'V',companyId:'C',status:'posted',description:'server'}},
  {collection:'journalLines',id:'L2',version:1,data:{id:'L2',companyId:'C',voucherId:'V',debit:200,credit:0}}
 ]};
 let view={companyId:'C',formId:'F',editRevision:0},nextTimer=0;
 const timers=new Map(),calls=[];
 const state={rows,graph,hook:null,error:null};
 const c={console:{error(){},warn(){}},Map,Set,JSON,Promise,Number,String,Array,Date,Math,
  setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
  currentUser:{id:'U',organizationId:'O'},COLLS:['companies','journalVouchers','journalLines','journalLineDimensions'],ID_RE:/^[A-Za-z0-9_-]+$/,
  document:{getElementById:()=>null,addEventListener(){}},canWrite:()=>true,requireWrite:()=>true,refreshAllSurfaces(){},alert(){},finoraAbortableRead:async p=>p};
 c.window=c;c.addEventListener=()=>{};
 c.sb={from(){const q={select(){return q;},order(){return q;},range:async()=>({error:null,data:structuredClone(state.rows)})};return q;},
  async rpc(name,args){calls.push({name,args});if(state.hook)await state.hook(name,args);
   if(name==='finora_journal_read_graph')return {error:state.error,data:structuredClone(state.graph)};
   if(name==='finora_journal_get_guard_mode')return {error:null,data:'audit'};
   return {error:null,data:{upserts:args.p_upserts.map(r=>({collection:r.collection,id:r.id,version:r.expected_version+1})),deletes:args.p_deletes}};
  }};
 vm.createContext(c);vm.runInContext(fs.readFileSync(process.env.FINORA_SYNC_SOURCE||'js/sync.js','utf8'),c);
 const run=s=>vm.runInContext(s,c),capture=(id='V')=>c.finoraCaptureJournalRefresh(id,()=>view);
 return {c,state,calls,timers,run,capture,setView:v=>{view={...view,...v};},snapshot:()=>run('JSON.stringify({datastore,snap:[...syncSnap],versions:[...versionSnap]})')};
}
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function prepared(){const f=fixture();await f.c.pullAll();return f;}
async function refresh(f){return f.c.finoraRefreshJournalGraph(f.capture());}

test('targeted refresh replaces only its graph and acknowledges versions without syncing display status',async()=>{
 const f=await prepared();f.state.graph.effective_status='partially_reversed';
 const result=await refresh(f);
 assert.equal(result.effectiveStatus,'partially_reversed');
 assert.equal(f.run("datastore.journalVouchers.find(r=>r.id==='V').status"),'posted');
 assert.equal(f.run('datastore.journalLines[0].id'),'L2');
 assert.equal(f.run('datastore.journalLineDimensions.length'),0);
 assert.equal(f.run("versionSnap.get('journalVouchers|V')"),3);
 assert.equal(f.run("syncSnap.has('journalLines|L')"),false);
 assert.equal(f.run("versionSnap.has('journalLineDimensions|D')"),false);
 assert.equal(f.run('computeDiff().up.length+computeDiff().del.length'),0);
 assert.deepEqual(f.calls.map(x=>x.name),['finora_journal_read_graph']);
});
test('unrelated dirty objects, deletion, pending state and save timer survive graph publication',async()=>{
 const f=await prepared();f.run("datastore.companies[0].name='unsaved';datastore.journalVouchers=datastore.journalVouchers.filter(r=>r.id!=='OTHER');saveDatastore();globalThis.keepCompany=datastore.companies;globalThis.keepObject=datastore.companies[0];globalThis.keepTimer=syncTimer");
 await refresh(f);
 assert.equal(f.run('datastore.companies===keepCompany&&datastore.companies[0]===keepObject&&syncTimer===keepTimer&&syncPending'),true);
 assert.equal(f.run('computeDiff().up[0].payload.name'),'unsaved');
 assert.equal(f.run('computeDiff().del[0]'),'journalVouchers|OTHER');
 assert.equal(f.timers.get(f.run('syncTimer')).ms,300);
});
for(const edit of ["datastore.journalVouchers[0].description='local'","datastore.journalLines=[]","datastore.journalLines[0].voucherId='OTHER'","datastore.journalLineDimensions[0].journalLineId='bad'"]){
 test('initial dirty graph rejects without network: '+edit,async()=>{
  const f=await prepared();f.run(edit);const before=f.snapshot();
  await assert.rejects(async()=>refresh(f),{code:'FINORA_GRAPH_LOCAL_CHANGED'});
  assert.equal(f.snapshot(),before);assert.equal(f.calls.length,0);
 });
}
for(const [code,change] of [
 ['FINORA_GRAPH_LOCAL_CHANGED',f=>f.run("datastore.journalLines[0].debit=101")],
 ['FINORA_GRAPH_LOCAL_CHANGED',f=>f.run("datastore.journalLines.push({id:'NEW',ownerUserId:'U',companyId:'C',voucherId:'V',debit:20})")],
 ['FINORA_GRAPH_VIEW_CHANGED',f=>f.setView({companyId:'C2'})],['FINORA_GRAPH_VIEW_CHANGED',f=>f.setView({formId:'F2'})],['FINORA_GRAPH_VIEW_CHANGED',f=>f.setView({editRevision:1})],
 ['FINORA_SYNC_CONTEXT_CHANGED',f=>{f.c.currentUser.organizationId='OTHER';}],['FINORA_SYNC_CONTEXT_CHANGED',f=>{f.c.currentUser={id:'U',organizationId:'O'};}],
 ['FINORA_SYNC_CONTEXT_CHANGED',f=>f.c.pullAll()]
])test('in-flight local/view/account/snapshot change rejects atomic publication #'+change.toString(),async()=>{
 const f=await prepared();f.state.hook=async name=>{if(name==='finora_journal_read_graph')await change(f);};
 const p=refresh(f);await assert.rejects(p,{code});assert.notEqual(f.run("datastore.journalVouchers.find(r=>r.id==='V').description"),'server');
 assert.equal(f.run('syncRunning'),false);
});
for(const [name,mutate] of [
 ['null',f=>f.state.graph=null],['wrong tenant',f=>f.state.graph.organization_id='OTHER'],
 ['wrong voucher',f=>f.state.graph.voucher_id='OTHER'],['no header',f=>f.state.graph.records.shift()],
 ['duplicate',f=>f.state.graph.records.push(f.state.graph.records[0])],
 ['foreign collection',f=>f.state.graph.records[1].collection='companies'],
 ['unsafe version',f=>f.state.graph.records[0].version=Number.MAX_SAFE_INTEGER],
 ['regressed version',f=>f.state.graph.records[0].version=1],
 ['same revision altered payload',f=>f.state.graph.records[0].version=2],
 ['wrong company',f=>f.state.graph.records[1].data.companyId='C2'],
 ['wrong parent',f=>f.state.graph.records[1].data.voucherId='OTHER'],
 ['bad ID',f=>f.state.graph.records[1].id='bad|id'],
 ['mismatched data ID',f=>f.state.graph.records[1].data.id='bad'],
 ['invalid status',f=>f.state.graph.effective_status='success'],
 ['draft reversed status',f=>{f.state.graph.records[0].data.status='draft';f.state.graph.effective_status='reversed';}],
 ['orphan dimension',f=>f.state.graph.records.push({collection:'journalLineDimensions',id:'D2',version:1,data:{id:'D2',companyId:'C',voucherId:'V',journalLineId:'missing'}})],
 ['collision',f=>{f.state.graph.records[1].id='COLLIDE';f.state.graph.records[1].data.id='COLLIDE';f.run("datastore.journalLines.push({id:'COLLIDE',ownerUserId:'U',companyId:'C',voucherId:'OTHER'})");}],
 ['error',f=>f.state.error={code:'42501',message:'private server details'}]
])test('malformed or unauthorized graph preserves all arrays and snapshots: '+name,async()=>{
 const f=await prepared();mutate(f);const before=f.snapshot();
 await assert.rejects(refresh(f),{code:name==='error'?'FINORA_GRAPH_READ_UNAVAILABLE':'FINORA_GRAPH_INVALID'});assert.equal(f.snapshot(),before);assert.equal(f.run('syncRunning'),false);
});
test('normal sync waits for refresh and sends only unrelated dirty records',async()=>{
 const f=await prepared(),gate=deferred();f.state.hook=name=>name==='finora_journal_read_graph'?gate.promise:undefined;
 const p=refresh(f);await tick();f.run("datastore.companies[0].name='pending'");await f.c.runSync();
 assert.deepEqual(f.calls.map(x=>x.name),['finora_journal_read_graph']);
 gate.resolve();await p;const timer=f.timers.get(f.run('syncTimer'));assert.equal(timer.ms,0);await timer.fn();
 const write=f.calls.find(x=>x.name==='finora_sync_records_v2');assert.equal(write.args.p_upserts.length,1);assert.equal(write.args.p_upserts[0].collection,'companies');
});
test('refresh queues behind an existing normal save',async()=>{
 const f=await prepared(),gate=deferred();f.run("datastore.companies[0].name='pending'");
 f.state.hook=name=>name==='finora_sync_records_v2'?gate.promise:undefined;
 const sync=f.c.runSync();await tick();const graph=refresh(f);await tick();
 assert.equal(f.calls.some(x=>x.name==='finora_journal_read_graph'),false);
 gate.resolve();await sync;await graph;assert.equal(f.run("datastore.journalVouchers.find(r=>r.id==='V').description"),'server');
});
test('second captured refresh rejects after first graph changes, without a second request',async()=>{
 const f=await prepared(),gate=deferred();f.state.hook=()=>gate.promise;
 const a=refresh(f);await tick();const b=refresh(f);const reject=assert.rejects(b,{code:'FINORA_SYNC_CONTEXT_CHANGED'});
 gate.resolve();await a;await reject;assert.equal(f.calls.length,1);
});
test('request timeout releases lock and a late graph cannot publish',async()=>{
 const f=await prepared(),gate=deferred();f.state.hook=()=>gate.promise;const before=f.snapshot();
 const p=refresh(f);const rejection=assert.rejects(p,{code:'FINORA_GRAPH_READ_UNAVAILABLE'});await tick();
 for(const t of [...f.timers.values()])if(t.ms===20000)t.fn();await rejection;
 gate.resolve();await tick();assert.equal(f.snapshot(),before);assert.equal(f.run('syncRunning'),false);
});
test('queued refresh timeout does not steal active writer lock',async()=>{
 const f=await prepared(),gate=deferred();f.run("datastore.companies[0].name='pending'");f.state.hook=name=>name==='finora_sync_records_v2'?gate.promise:undefined;
 const sync=f.c.runSync();await tick();const p=refresh(f);const rejection=assert.rejects(p,{code:'FINORA_GRAPH_BUSY'});await tick();
 const last=[...f.timers.values()].at(-1);last.fn();await rejection;
 assert.equal(f.run('syncRunning'),true);gate.resolve();await sync;assert.equal(f.calls.some(x=>x.name==='finora_journal_read_graph'),false);
});
test('read-only user can refresh a new visible graph without a write',async()=>{
 const f=await prepared();f.c.canWrite=()=>false;f.state.graph.voucher_id='NEW';f.state.graph.records=f.state.graph.records.slice(0,1);f.state.graph.records[0].id='NEW';f.state.graph.records[0].data.id='NEW';
 await f.c.finoraRefreshJournalGraph(f.capture('NEW'));assert.equal(f.run('datastore.journalVouchers.length'),3);assert.equal(f.calls.length,1);
});
test('valid same-revision JSON with different key order remains clean',async()=>{
 const f=await prepared();f.state.graph.effective_status='draft';f.state.graph.records=structuredClone(f.state.rows.filter(r=>r.id!=='C'&&r.id!=='OTHER'));
 f.state.graph.records[0].data={description:'old',status:'draft',companyId:'C',id:'V'};
 await refresh(f);assert.equal(f.run('computeDiff().up.length+computeDiff().del.length'),0);
});
test('complete graph above normal page size retains all lines and linked dimensions',async()=>{
 const f=await prepared();f.state.graph.records=f.state.graph.records.slice(0,1);
 for(let n=0;n<1001;n++)f.state.graph.records.push({collection:'journalLines',id:'N'+n,version:1,data:{companyId:'C',voucherId:'V',debit:n+1,credit:0}});
 f.state.graph.records.push({collection:'journalLineDimensions',id:'D2',version:1,data:{companyId:'C',voucherId:'V',journalLineId:'N1000'}});
 await refresh(f);assert.equal(f.run('datastore.journalLines.length'),1001);assert.equal(f.run("versionSnap.get('journalLines|N1000')"),1);assert.equal(f.run('datastore.journalLineDimensions[0].journalLineId'),'N1000');assert.equal(f.run('computeDiff().up.length+computeDiff().del.length'),0);
});
test('context changed while queued rejects before sending graph request',async()=>{
 const f=await prepared(),gate=deferred();f.run("datastore.companies[0].name='pending'");f.state.hook=name=>name==='finora_sync_records_v2'?gate.promise:undefined;
 const sync=f.c.runSync();await tick();const graph=refresh(f);const rejected=assert.rejects(graph,{code:'FINORA_GRAPH_VIEW_CHANGED'});f.setView({editRevision:1});gate.resolve();await sync;await rejected;
 assert.equal(f.calls.some(x=>x.name==='finora_journal_read_graph'),false);assert.equal(f.run('syncRunning'),false);
});
test('unhydrated same-user tenant cannot capture old graph',async()=>{
 const f=await prepared();f.c.currentUser.organizationId='OTHER';const before=f.snapshot();await assert.rejects(async()=>refresh(f),{code:'FINORA_SYNC_SNAPSHOT_REQUIRED'});assert.equal(f.snapshot(),before);assert.equal(f.calls.length,0);
});

test('failed writer drops pre-failure queued retry even when a graph refresh follows',async()=>{
 const f=await prepared(),gate=deferred();f.run("datastore.companies[0].name='pending'");
 let writes=0;f.state.hook=async name=>{if(name==='finora_sync_records_v2'){writes++;await gate.promise;throw new Error('transport lost');}};
 const sync=f.c.runSync();await tick();await f.c.runSync();const graph=refresh(f);await tick();
 gate.resolve();await sync;await graph;
 assert.equal(f.timers.size,0,'An uncertain write cannot gain a retry timer from the read-only graph operation');
 assert.equal(writes,1);assert.equal(f.run('syncPending'),true);assert.equal(f.run('computeDiff().up[0].payload.name'),'pending');
});
test('a new explicit save queued during graph read still resumes after earlier writer failure',async()=>{
 const f=await prepared(),writeGate=deferred(),readGate=deferred();f.run("datastore.companies[0].name='pending'");
 f.state.hook=async name=>{if(name==='finora_sync_records_v2'){await writeGate.promise;throw new Error('transport lost');}if(name==='finora_journal_read_graph')await readGate.promise;};
 const sync=f.c.runSync();await tick();const graph=refresh(f);writeGate.resolve();await sync;await tick();
 await f.c.runSync();readGate.resolve();await graph;
 assert.equal(f.timers.get(f.run('syncTimer')).ms,0);
});
test('older same-tenant full read cannot overwrite a newer targeted graph publication',async()=>{
 const f=await prepared(),gate=deferred();const original=f.c.sb.from;
 f.c.sb.from=()=>{const q=original();q.range=async()=>{const old=structuredClone(f.state.rows);await gate.promise;return {error:null,data:old};};return q;};
 const pull=f.c.pullAll();const rejected=assert.rejects(pull,{code:'FINORA_SYNC_CONTEXT_CHANGED'});
 await refresh(f);gate.resolve();await rejected;
 assert.equal(f.run("versionSnap.get('journalVouchers|V')"),3);
 assert.equal(f.run("datastore.journalVouchers.find(r=>r.id==='V').description"),'server');
});

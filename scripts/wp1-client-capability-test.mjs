import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
function fixture({mode='audit',missing=false,orgWrapper=false}={}){
 const calls=[],reads=[];const state={mode,missing,readError:null,probeError:null,writeError:null,ack:null,probeHook:null,writeHook:null,rows:[{collection:'companies',id:'C',data:{name:'before'},version:4,organization_id:'O'}]};
 const c={console:{error(){},warn(){}},Map,Set,JSON,Promise,Number,String,Array,Date,Math,setTimeout:()=>1,clearTimeout(){},setInterval(){},
 currentUser:{id:'U',organizationId:'O'},COLLS:['companies','settings','journalVouchers','journalLines','journalLineDimensions'],ID_RE:/^[A-Za-z0-9_-]+$/,
 document:{getElementById:()=>null,addEventListener(){},querySelectorAll:()=>[]},localStorage:{getItem:()=>null,removeItem(){},setItem(){}},
 enterApp:async()=>{},fetchCurrentUser:async()=>c.currentUser,canWrite:()=>true,requireWrite:()=>true,refreshAllSurfaces(){},alert(){},finoraAbortableRead:async(p)=>p,finoraTrackLoginRead:async(s,p)=>p};
 c.window=c;c.addEventListener=()=>{};
 c.sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='finora_journal_get_guard_mode'){
   if(state.probeHook)await state.probeHook();
   return state.probeError?{error:state.probeError}:state.missing?{error:{code:'PGRST202'}}:{data:state.mode,error:null};
  }
  if(state.writeHook)await state.writeHook();
  if(state.writeError)return {error:state.writeError};
  return {error:null,data:(state.explicitAck||state.ack)?state.ack:{upserts:(args.p_upserts||[]).map(r=>({collection:r.collection,id:r.id,version:(r.expected_version||0)+1})),deletes:args.p_deletes||[]}};
 },from(table){let columns='';const q={select(s){columns=s;return q;},eq(){return q;},order(){return q;},abortSignal(){return q;},range(){reads.push({table,columns});return Promise.resolve(state.readError?{error:state.readError}:{data:structuredClone(state.rows),error:null});}};return q;}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/sync.js','utf8'),c);
 
 if(orgWrapper)vm.runInContext(fs.readFileSync('js/organization-rbac.js','utf8'),c);
 const evalCode=s=>vm.runInContext(s,c);
 return {c,state,calls,reads,evalCode};
}
test('confirmed absent server uses legacy columns and legacy sync',async()=>{
 const f=fixture({missing:true});delete f.state.rows[0].version;await f.c.pullAll();f.evalCode("datastore.companies[0].name='changed'");await f.c.runSync();
 assert.ok(f.reads.every(x=>!x.columns.split(',').includes('version')));assert.equal(f.calls.at(-1).name,'finora_sync_records');
});
test('present capability loads versions and uses versioned sync acknowledgement',async()=>{
 const f=fixture();await f.c.pullAll();assert.equal(f.reads[0].columns,'*');assert.equal(f.calls.length,0);
 f.evalCode("datastore.companies[0].name='changed'");await f.c.runSync();assert.equal(f.calls.at(-1).name,'finora_sync_records_v2');
 assert.equal(f.calls.at(-1).args.p_upserts[0].expected_version,4);assert.equal(f.evalCode("versionSnap.get('companies|C')"),5);
});
test('transport probe errors preserve pending edits without a legacy write',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='unsaved'");f.state.probeError={code:'NETWORK',message:'provider private'};await f.c.runSync();
 assert.equal(f.calls.length,1);assert.equal(f.evalCode('datastore.companies[0].name'),'unsaved');assert.equal(f.evalCode('computeDiff().up.length'),1);
});
test('partial server with no row version fails before write',async()=>{
 const f=fixture();delete f.state.rows[0].version;await f.c.pullAll();f.evalCode("datastore.companies[0].name='unsaved'");await f.c.runSync();assert.equal(f.calls.length,1);
});
test('account switch during probe cannot send old edits',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='changed'");f.state.probeHook=async()=>{f.c.currentUser={id:'B',organizationId:'B'};};await f.c.runSync();assert.equal(f.calls.length,1);
});
test('old-organization write acknowledgement cannot overwrite new snapshot',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='changed'");
 f.state.writeHook=async()=>{f.c.currentUser={id:'B',organizationId:'B'};f.evalCode("syncSnap.clear();syncSnap.set('companies|B','new-tenant')");};
 await f.c.runSync();assert.equal(f.evalCode("syncSnap.has('companies|C')"),false);assert.equal(f.evalCode("syncSnap.get('companies|B')"),'new-tenant');
});
test('incomplete upsert acknowledgement cannot mark pending changes saved',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='changed'");f.state.ack={upserts:[],deletes:[]};await f.c.runSync();
 assert.equal(f.evalCode("JSON.parse(syncSnap.get('companies|C')).name"),'before');assert.equal(f.evalCode('computeDiff().up.length'),1);
});
test('incomplete delete acknowledgement cannot erase snapshot',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode('datastore.companies=[]');f.state.ack={upserts:[],deletes:[]};await f.c.runSync();assert.equal(f.evalCode("syncSnap.has('companies|C')"),true);
});
test('missing V2 write RPC never silently downgrades to legacy write',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='changed'");f.state.writeError={code:'PGRST202'};await f.c.runSync();
 assert.equal(f.calls.filter(x=>x.name==='finora_sync_records').length,0);assert.equal(f.evalCode('computeDiff().up.length'),1);
});
test('new server capability requires fresh versions without discarding pending edits',async()=>{
 const f=fixture({missing:true});delete f.state.rows[0].version;await f.c.pullAll();f.state.missing=false;f.evalCode("datastore.companies[0].name='unsaved'");await f.c.runSync();
 assert.equal(f.calls.filter(x=>x.name==='finora_sync_records_v2').length,0);assert.equal(f.evalCode('datastore.companies[0].name'),'unsaved');
});
test('organization wrapper uses same capability and versioned protocol',async()=>{
 const f=fixture({orgWrapper:true});await f.c.pullAll();assert.equal(f.reads[0].columns,'*');assert.equal(f.calls.length,0);f.evalCode("datastore.companies[0].name='changed'");await f.c.runSync();
 assert.equal(f.calls.at(-1).name,'finora_sync_records_v2');assert.equal(f.calls.at(-1).args.p_organization_id,'O');assert.equal(f.calls.at(-1).args.p_upserts[0].expected_version,4);
});

for(const orgWrapper of [false,true]){
 test(`late read cannot publish across identity switch (org wrapper ${orgWrapper})`,async()=>{
  const f=fixture({orgWrapper});const p=f.c.pullAll();f.c.currentUser={id:'B',organizationId:'B'};await assert.rejects(p);assert.equal(f.evalCode('datastore.companies.length'),0);
 });
 test(`CAS conflict preserves edits without reload or retry (org wrapper ${orgWrapper})`,async()=>{
  const f=fixture({orgWrapper});await f.c.pullAll();f.evalCode("datastore.companies[0].name='unsaved'");f.state.writeError={code:'40001',message:'FINORA_VERSION_CONFLICT'};await f.c.runSync();
  assert.equal(f.evalCode('datastore.companies[0].name'),'unsaved');assert.equal(f.evalCode('syncPending'),true);assert.equal(f.reads.length,1);assert.equal(f.evalCode("versionSnap.get('companies|C')"),4);
 });
}
for(const ack of [
 {upserts:[{collection:'companies',id:'C',version:5},{collection:'companies',id:'C',version:5}],deletes:[]},
 {upserts:[{collection:'companies',id:'C',version:4}],deletes:[]},
 {upserts:[{collection:'companies',id:'C',version:'5'}],deletes:[]},
 {upserts:[{collection:'companies',id:'other',version:5}],deletes:[]},
 {upserts:[{collection:'companies',id:'C',version:5}],deletes:[{collection:'companies',id:'C'}]},
 null
])test(`malformed acknowledgement stays pending: ${JSON.stringify(ack)}`,async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='unsaved'");f.state.ack=ack;f.state.explicitAck=true;await f.c.runSync();
 assert.equal(f.evalCode('computeDiff().up.length'),1);assert.equal(f.evalCode('syncPending'),true);
});
test('positive version evidence prevents falling back when probe disappears',async()=>{
 const f=fixture({missing:true});await f.c.pullAll();f.evalCode("datastore.companies[0].name='changed'");await f.c.runSync();assert.equal(f.calls.filter(x=>x.name==='finora_sync_records').length,0);
});
test('new record uses version zero and deletion acknowledges exact identity',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies=[{id:'NEW',ownerUserId:'U',name:'new'}]");await f.c.runSync();
 const args=f.calls.at(-1).args;assert.equal(args.p_upserts[0].expected_version,0);assert.equal(args.p_deletes[0].expected_version,4);
 assert.equal(f.evalCode("versionSnap.get('companies|NEW')"),1);assert.equal(f.evalCode("syncSnap.has('companies|C')"),false);assert.equal(f.evalCode('computeDiff().up.length'),0);
});
test('edits made during write stay pending and use returned version on next batch',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='first'");let n=0;f.state.writeHook=async()=>{if(n++===0)f.evalCode("datastore.companies[0].name='second'")};await f.c.runSync();
 const writes=f.calls.filter(x=>x.name==='finora_sync_records_v2');assert.equal(writes.length,2);assert.equal(writes[1].args.p_upserts[0].expected_version,5);assert.equal(f.evalCode("versionSnap.get('companies|C')"),6);
});
test('malformed guard mode cannot authorize a write',async()=>{
 const f=fixture({mode:null});await f.c.pullAll();f.evalCode("datastore.companies[0].name='unsaved'");await f.c.runSync();assert.equal(f.calls.length,1);assert.equal(f.evalCode('syncPending'),true);
});
for(const version of [null,0,-1,1.5,'4',Number.MAX_SAFE_INTEGER+1])test(`invalid persisted revision cannot downgrade to legacy: ${version}`,async()=>{
 const f=fixture({missing:true});f.state.rows[0].version=version;await assert.rejects(f.c.pullAll());assert.equal(f.evalCode('datastore.companies.length'),0);assert.equal(f.calls.length,0);
});
test('late acknowledgement after same-tenant refresh cannot replace fresh revisions',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='changed'");
 f.state.writeHook=async()=>{f.state.rows[0].version=9;f.state.rows[0].data.name='fresh';await f.c.pullAll();};await f.c.runSync();
 assert.equal(f.evalCode("versionSnap.get('companies|C')"),9);assert.equal(f.evalCode("JSON.parse(syncSnap.get('companies|C')).name"),'fresh');
});
test('nested edits during capability probe cannot mutate the captured write payload',async()=>{
 const f=fixture();f.state.rows[0].data.details={name:'old'};await f.c.pullAll();f.evalCode("datastore.companies[0].details.name='first'");
 let n=0;f.state.probeHook=async()=>{if(n++===0)f.evalCode("datastore.companies[0].details.name='second'")};await f.c.runSync();
 const writes=f.calls.filter(x=>x.name==='finora_sync_records_v2');assert.equal(writes.length,2);assert.equal(writes[0].args.p_upserts[0].data.details.name,'first');assert.equal(writes[1].args.p_upserts[0].data.details.name,'second');
});
for(const stage of ['probe','write'])test(`stalled ${stage} has a bounded failure and no late success`,async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='unsaved'");
 const rpc=f.c.sb.rpc;let release;const pending=new Promise(resolve=>{release=resolve});
 f.c.sb.rpc=(name,args)=>((stage==='probe'&&name==='finora_journal_get_guard_mode')||(stage==='write'&&name==='finora_sync_records_v2'))?pending:rpc(name,args);
 let timerIndex=0;
 f.c.setTimeout=fn=>{timerIndex++;if(stage==='probe'||timerIndex===2)queueMicrotask(fn);return timerIndex};
 await f.c.runSync();assert.equal(f.evalCode('syncPending'),true);assert.equal(f.evalCode('computeDiff().up.length'),1);
 release({error:null,data:stage==='probe'?'audit':{upserts:[{collection:'companies',id:'C',version:5}],deletes:[]}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.evalCode("versionSnap.get('companies|C')"),4);assert.equal(f.evalCode('syncPending'),true);
});
test('duplicate pending identifiers fail before any write',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies.push({id:'C',ownerUserId:'U',name:'duplicate'});datastore.companies[0].name='changed'");await f.c.runSync();assert.equal(f.calls.length,1);assert.equal(f.evalCode('syncPending'),true);
});
for(const change of ['tenant','identity'])test(`queued save resumes after stale ${change} request releases sync lock`,async()=>{
 const f=fixture({orgWrapper:true});await f.c.pullAll();f.evalCode("datastore.companies[0].name='first'");
 const timers=new Map();let id=0;f.c.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id};f.c.clearTimeout=id=>timers.delete(id);
 let release,started;const held=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve);
 // Identity-only case stalls before any write; tenant case stalls an old write.
 if(change==='tenant')f.state.writeHook=async()=>{started();await held;};else f.state.probeHook=async()=>{started();await held;};
 const oldRun=f.c.runSync();await entered;
 if(change==='tenant'){
  f.c.currentUser={id:'B',organizationId:'B'};f.state.rows=[{collection:'companies',id:'B',data:{name:'before-B'},version:9,organization_id:'B'}];await f.c.pullAll();
 }else f.c.currentUser={...f.c.currentUser};
 f.evalCode("datastore.companies[0].name='second';saveDatastore()");
 const queued=[...timers.entries()].find(([,t])=>t.ms===300);assert.ok(queued);timers.delete(queued[0]);await queued[1].fn();
 release();await oldRun;f.state.writeHook=null;f.state.probeHook=null;
 assert.equal(f.evalCode('syncPending'),true);assert.equal(timers.size,1);
 const [retryId,retry]=[...timers.entries()][0];assert.ok(retry.ms<=500);timers.delete(retryId);await retry.fn();
 assert.equal(f.calls.at(-1).args.p_organization_id,change==='tenant'?'B':'O');assert.equal(f.calls.at(-1).args.p_upserts[0].data.name,'second');assert.equal(f.evalCode('computeDiff().up.length'),0);
});
test('same-context CAS rejection does not automatically retry queued edits',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='unsaved'");
 const timers=new Map();let id=0;f.c.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id};f.c.clearTimeout=id=>timers.delete(id);
 f.state.writeHook=async()=>{await f.c.runSync()};f.state.writeError={code:'40001'};await f.c.runSync();
 assert.equal(timers.size,0);assert.equal(f.evalCode('syncPending'),true);assert.equal(f.evalCode('datastore.companies[0].name'),'unsaved');
});
test('same user cannot dispatch old-organization edits while new organization is loading',async()=>{
 const f=fixture({orgWrapper:true});await f.c.pullAll();f.evalCode("datastore.companies[0].name='first'");
 const timers=new Map();let id=0;f.c.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id};f.c.clearTimeout=id=>timers.delete(id);
 let release,started;const held=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve);
 f.state.writeHook=async()=>{started();await held};const oldRun=f.c.runSync();await entered;
 f.evalCode("datastore.companies[0].name='old-org-secret';saveDatastore()");const queued=[...timers.entries()].find(([,t])=>t.ms===300);timers.delete(queued[0]);await queued[1].fn();
 f.c.currentUser={id:'U',organizationId:'B'};
 let finishRead;const read=new Promise(resolve=>finishRead=resolve);
 f.c.sb.from=()=>{const q={select(){return q},eq(){return q},order(){return q},range(){return read}};return q};const newPull=f.c.pullAll();
 release();await oldRun;f.state.writeHook=null;
 for(const [key,timer] of [...timers]){timers.delete(key);await timer.fn()}
 assert.equal(f.calls.filter(x=>x.name==='finora_sync_records_v2').length,1);
 assert.equal(f.calls.filter(x=>x.args.p_organization_id==='B').length,0);
 finishRead({data:[{collection:'companies',id:'C',data:{name:'new-org-data'},version:4}],error:null});await newPull;
 f.evalCode("datastore.companies[0].name='new-org-edit'");await f.c.runSync();assert.equal(f.calls.at(-1).args.p_organization_id,'B');assert.equal(f.calls.at(-1).args.p_upserts[0].data.name,'new-org-edit');
});
test('direct same-user organization change cannot write before its own snapshot',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='old-org'");f.c.currentUser={id:'U',organizationId:'B'};await f.c.runSync();assert.equal(f.calls.length,0);
});
test('identity refresh without queued save marks unconfirmed edits instead of endless saving',async()=>{
 const f=fixture();await f.c.pullAll();const badges=[];f.c.setSyncBadge=state=>badges.push(state);
 f.evalCode("datastore.companies[0].name='unsaved';syncPending=true");
 f.state.writeHook=async()=>{f.c.currentUser={...f.c.currentUser}};await f.c.runSync();
 assert.equal(badges.at(-1),'conflict');assert.equal(f.evalCode('syncPending'),true);assert.equal(f.evalCode("versionSnap.get('companies|C')"),4);assert.equal(f.calls.filter(x=>x.name==='finora_sync_records_v2').length,1);
});
test('stale identity status preserves a newer save timer that has not fired',async()=>{
 const f=fixture();await f.c.pullAll();f.evalCode("datastore.companies[0].name='first'");
 const timers=new Map();let id=0;f.c.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id};f.c.clearTimeout=id=>timers.delete(id);
 f.state.writeHook=async()=>{f.c.currentUser={...f.c.currentUser};f.evalCode("datastore.companies[0].name='second';saveDatastore()")};await f.c.runSync();
 assert.equal(timers.size,1);assert.equal([...timers.values()][0].ms,300);assert.equal(f.evalCode('syncPending'),true);assert.equal(f.evalCode('datastore.companies[0].name'),'second');assert.equal(f.calls.filter(x=>x.name==='finora_sync_records_v2').length,1);
});

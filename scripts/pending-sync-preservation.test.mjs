import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const syncSource=readFileSync(new URL('../js/sync.js',import.meta.url),'utf8');
const orgSource=readFileSync(new URL('../js/organization-rbac.js',import.meta.url),'utf8');
const orgReader=orgSource.slice(orgSource.indexOf('const legacyPullAll=pullAll;'),orgSource.indexOf('// Keep the version-aware'));
const switcher=orgSource.slice(orgSource.indexOf('window.switchFinoraOrganization=async function'),orgSource.indexOf('window.finoraOrganizationSwitcherHtml'));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setImmediate(r));
function row(name='server-before',version=7){return {collection:'contacts',id:'C1',owner_id:'U1',organization_id:'ORG_A',version,data:{name}};}
async function harness(organization=true){
 const requests=[],timers=new Map(),badge={style:{}},alerts=[];let seq=0,read=async()=>({data:[row()],error:null});
 const c={currentUser:{id:'U1',organizationId:organization?'ORG_A':null,organizations:[{organization:{id:'ORG_A'}},{organization:{id:'ORG_B'}}]},
  COLLS:['contacts','settings'],ID_RE:/^[\w-]+$/,console:{warn(){},error(){},log(){}},
  setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),
  window:{addEventListener(){}},document:{addEventListener(){},getElementById:()=>badge},
  finoraAbortableRead:async q=>q,finoraOrganizationRead:async q=>q,alert:x=>alerts.push(x),
  canWrite:()=>true,requireWrite:()=>true,refreshAllSurfaces(){},
  localStorage:{setItem(_k,v){c.selectedOrg=v;}},fetchCurrentUser:async(_u,options)=>({...c.currentUser,organizationId:options?.organizationId||c.selectedOrg}),
  sb:{auth:{getUser:async()=>({data:{user:{id:'U1'}}})},from:()=>({select(){return this},eq(){return this},order(){return this},range(){return this},then(a,b){return read().then(a,b)}}),
   rpc:async(name,args)=>{requests.push({name,args});return {data:{upserts:args.p_upserts.map(r=>({collection:r.collection,id:r.id,version:r.expected_version+1})),deletes:args.p_deletes.map(({collection,id})=>({collection,id}))},error:null};}}
 };
 vm.createContext(c);vm.runInContext(syncSource,c);if(organization)vm.runInContext(orgReader+'\n'+switcher,c);
 await c.pullAll();
 const evaluate=s=>vm.runInContext(s,c);
 return {c,requests,timers,badge,alerts,evaluate,setRead:fn=>{read=fn;},state:()=>JSON.parse(evaluate("JSON.stringify({row:datastore.contacts[0],snap:[...syncSnap],versions:[...syncVersionSnap],pending:syncPending})"))};
}
for(const org of [false,true]){
 const name=org?'organization':'base';
 test(name+' reader preserves edits made during its request',async()=>{
  const h=await harness(org),d=deferred();h.setRead(()=>d.promise);const pending=h.c.pullAll();
  h.evaluate("datastore.contacts[0].name='unsaved-during-read'; syncPending=true");d.resolve({data:[row()],error:null});
  await assert.rejects(pending,/FINORA_(SYNC|READ)_/);assert.equal(h.state().row.name,'unsaved-during-read');assert.equal(h.state().pending,true);
 });
 test(name+' reader refuses to discard already-pending unrelated records',async()=>{
  const h=await harness(org);h.evaluate("datastore.settings.push({id:'main',ownerUserId:'U1',theme:'new'});syncPending=true");
  await assert.rejects(h.c.pullAll(),/FINORA_(SYNC|READ)_/);assert.equal(h.evaluate('datastore.settings[0].theme'),'new');
 });
 test(name+' reader rejects a stale identity response',async()=>{
  const h=await harness(org),d=deferred();h.setRead(()=>d.promise);const pending=h.c.pullAll();h.c.currentUser={id:'U2',organizationId:'OTHER'};
  d.resolve({data:[row()],error:null});await assert.rejects(pending,/FINORA_(SYNC|ORGANIZATION)_/);assert.equal(h.state().row.ownerUserId,'U1');
 });
}
test('later same-tenant read wins without an older response replacing it',async()=>{
 const h=await harness(),d=deferred();h.setRead(()=>d.promise);const old=h.c.pullAll();h.setRead(async()=>({data:[row('newest',9)],error:null}));await h.c.pullAll();
 d.resolve({data:[row('older',8)],error:null});await assert.rejects(old,/FINORA_(SYNC|READ)_/);assert.equal(h.state().row.name,'newest');assert.equal(h.state().versions[0][1],9);
});
test('same-user old-tenant ACK cannot overwrite newly hydrated tenant',async()=>{
 const h=await harness(),d=deferred();h.evaluate("datastore.contacts[0].name='A-edit';syncPending=true");
 h.c.sb.rpc=async(name,args)=>{h.requests.push({name,args});return d.promise;};const write=h.c.runSync();await tick();
 h.c.currentUser={...h.c.currentUser,organizationId:'ORG_B'};h.setRead(async()=>({data:[row('B-value',3)],error:null}));await h.c.pullAll();
 d.resolve({data:{upserts:[{collection:'contacts',id:'C1',version:8}],deletes:[]},error:null});await write;
 assert.equal(h.state().row.name,'B-value');assert.equal(h.state().row._serverVersion,3);assert.equal(h.state().versions[0][1],3);assert.match(h.state().snap[0][1],/B-value/);
});
test('forced organization A-to-B-to-A context transition invalidates an old completion',async()=>{
 const h=await harness(),d=deferred();h.evaluate("datastore.contacts[0].name='A-edit';syncPending=true");h.c.sb.rpc=async()=>d.promise;const write=h.c.runSync();await tick();
 // Voluntary switch now refuses pending work. Simulate forced identity replacement
 // independently to retain the epoch/late-ACK regression from PR250.
 h.evaluate("finoraInvalidateSyncContext();currentUser={...currentUser,organizationId:'ORG_B'}");h.setRead(async()=>({data:[row('B',3)],error:null}));await h.c.pullAll();
 h.evaluate("finoraInvalidateSyncContext();currentUser={...currentUser,organizationId:'ORG_A'}");h.setRead(async()=>({data:[row('A-new',10)],error:null}));await h.c.pullAll();
 d.resolve({data:{upserts:[{collection:'contacts',id:'C1',version:8}],deletes:[]},error:null});await write;
 assert.equal(h.state().row.name,'A-new');assert.equal(h.state().row._serverVersion,10);
});
test('voluntary clean organization switch stages and publishes identity and snapshot together',async()=>{
 const h=await harness(),d=deferred(),selector={value:'ORG_B'};
 h.setRead(()=>d.promise);const change=h.c.window.switchFinoraOrganization('ORG_B',selector);await tick();
 assert.equal(h.c.currentUser.organizationId,'ORG_A');assert.equal(h.state().row.name,'server-before');assert.equal(h.c.selectedOrg,undefined);assert.equal(selector.disabled,true);
 d.resolve({data:[row('B-new',3)],error:null});assert.equal(await change,true);
 assert.equal(h.c.currentUser.organizationId,'ORG_B');assert.equal(h.state().row.name,'B-new');assert.equal(h.state().versions[0][1],3);assert.equal(h.c.selectedOrg,'ORG_B');assert.equal(selector.value,'ORG_B');assert.equal(selector.disabled,false);
});
for(const mode of ['dirty','pending','paused','running'])test('voluntary switch blocks '+mode+' state without auth or read',async()=>{
 const h=await harness(),selector={value:'ORG_B'};let authCalls=0,reads=0;
 h.c.sb.auth.getUser=async()=>{authCalls++;return {data:{user:{id:'U1'}}}};
 h.setRead(async()=>{reads++;return {data:[row('B',3)],error:null}});
 if(mode==='dirty')h.evaluate("datastore.contacts[0].name='A-dirty'");
 if(mode==='pending')h.evaluate("syncPending=true");
 if(mode==='paused')await h.c.handleSyncError({code:'40001'});
 if(mode==='running')h.evaluate("syncRunning=true");
 const before=h.state();
 assert.equal(await h.c.window.switchFinoraOrganization('ORG_B',selector),false);
 assert.deepEqual(h.state(),before);assert.equal(h.c.currentUser.organizationId,'ORG_A');assert.equal(h.c.selectedOrg,undefined);assert.equal(selector.value,'ORG_A');assert.equal(authCalls,0);assert.equal(reads,0);
});
for(const stage of ['identity','snapshot'])test('voluntary switch preserves edits made during '+stage+' await',async()=>{
 const h=await harness(),d=deferred();
 if(stage==='identity')h.c.fetchCurrentUser=()=>d.promise;else h.setRead(()=>d.promise);
 const change=h.c.window.switchFinoraOrganization('ORG_B');await tick();
 h.evaluate("datastore.contacts[0].name='A-new-edit';syncPending=true");
 if(stage==='identity')d.resolve({...h.c.currentUser,organizationId:'ORG_B'});else d.resolve({data:[row('B',3)],error:null});
 assert.equal(await change,false);assert.equal(h.c.currentUser.organizationId,'ORG_A');assert.equal(h.state().row.name,'A-new-edit');assert.equal(h.state().pending,true);assert.equal(h.state().versions[0][1],7);assert.equal(h.c.selectedOrg,undefined);
});
test('failed target read and wrong target identity never publish or invalidate the current context',async()=>{
 const h=await harness(),before=h.state(),epoch=h.evaluate('finoraSyncEpoch');
 h.setRead(async()=>({data:null,error:{message:'read failed'}}));
 assert.equal(await h.c.window.switchFinoraOrganization('ORG_B'),false);assert.deepEqual(h.state(),before);assert.equal(h.evaluate('finoraSyncEpoch'),epoch);assert.equal(h.c.selectedOrg,undefined);
 h.c.fetchCurrentUser=async()=>({...h.c.currentUser,organizationId:'ORG_A'});
 assert.equal(await h.c.window.switchFinoraOrganization('ORG_B'),false);assert.deepEqual(h.state(),before);assert.equal(h.c.currentUser.organizationId,'ORG_A');
});
test('concurrent voluntary switch does not publish a second target',async()=>{
 const h=await harness(),d=deferred();h.setRead(()=>d.promise);
 const first=h.c.window.switchFinoraOrganization('ORG_B');await tick();
 assert.equal(await h.c.window.switchFinoraOrganization('ORG_A'),false);
 d.resolve({data:[row('B',3)],error:null});assert.equal(await first,true);assert.equal(h.c.currentUser.organizationId,'ORG_B');
});
test('40001 preserves dirty data and pauses automatic retries',async()=>{
 const h=await harness();h.evaluate("datastore.contacts[0].name='pending-conflict';syncPending=true");
 h.c.sb.rpc=async(name,args)=>{h.requests.push({name,args});return {data:null,error:{code:'40001',message:'FINORA_VERSION_CONFLICT'}};};
 await h.c.runSync();await h.c.runSync();assert.equal(h.state().row.name,'pending-conflict');assert.equal(h.state().pending,true);assert.equal(h.requests.length,1);assert.match(h.badge.textContent,/محفوظ/);
});
for(const variant of ['wrong-version','extra-key','missing-delete','duplicate-key'])test('invalid '+variant+' ACK cannot partially publish',async()=>{
 const h=await harness();h.evaluate("datastore.contacts[0].name='dirty';syncPending=true");
 if(variant==='missing-delete')h.evaluate("syncSnap.set('settings|main','{}');syncVersionSnap.set('settings|main',2)");
 const before=h.state();h.c.sb.rpc=async()=>({error:null,data:{upserts:variant==='extra-key'?[{collection:'contacts',id:'C1',version:8},{collection:'contacts',id:'OTHER',version:8}]:variant==='duplicate-key'?[{collection:'contacts',id:'C1',version:8},{collection:'contacts',id:'C1',version:8}]:[{collection:'contacts',id:'C1',version:variant==='wrong-version'?10:8}],deletes:[]}});
 await h.c.runSync();assert.deepEqual(h.state().snap,before.snap);assert.deepEqual(h.state().versions,before.versions);assert.equal(h.state().row._serverVersion,7);assert.equal(h.state().row.name,'dirty');
});
test('edits queued during successful write save against the acknowledged version',async()=>{
 const h=await harness(),d=deferred();h.evaluate("datastore.contacts[0].name='first';syncPending=true");
 const original=h.c.sb.rpc;h.c.sb.rpc=async(name,args)=>{if(!h.requests.length){h.requests.push({name,args});return d.promise;}return original(name,args);};
 const first=h.c.runSync();await tick();h.evaluate("datastore.contacts[0].name='second'");await h.c.runSync();
 d.resolve({data:{upserts:[{collection:'contacts',id:'C1',version:8}],deletes:[]},error:null});await first;
 assert.equal(h.requests.length,2);assert.equal(h.requests[1].args.p_upserts[0].expected_version,8);assert.equal(h.requests[1].args.p_upserts[0].data.name,'second');assert.equal(h.state().row.name,'second');assert.equal(h.state().versions[0][1],9);assert.equal(h.state().pending,false);
});

test('new organization cannot write previous tenant memory before hydration',async()=>{
 const h=await harness();h.evaluate("datastore.contacts[0].name='A-unsaved';syncPending=true");h.c.currentUser={...h.c.currentUser,organizationId:'ORG_B'};
 await h.c.runSync();assert.equal(h.requests.length,0);assert.equal(h.state().row.name,'A-unsaved');
});
test('queued new-tenant save resumes after discarding the previous ACK',async()=>{
 const h=await harness(),d=deferred();h.evaluate("datastore.contacts[0].name='A-write';syncPending=true");
 const original=h.c.sb.rpc;h.c.sb.rpc=async(name,args)=>{if(!h.requests.length){h.requests.push({name,args});return d.promise;}return original(name,args);};
 const old=h.c.runSync();await tick();h.c.currentUser={...h.c.currentUser,organizationId:'ORG_B'};
 h.setRead(async()=>({data:[row('B-before',3)],error:null}));await h.c.pullAll();h.evaluate("datastore.contacts[0].name='B-edit';syncPending=true");await h.c.runSync();
 d.resolve({data:{upserts:[{collection:'contacts',id:'C1',version:8}],deletes:[]},error:null});await old;
 const scheduled=[...h.timers.values()].find(x=>x.ms===0);assert.ok(scheduled,'queued write was starved');await scheduled.fn();
 assert.equal(h.requests.length,2);assert.equal(h.requests[1].args.p_organization_id,'ORG_B');assert.equal(h.requests[1].args.p_upserts[0].expected_version,3);assert.equal(h.state().row._serverVersion,4);assert.equal(h.state().row.name,'B-edit');
});
test('all pending collections survive permission rejection without a full reload',async()=>{
 const h=await harness();h.evaluate("datastore.contacts[0].name='contact-edit';datastore.settings.push({id:'main',ownerUserId:'U1',theme:'theme-edit'});syncPending=true");
 h.c.sb.rpc=async()=>({data:null,error:{code:'42501',message:'permission denied'}});await h.c.runSync();
 assert.equal(h.state().row.name,'contact-edit');assert.equal(h.evaluate('datastore.settings[0].theme'),'theme-edit');assert.equal(h.state().pending,true);
});

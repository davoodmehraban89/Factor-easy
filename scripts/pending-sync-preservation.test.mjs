import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const syncSource=readFileSync(new URL('../js/sync.js',import.meta.url),'utf8');
const orgSource=readFileSync(new URL('../js/organization-rbac.js',import.meta.url),'utf8');
const orgReader=orgSource.slice(orgSource.indexOf('const legacyPullAll=pullAll;'),orgSource.indexOf('// Keep the version-aware'));
const switcher=orgSource.slice(orgSource.indexOf('window.switchFinoraOrganization=async function'),orgSource.indexOf('window.finoraOrganizationSwitcherHtml'));
const membership=orgSource.slice(orgSource.indexOf('window.revalidateFinoraMembership=async function'),orgSource.indexOf('window.requireFreshFinoraMembership='));
const purge=orgSource.slice(orgSource.indexOf('function clearFinoraTenantMemory('),orgSource.indexOf('function showFinoraMembershipLock('));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setImmediate(r));
function row(name='server-before',version=7){return {collection:'contacts',id:'C1',owner_id:'U1',organization_id:'ORG_A',version,data:{name}};}
async function harness(organization=true){
 const requests=[],timers=new Map(),badge={style:{}},review={hidden:true,disabled:false},alerts=[];let seq=0,read=async()=>({data:[row()],error:null});
 const c={currentUser:{id:'U1',organizationId:organization?'ORG_A':null,organizations:[{organization:{id:'ORG_A'}},{organization:{id:'ORG_B'}}]},
  COLLS:['contacts','settings'],ID_RE:/^[\w-]+$/,AbortController,console:{warn(){},error(){},log(){}},
  setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),
  window:{addEventListener(){}},document:{addEventListener(){},getElementById:id=>id==='sync-conflict-review'?review:badge},
  finoraAbortableRead:async q=>q,finoraOrganizationRead:async q=>q,alert:x=>alerts.push(x),
  canWrite:()=>true,requireWrite:()=>true,refreshAllSurfaces(){},
  localStorage:{setItem(_k,v){c.selectedOrg=v;}},fetchCurrentUser:async(_u,options)=>({...c.currentUser,organizationId:options?.organizationId||c.selectedOrg}),
  sb:{auth:{getUser:async()=>({data:{user:{id:'U1'}}})},from:()=>({select(){return this},eq(){return this},in(){return this},order(){return this},range(){return this},then(a,b){return read().then(a,b)}}),
   rpc:async(name,args)=>{requests.push({name,args});return {data:{upserts:args.p_upserts.map(r=>({collection:r.collection,id:r.id,version:r.expected_version+1})),deletes:args.p_deletes.map(({collection,id})=>({collection,id}))},error:null};}}
 };
 vm.createContext(c);vm.runInContext(syncSource,c);if(organization)vm.runInContext(orgReader+'\n'+switcher,c);
 await c.pullAll();
 const evaluate=s=>vm.runInContext(s,c);
 return {c,requests,timers,badge,review,alerts,evaluate,setRead:fn=>{read=fn;},state:()=>JSON.parse(evaluate("JSON.stringify({row:datastore.contacts[0],snap:[...syncSnap],versions:[...syncVersionSnap],pending:syncPending})"))};
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

async function installMembershipHarness(h){
 h.c.document.querySelectorAll=()=>[];h.c.localStorage.removeItem=()=>{};h.c.STORAGE_KEY='test-only';
 h.c.lockCalls=[];h.c.signOutCalls=0;h.c.sb.auth.signOut=async()=>{h.c.signOutCalls++;};
 h.evaluate("let finoraMembershipRevalidationBusy=false;function showFinoraMembershipLock(hasAlternative){lockCalls.push(hasAlternative);}");
 vm.runInContext(purge+'\n'+membership,h.c);
}
test('stale membership reply cannot revoke a newly hydrated tenant',async()=>{
 const h=await harness(),d=deferred();await installMembershipHarness(h);
 h.setRead(()=>d.promise);const old=h.c.window.revalidateFinoraMembership({sensitive:true});await tick();
 h.evaluate("finoraInvalidateSyncContext();currentUser={...currentUser,organizationId:'ORG_B'}");h.setRead(async()=>({data:[row('B-safe',3)],error:null}));await h.c.pullAll();
 d.resolve({data:[],error:null});assert.equal(await old,false);assert.equal(h.c.currentUser.organizationId,'ORG_B');assert.equal(h.state().row.name,'B-safe');assert.equal(h.state().versions[0][1],3);assert.equal(h.c.signOutCalls,0);assert.equal(h.c.lockCalls.length,0);
});
test('current membership revocation still purges pending memory and signs out',async()=>{
 const h=await harness();await installMembershipHarness(h);h.evaluate("datastore.contacts[0].name='A-private';syncPending=true");
 h.setRead(async()=>({data:[],error:null}));assert.equal(await h.c.window.revalidateFinoraMembership({sensitive:true}),false);
 assert.equal(h.c.currentUser,null);assert.equal(h.evaluate('datastore.contacts.length'),0);assert.equal(h.evaluate('syncSnap.size'),0);assert.equal(h.evaluate('syncVersionSnap.size'),0);assert.equal(h.evaluate('syncPending'),false);assert.equal(h.c.signOutCalls,1);assert.deepEqual(h.c.lockCalls,[false]);
});

const networkFailure=()=>({error:{code:'',message:'TypeError: Failed to fetch'}});
test('unknown precommit upsert failure reads original revision and retries exact request once',async()=>{
 const h=await harness();h.evaluate("datastore.contacts[0].name='new';syncPending=true");const real=h.c.sb.rpc;let first=true;
 h.c.sb.rpc=async(name,args)=>{if(first){first=false;h.requests.push({name,args});return networkFailure();}return real(name,args);};
 await h.c.runSync();assert.equal(h.requests.length,2);assert.deepEqual(h.requests[0],h.requests[1]);assert.equal(h.state().pending,false);assert.equal(h.state().versions[0][1],8);
});
test('lost ACK with exact committed postimage reconciles without sending the write again',async()=>{
 const h=await harness();h.evaluate("datastore.contacts[0].name='new';syncPending=true");
 h.c.sb.rpc=async(name,args)=>{h.requests.push({name,args});h.setRead(async()=>({data:[row('new',8)],error:null}));return networkFailure();};
 await h.c.runSync();assert.equal(h.requests.length,1);assert.equal(h.state().pending,false);assert.equal(h.state().versions[0][1],8);assert.equal(h.state().row.name,'new');assert.match(h.badge.textContent,/تطابق داده/);
});
for(const mode of ['divergent','partial','read-error','wrong-tenant','delete','second-network'])test('unknown ACK recovery fails closed for '+mode,async()=>{
 const h=await harness();h.evaluate("datastore.contacts[0].name='new';syncPending=true");
 if(mode==='partial')h.evaluate("datastore.settings.push({id:'main',ownerUserId:'U1',theme:'new'})");
 if(mode==='delete')h.evaluate("datastore.contacts=[]");
 const before=h.state();
 h.c.sb.rpc=async(name,args)=>{h.requests.push({name,args});if(mode==='divergent')h.setRead(async()=>({data:[row('other',8)],error:null}));if(mode==='partial')h.setRead(async()=>({data:[row('new',8)],error:null}));if(mode==='read-error')h.setRead(async()=>({data:null,error:{message:'failed'}}));if(mode==='wrong-tenant')h.setRead(async()=>({data:[{...row('new',8),organization_id:'ORG_B'}],error:null}));return networkFailure();};
 await h.c.runSync();assert.equal(h.requests.length,mode==='second-network'?2:1);assert.deepEqual(h.state(),before);assert.equal(h.evaluate('finoraSyncIsPaused()'),true);
});
test('new edits during recovery are not included in the replayed request',async()=>{
 const h=await harness(),d=deferred();h.evaluate("datastore.contacts[0].name='sent';syncPending=true");const real=h.c.sb.rpc;let first=true;
 h.c.sb.rpc=async(name,args)=>{if(first){first=false;h.requests.push({name,args});h.setRead(()=>d.promise);return networkFailure();}return real(name,args);};
 const work=h.c.runSync();await tick();h.evaluate("datastore.contacts[0].name='newer'");d.resolve({data:[row()],error:null});await work;
 assert.equal(h.requests.length,3);assert.deepEqual(h.requests[0],h.requests[1]);assert.equal(h.requests[2].args.p_upserts[0].expected_version,8);assert.equal(h.requests[2].args.p_upserts[0].data.name,'newer');assert.equal(h.state().versions[0][1],9);
});
test('tenant change during read-back cannot publish or replay the old request',async()=>{
 const h=await harness(),d=deferred();h.evaluate("datastore.contacts[0].name='old';syncPending=true");h.c.sb.rpc=async(name,args)=>{h.requests.push({name,args});h.setRead(()=>d.promise);return networkFailure();};
 const work=h.c.runSync();await tick();h.evaluate("finoraInvalidateSyncContext();currentUser={...currentUser,organizationId:'ORG_B'}");h.setRead(async()=>({data:[row('B',3)],error:null}));await h.c.pullAll();d.resolve({data:[row('old',8)],error:null});await work;
 assert.equal(h.requests.length,1);assert.equal(h.state().row.name,'B');assert.equal(h.state().versions[0][1],3);assert.equal(h.state().pending,false);
});

async function conflictFixture(){const h=await harness();h.c.window.revalidateFinoraMembership=async()=>true;h.c.confirm=()=>true;h.evaluate("datastore.contacts[0].name='unsaved';syncPending=true");await h.c.handleSyncError({code:'40001'});return h;}
test('paused even with undone edits cannot be cleared by ordinary pull',async()=>{const h=await conflictFixture();h.evaluate("datastore.contacts[0].name='server-before'");const before=h.state();await assert.rejects(h.c.pullAll(),/FINORA_READ_PAUSED_CONFLICT/);assert.deepEqual(h.state(),before);assert.equal(h.review.hidden,false);});
test('conflict review explicitly accepts a staged server snapshot with zero writes',async()=>{const h=await conflictFixture();let checks=0;h.c.window.revalidateFinoraMembership=async()=>{checks++;return true};h.setRead(async()=>({data:[row('server-new',9)],error:null}));assert.equal(await h.c.window.finoraReviewSyncConflict(),true);assert.equal(checks,2);assert.equal(h.requests.length,0);assert.equal(h.state().row.name,'server-new');assert.equal(h.state().versions[0][1],9);assert.equal(h.state().pending,false);assert.equal(h.review.hidden,true);assert.equal(h.evaluate('finoraSyncIsPaused()'),false);assert.match(h.badge.textContent,/نسخه سرور بارگذاری شد/);});
for(const mode of ['cancel','read-error','wrong-tenant','denied','wrong-user','duplicate'])test('conflict review preserves full graph on '+mode,async()=>{const h=await conflictFixture();h.setRead(async()=>({data:[row('server-new',9)],error:null}));if(mode==='cancel')h.c.confirm=()=>false;if(mode==='read-error')h.setRead(async()=>({data:null,error:{message:'failed'}}));if(mode==='wrong-tenant')h.setRead(async()=>({data:[{...row(),organization_id:'ORG_B'}],error:null}));if(mode==='denied')h.c.window.revalidateFinoraMembership=async()=>false;if(mode==='wrong-user')h.c.sb.auth.getUser=async()=>({data:{user:{id:'U2'}}});if(mode==='duplicate')h.setRead(async()=>({data:[row(),row()],error:null}));const before=h.state();assert.equal(await h.c.window.finoraReviewSyncConflict(),false);assert.deepEqual(h.state(),before);assert.equal(h.requests.length,0);assert.equal(h.review.hidden,false);assert.equal(h.review.disabled,false);});
test('edits made during staged conflict read survive and suppress confirmation',async()=>{const h=await conflictFixture(),d=deferred();let confirms=0;h.c.confirm=()=>{confirms++;return true};h.setRead(()=>d.promise);const work=h.c.window.finoraReviewSyncConflict();await tick();h.evaluate("datastore.contacts[0].name='newer'");d.resolve({data:[row('server-new',9)],error:null});assert.equal(await work,false);assert.equal(confirms,0);assert.equal(h.state().row.name,'newer');assert.equal(h.requests.length,0);});
test('concurrent review blocked; stale tenant response cannot publish',async()=>{const h=await conflictFixture(),d=deferred();h.setRead(()=>d.promise);const work=h.c.window.finoraReviewSyncConflict();await tick();assert.equal(await h.c.window.finoraReviewSyncConflict(),false);h.evaluate("finoraInvalidateSyncContext();currentUser={...currentUser,organizationId:'ORG_B'}");h.setRead(async()=>({data:[{...row('B',3),organization_id:'ORG_B'}],error:null}));await h.c.pullAll();d.resolve({data:[row('old',8)],error:null});assert.equal(await work,false);assert.equal(h.state().row.name,'B');assert.equal(h.state().versions[0][1],3);assert.equal(h.requests.length,0);});
test('new saves during pause keep conflict visible without scheduling another write',async()=>{const h=await conflictFixture();assert.equal(h.c.saveDatastore(),true);assert.equal(h.review.hidden,false);assert.match(h.badge.textContent,/تغییرات محفوظ است/);assert.equal(h.requests.length,0);assert.equal([...h.timers.values()].filter(x=>x.ms===300).length,0);});

test('recovery render settings defaults do not mutate sparse server state; scope unwinds',async()=>{
 const h=await harness();
 const before=h.evaluate('JSON.stringify(datastore)');
 assert.equal(h.evaluate("finoraWithReadOnlyRefresh(()=>getMySettings().currency_mode)"),'rial');
 assert.equal(h.evaluate('JSON.stringify(datastore)'),before);
 assert.throws(()=>h.evaluate("finoraWithReadOnlyRefresh(()=>{finoraWithReadOnlyRefresh(()=>getMySettings());throw Error('render failed')})"),/render failed/);
 assert.equal(h.evaluate('finoraIsReadOnlyRefresh()'),false);
 h.evaluate("getMySettings().currency_mode='toman'");
 assert.equal(h.evaluate('datastore.settings[0].currency_mode'),'toman');
});
test('recovery render cannot change existing sparse settings or their nested preferences',async()=>{
 const h=await harness();
 h.evaluate("datastore.settings.push({ownerUserId:'U1',nested:{theme:'light'}})");
 const before=h.evaluate('JSON.stringify(datastore)');
 assert.equal(h.evaluate("finoraWithReadOnlyRefresh(()=>{const s=getMySettings();s.nested.theme='dark';return s.currency_mode})"),'rial');
 assert.equal(h.evaluate('JSON.stringify(datastore)'),before);
});

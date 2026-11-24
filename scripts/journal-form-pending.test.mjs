import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/journal-ui.js',import.meta.url),'utf8');
function harness(){
 const ids=['view-journal','je-manual-form','je-date','je-voucher-type','je-reference','je-desc','je-edit-voucher-id','je-number','je-lines','je-save-draft-button','je-cancel-edit-button'];
 const elements=Object.fromEntries(ids.map(id=>[id,{id,value:'',style:{},innerHTML:'',disabled:false,scrollIntoView(){}}]));
 elements['je-date'].value='1405/08/30';elements['je-voucher-type'].value='manual';elements['je-desc'].value='submitted';
 const listeners={},calls=[],alerts=[],renders=[],requests=[];let company='CO_A',epoch=0;
 const context={currentUser:{id:'USER_A',organizationId:'ORG_A'},document:{getElementById:id=>elements[id]||null,addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn)}},afCompanyId:()=>company,getJalaliNumeric:()=> '1405/08/30',ID_RE:/^[A-Za-z0-9_-]+$/,alert:message=>alerts.push(message),console};
 context.finoraSyncContext=()=>({user:context.currentUser,uid:context.currentUser?.id,org:context.currentUser?.organizationId,epoch});
 context.finoraSyncContextMatches=c=>c.user===context.currentUser&&c.uid===context.currentUser?.id&&c.org===context.currentUser?.organizationId&&c.epoch===epoch;
 function rpc(kind,id,input){calls.push({kind,id,input:structuredClone(input)});return new Promise((resolve,reject)=>requests.push({resolve,reject}));}
 context.jeRpcCreateDraft=input=>rpc('create',null,input);context.jeRpcUpdateDraft=(id,input)=>rpc('update',id,input);
 vm.createContext(context);vm.runInContext(source,context);
 context.jeCollectRows=()=>structuredClone(context.rows);context.rows=[{accountId:'A',debit:10,credit:0},{accountId:'B',debit:0,credit:10}];
 context.jeAddRow=()=>{};context.jeUpdateTotals=()=>{};context.renderJournal=()=>renders.push(true);
 context.jeVoucherDraftInput=id=>({voucher:{id,status:'draft',sourceType:'manual',companyId:company,date:'1405/08/30',voucherType:'manual',description:'other draft'},lines:context.rows});
 const ack=(id='JV_1')=>({id,status:'draft',sourceType:'manual',companyId:company,version:1});
 return {context,elements,calls,alerts,renders,requests,ack,setCompany:v=>company=v,bumpEpoch:()=>epoch++,edit:(id,value)=>{elements[id].value=value;for(const fn of listeners.input||[])fn({target:{closest:()=>elements['je-manual-form']}})}};
}

test('newer input survives create acknowledgement; next save updates the created draft',async()=>{
 const h=harness(),first=h.context.jeSaveManual();h.edit('je-desc','newer unsaved');h.requests[0].resolve(h.ack());await first;
 assert.equal(h.elements['je-desc'].value,'newer unsaved');assert.equal(h.elements['je-edit-voucher-id'].value,'JV_1');
 assert.match(h.alerts.at(-1),/ذخیره نشده/);
 const second=h.context.jeSaveManual();assert.equal(h.calls.length,2);assert.equal(h.calls[1].kind,'update');assert.equal(h.calls[1].id,'JV_1');assert.equal(h.calls[1].input.description,'newer unsaved');
 h.requests[1].resolve(h.ack());await second;assert.equal(h.elements['je-desc'].value,'');
});
test('newer journal lines survive update without changing the draft identity',async()=>{
 const h=harness();h.elements['je-edit-voucher-id'].value='JV_EXISTING';const pending=h.context.jeSaveManual();h.context.rows[0].debit=15;h.context.rows[1].credit=15;
 h.requests[0].resolve(h.ack('JV_EXISTING'));await pending;assert.equal(h.context.rows[0].debit,15);assert.equal(h.elements['je-edit-voucher-id'].value,'JV_EXISTING');assert.equal(h.elements['je-desc'].value,'submitted');assert.match(h.alerts.at(-1),/ذخیره نشده/);
});
test('unchanged acknowledged form clears normally',async()=>{
 const h=harness(),pending=h.context.jeSaveManual();h.requests[0].resolve(h.ack());await pending;assert.equal(h.elements['je-desc'].value,'');assert.equal(h.elements['je-edit-voucher-id'].value,'');assert.equal(h.alerts.length,1);assert.equal(h.renders.length,1);
});
test('duplicate save while pending sends one request',async()=>{
 const h=harness(),first=h.context.jeSaveManual(),second=h.context.jeSaveManual();assert.equal(h.calls.length,1);h.requests[0].resolve(h.ack());await Promise.all([first,second]);
});
for(const change of ['clear','load','company','user','organization','same-user-refresh','tenant-roundtrip','replacement-dom'])test('stale '+change+' completion leaves current form untouched and silent',async()=>{
 const h=harness(),pending=h.context.jeSaveManual();
 if(change==='clear')h.context.jeClearManualForm();
 if(change==='load')h.context.jeLoadDraftUi('JV_OTHER');
 if(change==='company')h.setCompany('CO_B');
 if(change==='user')h.context.currentUser={id:'USER_B',organizationId:'ORG_A'};
 if(change==='organization')h.context.currentUser.organizationId='ORG_B';
 if(change==='same-user-refresh')h.context.currentUser={...h.context.currentUser};
 if(change==='tenant-roundtrip')h.bumpEpoch();
 if(change==='replacement-dom')h.elements['je-desc']={...h.elements['je-desc']};
 h.elements['je-desc'].value='current form';const id=h.elements['je-edit-voucher-id'].value;
 h.requests[0].resolve({id:'JV_1',status:'draft',sourceType:'manual',companyId:'CO_A',version:1});await pending;
 assert.equal(h.elements['je-desc'].value,'current form');assert.equal(h.elements['je-edit-voucher-id'].value,id);assert.equal(h.alerts.length,0);assert.equal(h.renders.length,0);
});
test('failed save preserves input and reports failure only in its original context',async()=>{
 const h=harness(),pending=h.context.jeSaveManual();h.edit('je-desc','newer unsaved');h.requests[0].reject(new Error('rejected'));await pending;assert.equal(h.elements['je-desc'].value,'newer unsaved');assert.deepEqual(h.alerts,['rejected']);
});
test('late failed save is silent after changing organization',async()=>{
 const h=harness(),pending=h.context.jeSaveManual();h.context.currentUser.organizationId='ORG_B';h.requests[0].reject(new Error('old tenant failure'));await pending;assert.equal(h.alerts.length,0);
});
test('malformed create acknowledgement retains form and blocks a duplicate create',async()=>{
 const h=harness(),pending=h.context.jeSaveManual();h.requests[0].resolve({status:'draft'});await pending;assert.equal(h.elements['je-desc'].value,'submitted');assert.equal(h.elements['je-edit-voucher-id'].value,'');await h.context.jeSaveManual();assert.equal(h.calls.length,1);
});
test('returning to original company after detached create requires reconciliation before another create',async()=>{
 const h=harness(),pending=h.context.jeSaveManual();h.setCompany('CO_B');h.requests[0].resolve({id:'JV_1',status:'draft',sourceType:'manual',companyId:'CO_A',version:1});await pending;
 h.setCompany('CO_A');const again=h.context.jeSaveManual();assert.equal(h.calls.length,1);await again;assert.equal(h.elements['je-desc'].value,'submitted');
});

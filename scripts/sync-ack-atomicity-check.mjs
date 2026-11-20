import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../js/sync.js',import.meta.url),'utf8');
const start=src.indexOf('      // Validate the entire server acknowledgement');
const end=src.indexOf('      syncFailCount=0;',start);
assert(start>0&&end>start,'ack validation block missing');
const block=src.slice(start,end);
function run({up,deletes,savedUpserts,savedDeletes}){
 const syncSnap=new Map(),syncVersionSnap=new Map();
 const datastore={invoices:[{id:'I1',ownerUserId:'U'}]};
 const context={up,deletes,savedUpserts,savedDeletes,syncSnap,syncVersionSnap,datastore,currentUser:{id:'U'},keyOfRecord:(_c,x)=>x.id,Map,Number,Error};
 let error;
 try{vm.runInNewContext(block,context);}catch(e){error=e;}
 return {error,snap:syncSnap,versions:syncVersionSnap,datastore};
}
const up=[{key:'invoices|I1',coll:'invoices',id:'I1',s:'new'}];
let r=run({up,deletes:[],savedUpserts:[],savedDeletes:[]});
assert.match(r.error?.message||'',/ACK_VERSION_MISSING/);assert.equal(r.snap.size,0);
r=run({up,deletes:[{collection:'invoices',id:'I0'}],savedUpserts:[{collection:'invoices',id:'I1',version:2}],savedDeletes:[]});
assert.match(r.error?.message||'',/DELETE_ACK_MISSING/);assert.equal(r.snap.size,0);assert.equal(r.datastore.invoices[0]._serverVersion,undefined);
r=run({up,deletes:[],savedUpserts:[{collection:'invoices',id:'I1',version:2},{collection:'invoices',id:'I1',version:3}],savedDeletes:[]});
assert.match(r.error?.message||'',/ACK_VERSION_MISSING/);assert.equal(r.snap.size,0);
r=run({up,deletes:[],savedUpserts:[{collection:'invoices',id:'I1',version:2}],savedDeletes:[]});
assert.equal(r.error,undefined);assert.equal(r.snap.get('invoices|I1'),'new');assert.equal(r.versions.get('invoices|I1'),2);
console.log('sync acknowledgement atomicity checks passed');

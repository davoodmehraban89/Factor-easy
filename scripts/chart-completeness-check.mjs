import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('js/accounting-foundation.js','utf8');
function fixture(type='trading'){
 const ctx={console,window:{},currentUser:{id:'owner'},settings:{default_company_id:'C1'},companies:[{id:'C1',ownerUserId:'owner'}],datastore:{accounts:[],dimensionTypes:[],accountDimensionRules:[],journalEntries:[{id:'J1',status:'posted',debit:100,credit:100}]},requireWrite:()=>true,alert:()=>{},saveDatastore:()=>{},getMySettings(){return this.settings},getMyCompanies(){return this.companies}};
 vm.createContext(ctx);vm.runInContext(source,ctx);vm.runInContext('getMySettings=()=>settings;getMyCompanies=()=>companies;',ctx);
 assert.equal(vm.runInContext(`afApplyTemplate('C1','${type}')`,ctx),true);return ctx;
}
// Missing noncurrent assets would force fixed assets into the current bucket.
for(const type of ['trading','service','manufacturing','contracting','retail','distribution','nonprofit','professional']){
 const c=fixture(type),rows=c.datastore.accounts,byCode=new Map(rows.map(x=>[x.code,x]));
 assert.ok(byCode.has('12'),`${type}: noncurrent asset branch missing`);
 assert.equal(byCode.get('12').parentId,byCode.get('1').id);
 for(const code of ['1201','1202','1207','1208','1291','1292','1114','2113','2202','3103','4191','6301','6401'])assert.ok(byCode.has(code),`${type}: coverage missing ${code}`);
 assert.equal(byCode.get('1291').accountType,'asset');assert.equal(byCode.get('1291').normalBalance,'credit');
 assert.equal(byCode.get('4191').accountType,'revenue');assert.equal(byCode.get('4191').normalBalance,'debit');
 assert.equal(byCode.size,rows.length,`${type}: duplicate template code`);
 for(const a of rows){assert.equal(a.postingAllowed,a.level==='detail');if(a.parentId){const p=rows.find(x=>x.id===a.parentId);assert.ok(p);assert.equal(p.level,a.level==='detail'?'subsidiary':'gl');}}
 assert.equal(rows.filter(a=>a.systemRole==='cash_default').length,1);
 assert.equal(rows.filter(a=>a.systemRole==='revenue_default').length,1);
 if(type==='contracting')assert.equal(byCode.get('1105').title,'مطالبات حسن انجام کار');
 if(type==='manufacturing')assert.equal(byCode.get('1113').accountType,'asset');
}
function legacy(){const c=fixture();vm.runInContext('datastore.accounts=datastore.accounts.filter(a=>!AF_CHART_ADDITIONS.some(r=>r[0]===a.code));companies[0].accountingTemplate.chartVersion=3;',c);return c;}
function plan(c){return vm.runInContext('afChartUpgradePlan()',c)}
function apply(c,p){c.preview=p;return vm.runInContext('afApplyChartUpgrade(preview)',c)}
const c=legacy();c.datastore.accounts.push({id:'OTHER',ownerUserId:'other',companyId:'C1',code:'1201',title:'Other tenant'});c.datastore.accounts.push({id:'COMPANY2',ownerUserId:'owner',companyId:'C2',code:'12',title:'Other company'});
const old=JSON.stringify(c.datastore),p=plan(c);assert.ok(p.ok);assert.ok(p.additions.length>30);assert.equal(JSON.stringify(c.datastore),old,'preview mutated chart');
const historical=c.datastore.accounts.map(x=>JSON.stringify(x)),entries=JSON.stringify(c.datastore.journalEntries);assert.equal(apply(c,p).ok,true);
assert.deepEqual(c.datastore.accounts.slice(0,historical.length).map(x=>JSON.stringify(x)),historical,'upgrade rewrote historical account');assert.equal(JSON.stringify(c.datastore.journalEntries),entries);
const stable=JSON.stringify(c.datastore);assert.equal(plan(c).additions.length,0);assert.equal(apply(c,plan(c)).ok,true);assert.equal(JSON.stringify(c.datastore),stable,'repeat upgrade mutated rows');
for(const damage of ['conflict','inactive','bad-parent','posting-parent','missing-root','duplicate','unscoped','custom','stale','denied','switch-company']){
 const x=legacy();let preview;
 if(damage==='conflict')x.datastore.accounts.push({id:'COLLISION',ownerUserId:'owner',companyId:'C1',code:'1201',title:'Custom account',level:'detail'});
 if(damage==='inactive')x.datastore.accounts.find(a=>a.code==='1').active=false;
 if(damage==='bad-parent')x.datastore.accounts.find(a=>a.code==='11').parentId='OTHER';
 if(damage==='posting-parent')x.datastore.accounts.find(a=>a.code==='11').postingAllowed=true;
 if(damage==='missing-root')x.datastore.accounts=x.datastore.accounts.filter(a=>a.code!=='1');
 if(damage==='duplicate')x.datastore.accounts.push({...x.datastore.accounts.find(a=>a.code==='1'),id:'DUP'});
 if(damage==='unscoped')x.datastore.accounts.push({id:'LEGACY_UNSCOPED',ownerUserId:'owner',code:'1201'});
 if(damage==='custom')delete x.companies[0].accountingTemplate;
 if(['stale','denied','switch-company'].includes(damage)){preview=plan(x);if(damage==='stale')x.datastore.accounts.find(a=>a.code==='11').title='Changed';if(damage==='denied')x.requireWrite=()=>false;if(damage==='switch-company')x.settings.default_company_id='C2';}
 const before=JSON.stringify(x.datastore);assert.equal(apply(x,preview||plan(x)).ok,false,`${damage}: should reject`);assert.equal(JSON.stringify(x.datastore),before,`${damage}: partial mutation`);
}
const ui=legacy(),previewBox={innerHTML:''};ui.document={addEventListener:()=>{},getElementById:id=>id==='af-chart-upgrade-preview'?previewBox:null};ui.esc=v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;');
vm.runInContext(fs.readFileSync('js/accounting-foundation-ui.js','utf8'),ui);
const uiBefore=JSON.stringify(ui.datastore.accounts);vm.runInContext("if(typeof afPreviewChartUpgrade==='function')afPreviewChartUpgrade()",ui);
assert.ok(previewBox.innerHTML.includes('دارایی‌های غیرجاری'),'upgrade UI must show proposed noncurrent assets before applying');assert.equal(JSON.stringify(ui.datastore.accounts),uiBefore);
vm.runInContext('afApplyChartUpgradeFromUi()',ui);assert.ok(previewBox.innerHTML.includes('سوابق قبلی حفظ شدند'));assert.ok(ui.datastore.accounts.some(a=>a.code==='1201'));
// Real financial reporting must subtract credit-normal assets and debit-normal revenue.
const reporting=fixture(),account=code=>reporting.datastore.accounts.find(a=>a.code===code),voucher={id:'POSTED',date:'1405/01/01',status:'posted'},ledger=[['1202',1000,0],['1291',0,200],['3101',0,800],['1101',500,0],['4107',0,500],['4191',50,0],['1101',0,50]].map(([code,debit,credit],i)=>({id:'L'+i,accountId:account(code).id,account:account(code),debit,credit,voucher}));
reporting.jeLedgerRows=()=>ledger;vm.runInContext(fs.readFileSync('js/phase6-reporting.js','utf8'),reporting);const financial=reporting.window.P6Reports.financials();assert.equal(financial.assets,1250);assert.equal(financial.revenue,450);assert.equal(financial.profit,450);assert.equal(financial.assets,financial.equity+financial.profit);
console.log('Chart completeness: all 8 templates, contra types, safe explicit upgrades, preview UI and rejection boundaries passed.');

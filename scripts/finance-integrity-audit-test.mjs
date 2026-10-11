import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const fixture='scripts/.finance-audit-fixture.json';
const check=data=>{fs.writeFileSync(fixture,JSON.stringify(data));return spawnSync(process.execPath,['scripts/finance-integrity-audit.mjs',fixture],{encoding:'utf8'})};
try{
const base={journalVouchers:[{id:'V1',ownerUserId:'U1'}],journalLines:[{id:'L1',voucherId:'V1',debit:100,credit:0,ownerUserId:'U1'},{id:'L2',voucherId:'V1',debit:0,credit:100,ownerUserId:'U1'}],invoices:[{id:'I1',ownerUserId:'U1',companyId:'C1',number:'1',subtotal:100,items:[{qty:1,price:100,lineTotal:100}]}]};
let r=check(base);if(r.status!==0)throw Error('Valid accounting rejected: '+r.stdout+' '+r.stderr);
const bad=JSON.parse(JSON.stringify(base));bad.journalLines[1].credit=90;bad.invoices.push({...bad.invoices[0],id:'I2'});r=check(bad);if(r.status!==1||!r.stdout.includes('UNBALANCED_VOUCHER')||!r.stdout.includes('DUPLICATE_INVOICE_NUMBER'))throw Error('Invalid accounting not detected: '+r.stdout);
console.log('PASS: valid records accepted; imbalance and duplicate invoice rejected');
}finally{fs.rmSync(fixture,{force:true})}

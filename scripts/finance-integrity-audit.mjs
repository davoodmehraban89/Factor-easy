// Finora independent, read-only accounting integrity auditor.
// Usage: node scripts/finance-integrity-audit.mjs path/to/export.json
import fs from 'node:fs';
const path=process.argv[2];
if(!path){console.error('Usage: node scripts/finance-integrity-audit.mjs export.json');process.exit(2)}
const data=JSON.parse(fs.readFileSync(path,'utf8'));
const issues=[];
const vouchers=data.journalVouchers||[];
const lines=data.journalLines||[];
const invoices=data.invoices||[];
const money=v=>Number(v||0);
const cents=v=>Math.round(money(v)*100);
const issue=(code,id,detail)=>issues.push({code,id,detail});
const byVoucher=new Map();
for(const line of lines){const id=line.voucherId;const arr=byVoucher.get(id)||[];arr.push(line);byVoucher.set(id,arr);if(!vouchers.some(v=>v.id===id))issue('ORPHAN_JOURNAL_LINE',line.id||id,'Missing voucher')}
for(const v of vouchers){const rows=byVoucher.get(v.id)||[];if(!rows.length)issue('EMPTY_VOUCHER',v.id,'No journal lines');let dr=0,cr=0;for(const row of rows){const debit=cents(row.debit),credit=cents(row.credit);dr+=debit;cr+=credit;if(debit<0||credit<0||debit>0&&credit>0)issue('INVALID_JOURNAL_LINE',row.id||v.id,'Negative or simultaneous debit/credit');if(row.ownerUserId&&v.ownerUserId&&row.ownerUserId!==v.ownerUserId)issue('OWNER_MISMATCH',row.id||v.id,'Journal line owner differs from voucher')}if(dr!==cr)issue('UNBALANCED_VOUCHER',v.id,`Debit ${dr/100}; credit ${cr/100}`)}
const seen=new Set();for(const inv of invoices){const key=[inv.ownerUserId,inv.companyId,String(inv.number||'').trim()].join('|');if(seen.has(key))issue('DUPLICATE_INVOICE_NUMBER',inv.id,key);seen.add(key);const sum=(inv.items||[]).reduce((a,x)=>a+cents(x.lineTotal??money(x.qty)*money(x.price)),0);if((inv.items||[]).length&&Math.abs(sum-cents(inv.subtotal))>1)issue('INVOICE_SUBTOTAL_MISMATCH',inv.id,`Items ${sum/100}; subtotal ${inv.subtotal}`)}
const report={checked:{vouchers:vouchers.length,lines:lines.length,invoices:invoices.length},issues,passed:issues.length===0};console.log(JSON.stringify(report,null,2));if(issues.length)process.exitCode=1;

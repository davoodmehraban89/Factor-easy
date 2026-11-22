// Integration proof for the exact SELECT shipped to the operator. Synthetic
// PostgreSQL only: no production URL, credential, host port or persistent volume.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {planDraftConversion} from './lib/draft-conversion-plan.mjs';

test('source-derived inventory on isolated PostgreSQL preserves scope, exact amounts and read-only behavior', async()=>{
  const name='finora-draft-inventory-'+process.pid;
  function docker(args,input){
    const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
    if(r.status!==0)throw Error(r.stderr||r.error?.message||'docker failed');return r.stdout;
  }
  const sql=q=>docker(['exec','-i',name,'psql','-h','127.0.0.1','-X','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres'],q).trim();
  const query=readFileSync(new URL('./sql/draft-conversion-inventory.sql',import.meta.url),'utf8');
  const inventory=()=>JSON.parse(sql(query));
  const owner='00000000-0000-4000-8000-000000000001',org='00000000-0000-4000-8000-000000000002',org2='00000000-0000-4000-8000-000000000003';
  const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
  const insert=(collection,id,data,organization=org,recordOwner=owner)=>sql(`insert into public.records values (${quote(recordOwner)},${quote(collection)},${quote(id)},${quote(JSON.stringify(data))}::jsonb,now(),${quote(organization)});`);
  try{
    docker(['run','--detach','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
    // The image's temporary initialization server accepts Unix sockets before
    // restarting. TCP becomes available only on the final server; query the same endpoint.
    let ready=false;
    for(let i=0;i<60;i++){
      const r=spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],{encoding:'utf8',timeout:3000});
      if(r.status===0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.ok(ready,'isolated PostgreSQL ready');
    sql('create table public.records(owner_id uuid not null,collection text not null,id text not null,data jsonb not null,updated_at timestamptz,organization_id uuid not null,primary key(organization_id,collection,id));');
    insert('fiscalYears','FY',{companyId:'C',status:'open',startDate:'1405/01/01',endDate:'1405/12/29'});
    insert('invoices','I',{companyId:'C',journalVoucherId:'J',kind:'formal'});
    insert('journalVouchers','J',{companyId:'C',fiscalYearId:'FY',status:'posted',sourceType:'sale',sourceId:'I',date:'۱۴۰۵/۰۸/۲۲',totalDebit:'9007199254740993',totalCredit:'9007199254740993'});
    insert('journalLines','L1',{companyId:'C',voucherId:'J',accountId:'AP',debit:'9007199254740993',credit:0,counterpartyId:'PERSON'});
    insert('journalLines','L2',{companyId:'C',voucherId:'J',accountId:'BANK',debit:0,credit:'9007199254740993'});
    insert('journalLineDimensions','D',{companyId:'C',voucherId:'J',journalLineId:'L1',dimensionTypeId:'T',dimensionValueId:'PERSON'});
    const before=sql('select md5(string_agg(row(r.*)::text,\'\' order by collection,id)) from public.records r;');
    let inv=inventory();assert.equal(inv.journals.length,1);assert.equal(planDraftConversion(inv.journals).integrityReady,true);
    assert.equal(inv.journals[0].lines.find(l=>l.debit!=='0').debit,'9007199254740993');
    assert.equal(sql('select md5(string_agg(row(r.*)::text,\'\' order by collection,id)) from public.records r;'),before);
    assert.equal(inv.sourceIdentityAudit.sourcesConsidered,1);
    assert.equal(inv.sourceIdentityAudit.withoutGeneratedVoucher,0);
    assert.equal(inv.sourceIdentityAudit.orphanGeneratedVouchers,0);
    assert.equal(inv.sourceIdentityAudit.duplicateDraftSourceIdentities,0);
    assert.equal(inv.sourceIdentityAudit.postedProjectionMismatches,1,
      'synthetic posted voucher with no source projection must be visible');
    const fingerprint=inv.financialFingerprint;
    sql("update public.records set data=jsonb_set(data,'{companyId}','\"OTHER\"') where collection='invoices';");
    inv=inventory();assert.notEqual(inv.financialFingerprint,fingerprint);
    assert.ok(planDraftConversion(inv.journals).blockers.some(b=>b.code==='SOURCE_SCOPE_MISMATCH'));
    sql("update public.records set data=jsonb_set(data,'{companyId}','\"C\"') where collection='invoices';");
    sql("update public.records set data=data-'companyId' where collection='journalLines' and id='L1';");
    assert.ok(planDraftConversion(inventory().journals).blockers.some(b=>b.code==='CHILD_SCOPE_MISMATCH'),'a null child scope is not ignored by bool_and');
    sql("update public.records set data=jsonb_set(data,'{companyId}','\"C\"') where collection='journalLines' and id='L1';");
    sql("update public.records set data=jsonb_set(data,'{companyId}','\"OTHER\"') where collection='journalLineDimensions';");
    assert.ok(planDraftConversion(inventory().journals).blockers.some(b=>b.code==='CHILD_SCOPE_MISMATCH'));
    sql("update public.records set data=jsonb_set(data,'{status}','\"locked\"') where collection='fiscalYears';");
    assert.ok(planDraftConversion(inventory().journals).blockers.some(b=>b.code==='FISCAL_SCOPE_NOT_OPEN'));
    sql("delete from public.records where collection='invoices';");
    assert.equal(inventory().journals[0].source,null);
    // ADR216: one owner may belong to two organizations with the same record IDs.
    // A source in org2 must never attach to a voucher in org1 during inventory.
    insert('invoices','I',{companyId:'OTHER',kind:'formal'},org2);
    assert.equal(inventory().journals.find(x=>x.sourceType==='sale'&&x.status==='posted').source,null);
    insert('purchases','P_ONLY',{companyId:'C',documentStatus:'draft'});
    insert('invoices','I_OPERATIONAL',{companyId:'C',kind:'pre_invoice'});
    insert('invoices','I_DRAFT',{companyId:'C',kind:'formal',journalVoucherId:'J_DRAFT_A',documentStatus:'draft',accountingStatus:'draft'});
    insert('journalVouchers','J_DRAFT_A',{companyId:'C',sourceType:'sale',sourceId:'I_DRAFT',status:'draft'});
    insert('journalVouchers','J_DRAFT_B',{companyId:'C',sourceType:'sale',sourceId:'I_DRAFT',status:'draft'});
    insert('invoices','I_DANGLING',{companyId:'C',kind:'formal',journalVoucherId:'J_MISSING'});
    insert('invoices','I_WRONG',{companyId:'C',kind:'formal',journalVoucherId:'J_DRAFT_A'});
    insert('journalVouchers','J_ORPHAN',{companyId:'C',sourceType:'purchase',sourceId:'NONEXISTENT',status:'draft'});
    insert('invoices','I_POSTED',{companyId:'C',kind:'formal',journalVoucherId:'J_POSTED',documentStatus:'draft',accountingStatus:'draft'});
    insert('journalVouchers','J_POSTED',{companyId:'C',sourceType:'sale',sourceId:'I_POSTED',status:'posted'});
    insert('purchases','P_DRAFT_BAD',{companyId:'C',journalVoucherId:'P_JV',documentStatus:'posted',accountingStatus:'draft'});
    insert('journalVouchers','P_JV',{companyId:'C',sourceType:'purchase',sourceId:'P_DRAFT_BAD',status:'draft'});
    insert('invoices','I_UNLINKED',{companyId:'C',kind:'formal',documentStatus:'draft',accountingStatus:'draft'});
    insert('journalVouchers','J_UNLINKED',{companyId:'C',sourceType:'sale',sourceId:'I_UNLINKED',status:'draft'});
    const signal=inventory().sourceIdentityAudit;
    assert.deepEqual(signal,{
      sourcesConsidered:8, withoutGeneratedVoucher:4,
      unlinkedWithGeneratedVoucher:1, danglingSourceLinks:1,
      wrongIdentitySourceLinks:1, linkedDraftSources:2,
      linkedDraftProjectionMismatches:1, postedProjectionMismatches:1,
      duplicateDraftSourceIdentities:1, orphanGeneratedVouchers:2,
      crossScopeGeneratedVouchers:0
    },'aggregate-only source identity diagnostics for legacy / draft-first rollout');
    // A generated voucher pointing to a real but different-company source is
    // a separate risk from a missing source, not a reason to join across orgs.
    insert('journalVouchers','J_BAD_SCOPE',{companyId:'WRONG',sourceType:'purchase',sourceId:'P_ONLY',status:'draft'});
    assert.equal(inventory().sourceIdentityAudit.crossScopeGeneratedVouchers,1);
  }finally{spawnSync('docker',['rm','--force',name],{encoding:'utf8',timeout:30000});}
});

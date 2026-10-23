#!/usr/bin/env node
// Synthetic original Chromium UI source -> unlinked localhost GoTrue JWT -> PostgREST server-owned accounting.
// No Production network, user records, live credentials or schema modifications.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const API='http://127.0.0.1:54321',HOST='127.0.0.1',PORT='54322';
for(const k of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_SERVICE_ROLE_KEY'])
 if(process.env[k])throw Error('FINORA_TEST_TARGET_PRODUCTION_FORBIDDEN '+k);
if(process.env.PGHOST&&!['localhost',HOST].includes(process.env.PGHOST))
 throw Error('FINORA_TEST_TARGET_PRODUCTION_FORBIDDEN PGHOST');
const fx=JSON.parse(fs.readFileSync(process.argv[2]||'stage3-ui-fixtures.json','utf8'));
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
function sh(exe,args){
 const p=spawnSync(exe,args,{encoding:'utf8',timeout:30000,maxBuffer:2000000,
  env:{...process.env,PGHOST:HOST,PGPORT:PORT,PGPASSWORD:'postgres'}});
 if(p.error||p.status!==0)throw Error('LOCAL_PROCESS_FAILED '+exe+' '+String(p.stderr||p.error).slice(0,600));
 return String(p.stdout||'').trim();
}
const db=q=>sh('psql',['-h',HOST,'-p',PORT,'-U','postgres','-d','postgres','-X','-qAt',
 '-v','ON_ERROR_STOP=1','-c',q]).split('\n').at(-1);
const env=Object.fromEntries(sh('supabase',['status','-o','env']).split('\n')
 .filter(s=>/^[A-Z_]+=/i.test(s)).map(s=>{
  const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1).replace(/^['"]|['"]$/g,'')];
 }));
const anon=env.ANON_KEY,admin=env.SERVICE_ROLE_KEY;
if(!anon||!admin)throw Error('LOCAL_CLI_KEYS_MISSING');
async function http(endpoint,body,token=admin,adminMode=false){
 const url=new URL(endpoint,API);
 if(url.hostname!==HOST||url.port!=='54321')throw Error('REMOTE_HTTP_TARGET_FORBIDDEN');
 const secret=adminMode?admin:anon;
 const r=await fetch(url,{method:'POST',headers:{apikey:secret,
  authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>null);
 return {ok:r.ok,status:r.status,data};
}
const email='stage3.synthetic.owner@example.invalid',password='Local-Stage3-Only-Password!123';
const user=await http('/auth/v1/admin/users',{email,password,email_confirm:true},admin,true);
if(!user.ok||!user.data?.id)throw Error('LOCAL_GOTRUE_OWNER_CREATE_FAILED '+user.status);
const uid=user.data.id;
const org=db('SELECT organization_id::text FROM public.organization_members WHERE user_id='+quote(uid)+'::uuid AND is_owner=true LIMIT 1');
if(!/^[0-9a-f-]{36}$/.test(org))throw Error('LOCAL_OWNER_ORG_MISSING');
db("UPDATE public.licenses SET status='active',ends_at='2099-01-01' WHERE organization_id="+quote(org)+"::uuid");
const login=await http('/auth/v1/token?grant_type=password',{email,password},anon);
if(!login.ok||!login.data?.access_token)throw Error('LOCAL_GOTRUE_PASSWORD_JWT_FAILED '+login.status);
const jwt=login.data.access_token;let networkCalls=0;
const rpc=async(name,args)=>{networkCalls++;return http('/rest/v1/rpc/'+name,args,jwt)};
const mode=await rpc('finora_journal_set_guard_mode',{
 p_organization_id:org,p_expected_mode:'off',p_mode:'enforce',
 p_reason:'Local synthetic Stage3 guarded source posting'
});
if(!mode.ok||mode.data?.mode!=='enforce')throw Error('JWT_GUARD_MODE_ENFORCE_FAILED '+mode.status);
const company='ST3_CO',fiscal='ST3_FY';
function record(coll,id,data){
 db('INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES('+
  quote(org)+'::uuid,'+quote(uid)+'::uuid,'+quote(coll)+','+quote(id)+','+
  quote(JSON.stringify(data))+'::jsonb)');
}
record('companies',company,{name:'Synthetic Stage3 company'});
record('fiscalYears',fiscal,{companyId:company,startDate:'1405/01/01',endDate:'1405/12/29',status:'open'});
const specs=[
 ['CASH','1101','cash_default','asset','debit'],
 ['AR','1102','receivable_control','asset','debit'],
 ['REV','4101','revenue_default','revenue','credit'],
 ['VATP','2102','vat_payable','liability','credit'],
 ['PUR','5101','purchase_default','expense','debit'],
 ['AP','2101','payable_control','liability','credit'],
 ['VATR','1108','vat_recoverable','asset','debit']
],roles={};
for(const [id,code,role,accountType,normalBalance] of specs){
 roles[role]=id;
 record('accounts',id,{companyId:company,code,title:'Local '+role,
  systemRole:role,accountType,normalBalance,postingAllowed:true,active:true,level:'detail',parentId:'PARENT'});
}
const approved=await rpc('finora_phase1a_publish_role_assignments',{
 p_organization_id:org,p_company_id:company,p_assignments:roles,
 p_expected_version:0,p_reason:'Synthetic organization owner approves version one role mappings'
});
if(!approved.ok||Number(approved.data?.version)!==1)
 throw Error('JWT_OWNER_ROLE_PUBLISH_FAILED '+approved.status+' '+JSON.stringify(approved.data).slice(0,350));
let posted=0,replayed=0,rejected=0;
for(const kind of ['sale','purchase']){
 const source={...fx[kind],companyId:company};
 if(source.currencyCode!=='IRR'||source.accountingVersion!==1)throw Error('UI_FIXTURE_INVALID_'+kind);
 const sourceId='ST3_SOURCE_'+kind.toUpperCase(),voucherId='ST3_VOUCHER_'+kind.toUpperCase();
 const coll=kind==='sale'?'invoices':'purchases';
 record(coll,sourceId,source);
 const header={companyId:company,fiscalYearId:fiscal,date:'1405/07/24',
  sourceType:kind,sourceId,sourceVersion:'1'};
 const args={p_organization_id:org,p_voucher_id:voucherId,
  p_source_collection:coll,p_source_id:sourceId,p_header:header,p_lines:null};
 const result=await rpc('finora_journal_autopost',args);
 if(!result.ok||result.data?.voucher?.status!=='posted'||Number(result.data.contractVersion)!==1||
  !Array.isArray(result.data.computedLines)||result.data.computedLines.length<2)
  throw Error('REAL_JWT_AUTOPOST_FAILED '+kind+' '+result.status+' '+JSON.stringify(result.data).slice(0,500));
 const lines=result.data.computedLines;
 const debit=lines.reduce((s,l)=>s+Number(l.debit||0),0);
 const credit=lines.reduce((s,l)=>s+Number(l.credit||0),0);
 if(debit!==credit||debit!==source.grandTotal)throw Error('JWT_VOUCHER_UNBALANCED '+kind);
 const info=JSON.parse(db('SELECT jsonb_build_object('+
  "'status',data->>'status','number',data->>'number','source',data->>'sourceId','version',version)::text "+
  'FROM public.records WHERE organization_id='+quote(org)+"::uuid AND collection='journalVouchers' AND id="+quote(voucherId)));
 if(info.status!=='posted'||info.source!==sourceId||!info.number||Number(info.version)<2)
  throw Error('JWT_POSTING_NOT_DURABLE '+kind);
 posted++;
 // An attacker must not be able to amend the original financial source after
 // the server posted its journal. The API may return 2xx for an RLS-filtered
 // zero-row PATCH; the authoritative persisted row is the acceptance check.
 const attacked=await fetch(API+'/rest/v1/records?organization_id=eq.'+org+
  '&collection=eq.'+coll+'&id=eq.'+sourceId,{
  method:'PATCH',
  headers:{apikey:anon,authorization:'Bearer '+jwt,
   'content-type':'application/json',Prefer:'return=representation'},
  body:JSON.stringify({data:{...source,grandTotal:source.grandTotal+17}})
 });
 const attackBody=await attacked.json().catch(()=>null);
 const persistedGrand=Number(db("SELECT data->>'grandTotal' FROM public.records WHERE organization_id="+
  quote(org)+"::uuid AND collection="+quote(coll)+" AND id="+quote(sourceId)));
 if(persistedGrand!==source.grandTotal||attackBody?.length>0&&attacked.ok)
  throw Error('JWT_POSTED_SOURCE_MUTATION_BYPASS '+kind+' HTTP_'+attacked.status);
 rejected++;
 // The same authenticated owner must also be unable to bypass the freeze via
 // FINORA's normal optimistic-CAS sync endpoint (UPDATE or DELETE).
 const actualVersion=Number(db("SELECT version FROM public.records WHERE organization_id="+
  quote(org)+"::uuid AND collection="+quote(coll)+" AND id="+quote(sourceId)));
 if(!Number.isSafeInteger(actualVersion)||actualVersion<1)
  throw Error('JWT_SOURCE_VERSION_MISSING '+kind);
 const overwrite=await rpc('finora_sync_records_v2',{
  p_organization_id:org,
  p_upserts:[{collection:coll,id:sourceId,expected_version:actualVersion,
   data:{...source,grandTotal:source.grandTotal+31}}],
  p_deletes:[]
 });
 if(overwrite.ok||!String(overwrite.data?.message||'').includes('FINORA_POSTED_SOURCE_IMMUTABLE'))
  throw Error('JWT_CAS_POSTED_SOURCE_MUTATION_BYPASS '+kind+' '+overwrite.status+' '+
   JSON.stringify(overwrite.data).slice(0,300));
 if(Number(db("SELECT data->>'grandTotal' FROM public.records WHERE organization_id="+
  quote(org)+"::uuid AND collection="+quote(coll)+" AND id="+quote(sourceId)))!==source.grandTotal)
  throw Error('JWT_CAS_CHANGED_POSTED_SOURCE '+kind);
 rejected++;
 const deletion=await rpc('finora_sync_records_v2',{
  p_organization_id:org,p_upserts:[],
  p_deletes:[{collection:coll,id:sourceId,expected_version:actualVersion}]
 });
 if(deletion.ok||!String(deletion.data?.message||'').includes('FINORA_POSTED_SOURCE_IMMUTABLE'))
  throw Error('JWT_CAS_POSTED_SOURCE_DELETE_BYPASS '+kind+' '+deletion.status+' '+
   JSON.stringify(deletion.data).slice(0,300));
 if(db("SELECT count(*) FROM public.records WHERE organization_id="+
  quote(org)+"::uuid AND collection="+quote(coll)+" AND id="+quote(sourceId))!=='1')
  throw Error('JWT_POSTED_SOURCE_WAS_DELETED '+kind);
 rejected++;
 const retry=await rpc('finora_journal_autopost',args);
 if(!retry.ok||retry.data?.replayed!==true||retry.data?.voucher?.number!==info.number)
  throw Error('JWT_AUTOPOST_NOT_IDEMPOTENT '+kind+' '+retry.status);
 const count=db("SELECT count(*) FROM public.records WHERE organization_id="+quote(org)+"::uuid AND collection='journalVouchers' AND id="+quote(voucherId));
 if(count!=='1')throw Error('DUPLICATE_JOURNAL_ON_RETRY '+kind);
 replayed++;
 const fake=await rpc('finora_journal_autopost',{...args,p_source_id:'FORGED_SOURCE_ID'});
 if(fake.ok)throw Error('JWT_SOURCE_ID_FORGERY_ACCEPTED '+kind);
 rejected++;
}
const cross=await rpc('finora_journal_autopost',{
 p_organization_id:'00000000-0000-0000-0000-000000000123',
 p_voucher_id:'FORGED_CROSS_ORG',p_source_collection:'invoices',
 p_source_id:'ST3_SOURCE_SALE',p_header:{companyId:company,fiscalYearId:fiscal,
 date:'1405/07/24',sourceType:'sale',sourceId:'ST3_SOURCE_SALE',sourceVersion:'1'},p_lines:null
});
if(cross.ok)throw Error('JWT_CROSS_ORGANIZATION_AUTOPOST_ACCEPTED');
rejected++;
const vouchers=db("SELECT count(*) FROM public.records WHERE organization_id="+quote(org)+"::uuid AND collection='journalVouchers' AND data->>'status'='posted'");
const audits=db("SELECT count(*) FROM private.finora_phase1a_journal_audit WHERE organization_id="+quote(org)+"::uuid AND action='posted'");
if(vouchers!=='2'||audits!=='2')throw Error('LOCAL_POSTING_COUNT_OR_AUDIT_INCORRECT '+vouchers+' '+audits);
console.log('FINORA_STAGE3_REAL_JWT_AUTOPOST_PASS '+JSON.stringify({
 sources:'actual synthetic Chromium invoice/purchase form',posted,replayed,rejected,
 balanced:true,unique:true,postedAudits:Number(audits),realGoTrue:true,realJWT:true,
 realPostgREST:true,networkCalls,remoteConnections:0,productionMutation:false
}));

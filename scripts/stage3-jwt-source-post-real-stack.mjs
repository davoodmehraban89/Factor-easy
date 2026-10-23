#!/usr/bin/env node
// Finora Stage3: local GoTrue password JWT -> genuine PostgREST source autopost.
// NEVER TARGETS A REMOTE URL; consumes only synthetic actual-form CI fixtures.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const HOST='127.0.0.1',API='http://127.0.0.1:54321',PGPORT='54322';
for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_SERVICE_ROLE_KEY']){
 if(process.env[key])throw Error('PRODUCTION_CREDENTIAL_FORBIDDEN '+key);
}
if(process.env.PGHOST&&!['localhost',HOST].includes(process.env.PGHOST))
 throw Error('REMOTE_DATABASE_HOST_FORBIDDEN');
const fixture=JSON.parse(fs.readFileSync(process.argv[2]||'stage3-ui-fixtures.json','utf8'));
function sh(cmd,args){
 const r=spawnSync(cmd,args,{encoding:'utf8',timeout:30000,
  env:{...process.env,PGHOST:HOST,PGPORT,PGPASSWORD:'postgres'},maxBuffer:2097152});
 if(r.error||r.status!==0)throw Error('LOCAL_COMMAND_FAILED '+cmd+' '+String(r.stderr||r.error).slice(0,300));
 return r.stdout.trim();
}
const vars=Object.fromEntries(sh('supabase',['status','-o','env']).split('\n').filter(x=>/^[A-Z_]+=/i.test(x)).map(line=>{
 const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')];
}));
const anon=vars.ANON_KEY,service=vars.SERVICE_ROLE_KEY;
if(!anon||!service)throw Error('LOCAL_ANON_AND_SERVICE_KEYS_REQUIRED');
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const query=sql=>sh('psql',['-X','-qAt','-h',HOST,'-p',PGPORT,'-U','postgres','-d','postgres',
 '-v','ON_ERROR_STOP=1','-c',sql]).split('\n').at(-1);
async function request(url,headers,body){
 if(!url.startsWith(API+'/'))throw Error('REMOTE_HTTP_ATTEMPT');
 const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
 const payload=await res.json().catch(()=>({}));
 return {status:res.status,payload};
}
async function createUser(address){
 const r=await request(API+'/auth/v1/admin/users',{apikey:service,authorization:'Bearer '+service},
  {email:address,password:'Only-Disposable-Test-Pass!123',email_confirm:true});
 if(![200,201].includes(r.status)||!r.payload.id)throw Error('LOCAL_AUTH_USER_CREATE '+r.status);
 return r.payload.id;
}
async function login(address){
 const r=await request(API+'/auth/v1/token?grant_type=password',{apikey:anon},
  {email:address,password:'Only-Disposable-Test-Pass!123'});
 if(r.status!==200||!r.payload.access_token)throw Error('REAL_LOCAL_GOTRUE_LOGIN_FAIL '+r.status);
 return r.payload.access_token;
}
function sqlInsert(org,user,collection,id,data){
 query('INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES ('+
  quote(org)+'::uuid,'+quote(user)+'::uuid,'+quote(collection)+','+quote(id)+','+
  quote(JSON.stringify(data))+'::jsonb)');
}
async function rpc(name,token,body){
 return request(API+'/rest/v1/rpc/'+name,{apikey:anon,authorization:'Bearer '+token},body);
}
function mustFail(resp,why){
 if(resp.status<400)throw Error('NEGATIVE_ACCEPTED '+why+' '+JSON.stringify(resp.payload).slice(0,350));
}
function mustOk(resp,why){
 if(resp.status!==200)throw Error('EXPECTED_SUCCESS '+why+' status='+resp.status+
  ' code='+String(resp.payload.code||resp.payload.message).slice(0,180));
}
const owner=await createUser('finora.stage3.owner@example.invalid');
const other=await createUser('finora.stage3.other@example.invalid');
const org=query('SELECT organization_id::text FROM public.organization_members WHERE user_id='+
 quote(owner)+'::uuid AND status='+quote('active')+' AND is_owner=true LIMIT 1');
const otherOrg=query('SELECT organization_id::text FROM public.organization_members WHERE user_id='+
 quote(other)+'::uuid AND status='+quote('active')+' AND is_owner=true LIMIT 1');
if(!org||!otherOrg||org===otherOrg)throw Error('TENANT_ISOLATION_FIXTURE_BROKEN');
const ownerToken=await login('finora.stage3.owner@example.invalid');
const otherToken=await login('finora.stage3.other@example.invalid');
query("UPDATE public.licenses SET status='active',ends_at='2099-01-01' WHERE organization_id IN ("+
 quote(org)+"::uuid,"+quote(otherOrg)+"::uuid)");
const company='QA_CO',fy='QA_FY';
sqlInsert(org,owner,'companies',company,{name:'Only synthetic Stage3 company'});
sqlInsert(org,owner,'fiscalYears',fy,{companyId:company,startDate:'1405/01/01',
 endDate:'1405/12/29',status:'open'});
const specs=[
 ['CASH','cash_default','1101','asset','debit'],
 ['AR','receivable_control','1102','asset','debit'],
 ['REV','revenue_default','4101','revenue','credit'],
 ['VATP','vat_payable','2102','liability','credit'],
 ['PUR','purchase_default','5101','expense','debit'],
 ['AP','payable_control','2101','liability','credit'],
 ['VATR','vat_recoverable','1108','asset','debit']
];
const mappings={};
for(const [id,role,code,type,nature] of specs){
 mappings[role]=id;
 sqlInsert(org,owner,'accounts',id,{companyId:company,code,title:'Synthetic '+role,
  accountType:type,normalBalance:nature,postingAllowed:true,active:true,
  systemRole:role,level:'detail',parentId:'PARENT'});
}
query("INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode) VALUES ("+
 quote(org)+"::uuid,'enforce') ON CONFLICT (organization_id) DO UPDATE SET mode='enforce'");
const sourceIds={sale:'ST3_SALE_REAL_JWT',purchase:'ST3_PURCHASE_REAL_JWT'};
for(const kind of ['sale','purchase']){
 const sample=fixture[kind];
 if(!sample||sample.currencyCode!=='IRR'||sample.accountingVersion!==1)
  throw Error('SYNTHETIC_ACTUAL_FORM_INPUT_INVALID '+kind);
 sqlInsert(org,owner,kind==='sale'?'invoices':'purchases',sourceIds[kind],
  {...sample,companyId:company});
}
function header(kind,id){
 return {companyId:company,fiscalYearId:fy,date:'1405/07/24',
  sourceType:kind,sourceId:id,sourceVersion:'1'};
}
function args(kind,id,voucher,lines=null){
 return {p_organization_id:org,p_voucher_id:voucher,
  p_source_collection:kind==='sale'?'invoices':'purchases',
  p_source_id:id,p_header:header(kind,id),p_lines:lines};
}
// Deny unauthorized cross-org role publication before any owner approval.
const rejectMapping=await rpc('finora_phase1a_publish_role_assignments',otherToken,
 {p_organization_id:org,p_company_id:company,p_assignments:mappings,p_expected_version:0,
  p_reason:'Rejected cross-org synthetic approval'});
mustFail(rejectMapping,'CROSS_ORG_ROLE_PUBLICATION');
const noRole=await rpc('finora_journal_autopost',ownerToken,
 args('sale',sourceIds.sale,'ST3_PRE_APPROVAL'));
mustFail(noRole,'OWNER_MAPPING_MISSING');
if(query("SELECT count(*) FROM public.records WHERE organization_id="+quote(org)+
 "::uuid AND collection='journalVouchers'")!=='0')
 throw Error('DENIED_POST_CREATED_FINANCIAL_ROWS');
const role=await rpc('finora_phase1a_publish_role_assignments',ownerToken,
 {p_organization_id:org,p_company_id:company,p_assignments:mappings,p_expected_version:0,
  p_reason:'Approved locally for synthetic isolated stage3 test'});
mustOk(role,'SYNTHETIC_OWNER_APPROVED_ROLE_SNAPSHOT');
if(Number(role.payload.version)!==1)throw Error('SYNTHETIC_MAPPING_VERSION_INVALID');
const cross=await rpc('finora_journal_autopost',otherToken,
 args('sale',sourceIds.sale,'ST3_CROSS_ORG_ATTACK'));
mustFail(cross,'CROSS_ORG_AUTOPost');
const badLines=[{accountId:'CASH',debit:999999,credit:0},
 {accountId:'REV',debit:0,credit:999999}];
const attack=await rpc('finora_journal_autopost',ownerToken,
 args('sale',sourceIds.sale,'ST3_TAMPERED_LINES',badLines));
mustFail(attack,'CLIENT_FORGED_LINES');
const receipts=await rpc('finora_journal_autopost',ownerToken,
 {...args('sale',sourceIds.sale,'ST3_UNSUPPORTED_KIND'),
  p_header:header('receipt',sourceIds.sale)});
mustFail(receipts,'UNSUPPORTED_RECEIPT_TYPE');
const malformed={...fixture.sale,currencyCode:'UNSUPPORTED_NON_RIAL'};
sqlInsert(org,owner,'invoices','ST3_BAD_CURRENCY',malformed);
const nonIrr=await rpc('finora_journal_autopost',ownerToken,
 args('sale','ST3_BAD_CURRENCY','ST3_NON_IRR_DENIED'));
mustFail(nonIrr,'NON_RIAL_POSTING');
const completed={};
for(const kind of ['sale','purchase']){
 const id=sourceIds[kind],voucher='ST3_REAL_'+kind.toUpperCase();
 const first=await rpc('finora_journal_autopost',ownerToken,args(kind,id,voucher));
 mustOk(first,kind.toUpperCase()+'_JWT_POST');
 if(first.payload.voucher?.status!=='posted'||first.payload.replayed!==false||
   !first.payload.voucher.number||Number(first.payload.contractVersion)!==1)
  throw Error('SERVER_OWNED_POST_RESPONSE_INVALID '+kind);
 const replay=await rpc('finora_journal_autopost',ownerToken,
  args(kind,id,'ST3_RETRY_'+kind.toUpperCase()));
 mustOk(replay,kind.toUpperCase()+'_REPLAY');
 if(replay.payload.replayed!==true||
    replay.payload.voucher?.number!==first.payload.voucher.number)
  throw Error('DUPLICATE_EVENT_POSTING_NOT_IDEMPOTENT '+kind);
 const lines=JSON.parse(query("SELECT jsonb_build_object("+
  "'debit',sum((data->>'debit')::numeric),"+
  "'credit',sum((data->>'credit')::numeric),"+
  "'rows',count(*))::text FROM public.records WHERE organization_id="+
  quote(org)+"::uuid AND collection='journalLines' AND data->>'voucherId'="+quote(voucher)));
 if(!(Number(lines.debit)>0)||Number(lines.debit)!==Number(lines.credit)||
   Number(lines.rows)<2)throw Error('SERVER_POSTING_UNBALANCED '+kind);
 const postedCount=query("SELECT count(*) FROM public.records WHERE organization_id="+
  quote(org)+"::uuid AND collection='journalVouchers' AND data->>'sourceId'="+
  quote(id)+" AND data->>'status'='posted'");
 if(postedCount!=='1')throw Error('NON_UNIQUE_SOURCE_POST '+kind);
 const auditCount=query("SELECT count(*) FROM private.finora_phase1a_journal_audit WHERE organization_id="+
  quote(org)+"::uuid AND voucher_id="+quote(voucher)+" AND action='posted'");
 if(auditCount!=='1')throw Error('MISSING_OR_DUPLICATE_AUDIT '+kind);
 completed[kind]={balanced:true,audit:1,posted:1,replayed:true,lines:lines.rows};
}
const total=query("SELECT count(*) FROM public.records WHERE organization_id="+quote(org)+
 "::uuid AND collection='journalVouchers' AND data->>'status'='posted'");
if(total!=='2')throw Error('UNEXPECTED_JOURNAL_COUNT '+total);
console.log('FINORA_STAGE3_REAL_JWT_SOURCE_POST_PASS '+JSON.stringify({
 layer:'local GoTrue password JWT + actual PostgREST RPC + PostgreSQL',
 source:'actual synthetic browser form fixtures',kinds:Object.keys(completed),
 results:completed,negatives:5,foreignConnections:0,
 productionMutation:false,hostedStaging:false
}));

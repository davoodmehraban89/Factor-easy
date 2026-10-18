#!/usr/bin/env node
// REAL STACK: Built Pages HTML + local GoTrue/PostgREST/Kong + real JWT/Chromium.
// This script NEVER accesses a remote host. Artifacts exclude credentials/JWT.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from '@playwright/test';
const API='http://127.0.0.1:54321',SITE='http://127.0.0.1:4173',REF='hcsixhqbyuhpshfwqpjx';
const blocked=['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_SERVICE_ROLE_KEY'];
if(blocked.some(k=>process.env[k]))throw Error('FINORA_TEST_TARGET_PRODUCTION_FORBIDDEN');
function sh(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:30000,env:{...process.env,PGPASSWORD:'postgres'}});if(r.status!==0)throw Error('LOCAL_COMMAND_FAILED '+cmd+' '+String(r.stderr).slice(0,180));return r.stdout.trim()}
const vars=Object.fromEntries(sh('supabase',['status','-o','env']).split('\n').filter(x=>/^[A-Z_]+=/i.test(x)).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const anon=vars.ANON_KEY,admin=vars.SERVICE_ROLE_KEY;
if(!anon||!admin)throw Error('LOCAL_CLI_KEYS_UNAVAILABLE');
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const db=q=>sh('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-c',q]).split('\n').at(-1);
async function addUser(email){
 const r=await fetch(API+'/auth/v1/admin/users',{method:'POST',headers:{apikey:admin,authorization:'Bearer '+admin,'content-type':'application/json'},body:JSON.stringify({email,password:'Local-Stage22-Password!12345',email_confirm:true})});
 const v=await r.json();if(r.status!==200&&r.status!==201)throw Error('LOCAL_AUTH_ADMIN_CREATE_FAILED '+r.status+' '+JSON.stringify(v).slice(0,130));return v.id;
}
const owner=await addUser('stage22.real.owner@example.invalid'),other=await addUser('stage22.real.other@example.invalid');
const org=db('SELECT organization_id::text FROM public.organization_members WHERE user_id='+quote(owner)+'::uuid AND is_owner=true LIMIT 1');
const otherOrg=db('SELECT organization_id::text FROM public.organization_members WHERE user_id='+quote(other)+'::uuid AND is_owner=true LIMIT 1');
if(!org||!otherOrg||org===otherOrg)throw Error('LOCAL_ORGANIZATIONS_NOT_PROVISIONED');
db("UPDATE public.licenses SET status='active',ends_at='2099-01-01' WHERE organization_id IN ("+quote(org)+"::uuid,"+quote(otherOrg)+"::uuid)");
function record(coll,id,data){
 db('INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES('+quote(org)+'::uuid,'+quote(owner)+'::uuid,'+quote(coll)+','+quote(id)+','+quote(JSON.stringify(data))+'::jsonb)');
}
record('companies','ST22_CO',{name:'Real stack local company'});
record('fiscalYears','ST22_FY',{companyId:'ST22_CO',startDate:'1405/01/01',endDate:'1405/12/29',status:'open'});
for(const data of [
 {id:'ST22_CASH',companyId:'ST22_CO',code:'1101',title:'صندوق',accountType:'asset',normalBalance:'debit',postingAllowed:true,active:true,level:'detail'},
 {id:'ST22_REV',companyId:'ST22_CO',code:'4101',title:'درآمد',accountType:'revenue',normalBalance:'credit',postingAllowed:true,active:true,level:'detail'}
])record('accounts',data.id,data);
const evidence={layer:'real-stack',builtPage:'_site/index.html',login:'unverified',scenarios:[],network:[],syncPayload:[]};
let core=fs.readFileSync('_site/js/core.js','utf8');
const old="const SUPABASE_URL='https://"+REF+".supabase.co';";
if(!core.includes(old))throw Error('BUILT_ARTIFACT_MISSING_ORIGINAL_TARGET');
core=core.replace(old,"const SUPABASE_URL='"+API+"';").replace(/const SUPABASE_KEY='[^']+';/,"const SUPABASE_KEY='"+anon+"';");
if(core.includes(REF))throw Error('LOCAL_PATCH_NOT_ISOLATED');
fs.writeFileSync('_site/js/core.js',core);
let html=fs.readFileSync('_site/index.html','utf8');
html=html.replace("connect-src 'self' https://"+REF+".supabase.co","connect-src 'self' "+API).replace('; upgrade-insecure-requests','');
if(html.includes('https://'+REF+'.supabase.co'))throw Error('LOCAL_HTML_NOT_ISOLATED');
fs.writeFileSync('_site/index.html',html);
const server=http.createServer((req,res)=>{
 const rel=path.normalize(decodeURIComponent(new URL(req.url,SITE).pathname)).replace(/^[/\\]+/,'');
 const root=path.resolve('_site'),file=path.resolve(root,rel||'index.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 const ext=path.extname(file),mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
 try{res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':'no-store'}).end(fs.readFileSync(file))}
 catch{res.writeHead(404).end()}
});
await new Promise(ok=>server.listen(4173,'127.0.0.1',ok));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const remote=[],errors=[];
let capturedGuardMode='enforce'; // Explicit phase label: audit intentionally exercises legacy fields.
page.on('pageerror',err=>errors.push(String(err.message).slice(0,140)));
const responseCodes=[];
page.on('response',res=>{
 const u=new URL(res.url());
 if(u.port==='54321')responseCodes.push({path:u.pathname,status:res.status()});
});
await page.route('**/*',route=>{
 const u=new URL(route.request().url());
 if(!['localhost','127.0.0.1'].includes(u.hostname)){if(/supabase\.co|factoreasy\.ir/.test(u.hostname))remote.push(u.hostname);return route.abort()}
 return route.continue();
});
page.on('request',req=>{
 const u=new URL(req.url());if(u.port!=='54321')return;
 evidence.network.push({method:req.method(),path:u.pathname.replace(/\/users\/[^/]+/,'/users/{id}')});
 if(u.pathname.includes('finora_sync_records_v2')){
  let payload={};try{payload=JSON.parse(req.postData()||'{}')}catch{}
  const journal=(payload.p_upserts||[]).filter(x=>/^journal/.test(x.collection));
  evidence.syncPayload.push({
   phase:capturedGuardMode,upserts:(payload.p_upserts||[]).length,
   journalRows:journal.length,
   serverFields:journal.some(x=>['status','number','postedAt'].some(k=>Object.hasOwn(x.data||{},k))),
   anyServerOwnedFields:(payload.p_upserts||[]).some(x=>['status','number','postedAt'].some(k=>Object.hasOwn(x.data||{},k)))
  });
 }
});
try{
 await page.goto(SITE+'/index.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.FinoraStartupStatus?.authFormReady===true,{timeout:35000});
 await page.locator('#auth-email').fill('stage22.real.owner@example.invalid');
 await page.locator('#auth-password').fill('Local-Stage22-Password!12345');
 await page.locator('#auth-login-button').click();
 try{
  await page.waitForFunction(()=>document.getElementById('auth-screen')?.style.display==='none'&&typeof currentUser!=='undefined'&&!!currentUser?.organizationId,null,{timeout:50000});
 }catch(error){
  const stage=await page.evaluate(async()=>({
   membershipLock:!!document.getElementById('finora-membership-lock'),
   pendingStages:typeof finoraPendingLoginStages==='function'?finoraPendingLoginStages():[],
   authFormReady:window.FinoraStartupStatus?.authFormReady,
   assetsReady:window.FinoraStartupStatus?.extensionsReady,
   failedAssets:window.FinoraStartupStatus?.failedExtensionCount,
   authChecked:window.FinoraStartupStatus?.authChecked,
   loginState:document.getElementById('auth-login-status')?.dataset?.state,
   loginMessage:document.getElementById('auth-login-status')?.textContent?.slice(0,180),
   hasCurrentUser:typeof currentUser!=='undefined'&&!!currentUser,
   authSession:!!(await sb.auth.getSession()).data.session,
   orgContextReady:!!window.FinoraOrganizationContextReady
  }));
  const orgCheck=await page.evaluate(async()=>{
   try{
    const {data,error}=await sb.from('organization_members').select('organization_id,status').eq('user_id',(await sb.auth.getUser()).data.user.id).eq('status','active');
    return {count:(data||[]).length,hasError:!!error};
   }catch{return {error:true}}
  });
  console.error('REAL_LOGIN_DIAGNOSTIC '+JSON.stringify({stage,orgCheck,errors:errors.slice(0,5),responses:responseCodes.slice(-28)}));
  throw error;
 }
 const login=await page.evaluate(async()=>({org:currentUser.organizationId,uid:currentUser.id,hasJWT:!!(await sb.auth.getSession()).data.session?.access_token,api:SUPABASE_URL}));
 if(login.org!==org||login.uid!==owner||!login.hasJWT||login.api!==API)throw Error('REAL_UI_AUTH_JWT_OR_TENANT_FAILED');
 evidence.login='PASS';evidence.scenarios.push('real-password-login');
 const flag=await page.evaluate(o=>sb.rpc('finora_journal_set_guard_mode',{p_organization_id:o,p_expected_mode:'off',p_mode:'enforce',p_reason:'Real-stack local-only owner verification'}),org);
 if(flag.error||flag.data?.mode!=='enforce')throw Error('REAL_OWNER_GUARD_MODE_CHANGE_FAILED');
 if(await page.evaluate(()=>finoraManualMode())!=='enforce')throw Error('REAL_BROWSER_FLAG_NOT_FROM_SERVER');
 evidence.scenarios.push('server-owned-mode-via-JWT');
 await page.evaluate(()=>{
  getMySettings().default_company_id='ST22_CO';renderJournal();switchView('view-journal');
  const rows=document.querySelectorAll('#je-lines .je-line');
  if(rows.length<2)throw Error('JOURNAL_FORM_MISSING');
  rows[0].querySelector('.je-account').value='ST22_CASH';
  rows[0].querySelector('.je-debit').value='1250';
  rows[1].querySelector('.je-account').value='ST22_REV';
  rows[1].querySelector('.je-credit').value='1250';
  document.getElementById('je-date').value='1405/07/26';
  document.getElementById('je-desc').value='Real stack manual draft';
 });
 // A real first-login user sees an onboarding modal; complete it through
 // the original UI rather than forcing or bypassing pointer interception.
 if(await page.locator('#modal-user-onboarding.active').count()){
   await page.locator('#onboarding-full-name').fill('کاربر آزمایشی محلی');
   await page.evaluate(()=>{const control=document.getElementById('onboarding-professional-role');
     if(!control)throw Error('LOCAL_UI_ONBOARDING_ROLE_MISSING');
     control.value='accountant';control.dispatchEvent(new Event('change',{bubbles:true}));});
   await page.locator('#modal-user-onboarding button').click();
   await page.locator('#modal-user-onboarding.active').waitFor({state:'hidden',timeout:15000});
 }
 await page.locator('#je-save-draft-button').click();
 await page.waitForFunction(()=>getMyJournalVouchers().some(x=>x.description==='Real stack manual draft'),{timeout:25000});
 const draft=await page.evaluate(()=>getMyJournalVouchers().find(x=>x.description==='Real stack manual draft'));
 if(draft.number||draft.status!=='draft')throw Error('REAL_DRAFT_HAS_SERVER_NUMBER');
 if(db("SELECT count(*) FROM public.records WHERE organization_id="+quote(org)+"::uuid AND collection='journalVouchers' AND id="+quote(draft.id))!=='1')throw Error('REAL_DRAFT_NOT_PERSISTED');
 evidence.scenarios.push('real-browser-RPC-draft');
 const attacks=await page.evaluate(async p=>{
  const token=(await sb.auth.getSession()).data.session.access_token;
  const headers={apikey:SUPABASE_KEY,authorization:'Bearer '+token,'content-type':'application/json',Prefer:'return=representation'};
  const url=SUPABASE_URL+'/rest/v1/records';
  const saved=await sb.from('records').select('data').eq('organization_id',p.org).eq('collection','journalVouchers').eq('id',p.id).single();
  if(saved.error)throw saved.error;
  const patch=await fetch(url+'?organization_id=eq.'+p.org+'&collection=eq.journalVouchers&id=eq.'+p.id,{method:'PATCH',headers,body:JSON.stringify({data:{...saved.data.data,status:'posted',number:'999',postedAt:'forged'}})});
  const cross=await fetch(url,{method:'POST',headers,body:JSON.stringify({organization_id:p.other,owner_id:p.user,collection:'journalVouchers',id:'ST22_WRONG_ORG',data:{status:'posted',number:'999'}})});
  return {patch:patch.status,cross:cross.status};
 },{org,other:otherOrg,id:draft.id,user:owner});
 if(attacks.patch<400||attacks.cross<400)throw Error('JWT_REST_ATTACK_NOT_REJECTED '+JSON.stringify(attacks));
 if(db("SELECT data->>'status' FROM public.records WHERE organization_id="+quote(org)+"::uuid AND id="+quote(draft.id))!=='draft')throw Error('JWT_PATCH_CHANGED_POST_STATUS');
 if(db("SELECT count(*) FROM public.records WHERE organization_id="+quote(otherOrg)+"::uuid AND id='ST22_WRONG_ORG'")!=='0')throw Error('CROSS_ORG_WRITE_NOT_BLOCKED');
 evidence.scenarios.push({attack:'JWT-REST-direct-post',status:attacks.patch,denied:true},{attack:'JWT-REST-cross-org',status:attacks.cross,denied:true});
 const post=await page.evaluate(async id=>{const a=await Promise.all([jePost(id),jePost(id)]);return a.map(x=>({status:x.status,number:x.number}))},draft.id);
 if(post.some(x=>x.status!=='posted'||!x.number)||post[0].number!==post[1].number)throw Error('IDEMPOTENT_DOUBLE_POST_FAILED');
 const row=JSON.parse(db("SELECT jsonb_build_object('status',data->>'status','number',data->>'number','version',version)::text FROM public.records WHERE organization_id="+quote(org)+"::uuid AND id="+quote(draft.id)));
 const balance=JSON.parse(db("SELECT jsonb_build_object('debit',sum((data->>'debit')::numeric),'credit',sum((data->>'credit')::numeric),'count',count(*))::text FROM public.records WHERE organization_id="+quote(org)+"::uuid AND collection='journalLines' AND data->>'voucherId'="+quote(draft.id)));
 const audits=Number(db("SELECT count(*) FROM private.finora_phase1a_journal_audit WHERE organization_id="+quote(org)+"::uuid AND action='posted' AND voucher_id="+quote(draft.id)));
 if(row.status!=='posted'||!row.number||balance.debit!==balance.credit||balance.debit!==1250||balance.count!==2||audits!==1)throw Error('REAL_DB_POST_AUDIT_BALANCE_FAILED');
 evidence.scenarios.push('real-JWT-post-double-click-single-number-and-audit');
 const changed=await page.evaluate(o=>sb.rpc('finora_journal_set_guard_mode',{p_organization_id:o,p_expected_mode:'enforce',p_mode:'audit',p_reason:'Real-stack legacy audit mode test'}),org);
 if(changed.error||changed.data?.mode!=='audit')throw Error('REAL_AUDIT_MODE_NOT_SET');
 await page.evaluate(()=>finoraManualMode());
 capturedGuardMode='audit'; // Old-client audit violation is deliberate and MUST remain visible.
 const legacy=await page.evaluate(async()=>{
  const v=await jeCreateDraft({date:'1405/07/26',voucherType:'manual',description:'Audit legacy draft',
   lines:[{accountId:'ST22_CASH',debit:75,credit:0},{accountId:'ST22_REV',debit:0,credit:75}]});
  await runSync();return {number:v.number,status:v.status};
 });
 if(!legacy.number||legacy.status!=='draft')throw Error('LEGACY_AUDIT_NOT_LEGACY');
 const violations=Number(db("SELECT count(*) FROM private.finora_phase1a_journal_audit WHERE organization_id="+quote(org)+"::uuid AND action='guard_violation'"));
 if(violations<1)throw Error('AUDIT_MODE_NO_VIOLATION_RECORDED');
 evidence.scenarios.push('legacy-numbered-draft-audit-with-violation-row');
 if(remote.length)throw Error('PRODUCTION_NETWORK_ATTEMPT');
 const enforcedSync=evidence.syncPayload.filter(x=>x.phase==='enforce');
 const auditSync=evidence.syncPayload.filter(x=>x.phase==='audit');
 if(!enforcedSync.length)throw Error('REAL_ENFORCE_SYNC_BODY_UNOBSERVED');
 if(enforcedSync.some(x=>x.journalRows!==0||x.anyServerOwnedFields))
  throw Error('ENFORCE_CLIENT_SYNC_SUBMITTED_SERVER_OWNED_FIELDS');
 if(!auditSync.some(x=>x.journalRows>0&&x.serverFields))
  throw Error('LEGACY_AUDIT_SYNC_DID_NOT_EXPOSE_EXPECTED_VIOLATION');
 evidence.syncInvariant={
  enforceRequestCount:enforcedSync.length,
  enforceNoServerOwnedFields:true,
  auditRequestCount:auditSync.length,
  legacyAuditServerFieldsObserved:true,
  legacyAuditViolationRows:violations
 };
 if(!evidence.network.some(x=>x.path.includes('/auth/v1/token'))||!evidence.network.some(x=>x.path.includes('/rest/v1/rpc/')))throw Error('REAL_NETWORK_PATHS_NOT_OBSERVED');
 evidence.db={version:row.version,numberUnique:true,balanced:true,postedAudits:audits,auditViolations:violations};
 console.log('STAGE22_REAL_STACK_PASS '+JSON.stringify({scenarios:evidence.scenarios,db:evidence.db,requests:evidence.network.length}));
}finally{
 evidence.pageErrors=errors.slice(0,6);evidence.authRestResponses=responseCodes.slice(-40);evidence.remoteProductionAttempt=remote.length;
 fs.writeFileSync('stage22-real-stack-evidence.json',JSON.stringify(evidence,null,2));
 await browser.close();await new Promise(ok=>server.close(ok));
}

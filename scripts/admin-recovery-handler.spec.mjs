import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';

const ACTOR='11111111-1111-4111-8111-111111111111';
const TARGET='22222222-2222-4222-8222-222222222222';
const ACTOR_MEMBER='33333333-3333-4333-8333-333333333333';
const TARGET_MEMBER='44444444-4444-4444-8444-444444444444';
const ROLE='55555555-5555-4555-8555-555555555555';
const FOREIGN_ROLE='66666666-6666-4666-8666-666666666666';
const CREATED='77777777-7777-4777-8777-777777777777';
const ORG='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORG='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CALLBACK='https://factoreasy.ir/?finora_recovery=1';
const handlerPath=new URL('../supabase/functions/admin-user-management/handler.mjs',import.meta.url);

async function loadHandler(dependencies){
  if(existsSync(handlerPath)){
    const {createAdminUserManagementHandler}=await import(handlerPath.href);
    return createAdminUserManagementHandler(dependencies);
  }
  // Exercise the unchanged inline Deno handler during the RED run, with no SDK/network import.
  let handler;
  const source=readFileSync(new URL('../supabase/functions/admin-user-management/index.ts',import.meta.url),'utf8')
    .replace(/^import .*;\s*$/gm,'')
    .replace(/let body:\s*Record<string,unknown>;/,'let body;')
    .replace(/:\s*string\s*\|\s*null/g,'')
    .replace(/:\s*(?:string|number|unknown|Request)\b/g,'');
  new Function('createClient','Deno','console',source)(dependencies.createClient,{
    env:{get:dependencies.getEnv},serve:value=>{handler=value;}
  },dependencies.logger);
  assert.equal(typeof handler,'function');
  return handler;
}

async function fixture(options={}){
  const tables={
    profiles:[{id:ACTOR,role:options.admin?'admin':'user'},{id:TARGET,role:'user'}],
    organizations:[{id:ORG,status:'active'},{id:OTHER_ORG,status:'active'}],
    organization_members:[
      {id:ACTOR_MEMBER,organization_id:ORG,user_id:ACTOR,status:'active',is_owner:!!options.owner},
      {id:TARGET_MEMBER,organization_id:ORG,user_id:TARGET,status:'active',is_owner:false}
    ],
    member_module_permissions:[],organization_member_roles:[],organization_roles:[],organization_role_permissions:[]
  };
  const calls={clients:[],queries:[],authLookups:[],targetLookups:[],emails:[],creates:[],updates:[],links:[],logs:[]};
  const failures=new Set();
  const targetUser={id:TARGET,email:'verified@example.invalid',email_confirmed_at:'2026-10-01T00:00:00Z'};
  function query(table){
    const filters=[];
    function result(one=false){
      calls.queries.push({table,filters:filters.slice()});
      if(failures.has(table))return {data:null,error:{message:'PRIVATE_DATABASE_ERROR'}};
      const rows=(tables[table]||[]).filter(row=>filters.every(([kind,key,value])=>kind==='eq'?row[key]===value:value.includes(row[key])));
      return {data:one?(rows[0]||null):rows,error:null};
    }
    return {
      select(){return this;},eq(key,value){filters.push(['eq',key,value]);return this;},
      in(key,values){filters.push(['in',key,values]);return this;},limit(){return this;},
      single(){return Promise.resolve(result(true));},maybeSingle(){return Promise.resolve(result(true));},
      then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}
    };
  }
  const getEnv=name=>({SUPABASE_URL:'https://fixture.example.invalid',SUPABASE_ANON_KEY:'anon-fixture',SUPABASE_SERVICE_ROLE_KEY:options.missingConfig?undefined:'service-fixture'})[name];
  const createClient=(url,key,config)=>{
    calls.clients.push({url,key,config});
    return {
      from:query,
      auth:{
        getUser:async token=>{calls.authLookups.push(token);return {data:{user:options.authError?null:{id:ACTOR,user_metadata:options.userMetadata||{}}},error:options.authError||null};},
        resetPasswordForEmail:async(email,config)=>{calls.emails.push({email,config,key});if(options.emailThrows)throw new Error('PRIVATE_EMAIL_ERROR');return {data:{},error:options.emailError||null};},
        admin:{
          getUserById:async id=>{calls.targetLookups.push(id);return {data:{user:id===TARGET&&!options.targetError?targetUser:null},error:options.targetError||null};},
          createUser:async body=>{calls.creates.push(body);return {data:{user:options.createError?null:{id:CREATED}},error:options.createError||null};},
          updateUserById:async(...args)=>{calls.updates.push(args);if(options.updateThrows)throw new Error('PRIVATE_AUTH_EXCEPTION');return {data:options.updateError?null:{user:{id:TARGET}},error:options.updateError||null};},
          generateLink:async(...args)=>{calls.links.push(args);return {data:{properties:{action_link:'PRIVATE_ACTION_LINK'}},error:null};}
        }
      }
    };
  };
  const handler=await loadHandler({createClient,getEnv,logger:{info:(...args)=>calls.logs.push(args),error:(...args)=>calls.logs.push(args)}});
  async function invoke(body={action:'send_recovery',user_id:TARGET,organization_id:ORG},requestOptions={}){
    const method=requestOptions.method||'POST';
    const headers={'Content-Type':'application/json'};
    if(requestOptions.origin!==null)headers.Origin=requestOptions.origin||'https://factoreasy.ir';
    if(requestOptions.authorization!==null)headers.Authorization=requestOptions.authorization||'Bearer fixture-token';
    const request=new Request('https://fixture.example.invalid/functions/v1/admin-user-management',{
      method,headers,...(method==='POST'?{body:requestOptions.rawBody??JSON.stringify(body)}:{})
    });
    const response=await handler(request);
    return {status:response.status,body:response.status===204?null:await response.json(),headers:response.headers};
  }
  return {tables,calls,failures,targetUser,invoke};
}
function managerRole(f){
  f.tables.organization_member_roles.push({organization_id:ORG,member_id:ACTOR_MEMBER,role_id:ROLE,active:true});
  f.tables.organization_roles.push({id:ROLE,organization_id:ORG,active:true,role_key:'system_admin'});
  f.tables.organization_role_permissions.push({organization_id:ORG,role_id:ROLE,module_key:'core',capabilities:['read','configure']});
}
function noPasswordMutation(f){assert.equal(f.calls.updates.length,0);assert.equal(f.calls.links.length,0);}

test('global administrator requests only the current verified Auth email and fixed callback',async()=>{
  const f=await fixture({admin:true});
  const result=await f.invoke({action:'send_recovery',user_id:TARGET});
  assert.equal(result.status,200);assert.deepEqual(result.body,{ok:true});
  assert.deepEqual(f.calls.targetLookups,[TARGET]);
  assert.deepEqual(f.calls.emails,[{email:f.targetUser.email,config:{redirectTo:CALLBACK},key:'anon-fixture'}]);
  assert.deepEqual(f.calls.authLookups,['fixture-token']);
  for(const {config} of f.calls.clients){
    assert.equal(config.auth.persistSession,false);assert.equal(config.auth.autoRefreshToken,false);
    assert.equal(config.auth.detectSessionInUrl,false);assert.equal(config.auth.flowType,'implicit');
  }
  noPasswordMutation(f);
});
test('active organization owner may request recovery for an active same-organization Auth user',async()=>{
  const f=await fixture({owner:true});assert.equal((await f.invoke()).status,200);
  assert.equal(f.calls.emails.length,1);noPasswordMutation(f);
});
test('ordinary member and forged user metadata never grant recovery management',async()=>{
  const f=await fixture({userMetadata:{role:'admin',is_owner:true,core_configure:true}});
  assert.equal((await f.invoke()).status,403);assert.equal(f.calls.emails.length,0);noPasswordMutation(f);
});
test('direct core configure permission authorizes the active member',async()=>{
  const f=await fixture();f.tables.member_module_permissions.push({organization_id:ORG,member_id:ACTOR_MEMBER,module_key:'core',capabilities:['configure']});
  assert.equal((await f.invoke()).status,200);assert.equal(f.calls.emails.length,1);
});
test('existing full_suite configure permission authorizes the active member',async()=>{
  const f=await fixture();f.tables.member_module_permissions.push({organization_id:ORG,member_id:ACTOR_MEMBER,module_key:'full_suite',capabilities:['configure']});
  assert.equal((await f.invoke()).status,200);
});
test('module-specific configure and malformed capability strings do not manage recovery',async()=>{
  for(const permission of [{module_key:'accounting',capabilities:['configure']},{module_key:'core',capabilities:'configure'}]){
    const f=await fixture();f.tables.member_module_permissions.push({organization_id:ORG,member_id:ACTOR_MEMBER,...permission});
    assert.equal((await f.invoke()).status,403);assert.equal(f.calls.emails.length,0);
  }
});
test('active reusable role permission authorizes recovery without a new global role',async()=>{
  const f=await fixture();managerRole(f);assert.equal((await f.invoke()).status,200);assert.equal(f.calls.emails.length,1);
});
test('system_admin role name without configure permission grants nothing',async()=>{
  const f=await fixture();managerRole(f);f.tables.organization_role_permissions=[];
  assert.equal((await f.invoke()).status,403);assert.equal(f.calls.emails.length,0);
});
for(const mutation of ['inactive assignment','inactive role','foreign assignment','foreign role','foreign permission']){
  test(`${mutation} cannot authorize recovery`,async()=>{
    const f=await fixture();managerRole(f);
    if(mutation==='inactive assignment')f.tables.organization_member_roles[0].active=false;
    if(mutation==='inactive role')f.tables.organization_roles[0].active=false;
    if(mutation==='foreign assignment')f.tables.organization_member_roles[0].organization_id=OTHER_ORG;
    if(mutation==='foreign role')f.tables.organization_roles[0].organization_id=OTHER_ORG;
    if(mutation==='foreign permission')f.tables.organization_role_permissions[0].organization_id=OTHER_ORG;
    assert.equal((await f.invoke()).status,403);assert.equal(f.calls.emails.length,0);noPasswordMutation(f);
  });
}
for(const who of ['actor','target'])for(const status of ['suspended','left']){
  test(`${status} ${who} membership cannot send a recovery email`,async()=>{
    const f=await fixture({owner:true});f.tables.organization_members[who==='actor'?0:1].status=status;
    assert.equal((await f.invoke()).status,403);assert.equal(f.calls.emails.length,0);
  });
}
test('cross-organization target and organization identifiers cannot escape caller scope',async()=>{
  const f=await fixture({owner:true});f.tables.organization_members[1].organization_id=OTHER_ORG;
  assert.equal((await f.invoke()).status,403);
  assert.equal((await f.invoke({action:'send_recovery',user_id:TARGET,organization_id:OTHER_ORG})).status,403);
  assert.equal(f.calls.emails.length,0);
});
test('membership UUID is not an Auth-user UUID and cannot select a recipient',async()=>{
  const f=await fixture({owner:true});
  assert.equal((await f.invoke({action:'send_recovery',user_id:TARGET_MEMBER,organization_id:ORG})).status,403);
  assert.equal(f.calls.emails.length,0);assert.equal(f.calls.targetLookups.length,0);
});
test('suspended organization and missing caller membership fail closed',async()=>{
  for(const missing of [false,true]){
    const f=await fixture({owner:true});
    if(missing)f.tables.organization_members.shift();else f.tables.organizations[0].status='suspended';
    assert.equal((await f.invoke()).status,403);assert.equal(f.calls.emails.length,0);
  }
});
for(const table of ['profiles','organizations','organization_members','member_module_permissions','organization_member_roles','organization_roles','organization_role_permissions']){
  test(`${table} read error fails closed without sending mail`,async()=>{
    const f=await fixture();managerRole(f);f.failures.add(table);
    const result=await f.invoke();assert.equal(result.status,503);assert.equal(f.calls.emails.length,0);
    assert.doesNotMatch(JSON.stringify(result.body),/PRIVATE_DATABASE_ERROR/);
  });
}
test('missing or unconfirmed email cannot be replaced by stale profile information',async()=>{
  for(const variant of ['missing','unconfirmed','invalid']){
    const f=await fixture({admin:true});
    f.tables.profiles[1].email='stale@example.invalid';
    if(variant==='missing')f.targetUser.email=null;
    if(variant==='unconfirmed')f.targetUser.email_confirmed_at=null;
    if(variant==='invalid')f.targetUser.email='not-an-email';
    assert.equal((await f.invoke({action:'send_recovery',user_id:TARGET})).status,400);assert.equal(f.calls.emails.length,0);
  }
});
test('Auth target lookup failure returns no sensitive details and sends no email',async()=>{
  const f=await fixture({admin:true,targetError:{message:'PRIVATE_AUTH_LOOKUP_ERROR'}});
  const result=await f.invoke({action:'send_recovery',user_id:TARGET});
  assert.equal(result.status,400);assert.equal(f.calls.emails.length,0);
  assert.doesNotMatch(JSON.stringify([result.body,f.calls.logs]),/PRIVATE_AUTH_LOOKUP_ERROR/);
});
for(const extra of [{email:'attacker@example.invalid'},{redirectTo:'https://attacker.example.invalid/'},{password:'NeverSet!Secret123'},{role:'admin'},{is_owner:true}]){
  test(`untrusted recovery field ${Object.keys(extra)[0]} is rejected`,async()=>{
    const f=await fixture({admin:true});
    assert.equal((await f.invoke({action:'send_recovery',user_id:TARGET,...extra})).status,400);
    assert.equal(f.calls.emails.length,0);noPasswordMutation(f);
  });
}
test('malformed target and organization identifiers are rejected before Auth target lookup',async()=>{
  for(const body of [{action:'send_recovery',user_id:'-'.repeat(36)},...[false,0,'','company-1',42].map(organization_id=>({action:'send_recovery',user_id:TARGET,organization_id}))]){
    const f=await fixture({admin:true});assert.equal((await f.invoke(body)).status,400);assert.equal(f.calls.targetLookups.length,0);
  }
});
test('global platform admin can set a password through Auth Admin and receives only an outcome',async()=>{
  const secret='NeverSet!Secret123';const f=await fixture({admin:true});
  const result=await f.invoke({action:'set_password',user_id:TARGET,password:secret});
  assert.equal(result.status,200);assert.deepEqual(result.body,{ok:true});
  assert.deepEqual(f.calls.updates,[[TARGET,{password:secret}]]);
  assert.deepEqual(f.calls.logs,[['finora_admin_password_set',{actor:ACTOR,user_id:TARGET,outcome:'success'}]]);
  assert.doesNotMatch(JSON.stringify([result.body,f.calls.logs]),new RegExp(secret));
  assert.equal(f.calls.emails.length,0);assert.equal(f.calls.creates.length,0);
});
test('organization owner and delegated managers cannot assign any global Auth password',async()=>{
  for(const options of [{owner:true},{}]){
    const f=await fixture(options);if(!options.owner)managerRole(f);
    const result=await f.invoke({action:'set_password',user_id:TARGET,password:'NeverSet!Secret123'});
    assert.equal(result.status,403);assert.equal(result.body.error,'admin_required');
    assert.equal(f.calls.targetLookups.length,0);noPasswordMutation(f);
  }
});
test('malformed direct reset identifiers and unexpected fields are rejected without Auth lookup',async()=>{
  for(const body of [
    {action:'set_password',user_id:'-'.repeat(36),password:'NeverSet!Secret123'},
    {action:'set_password',user_id:TARGET,password:'NeverSet!Secret123',organization_id:ORG},
    {action:'set_password',user_id:TARGET,password:'NeverSet!Secret123',email:'attacker@example.invalid'},
    {action:'set_password',user_id:TARGET,password:'NeverSet!Secret123',role:'admin'}
  ]){
    const f=await fixture({admin:true});const result=await f.invoke(body);
    assert.equal(result.status,400);assert.equal(result.body.error,'invalid_password_reset');
    assert.equal(f.calls.targetLookups.length,0);noPasswordMutation(f);
  }
});
test('weak assigned passwords fail server policy without Auth mutation',async()=>{
  for(const password of ['short','NeverSet!NoDigits','ONLYUPPER!123','NeverSet!abcdef','a'.repeat(129)]){
    const f=await fixture({admin:true});const result=await f.invoke({action:'set_password',user_id:TARGET,password});
    assert.equal(result.status,400);assert.equal(result.body.error,'weak_password_assignment');noPasswordMutation(f);
  }
});
test('Auth password update failures are bounded and never log the submitted secret',async()=>{
  const secret='NeverSet!Secret123';
  for(const options of [{updateError:{code:'PRIVATE_AUTH_ERROR',message:'PRIVATE_AUTH_MESSAGE'}},{updateThrows:true}]){
    const f=await fixture({admin:true,...options});
    const result=await f.invoke({action:'set_password',user_id:TARGET,password:secret});
    assert.equal(result.status,502);assert.equal(result.body.error,'password_assignment_failed');
    assert.doesNotMatch(JSON.stringify([result.body,f.calls.logs]),/PRIVATE_|NeverSet!Secret123/);
    assert.equal(f.calls.emails.length,0);
  }
});
test('rate limits remain distinguishable without leaking provider error text',async()=>{
  for(const error of [{code:'over_email_send_rate_limit'},{code:'over_request_rate_limit'},{status:429}]){
    const f=await fixture({admin:true,emailError:{...error,message:'PRIVATE_EMAIL_PROVIDER_ERROR'}});
    const result=await f.invoke({action:'send_recovery',user_id:TARGET});
    assert.equal(result.status,429);assert.equal(result.body.error,'recovery_rate_limited');
    assert.doesNotMatch(JSON.stringify([result.body,f.calls.logs]),/PRIVATE_EMAIL_PROVIDER_ERROR|verified@example/);
  }
});
test('email request rejection and network exception cannot claim success or expose a link',async()=>{
  for(const options of [{emailError:{code:'unexpected_failure',message:'PRIVATE_EMAIL_PROVIDER_ERROR'}},{emailThrows:true}]){
    const f=await fixture({admin:true,...options});const result=await f.invoke({action:'send_recovery',user_id:TARGET});
    assert.equal(result.status,502);assert.equal(result.body.error,'recovery_failed');noPasswordMutation(f);
    assert.doesNotMatch(JSON.stringify([result.body,f.calls.logs]),/PRIVATE_|verified@example/);
  }
});
test('recovery response and audit contain only outcome and account identifiers',async()=>{
  const f=await fixture({owner:true});const result=await f.invoke();assert.equal(result.status,200);
  const encoded=JSON.stringify([result.body,f.calls.logs]);
  assert.doesNotMatch(encoded,/verified@example|anon-fixture|service-fixture|fixture-token|action_link|access_token|password/i);
  assert.ok(encoded.includes(ACTOR));assert.ok(encoded.includes(TARGET));assert.ok(encoded.includes(ORG));
  noPasswordMutation(f);
});
test('global-admin account creation contract remains unchanged',async()=>{
  const f=await fixture({admin:true});
  const result=await f.invoke({action:'create',email:'NEW@example.invalid',full_name:'Sample User',username:'sample.user',temporary_password:'Create!Fixture123'});
  assert.equal(result.status,201);assert.deepEqual(result.body,{ok:true,user_id:CREATED});
  assert.deepEqual(f.calls.creates,[{email:'new@example.invalid',email_confirm:true,password:'Create!Fixture123',user_metadata:{full_name:'Sample User',username:'sample.user',temporary_credential:true}}]);
  assert.equal(f.calls.emails.length,0);noPasswordMutation(f);
});
test('organization owner and delegated manager cannot provision a global account',async()=>{
  for(const owner of [true,false]){
    const f=await fixture({owner});if(!owner)managerRole(f);
    assert.equal((await f.invoke({action:'create',email:'new@example.invalid',temporary_password:'Create!Fixture123'})).status,403);
    assert.equal(f.calls.creates.length,0);
  }
});
test('weak initial passwords remain rejected and creation errors stay bounded',async()=>{
  const f=await fixture({admin:true});
  assert.equal((await f.invoke({action:'create',email:'new@example.invalid',temporary_password:'weak'})).body.error,'weak_temporary_password');
  const failed=await fixture({admin:true,createError:{code:'PRIVATE_EMAIL_SECRET',message:'PRIVATE_MESSAGE'}});
  const result=await failed.invoke({action:'create',email:'new@example.invalid',temporary_password:'Create!Fixture123'});
  assert.equal(result.status,400);assert.equal(result.body.error,'provision_failed');
  assert.doesNotMatch(JSON.stringify([result.body,failed.calls.logs]),/PRIVATE_/);
});
test('CORS and HTTP method handling preserve existing restrictions',async()=>{
  const f=await fixture({admin:true});
  assert.equal((await f.invoke(undefined,{origin:'https://attacker.example.invalid'})).status,403);
  const preflight=await f.invoke(undefined,{method:'OPTIONS',authorization:null});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://factoreasy.ir');
  assert.equal((await f.invoke(undefined,{method:'GET'})).status,405);assert.equal(f.calls.clients.length,0);
});
test('missing or rejected bearer and missing server configuration never send mail',async()=>{
  const f=await fixture({admin:true});assert.equal((await f.invoke(undefined,{authorization:null})).status,401);
  const rejected=await fixture({authError:{message:'PRIVATE_AUTH_ERROR'}});assert.equal((await rejected.invoke()).status,401);
  const unconfigured=await fixture({missingConfig:true});assert.equal((await unconfigured.invoke()).status,503);
  for(const item of [f,rejected,unconfigured])assert.equal(item.calls.emails.length,0);
});
test('invalid, array and oversized JSON requests cannot trigger recovery',async()=>{
  for(const requestOptions of [{rawBody:'{'},{rawBody:'[]'},{rawBody:'null'},{rawBody:'x'.repeat(8193)}]){
    const f=await fixture({admin:true});const result=await f.invoke(undefined,requestOptions);
    assert.ok([400,413].includes(result.status));assert.equal(f.calls.emails.length,0);
  }
});

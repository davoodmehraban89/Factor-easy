const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';

test.beforeEach(async({page})=>{
  await page.route('https://*.supabase.co/**',route=>route.abort());
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FinoraStartupStatus?.authChecked===true);
});

test('Auth timeout covers a stalled password response body after headers reach the real SDK',async({page})=>{
  const actual=await page.evaluate(async()=>{
    const originalFetch=window.fetch,originalAuthFetch=sb.auth.fetch;
    let streamController,signal;
    window.fetch=async(input,init)=>{
      signal=init.signal;
      return new Response(new ReadableStream({start(controller){
        streamController=controller;
        controller.enqueue(new TextEncoder().encode('{"access_token":'));
        signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});
      }}),{status:200,headers:{'content-type':'application/json'}});
    };
    sb.auth.fetch=(input,init)=>finoraBoundedAuthFetch(input,init,60);
    try{
      const result=await Promise.race([
        sb.auth.signInWithPassword({email:'fixture@example.test',password:'synthetic-only'}).then(result=>({settled:true,failed:!!result.error,networkError:isAuthNetworkError(result.error)})),
        new Promise(resolve=>setTimeout(()=>resolve({settled:false}),500))
      ]);
      return {...result,aborted:signal.aborted};
    }finally{
      streamController.error(new DOMException('Fixture cleanup','AbortError'));
      window.fetch=originalFetch;sb.auth.fetch=originalAuthFetch;
    }
  });
  expect(actual).toEqual({settled:true,failed:true,networkError:true,aborted:true});
});

test('A complete Auth response preserves status, headers and an unread body',async({page})=>{
  const actual=await page.evaluate(async()=>{
    const originalFetch=window.fetch;
    const response=new Response('{"message":"fixture"}',{status:201,statusText:'Created',headers:{'content-type':'application/json','x-request-id':'fixture-request'}});
    window.fetch=async()=>response;
    try{
      const received=await finoraBoundedAuthFetch('https://fixture.invalid/auth/v1/token',{},200);
      const unread=!received.bodyUsed;
      return {sameResponse:received===response,status:received.status,statusText:received.statusText,requestId:received.headers.get('x-request-id'),unread,body:await received.json()};
    }finally{window.fetch=originalFetch;}
  });
  expect(actual).toEqual({sameResponse:true,status:201,statusText:'Created',requestId:'fixture-request',unread:true,body:{message:'fixture'}});
});

test('Real SDK keeps a completed invalid-password response distinct from a transport timeout',async({page})=>{
  const actual=await page.evaluate(async()=>{
    const originalFetch=window.fetch,originalAuthFetch=sb.auth.fetch;
    window.fetch=async()=>new Response(JSON.stringify({code:'invalid_credentials',message:'Invalid login credentials'}),{status:400,headers:{'content-type':'application/json','x-supabase-api-version':'2024-01-01'}});
    sb.auth.fetch=(input,init)=>finoraBoundedAuthFetch(input,init,200);
    try{
      const result=await sb.auth.signInWithPassword({email:'fixture@example.test',password:'synthetic-only'});
      return {code:result.error?.code,status:result.error?.status,networkError:isAuthNetworkError(result.error),message:authMsg(result.error)};
    }finally{window.fetch=originalFetch;sb.auth.fetch=originalAuthFetch;}
  });
  expect(actual).toMatchObject({code:'invalid_credentials',status:400,networkError:false});
  expect(actual.message).toContain('ایمیل یا رمز عبور اشتباه است');
});

test('Restoring an expired session retries a stalled Auth body and recovers through the real SDK',async({page})=>{
  const actual=await page.evaluate(async()=>{
    const originalFetch=window.fetch;
    const session={access_token:'synthetic-access',refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'synthetic-restored-user',aud:'authenticated',email:'fixture@example.test',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
    const memory=new Map([['fixture-session',JSON.stringify({...session,expires_at:1})]]);
    let attempts=0,streamController;
    window.fetch=async(input,init)=>{
      attempts++;
      if(attempts>1)return new Response(JSON.stringify(session),{status:200,headers:{'content-type':'application/json'}});
      return new Response(new ReadableStream({start(controller){
        streamController=controller;
        controller.enqueue(new TextEncoder().encode('{"access_token":'));
        init.signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});
      }}),{status:200,headers:{'content-type':'application/json'}});
    };
    const client=new window.supabase.AuthClient({url:'https://fixture.invalid/auth/v1',storageKey:'fixture-session',storage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)},persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,fetch:(input,init)=>finoraBoundedAuthFetch(input,init,60)});
    try{
      return await Promise.race([
        client.getSession().then(({data,error})=>({restored:!!data.session&&!error,userId:data.session?.user?.id})),
        new Promise(resolve=>setTimeout(()=>resolve({restored:false}),1500))
      ]);
    }finally{await client.stopAutoRefresh();streamController.error(new DOMException('Fixture cleanup','AbortError'));window.fetch=originalFetch;}
  });
  expect(actual).toEqual({restored:true,userId:'synthetic-restored-user'});
});

test('Upstream cancellation remains effective while an Auth body is still arriving',async({page})=>{
  const actual=await page.evaluate(async()=>{
    const originalFetch=window.fetch,upstream=new AbortController();
    let streamController;
    window.fetch=async(input,init)=>new Response(new ReadableStream({start(controller){
      streamController=controller;
      init.signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});
    }}),{status:200});
    try{
      const request=finoraBoundedAuthFetch('https://fixture.invalid/auth/v1/token',{signal:upstream.signal},5000).then(response=>response.text());
      setTimeout(()=>upstream.abort(),20);
      return await Promise.race([
        request.then(()=>({cancelled:false}),err=>({cancelled:upstream.signal.aborted&&isAuthNetworkError(err)})),
        new Promise(resolve=>setTimeout(()=>resolve({cancelled:false}),400))
      ]);
    }finally{streamController.error(new DOMException('Fixture cleanup','AbortError'));window.fetch=originalFetch;}
  });
  expect(actual).toEqual({cancelled:true});
});

test('Non-Auth reads retain their streaming response and original cancellation signal',async({page})=>{
  const actual=await page.evaluate(async()=>{
    const originalFetch=window.fetch,upstream=new AbortController();
    let receivedSignal,controller;
    const response=new Response(new ReadableStream({start(value){controller=value;}}),{status:200});
    window.fetch=async(input,init)=>{receivedSignal=init.signal;return response;};
    try{
      const received=await finoraBoundedAuthFetch('https://fixture.invalid/rest/v1/records',{signal:upstream.signal},40);
      return {sameResponse:received===response,sameSignal:receivedSignal===upstream.signal,bodyStillUnread:!received.bodyUsed};
    }finally{controller.close();window.fetch=originalFetch;}
  });
  expect(actual).toEqual({sameResponse:true,sameSignal:true,bodyStillUnread:true});
});

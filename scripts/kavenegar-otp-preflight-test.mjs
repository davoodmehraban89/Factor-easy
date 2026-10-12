import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {KAVENEGAR_TEMPLATE, iranianSmsReceptor, handleFinoraKavenegarSms} from '../supabase/functions/finora-kavenegar-send-sms/handler.mjs';

const signedSecretBytes = new TextEncoder().encode('synthetic-hook-secret-material-that-is-not-live');
const hookSecret='v1,whsec_'+btoa(String.fromCharCode(...signedSecretBytes));
const config={FINORA_KAVENEGAR_OTP_ENABLED:'true',KAVENEGAR_API_KEY:'SYNTHETICAPIKEY1234567890',SEND_SMS_HOOK_SECRET:hookSecret};
const env=(overrides={})=>(key)=>({...config,...overrides})[key]||'';
const event={user:{id:'00000000-0000-4000-8000-000000000001',phone:'+989123456789'},sms:{otp:'123456'}};
const signed=async (payload=event,{ts=Math.floor(Date.now()/1000),id='test_event_123',secretBytes=signedSecretBytes,signatureTamper=false}={})=>{
  const raw=JSON.stringify(payload);
  const cryptoKey=await crypto.subtle.importKey('raw',secretBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new TextEncoder().encode(id+'.'+ts+'.'+raw);
  const signature=new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,bytes));
  const base64=btoa(String.fromCharCode(...signature));
  return new Request('https://functions.invalid/finora-kavenegar-send-sms',{
    method:'POST',
    headers:{'webhook-id':id,'webhook-timestamp':String(ts),'webhook-signature':'v1,'+(signatureTamper?'invalidsignature':base64)},
    body:raw
  });
};
const rejectedNetwork=async()=>{throw new Error('not expected to contact SMS provider');};
let calls=0;
const mockSuccess=async(url,options)=>{
  calls++;
  assert.equal(url,'https://api.kavenegar.com/v1/SYNTHETICAPIKEY1234567890/verify/lookup.json');
  assert.equal(options.method,'POST');
  assert.equal(options.headers['Content-Type'],'application/x-www-form-urlencoded');
  const form=new URLSearchParams(options.body);
  assert.equal(form.get('receptor'),'09123456789');
  assert.equal(form.get('token'),'123456');
  assert.equal(form.get('template'),KAVENEGAR_TEMPLATE);
  assert.equal([...form.keys()].length,3);
  assert.equal(options.signal.aborted,false);
  return Response.json({return:{status:200},entries:{messageid:123}},{status:200});
};
const perform=async(req,{overrides={},fetchImpl=rejectedNetwork}={})=>{
  const response=await handleFinoraKavenegarSms(req,{env:env(overrides),fetchImpl});
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  const raw=await response.text();
  for(const forbidden of ['123456','09123456789',config.KAVENEGAR_API_KEY,hookSecret])assert.ok(!raw.includes(forbidden));
  return {status:response.status,raw};
};
assert.equal(KAVENEGAR_TEMPLATE,'FinoraLogin');
assert.equal(iranianSmsReceptor('+989123456789'),'09123456789');
assert.equal(iranianSmsReceptor('09123456789'),null);
assert.equal(iranianSmsReceptor('+12025550123'),null);
assert.equal((await perform(await signed(),{overrides:{FINORA_KAVENEGAR_OTP_ENABLED:''}})).status,503);
assert.equal((await perform(await signed(),{overrides:{KAVENEGAR_API_KEY:''}})).status,503);
assert.equal((await perform(await signed(),{overrides:{SEND_SMS_HOOK_SECRET:''}})).status,503);
assert.equal((await perform(new Request('https://functions.invalid'),{})).status,405);
const unsigned=new Request('https://functions.invalid',{method:'POST',body:JSON.stringify(event)});
assert.equal((await perform(unsigned)).status,401);
assert.equal((await perform(await signed(event,{signatureTamper:true}))).status,401);
assert.equal((await perform(await signed(event,{ts:Math.floor(Date.now()/1000)-301}))).status,401);
assert.equal((await perform(await signed(event,{ts:Math.floor(Date.now()/1000)+301}))).status,401);
assert.equal((await perform(await signed({user:{phone:'+12025550123'},sms:{otp:'123456'}}))).status,422);
assert.equal((await perform(await signed({user:{phone:'+989123456789'},sms:{otp:'12345'} }))).status,422);
assert.equal((await perform(await signed({user:{phone:'+989123456789'},sms:{otp:'123456%0Aevil'}}))).status,422);
assert.equal((await perform(await signed({user:{phone:'+989123456789'},sms:{otp:123456}}))).status,422);
assert.equal((await perform(await signed(),{fetchImpl:async()=>Response.json({return:{status:411}},{status:200})})).status,502);
assert.equal((await perform(await signed(),{fetchImpl:async()=>Response.json({return:{status:200}},{status:400})})).status,502);
assert.equal((await perform(await signed(),{fetchImpl:async()=>{throw new Error('synthetic network outage')}})).status,502);
assert.equal((await perform(await signed(),{fetchImpl:mockSuccess})).status,200);
assert.equal(calls,1,'real delivery must never occur during preflight tests');
const code=readFileSync('supabase/functions/finora-kavenegar-send-sms/index.ts','utf8');
assert.match(code,/handleFinoraKavenegarSms/);
assert.match(code,/Deno\.serve/);
assert.ok(!code.includes('SERVICE_ROLE_KEY'));
const quality=readFileSync('supabase/functions/finora-kavenegar-send-sms/handler.mjs','utf8');
assert.match(quality,/verifyAuthSmsSignature/);
assert.match(quality,/FINORA_KAVENEGAR_OTP_ENABLED/);
assert.ok(!quality.includes('console.log('));
console.log('PASS: Finora Kavenegar OTP offline preflight: signed request, disabled default, provider errors, phone/token isolation, zero real SMS.');

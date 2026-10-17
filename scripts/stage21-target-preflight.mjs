#!/usr/bin/env node
import fs from 'node:fs';
const denied='FINORA_TEST_TARGET_PRODUCTION_FORBIDDEN';
function localOnly({url,dbUrl,projectRef}){
 if(projectRef!=='local')throw Error(denied);
 for(const raw of [url,dbUrl]){
  const u=new URL(raw);
  if(!['127.0.0.1','localhost'].includes(u.hostname))throw Error(denied);
  if(!['http:','postgres:','postgresql:'].includes(u.protocol))throw Error(denied);
 }
 return true;
}
const base={url:'http://127.0.0.1:54321',dbUrl:'postgresql://postgres@127.0.0.1:54322/postgres',projectRef:'local'};
const cases=[
 {name:'remote-auth-url',target:{...base,url:'https://hcsixhqbyuhpshfwqpjx.supabase.co'},denied:true},
 {name:'remote-project',target:{...base,projectRef:'hcsixhqbyuhpshfwqpjx'},denied:true},
 {name:'remote-db',target:{...base,dbUrl:'postgresql://postgres@db.hcsixhqbyuhpshfwqpjx.supabase.co:5432/postgres'},denied:true},
 {name:'local-cli',target:base,denied:false}
];
const evidence=[];
for(const c of cases){
 let err='';
 try{localOnly(c.target)}catch(e){err=e.message}
 if((err===denied)!==c.denied)throw Error('CANARY_BAD_ASSERTION');
 evidence.push({case:c.name,denied:err===denied,preConnection:true});
}
const phase=process.argv[2];
fs.writeFileSync('stage21-target-evidence.json',JSON.stringify({phase,connections:0,evidence},null,2));
if(phase==='red'){console.error(denied+' INTENTIONAL_RED before any connection');process.exit(21)}
if(phase!=='green')throw Error('Unknown phase');
console.log('STAGE21_TARGET_GREEN all remote targets denied, local allowed, connections=0');

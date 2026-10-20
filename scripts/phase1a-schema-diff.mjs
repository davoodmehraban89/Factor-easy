#!/usr/bin/env node
// Phase 1A: hash-only, read-only production versus locally rebuilt Supabase schema.
import fs from 'node:fs';
const [prodPath,localPath] = process.argv.slice(2);
if (!prodPath || !localPath) throw Error('Usage: node scripts/phase1a-schema-diff.mjs <prod.json> <local.json>');
const prod = JSON.parse(fs.readFileSync(prodPath,'utf8'));
const localRaw = JSON.parse(fs.readFileSync(localPath,'utf8'));
const local = Array.isArray(localRaw) ? localRaw : localRaw.objects;
if (!Array.isArray(prod.objects) || !Array.isArray(local)) throw Error('Invalid catalog payloads');
function unique(xs) {
 const out=new Map();
 for (const x of xs) {
   if (!x.kind || !x.key || !x.hash) throw Error('Malformed fingerprint');
   const k=x.kind+'|'+x.key;
   if(out.has(k)) throw Error('Duplicate catalog object '+k);
   out.set(k,x.hash);
 }
 return out;
}
const live=unique(prod.objects),rebuilt=unique(local);
const onlyLive=[],onlyLocal=[],definitionDrift=[],same=[];
for(const [key,hash] of live) {
 if(!rebuilt.has(key))onlyLive.push(key);
 else if(hash!==rebuilt.get(key))definitionDrift.push(key);
 else same.push(key);
}
for(const key of rebuilt.keys())if(!live.has(key))onlyLocal.push(key);
const sort=a=>a.sort((x,y)=>x.localeCompare(y,'en'));
const result={
 baseline:prod.baseline_repo_sha,prodCount:live.size,localCount:rebuilt.size,
 A_numberingOnly:'Migration-name equivalence must be established separately with source manifest and live history; object hashes cannot prove numbered migration equivalence',
 B_productionOnly:sort(onlyLive),
 C_repositoryOnly:sort(onlyLocal),
 D_sameIdentityDifferentDefinition:sort(definitionDrift),
 sameIdentitySameDefinition:same.length,
 parityVerified:onlyLive.length===0&&onlyLocal.length===0&&definitionDrift.length===0
};
fs.writeFileSync('phase1a-schema-diff.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({prodCount:result.prodCount,localCount:result.localCount,prodOnly:onlyLive.length,repoOnly:onlyLocal.length,changed:definitionDrift.length,matching:same.length,parityVerified:result.parityVerified},null,2));
for(const label of ['B_productionOnly','C_repositoryOnly','D_sameIdentityDifferentDefinition']) {
 console.log('\n'+label+'\n'+result[label].slice(0,100).join('\n'));
}
if(!result.parityVerified)process.exitCode=1;

#!/usr/bin/env node
// Positive manual client compatibility gate: never treat expected RED as GREEN.
import {readFileSync} from 'node:fs';
const file=process.argv[2]||'stage22-evidence.json';
const proof=JSON.parse(readFileSync(file,'utf8'));
const required=new Set([
 'existing-client-draft-with-status-and-number',
 'existing-client-batched-draft-and-lines',
 'existing-client-post-status-transition'
]);
if(proof.mode!=='enforce'||proof.positiveCompatibility!==3)
 throw Error('FINORA_STAGE22_COMPAT_NOT_ENFORCE_OR_NOT_3_OF_3');
for(const scenario of required){
 const matches=(proof.scenarios||[]).filter(x=>x.scenario===scenario&&x.result==='GREEN');
 if(matches.length!==1)throw Error('FINORA_STAGE22_COMPAT_MISSING_OR_RED '+scenario);
}
const db=proof.database||{};
if(db.posted<2||db.posted!==db.balanced||db.posted!==db.unique_numbers||db.audit<db.posted)
 throw Error('FINORA_STAGE22_COMPAT_DATABASE_EVIDENCE_INSUFFICIENT');
console.log('FINORA_STAGE22_POSITIVE_CLIENT_COMPAT_3_OF_3_GREEN db='+JSON.stringify(db));

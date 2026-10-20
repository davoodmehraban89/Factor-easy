#!/usr/bin/env node
// Strict Stage 2.2 baseline comparison; 2026-10-16 READ-ONLY Production snapshot.
// Raw textual function differences are diagnostic ONLY, never counted as parity.
// A PASS REQUIRES identical object identities / non-function hashes AND
// ALL function lexical tokens and SECURITY DEFINER metadata to match.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const baseline='supabase/tests/fixtures/phase1a_production_schema_fingerprints_20261016.json';
const local='stage22-head-baseline-objects.json';
const args=['scripts/phase1a-schema-diff.mjs',baseline,local];
let rawExit=0;
try{execFileSync(process.execPath,args,{stdio:'inherit'});}catch(e){
 rawExit=e.status;
 if(rawExit!==1)throw e;
}
const diff=JSON.parse(fs.readFileSync('phase1a-schema-diff.json','utf8'));
const nonFunctions=diff.D_sameIdentityDifferentDefinition.filter(x=>!x.startsWith('function|'));
const structuralOk=diff.prodCount===1069 && diff.localCount===1069 &&
 diff.B_productionOnly.length===0&&diff.C_repositoryOnly.length===0&&
 nonFunctions.length===0 && [0,1].includes(rawExit);
if(!structuralOk)throw Error('FINORA_STAGE22_STRUCTURAL_PARITY_FAILED '+JSON.stringify({
 prod:diff.prodCount,local:diff.localCount,prodOnly:diff.B_productionOnly,
 localOnly:diff.C_repositoryOnly,nonFunctions,rawExit
}));
fs.writeFileSync('stage22-head-structural-gate.json',JSON.stringify({
 baselineKind:'read-only-2026-10-16-snapshot',structuralPass:true,baselineCount:diff.prodCount,
 rawFunctionDefinitionDrift:diff.D_sameIdentityDifferentDefinition.length,
 warning:'Raw pg_get_functiondef hash mismatches are NOT waived; token and metadata proof required after this step.'
},null,2));
console.log('STAGE22_BASELINE_STRUCTURAL_PASS 1069 objects; raw function-drift count '+
 diff.D_sameIdentityDifferentDefinition.length+' MUST be resolved by token+metadata verifier');

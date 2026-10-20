#!/usr/bin/env node
// Strict FULL parity: a raw function definition hash may differ only if
// token-by-token lexical equality and ALL function metadata are proven.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const structure=read('stage22-head-structural-gate.json');
const raw=read('phase1a-schema-diff.json');
const tokens=read('phase1a-lexical-diff.json');
const classified=read('phase1a-function-classification.json');
const errors=[];
if(structure.structuralPass!==true || structure.baselineCount!==1069)errors.push('STRUCTURE_NOT_PROVED');
if(raw.B_productionOnly.length||raw.C_repositoryOnly.length)errors.push('MISSING_OR_EXTRA_OBJECT');
const nonfunc=raw.D_sameIdentityDifferentDefinition.filter(k=>!k.startsWith('function|'));
if(nonfunc.length)errors.push('NON_FUNCTION_DEFINITION_DIFFERENCE');
if(tokens.production!==154||tokens.local!==154||tokens.exactLexicalTokenMatch!==154)
 errors.push('FUNCTION_COUNT_OR_TOKENS_NOT_IDENTICAL');
if(tokens.bodyMismatch.length||tokens.productionOnly.length||tokens.localOnly.length)
 errors.push('FUNCTION_BODY_OR_IDENTITY_MISMATCH');
if(classified.counts.production!==154||classified.counts.local!==154)
 errors.push('FUNCTION_METADATA_COUNT_MISMATCH');
for(const key of ['metadataChanged','productionOnly','repositoryOnly'])
 if(classified.findings[key]?.length)errors.push('FUNCTION_'+key+'_DIFFERENCE');
if(errors.length)throw Error('FINORA_STAGE22_BASELINE_PARITY_FAILED '+errors.join(','));
const result={pass:true,baseline:'2026-10-16-READ-ONLY-snapshot-NOT-live',objectCount:1069,
 functionCount:154,rawFunctionHashDifferences:raw.D_sameIdentityDifferentDefinition.length,
 exactLexicallyEqualFunctions:154,identicalFunctionMetadata:true,
 identicalNonFunctionObjects:true,limitations:'Snapshot and lexer equality are NOT equivalent to live Production parity or functional authorization tests.'};
fs.writeFileSync('stage22-head-parity-verdict.json',JSON.stringify(result,null,2)+'\n');
console.log('FINORA_STAGE22_STRICT_BASELINE_PARITY_PASS '+JSON.stringify(result));

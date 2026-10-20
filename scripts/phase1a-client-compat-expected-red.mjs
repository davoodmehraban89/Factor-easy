#!/usr/bin/env node
// Separate, strict KNOWN-RED sentinel. Never certify Stage 1 integration.
import {spawnSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
const expected=new Map([
  ['existing-client-draft-with-status-and-number','FINORA_SERVER_ONLY_JOURNAL_FIELDS'],
  ['existing-client-batched-draft-and-lines','FINORA_CHILD_PARENT_NOT_FOUND'],
  ['existing-client-post-status-transition','FINORA_SERVER_ONLY_JOURNAL_FIELDS']
]);
const child=spawnSync(process.execPath,['scripts/phase1a-positive-client-contract.mjs'],{encoding:'utf8',timeout:90000});
process.stdout.write(child.stdout||'');
process.stderr.write(child.stderr||'');
const records=(child.stdout||'').split('\n').flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}});
const cases=records.filter(x=>x.scenario);
const totals=records.find(x=>x.clientContractTotal!==undefined);
const errors=[];
if(child.error)errors.push(String(child.error));
if(child.status!==1)errors.push('positive compatibility contract exit must be 1 for known RED');
if(cases.length!==3||new Set(cases.map(x=>x.scenario)).size!==3)errors.push('expected exactly 3 executed distinct scenarios');
if(!totals||totals.clientContractTotal!==3||totals.passed!==0||totals.failed!==3)errors.push('scenario totals changed');
for(const [name,error] of expected){
  const actual=cases.find(x=>x.scenario===name);
  if(!actual){errors.push('missing scenario '+name);continue}
  if(actual.result!=='RED compatibility failure'||!actual.guardEnforceProved||actual.exit===0||!actual.diagnostic.includes('ERROR:  '+error)){
    errors.push('unexpected result / no enforce proof / changed error for '+name);
  }
}
const summary=[
  '## EXPECTED RED — client compatibility blocked until Stage 2',
  '',
  '**This is not a green client test and does not certify Stage 1 deployment.**',
  '',
  '| Scenario | Expected failure | Actual |',
  '|---|---|---|',
  ...[...expected].map(([name,e])=>{
    const v=cases.find(x=>x.scenario===name);
    return '| '+name+' | '+e+' | '+(v?.diagnostic||'not executed')+' |';
  }),
  '',
  errors.length?'**SENTINEL FAILED:** '+errors.join(' ; '):'**KNOWN EXPECTED RED CONFIRMED: 3/3, authenticated org guard=enforce.**',
  ''
].join('\n');
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
console.log(errors.length?'EXPECTED_RED_SENTINEL_FAILED':'EXPECTED_RED_CONFIRMED_NOT_STAGE1_GREEN');
for(const e of errors)console.error(e);
if(errors.length)process.exitCode=1;

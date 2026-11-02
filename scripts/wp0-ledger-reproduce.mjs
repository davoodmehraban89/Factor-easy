import {withDisposableLedger} from './wp0-ledger-harness.mjs';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
await withDisposableLedger(async c=>{
 const result=c.sql(readFileSync('supabase/tests/wp0_ledger_reproduction.sql','utf8'));
 c.requireSuccess(result,'D1/D2 baseline reproduction');
 const output=result.stdout+result.stderr;
 for(const marker of ['D1_REPRODUCED:','D2_REPRODUCED:','ISOLATION_READ_PASS:']) assert.ok(output.includes(marker),marker);
 mkdirSync('docs/wp0/evidence',{recursive:true});
 writeFileSync('docs/wp0/evidence/ledger-baseline.json',JSON.stringify(c.evidence,null,2)+'\n');
 writeFileSync('docs/wp0/evidence/ledger-reproduction.log',output);
 console.log('BASELINE REPRODUCED: D1 and D2 are vulnerabilities, NOT ledger safety passes. Other-tenant read denied. All fixtures rolled back; disposable container removed.');
});

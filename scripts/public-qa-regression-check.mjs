import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import './build-pages.mjs';

function must(condition,message){if(!condition)throw new Error('Public QA regression: '+message);}

const money=fs.readFileSync('js/money-format.js','utf8');
const sandbox={};
vm.runInNewContext(money+'\n;globalThis.__parseFormattedNumber=parseFormattedNumber;',sandbox,{filename:'js/money-format.js'});
for(const [input,expected] of [['۱۲٫۵',12.5],['۱٬۲۳۴٫۵۶',1234.56],['١٢٫٥',12.5],['12.5',12.5],['1,234.56',1234.56]]){
  const actual=sandbox.__parseFormattedNumber(input);
  must(Object.is(actual,expected),`parseFormattedNumber(${JSON.stringify(input)}) expected ${expected}, got ${actual}`);
}

const built=fs.readFileSync('_site/index.html','utf8');
must(!fs.existsSync('_site/diag.html'),'diag.html must never be present in the deployable artifact');
must(!/script-src[^;]*'unsafe-inline'/i.test(built),'deployable CSP must not allow unsafe-inline scripts');
must(!/\son[a-z]+=/i.test(built),'deployable HTML must not contain inline event handlers');
must(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(built),'deployable HTML must not contain inline script blocks');
for(const tag of [...built.matchAll(/<script[^>]+src="https:\/\/[^\"]+"[^>]*>/gi)].map(m=>m[0]))must(/integrity=/i.test(tag),'external scripts must carry SRI');
for(const file of ['_site/js/generated-event-handlers.js','_site/js/generated-dynamic-handlers.js']){
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  must(check.status===0,`${file} must parse: `+(check.stderr||check.stdout));
}
const selfcheck=fs.readFileSync('js/selfcheck.js','utf8');
must(/version:'1\.0'/.test(selfcheck)&&/\{version:'1\.0',run\}/.test(selfcheck),'FinoraHealth version must remain 1.0');
console.log('Public QA regression invariants: PASS');

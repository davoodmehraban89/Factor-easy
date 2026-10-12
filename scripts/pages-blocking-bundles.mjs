import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

// These are original contiguous, parser-blocking <script> runs in index.html.
// Preserve all CSS boundaries and early CSP/auth binding scripts unchanged.
const groups=[
  {name:'foundation',files:['admin','sync','ui','invoices','print','products','contacts','cheques','expenses','companies','backup','words']},
  {name:'business',files:['patches','idle-and-reports','money-format','projects','invoice-excel-import','purchases','commercial-rnd','operations','payments','accounting']},
  {name:'accounting',files:['accounting-foundation','journal-engine','context-help','accounting-foundation-ui','accounting-foundation-render','journal-ui','document-management','drilldown','phase4-contracting','phase5-domain','phase5-enterprise','phase6-reporting','enterprise-iran','enterprise-iran-v2','selfcheck','ux-hardening-r2']}
];
const localScript=/<script src="(js\/([a-z0-9-]+)\.js(?:\?v=[a-z0-9-]+)?)"><\/script>/gi;

export function bundleFinoraPagesBlockingScripts(originalHtml,outDir){
  let html=originalHtml;
  for(const {name,files} of groups){
    const tags=[...html.matchAll(localScript)];
    const from=tags.find(t=>t[2]===files[0]);
    const last=tags.find(t=>t[2]===files.at(-1));
    if(!from||!last||last.index<from.index)throw new Error('Missing Pages group '+name);
    const segment=html.slice(from.index,last.index+last[0].length);
    const found=[...segment.matchAll(localScript)].map(t=>t[2]);
    if(JSON.stringify(found)!==JSON.stringify(files)||segment.replace(localScript,'').trim())
      throw new Error('Non-contiguous or reordered Pages scripts in '+name);
    const sources=files.map(file=>{
      const filename=path.join(outDir,'js',file+'.js');
      if(!fs.existsSync(filename))throw new Error('Missing Pages JS '+file);
      return fs.readFileSync(filename,'utf8');
    });
    // A classic-script concatenation preserves global declarations and
    // executes each source in its original document order, exactly once.
    const content='// Finora '+name+' Pages-only bundle. Original order.\n'+sources.join('\n;\n');
    new vm.Script(content,{filename:'finora-'+name+'-pages.js'});
    const hash=createHash('sha256').update(content).digest('hex').slice(0,16);
    const file='finora-pages-'+name+'.js';
    fs.writeFileSync(path.join(outDir,'js',file),content);
    html=html.slice(0,from.index)+'<script src="js/'+file+'?v='+hash+'"></script>'+html.slice(last.index+last[0].length);
  }
  return html;
}

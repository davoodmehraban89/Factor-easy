#!/usr/bin/env node
// Additional, non-authoritative analysis of raw pg_proc.prosrc. Do not mistake
// whitespace-stripped hashes for a proof of SQL semantic equivalence.
import fs from 'node:fs';
const prod=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).functions;
const raw=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const local=Array.isArray(raw)?raw:raw.functions;
const byKey=new Map(local.map(x=>[x.key,x]));
const classes={exact:[],whitespaceOnlyCandidate:[],bodyChanged:[],metadataChanged:[],missing:[]};
for(const p of prod){
 const l=byKey.get(p.key);
 if(!l){classes.missing.push(p.key);continue}
 const meta=['config','secdef','volatile','arguments','return'].filter(x=>JSON.stringify(p[x])!==JSON.stringify(l[x]));
 if(meta.length){classes.metadataChanged.push({key:p.key,attributes:meta});continue}
 if(p.exact===l.exact){classes.exact.push(p.key);continue}
 if(p.compact===l.compact){classes.whitespaceOnlyCandidate.push(p.key);continue}
 classes.bodyChanged.push(p.key);
}
const localOnly=local.filter(x=>!prod.some(p=>p.key===x.key)).map(x=>x.key);
const result={counts:{production:prod.length,local:local.length,exact:classes.exact.length,whitespaceOnlyCandidate:classes.whitespaceOnlyCandidate.length,bodyChanged:classes.bodyChanged.length,metadataChanged:classes.metadataChanged.length,missing:classes.missing.length,localOnly:localOnly.length},findings:{whitespaceOnlyCandidate:classes.whitespaceOnlyCandidate,bodyChanged:classes.bodyChanged,metadataChanged:classes.metadataChanged,productionOnly:classes.missing,repositoryOnly:localOnly},warning:'Whitespace removal can conceal differences inside SQL string literals. Candidate means needs contextual review, not parity proven.'};
fs.writeFileSync('phase1a-function-classification.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(classes.bodyChanged.length||classes.metadataChanged.length||classes.missing.length||localOnly.length)process.exitCode=1;

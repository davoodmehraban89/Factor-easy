#!/usr/bin/env node
// Canonical lexical comparison of PL/pgSQL / SQL function bodies.
// Strip only token-separating whitespace and SQL comments; PRESERVE exact
// text inside single/double quotes and dollar-quoted bodies.
import fs from 'node:fs';
export function lex(source){
 const tokens=[]; let i=0;
 while(i<source.length){
  const c=source[i],next=source[i+1];
  if(/\s/u.test(c)){i++;continue}
  if(c==='-'&&next==='-'){i+=2;while(i<source.length&&source[i]!=='\n')i++;continue}
  if(c==='/'&&next==='*'){i+=2;let depth=1;while(i<source.length&&depth){if(source[i]==='/'&&source[i+1]==='*'){depth++;i+=2}else if(source[i]==='*'&&source[i+1]==='/'){depth--;i+=2}else i++}if(depth)throw Error('unclosed SQL comment');continue}
  if(c==="'"){
   const start=i++;const esc=(start>0&&/[eE]/.test(source[start-1])&&(start===1||!/[a-zA-Z_0-9]/.test(source[start-2])));
   let closed=false;
   while(i<source.length){
    if(esc&&source[i]==='\\'){i+=2;continue}
    if(source[i]==="'"){if(source[i+1]==="'"){i+=2;continue}i++;closed=true;break}
    i++;
   }
   if(!closed)throw Error('unclosed SQL string');tokens.push(source.slice(start,i));continue
  }
  if(c==='"'){const start=i++;let closed=false;while(i<source.length){if(source[i]==='"'){if(source[i+1]==='"'){i+=2;continue}i++;closed=true;break}i++}if(!closed)throw Error('unclosed SQL identifier');tokens.push(source.slice(start,i));continue}
  if(c==='$'){
   const tag=source.slice(i).match(/^\$[a-zA-Z_0-9]*\$/)?.[0];
   if(tag){const end=source.indexOf(tag,i+tag.length);if(end<0)throw Error('unclosed dollar quote');tokens.push(source.slice(i,end+tag.length));i=end+tag.length;continue}
  }
  if(/[a-zA-Z_0-9\u0080-\uffff]/u.test(c)){const start=i++;while(i<source.length&&/[a-zA-Z_0-9\u0080-\uffff]/u.test(source[i]))i++;tokens.push(source.slice(start,i));continue}
  tokens.push(c);i++;
 }
 return tokens;
}
export function fingerprint(source){
 const tokens=lex(source);let a=0xcbf29ce484222325n,b=0x84222325cbf29ce4n;const mask=(1n<<64n)-1n;
 for(const t of tokens){for(let i=0;i<t.length;i++){const x=BigInt(t.charCodeAt(i));a=((a^x)*0x100000001b3n)&mask;b=((b^x)*0x100000001b3n)&mask}a=((a^255n)*0x100000001b3n)&mask;b=((b^255n)*0x100000001b3n)&mask}
 return {token_count:tokens.length,lexical_hash:a.toString(16).padStart(16,'0')+b.toString(16).padStart(16,'0')};
}
if(process.argv[1]?.endsWith('phase1a-lexical-compare.mjs')&&process.argv[2]){
 const baseline=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).functions;
 const l=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
 const local=Array.isArray(l)?l:l.functions;
 const map=new Map(local.map(x=>[x.key,fingerprint(x.source)]));
 const missing=[],mismatch=[],same=[];
 for(const p of baseline){const got=map.get(p.key);
  if(!got){missing.push(p.key);continue}
  if(got.lexical_hash===p.lexical_hash&&got.token_count===p.token_count)same.push(p.key);
  else mismatch.push({key:p.key,expected_count:p.token_count,got_count:got.token_count});
 }
 const extra=local.filter(x=>!baseline.some(p=>p.key===x.key)).map(x=>x.key);
 const result={production:baseline.length,local:local.length,exactLexicalTokenMatch:same.length,bodyMismatch:mismatch,productionOnly:missing,localOnly:extra,disclaimer:'Lexical equality ignores only SQL comments and whitespace outside SQL literals. This is not a functional RLS test.'};
 fs.writeFileSync('phase1a-lexical-diff.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
 if(mismatch.length||missing.length||extra.length)process.exitCode=1;
}

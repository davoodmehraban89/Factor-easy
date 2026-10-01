import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'_site');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

for(const name of ['manifest.json','CNAME']){
  const src=path.join(root,name);
  if(fs.existsSync(src))fs.copyFileSync(src,path.join(out,name));
}
for(const dir of ['js','vendor'])fs.cpSync(path.join(root,dir),path.join(out,dir),{recursive:true});

const simpleCall=/^\s*(?:return\s+)?(?:window\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\([^;]*\)\s*;?\s*$/;
let dynamicHandlers=0;
for(const name of fs.readdirSync(path.join(out,'js'))){
  if(!name.endsWith('.js'))continue;
  const file=path.join(out,'js',name);
  let source=fs.readFileSync(file,'utf8');
  source=source.replace(/\s(on[a-z]+)="([^"]*)"/gi,(_,attr,body)=>{
    const event=attr.slice(2).toLowerCase();
    const decoded=body.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    if(!simpleCall.test(decoded))throw new Error(`Unsupported dynamic inline handler in ${name}: ${decoded}`);
    dynamicHandlers++;
    return ` data-finora-dynamic-${event}="${body}"`;
  });
  source=source
    .replace(/getAttribute\((['"])onclick\1\)/g,"getAttribute('data-finora-dynamic-click')")
    .replace(/\[onclick\^=/g,'[data-finora-dynamic-click^=')
    .replace(/\[onclick\*=/g,'[data-finora-dynamic-click*=');
  fs.writeFileSync(file,source);
}

let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const handlers=[];
html=html.replace(/\s(on[a-z]+)="([^"]*)"/gi,(_,attr,body)=>{
  const event=attr.slice(2).toLowerCase();
  const id=handlers.length;
  const decoded=body.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  handlers.push({id,event,body:decoded});
  return ` data-finora-handler-${id}="${event}"`;
});

html=html.replace(
  /<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js"><\/script>/i,
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" integrity="sha512-r22gChDnGvBylk90+2e/ycr3RVrDi8DIOkIGNhJlKfuyQM4tIRAI062MaV8sfjQKYVGjOBaZBOA87z+IhZE9DA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>'
);
html=html.replace(/script-src[^;]*/i,"script-src 'self' https://cdnjs.cloudflare.com");
// frame-ancestors is ignored in meta-delivered CSP and generates a browser error;
// clickjacking protection must be supplied as an HTTP response header by the edge/host.
html=html.replace(/;\s*frame-ancestors 'none'/i,'');
html=html.replace('</body>','<script src="js/generated-event-handlers.js"></script>\n<script src="js/generated-dynamic-handlers.js"></script>\n</body>');

const generated=`// Generated at build time from legacy static inline event attributes.\n(function(){\n${handlers.map(({id,event,body})=>`  {\n    const el=document.querySelector('[data-finora-handler-${id}]');\n    if(el)el.addEventListener(${JSON.stringify(event)},function(event){\n      const result=(function(event){${body}}).call(this,event);\n      if(result===false){event.preventDefault();event.stopPropagation();}\n    });\n  }`).join('\n')}\n})();\n`;

const dynamic=`// CSP-safe dispatcher for simple handlers emitted by runtime renderers.\n(function(){\n  const events=['click','change','input','submit','blur','focus','keydown','keyup'];\n  function splitArgs(text){\n    const out=[];let cur='',quote='',escape=false;\n    for(const ch of text){\n      if(escape){cur+=ch;escape=false;continue;}\n      if(ch==='\\\\'){cur+=ch;escape=true;continue;}\n      if(quote){cur+=ch;if(ch===quote)quote='';continue;}\n      if(ch==='\\"'||ch==="'"){quote=ch;cur+=ch;continue;}\n      if(ch===','){out.push(cur.trim());cur='';continue;}\n      cur+=ch;\n    }\n    if(cur.trim()||text.trim())out.push(cur.trim());\n    return out;\n  }\n  function arg(token,el,event){\n    if(token==='')return undefined;\n    if((token[0]==="'"&&token.at(-1)==="'")||(token[0]==='\\"'&&token.at(-1)==='\\"'))return token.slice(1,-1).replace(/\\\\(['\\"\\\\])/g,'$1');\n    if(token==='this')return el;if(token==='event')return event;if(token==='this.value')return el.value;if(token==='this.checked')return el.checked;if(token==='event.target.value')return event.target?.value;\n    if(token==='true')return true;if(token==='false')return false;if(token==='null')return null;if(token==='undefined')return undefined;\n    if(/^-?\\d+(?:\\.\\d+)?$/.test(token))return Number(token);\n    throw new Error('Unsupported CSP-safe handler argument: '+token);\n  }\n  function invoke(expression,el,event){\n    const text=String(expression||'').trim().replace(/^return\\s+/,'').replace(/;$/,'');\n    const m=text.match(/^((?:window\\.)?[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)\\s*\\((.*)\\)$/);\n    if(!m)throw new Error('Unsupported CSP-safe handler: '+text);\n    const parts=m[1].replace(/^window\\./,'').split('.');let owner=window;\n    for(let i=0;i<parts.length-1;i++)owner=owner?.[parts[i]];\n    const fn=owner?.[parts.at(-1)];if(typeof fn!=='function')throw new Error('Missing CSP-safe handler function: '+m[1]);\n    return fn.apply(el,splitArgs(m[2]).map(x=>arg(x,el,event)));\n  }\n  for(const type of events){\n    document.addEventListener(type,function(event){\n      const el=event.target?.closest?.('[data-finora-dynamic-'+type+']');if(!el)return;\n      const result=invoke(el.getAttribute('data-finora-dynamic-'+type),el,event);\n      if(result===false){event.preventDefault();event.stopPropagation();}\n    },type==='blur'||type==='focus');\n  }\n})();\n`;

if(/<script(?![^>]*\ssrc=)[^>]*>/i.test(html))throw new Error('Built page still contains inline script blocks');
if(/\son[a-z]+=/i.test(html))throw new Error('Built page still contains inline event handlers');
if(/script-src[^;]*'unsafe-inline'/i.test(html))throw new Error('Built page still permits unsafe-inline scripts');
const externalScripts=[...html.matchAll(/<script[^>]+src="https:\/\/[^\"]+"[^>]*>/gi)].map(m=>m[0]);
for(const tag of externalScripts)if(!/integrity=/i.test(tag))throw new Error('Built page contains external script without SRI: '+tag);

fs.writeFileSync(path.join(out,'index.html'),html);
fs.writeFileSync(path.join(out,'js','generated-event-handlers.js'),generated);
fs.writeFileSync(path.join(out,'js','generated-dynamic-handlers.js'),dynamic);
console.log(`Pages artifact built: ${handlers.length} static + ${dynamicHandlers} runtime inline handlers externalized; diag.html intentionally excluded.`);

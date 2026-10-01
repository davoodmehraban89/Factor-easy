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
html=html.replace('</body>','<script src="js/generated-event-handlers.js"></script>\n</body>');

const generated=`// Generated at build time from legacy inline event attributes.\n(function(){\n${handlers.map(({id,event,body})=>`  {\n    const el=document.querySelector('[data-finora-handler-${id}]');\n    if(el)el.addEventListener(${JSON.stringify(event)},function(event){\n      const result=(function(event){${body}}).call(this,event);\n      if(result===false){event.preventDefault();event.stopPropagation();}\n    });\n  }`).join('\n')}\n})();\n`;

if(/<script(?![^>]*\ssrc=)[^>]*>/i.test(html))throw new Error('Built page still contains inline script blocks');
if(/\son[a-z]+=/i.test(html))throw new Error('Built page still contains inline event handlers');
if(/script-src[^;]*'unsafe-inline'/i.test(html))throw new Error('Built page still permits unsafe-inline scripts');
const externalScripts=[...html.matchAll(/<script[^>]+src="https:\/\/[^\"]+"[^>]*>/gi)].map(m=>m[0]);
for(const tag of externalScripts)if(!/integrity=/i.test(tag))throw new Error('Built page contains external script without SRI: '+tag);

fs.writeFileSync(path.join(out,'index.html'),html);
fs.writeFileSync(path.join(out,'js','generated-event-handlers.js'),generated);
console.log(`Pages artifact built: ${handlers.length} inline handlers externalized; diag.html intentionally excluded.`);

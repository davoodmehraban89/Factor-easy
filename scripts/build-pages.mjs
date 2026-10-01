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
html=html.replace(/\s(on(?:click|change|input|submit|blur|focus))="([^"]*)"/gi,(_,attr,body)=>{
  const event=attr.slice(2).toLowerCase();
  const id=handlers.length;
  handlers.push({id,event,body:body.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&')});
  return ` data-finora-handler-${id}="${event}"`;
});

html=html.replace(
  /<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js"><\/script>/i,
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" integrity="sha512-r22gChDnGvBylk90+2e/ycr3RVrDi8DIOkIGNhJlKfuyQM4tIRAI062MaV8sfjQKYVGjOBaZBOA87z+IhZE9DA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>'
);
html=html.replace(/script-src 'self' 'unsafe-inline'/i,"script-src 'self' https://cdnjs.cloudflare.com");
html=html.replace(/\shttps:\/\/cdn\.jsdelivr\.net(?=;)/g,'');
html=html.replace(/;\s*frame-ancestors 'none'/i,'');
html=html.replace('</body>','<script src="js/generated-event-handlers.js"></script>\n</body>');

const generated=`// Generated at build time from legacy inline event attributes.\n(function(){\n${handlers.map(({id,event,body})=>`  {\n    const el=document.querySelector('[data-finora-handler-${id}]');\n    if(el)el.addEventListener(${JSON.stringify(event)},function(event){\n      const result=(function(event){${body}}).call(this,event);\n      if(result===false){event.preventDefault();event.stopPropagation();}\n    });\n  }`).join('\n')}\n})();\n`;

if(/<script(?![^>]*\ssrc=)[^>]*>/i.test(html))throw new Error('Built page still contains inline script blocks');
if(/\son(?:click|change|input|submit|blur|focus)=/i.test(html))throw new Error('Built page still contains inline event handlers');
if(/script-src[^;]*'unsafe-inline'/i.test(html))throw new Error('Built page still permits unsafe-inline scripts');
if(/cdn\.(?:jsdelivr|cloudflare)\.com[^>]*><\/script>/i.test(html)&&!/<script[^>]+cdn\.(?:jsdelivr|cloudflare)\.com[^>]+integrity=/i.test(html))throw new Error('Built page contains CDN script without SRI');

fs.writeFileSync(path.join(out,'index.html'),html);
fs.writeFileSync(path.join(out,'js','generated-event-handlers.js'),generated);
console.log(`Pages artifact built: ${handlers.length} inline handlers externalized; diag.html intentionally excluded.`);

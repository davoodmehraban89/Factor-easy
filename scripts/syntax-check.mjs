import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const dir=path.join(process.cwd(),'js');
const files=fs.readdirSync(dir).filter(name=>name.endsWith('.js')).sort();
let failed=false;
for(const file of files){
  const source=fs.readFileSync(path.join(dir,file),'utf8');
  try{
    new vm.Script(source,{filename:'js/'+file});
    console.log('syntax ok:',file);
  }catch(error){
    failed=true;
    console.error('syntax failed:',file);
    console.error(error.stack||error.message);
  }
}
const scriptsDir=path.join(process.cwd(),'scripts');
const scripts=fs.readdirSync(scriptsDir).filter(name=>name.endsWith('.mjs')).sort();
for(const file of scripts){
  const r=spawnSync(process.execPath,['--check',path.join(scriptsDir,file)],{encoding:'utf8'});
  if(r.status!==0){failed=true;console.error('syntax failed: scripts/'+file);console.error(r.stderr||r.stdout);}
  else console.log('syntax ok: scripts/'+file);
}
if(failed)process.exit(1);
console.log('Syntax passed for '+files.length+' JavaScript modules and '+scripts.length+' MJS test scripts.');

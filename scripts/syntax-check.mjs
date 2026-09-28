import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

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
if(failed)process.exit(1);
console.log('JavaScript syntax passed for '+files.length+' modules.');

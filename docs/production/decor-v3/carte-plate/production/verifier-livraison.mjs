import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const base='docs/production/decor-v3/carte-plate',logs={},steps=[];
for(const [id,dir] of [['complete',base],['pilote',base+'/pilote']]){
 let output='';
 for(const [mode,args] of [['decouper',[dir+'/fresque-plate-maitre.png',dir+'/tuiles']],['verifier',[dir+'/tuiles',dir+'/fresque-plate-maitre.png']]]){
  const result=spawnSync(process.execPath,['scripts/fresque-plate-raccords.mjs',mode,...args],{encoding:'utf8',maxBuffer:4*1024*1024});
  process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
  output+=(result.stdout||'')+(result.stderr||'');steps.push({id,mode,status:result.status});
  if(result.status!==0){
   logs[id]=output;
   fs.writeFileSync(path.join(dir,id==='complete'?'verification-complete.txt':'../verification-pilote.txt'),output);
   fs.writeFileSync(base+'/production/sorties-revision.json',JSON.stringify({...logs,date:new Date().toISOString(),steps},null,2));
   throw new Error('Échec de '+id+' '+mode);
  }
 }
 logs[id]=output;
 fs.writeFileSync(path.join(dir,id==='complete'?'verification-complete.txt':'../verification-pilote.txt'),output);
}
fs.writeFileSync(base+'/production/sorties-revision.json',JSON.stringify({...logs,date:new Date().toISOString(),steps},null,2));

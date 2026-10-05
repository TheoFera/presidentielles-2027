import fs from 'node:fs';
import path from 'node:path';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate');
const a=readPng(path.join(base,'production/fresque-en-cours.png'));
const dir=path.join(base,'production/controle-visuel-raccords');
fs.mkdirSync(dir,{recursive:true});
for(let n=1;n<=18;n++){
 const next=n===18?1:n+1,cut=n*1920;
 const data=Buffer.alloc(800*1080*4);
 for(let y=0;y<1080;y++)for(let x=0;x<800;x++){
  const xx=(cut-400+x)%a.width,p=(y*a.width+xx)*4;
  a.data.copy(data,(y*800+x)*4,p,p+4);
 }
 writePng(path.join(dir,`raccord-${String(n).padStart(2,'0')}-${String(next).padStart(2,'0')}.png`),{width:800,height:1080,data});
}
console.log('18 vues natives de 800 × 1080 px, boucle 18 → 01 comprise.');

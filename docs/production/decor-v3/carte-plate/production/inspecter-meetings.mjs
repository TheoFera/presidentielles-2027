import fs from 'node:fs';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const base='docs/production/decor-v3/carte-plate',a=readPng(base+'/production/fresque-en-cours.png'),dir=base+'/production/controle-meetings';fs.mkdirSync(dir,{recursive:true});
for(const n of [2,5,8,11,14,17]){
 const w=576,h=480,x=(n-1)*1920+672,y=600,data=Buffer.alloc(w*h*4);
 for(let j=0;j<h;j++)a.data.copy(data,j*w*4,((y+j)*a.width+x)*4,((y+j)*a.width+x+w)*4);
 writePng(dir+'/tuile-'+String(n).padStart(2,'0')+'-meeting.png',{width:w,height:h,data});
}
console.log('Six places recadrées à x = 672…1248, sans toucher la fresque.');

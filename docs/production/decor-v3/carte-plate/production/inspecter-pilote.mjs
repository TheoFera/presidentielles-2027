import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const base=path.resolve('docs/production/decor-v3/carte-plate'),a=readPng(path.join(base,'production/fresque-en-cours.png'));
const rects=[{id:'paris-a-porte',x:1060,y:680,w:470,h:400,cx:1294},{id:'paris-b-atelier',x:1920+250,y:680,w:460,h:400,cx:1920+444},{id:'paris-c-qg',x:3840+255,y:680,w:406,h:400,cx:3840+458},{id:'paris-c-institut',x:3840+1222,y:680,w:406,h:400,cx:3840+1425}];
const out=path.join(base,'production/controle-geometrie');fs.mkdirSync(out,{recursive:true});
for(const r of rects){
 const data=Buffer.alloc(r.w*r.h*4);for(let y=0;y<r.h;y++)a.data.copy(data,y*r.w*4,((r.y+y)*a.width+r.x)*4,((r.y+y)*a.width+r.x+r.w)*4);
 writePng(path.join(out,r.id+'.png'),{width:r.w,height:r.h,data});
 const crop=await sharp(data,{raw:{width:r.w,height:r.h,channels:4}}).resize(r.w*2,r.h*2,{kernel:'nearest'}).png().toBuffer();
 const xx=(r.cx-r.x)*2,yy=y=>(y-r.y)*2;
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+r.w*2+'" height="'+r.h*2+'"><g fill="none" stroke="#f000ff" stroke-width="2"><rect x="'+(xx-96)+'" y="'+yy(820)+'" width="192" height="368"/><rect x="'+(xx-258)+'" y="'+yy(764)+'" width="516" height="88"/><path d="M0 '+yy(1004)+'H'+r.w*2+'"/></g></svg>');
 await sharp(crop).composite([{input:svg}]).png().toFile(path.join(out,r.id+'-guide-qa.png'));
}
console.log('4 gros plans du pilote, originaux et repères de contrôle séparés de la peinture.');


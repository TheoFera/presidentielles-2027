// Remplacement opaque de zones locales : aucune interpolation entre deux images.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const p=path.resolve('docs/production/decor-v3/carte-plate/production');
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const file=path.join(p,'recul-obstacles.json'),plan=JSON.parse(fs.readFileSync(file));
const master=path.join(p,'fresque-en-cours.png'),backup=path.join(p,'fresque-avant-recul-obstacles.png');
if(!fs.existsSync(backup))fs.writeFileSync(backup,fs.readFileSync(master));
const original=readPng(backup),a={...original,data:Buffer.from(original.data)},allowed=new Uint8Array(a.width*a.height);
for(const e of plan.retouches){
 const source=path.join(p,'recul-'+e.id+'-generation.png'),normalized=path.join(p,'recul-'+e.id+'-normalisee.png');
 fs.writeFileSync(source,fs.readFileSync(e.generated));
 // Retirer uniquement les éventuelles marges noires uniformes ajoutées par l’outil.
 const raw=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const blackRow=y=>raw.data.subarray(y*raw.info.width*3,(y+1)*raw.info.width*3).every(v=>v<=8);
 let top=0,bottom=raw.info.height;
 while(top<bottom&&blackRow(top))top++;
 while(bottom>top&&blackRow(bottom-1))bottom--;
 await sharp(source).extract({left:0,top,width:raw.info.width,height:bottom-top}).resize(e.width,e.height,{fit:'fill'}).ensureAlpha().png().toFile(normalized);
 const src=readPng(normalized);let changed=0;
 for(const [x,y,w,h] of e.rectangles||[e.rect]){
  if(x<e.left||y<e.top||x+w>e.left+e.width||y+h>e.top+e.height)throw new Error('Masque hors guide : '+e.id);
  for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){
   const q=((j-e.top)*src.width+i-e.left)*4,r=j*a.width+i,d=r*4;
   if(src.data[q+3]!==255)throw new Error('Pixel transparent : '+e.id);
   if(!src.data.subarray(q,q+4).equals(original.data.subarray(d,d+4)))changed++;
   src.data.copy(a.data,d,q,q+4);allowed[r]=1;
  }
 }
 e.pixelsModifies=changed;e.pixelsExterieursIdentiques=true;
 const [x,y,w,h]=e.rect;
 fs.writeFileSync(path.join(p,'retouches','recul-'+e.id+'.json'),JSON.stringify({id:'recul-'+e.id,x,y,w,h,source,appliquee:true,pixelsExterieursIdentiques:true,mode:'Suppression ou recul derrière le passage, remplacement opaque sans fondu'},null,2));
}
let count=0;
for(let i=0;i<allowed.length;i++){
 if(a.data[i*4+3]!==255)throw new Error('Maître transparent.');
 if(!a.data.subarray(i*4,i*4+4).equals(original.data.subarray(i*4,i*4+4))){if(!allowed[i])throw new Error('Pixel extérieur modifié.');count++;}
}
writePng(master,a);
for(const e of plan.retouches)await sharp(master).extract({left:e.left,top:e.top,width:e.width,height:e.height}).png().toFile(path.join(p,'recul-'+e.id+'-apres.png'));
plan.dateApplication=new Date().toISOString();plan.pixelsModifies=count;plan.pixelsExterieursIdentiques=true;plan.pixelsTransparents=0;
fs.writeFileSync(file,JSON.stringify(plan,null,2));
console.log(count+' pixels retouchés ; pixels extérieurs identiques et fresque opaque.');

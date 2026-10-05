// Retouches opaques limitées aux obstacles : aucun fondu, pixels extérieurs conservés.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate'),p=path.join(base,'production');
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const file=path.join(p,'nettoyage-passage.json'),plan=JSON.parse(fs.readFileSync(file));
const master=path.join(p,'fresque-en-cours.png'),backup=path.join(p,'fresque-avant-nettoyage-passage.png');
if(!fs.existsSync(backup))fs.copyFileSync(master,backup);
const original=readPng(backup),a={...original,data:Buffer.from(original.data)};
const allowed=new Uint8Array(a.width*a.height);
for(const e of plan.retouches){
 const id='passage-tuile-'+String(e.tuile).padStart(2,'0'),generated=path.join(p,id+'-generation.png');
 fs.copyFileSync(e.sourceGeneree,generated);
 const normalized=path.join(p,id+'-normalisee.png');
 await sharp(generated).resize(1920,640,{fit:'fill'}).ensureAlpha().png().toFile(normalized);
 const src=readPng(normalized),left=(e.tuile-1)*1920;
 if(e.raffinement){
  const refined=path.join(p,id+'-raffinee.png');
  await sharp(e.raffinement.sourceGeneree).resize(1920,640,{fit:'fill'}).ensureAlpha().png().toFile(refined);
  const extra=readPng(refined);
  for(const [x,y,w,h] of e.raffinement.rectangles)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){
   const q=((j-440)*1920+i)*4;if(extra.data[q+3]!==255)throw new Error('Retouche transparente.');
   extra.data.copy(src.data,q,q,q+4);
  }
  writePng(normalized,src);
 }
 let changed=0;
 for(const [x,y,w,h] of e.rectangles){
  if(x<0||y<440||x+w>1920||y+h>1080)throw new Error('Retouche hors image : '+id);
  for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){
   const q=((j-440)*1920+i)*4,r=j*a.width+left+i,d=r*4;
   if(src.data[q+3]!==255)throw new Error('Transparence interdite.');
   if(!src.data.subarray(q,q+4).equals(original.data.subarray(d,d+4)))changed++;
   src.data.copy(a.data,d,q,q+4);allowed[r]=1;
  }
 }
 e.pixelsModifies=changed;e.pixelsExterieursIdentiques=true;
}
for(const e of plan.raccords||[]){
 const generated=path.join(p,e.id+'-generation.png'),normalized=path.join(p,e.id+'-normalisee.png');
 fs.copyFileSync(e.sourceGeneree,generated);
 await sharp(generated).resize(e.canvasWidth,e.canvasHeight,{fit:'fill'}).ensureAlpha().png().toFile(normalized);
 const src=readPng(normalized);let changed=0;
 for(let j=e.y;j<e.y+e.h;j++)for(let i=e.x;i<e.x+e.w;i++){
  const q=((j-e.canvasTop)*src.width+i-e.canvasLeft)*4,r=j*a.width+i,d=r*4;
  if(src.data[q+3]!==255)throw new Error('Raccord transparent.');
  if(!src.data.subarray(q,q+4).equals(original.data.subarray(d,d+4)))changed++;
  src.data.copy(a.data,d,q,q+4);allowed[r]=1;
 }
 e.pixelsExterieursIdentiques=true;e.pixelsModifies=changed;
 fs.writeFileSync(path.join(p,'retouches',e.id+'.json'),JSON.stringify({...e,source:generated,appliquee:true},null,2));
}
let total=0;
for(let i=0;i<allowed.length;i++){
 if(!a.data.subarray(i*4,i*4+4).equals(original.data.subarray(i*4,i*4+4))){
  if(!allowed[i])throw new Error('Pixel extérieur modifié.');total++;
 }
 if(a.data[i*4+3]!==255)throw new Error('Maître non opaque.');
}
writePng(master,a);
for(const e of plan.retouches){
 const id='passage-tuile-'+String(e.tuile).padStart(2,'0');
 await sharp(master).extract({left:(e.tuile-1)*1920,top:440,width:1920,height:640}).png().toFile(path.join(p,id+'-apres.png'));
 const xs=e.rectangles.map(r=>r[0]),ys=e.rectangles.map(r=>r[1]);
 const x=(e.tuile-1)*1920+Math.min(...xs),y=Math.min(...ys);
 const w=Math.max(...e.rectangles.map(r=>r[0]+r[2]))-Math.min(...xs),h=Math.max(...e.rectangles.map(r=>r[1]+r[3]))-y;
 fs.writeFileSync(path.join(p,'retouches',id+'.json'),JSON.stringify({id,x,y,w,h,source:path.join(p,id+'-generation.png'),appliquee:true,pixelsExterieursIdentiques:true,rectangles:e.rectangles,pixelsModifies:e.pixelsModifies,mode:'Effacement ou recul du pied des objets, masque binaire sans fondu'},null,2));
}
// Les anciens calages sont un historique. Un obstacle supprimé ne doit pas être restauré pour les satisfaire.
const dir=path.join(p,'retouches');
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('-calibrage.json'))){
 const cal=JSON.parse(fs.readFileSync(path.join(dir,f))),id=cal.id||f.slice(0,-'-calibrage.json'.length),mf=path.join(dir,id+'.json');
 if(!fs.existsSync(mf))continue;
 const m=JSON.parse(fs.readFileSync(mf));if(m.appliquee!==true)continue;
 for(const c of cal.cellules||[]){
  if(!['porte','panneau'].includes(c.role))continue;
  const v=c.cible,x=m.x+v.x-m.context,y=m.y+v.y;
  const overlaps=plan.retouches.some(e=>e.rectangles.some(([rx,ry,rw,rh])=>{
   const xx=(e.tuile-1)*1920+rx;return x<xx+rw&&x+v.w>xx&&y<ry+rh&&y+v.h>ry;
  }));
  if(overlaps&&!(cal.cellulesRemplacees||[]).some(r=>r.role===c.role)){
   (cal.cellulesRemplacees??=[]).push({role:c.role,par:'nettoyage-passage',motif:'Suppression d’un obstacle peint devant le passage, selon la précision utilisateur.'});
   fs.writeFileSync(path.join(dir,f),JSON.stringify(cal,null,2));
  }
 }
}
plan.dateApplication=new Date().toISOString();plan.pixelsModifies=total;plan.pixelsExterieursIdentiques=true;plan.pixelsTransparents=0;
fs.writeFileSync(file,JSON.stringify(plan,null,2));
console.log(total+' pixels retouchés dans '+plan.retouches.length+' tuiles ; tous les pixels extérieurs sont identiques.');

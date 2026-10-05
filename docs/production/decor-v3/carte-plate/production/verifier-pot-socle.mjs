import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {readPng} from '../../../../../scripts/lib/png.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate'),p=path.join(base,'production');
const file=path.join(p,'correction-pot-socle.json'),plan=JSON.parse(fs.readFileSync(file));
const master=path.join(p,'fresque-en-cours.png'),a=readPng(master),old=readPng(path.join(p,'fresque-avant-pot-socle.png'));
const names=fs.readdirSync(path.join(base,'tuiles')).filter(f=>/^tuile-\d{2}.*\.png$/.test(f)).sort();
if(names.length!==18)throw new Error('Découpe incomplète.');
for(const[i,name]of names.entries()){
 const runtime=readPng(path.resolve('assets/generated/carte-plate',name));
 for(let y=0;y<1080;y++)if(!a.data.subarray((y*a.width+i*1920)*4,(y*a.width+(i+1)*1920)*4).equals(runtime.data.subarray(y*1920*4,(y+1)*1920*4)))throw new Error('Image du jeu obsolète : '+name);
}
const restoration=JSON.parse(fs.readFileSync(path.join(p,'restauration-vitrines-riches.json'))),protectedAreas=[];
for(const e of restoration.restaurations){
 const m=JSON.parse(fs.readFileSync(path.join(p,'retouches',e.id+'.json'))),src=readPng(e.sourceRestauree);
 const height=e.id==='restauration-riches-b-vitrine'?plan.zoneProtegeeRichesB.h:e.hauteur;
 for(let y=0;y<height;y++){
  const reference=src.data.subarray((y*src.width+m.context)*4,(y*src.width+m.context+m.w)*4);
  const now=a.data.subarray(((m.y+y)*a.width+m.x)*4,((m.y+y)*a.width+m.x+m.w)*4);
  if(!reference.equals(now))throw new Error('Vitrine modifiée dans la zone protégée : '+e.id);
 }
 protectedAreas.push({id:e.id,x:m.x,y:m.y,w:m.w,h:height,pixelsOriginauxIdentiques:true,socleRepris:e.id==='restauration-riches-b-vitrine'});
}
function region(im,left){const data=Buffer.alloc(800*1080*4);for(let y=0;y<1080;y++)for(let x=0;x<800;x++){const xx=(left+x+im.width)%im.width,q=(y*im.width+xx)*4;im.data.copy(data,(y*800+x)*4,q,q+4);}return data;}
const joints=Array.from({length:18},(_,i)=>({gauche:i+1,droite:i===17?1:i+2,identiqueAvantCorrection:region(a,(i+1)*1920-400).equals(region(old,(i+1)*1920-400))}));
plan.verification={date:new Date().toISOString(),copiesDuJeuIdentiquesAuMaitre:true,vitrinesProtegees:protectedAreas,raccords:joints,sha256Maitre:crypto.createHash('sha256').update(fs.readFileSync(master)).digest('hex'),limite:'Riches B : pixels d’origine conservés au-dessus de y = 1 004 ; seul le socle et le pavage en dessous sont repris. Le contrôle de pixels ne suffit pas à valider la qualité artistique.'};
for(const e of plan.retouches){e.generatedOriginal??=e.generated;e.generated=path.join(p,'correction-'+e.id+'-generation.png');}
fs.writeFileSync(file,JSON.stringify(plan,null,2));
console.log('18 images du jeu synchronisées ; vitrines originales protégées ; seul le socle de Riches B est repris.');
console.log('Raccords modifiés : '+joints.filter(j=>!j.identiqueAvantCorrection).map(j=>j.gauche+'→'+j.droite).join(', '));

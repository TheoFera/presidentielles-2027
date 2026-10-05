// Vérification des copies du jeu, des vitrines restaurées et des raccords réellement modifiés.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {readPng} from '../../../../../scripts/lib/png.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate'),p=path.join(base,'production');
const a=readPng(path.join(p,'fresque-en-cours.png')),old=readPng(path.join(p,'fresque-avant-nettoyage-passage.png'));
const plan=JSON.parse(fs.readFileSync(path.join(p,'nettoyage-passage.json')));
const tiles=fs.readdirSync(path.join(base,'tuiles')).filter(f=>/^tuile-\d{2}.*\.png$/.test(f)).sort();
const changedTiles=[];
for(const [i,f] of tiles.entries()){
 const runtime=readPng(path.resolve('assets/generated/carte-plate',f)),left=i*1920;
 let changed=false;
 for(let y=0;y<1080;y++){
  const row=a.data.subarray((y*a.width+left)*4,(y*a.width+left+1920)*4);
  if(!row.equals(runtime.data.subarray(y*1920*4,(y+1)*1920*4)))throw new Error('Image du jeu obsolète : '+f);
  if(!row.equals(old.data.subarray((y*a.width+left)*4,(y*a.width+left+1920)*4)))changed=true;
 }
 if(changed)changedTiles.push(i+1);
}
if(tiles.length!==18)throw new Error('Découpe incomplète.');
const restoration=JSON.parse(fs.readFileSync(path.join(p,'restauration-vitrines-riches.json')));
for(const e of restoration.restaurations){
 const m=JSON.parse(fs.readFileSync(path.join(p,'retouches',e.id+'.json'))),src=readPng(e.sourceRestauree);
 for(let y=0;y<e.hauteur;y++){
  const original=src.data.subarray((y*src.width+m.context)*4,(y*src.width+m.context+m.w)*4);
  const now=a.data.subarray(((m.y+y)*a.width+m.x)*4,((m.y+y)*a.width+m.x+m.w)*4);
  if(!original.equals(now))throw new Error('Vitrine restaurée modifiée : '+e.id);
 }
}
function window(im,left){
 const data=Buffer.alloc(800*1080*4);
 for(let y=0;y<1080;y++)for(let x=0;x<800;x++){
  const xx=(left+x+im.width)%im.width,q=(y*im.width+xx)*4;
  im.data.copy(data,(y*800+x)*4,q,q+4);
 }
 return data;
}
const joints=[];
for(let n=1;n<=18;n++){
 const next=n===18?1:n+1,left=n*1920-400;
 joints.push({gauche:n,droite:next,identiqueAvantNettoyage:window(a,left).equals(window(old,left))});
}
plan.verification={date:new Date().toISOString(),tuilesModifiees:changedTiles,tuilesInchangees:18-changedTiles.length,
 copiesDuJeuIdentiquesAuMaitre:true,troisVitrinesOriginalesConserveesAuPixelPres:true,raccords:joints,
 sha256Maitre:crypto.createHash('sha256').update(fs.readFileSync(path.join(p,'fresque-en-cours.png'))).digest('hex'),
 limite:'Les contrôles de pixels ne détectent pas un objet ou un défaut artistique ; les vues ont été inspectées séparément.'};
fs.writeFileSync(path.join(p,'nettoyage-passage.json'),JSON.stringify(plan,null,2));
console.log('18 images du jeu identiques au maître ; 3 vitrines originales conservées au pixel près ; '+changedTiles.length+' tuiles modifiées.');
console.log('Raccords à réinspecter : '+joints.filter(j=>!j.identiqueAvantNettoyage).map(j=>j.gauche+'→'+j.droite).join(', '));

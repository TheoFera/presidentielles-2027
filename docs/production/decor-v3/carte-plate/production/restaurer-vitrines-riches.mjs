// Restaure les sources avant calage ; copie opaque, sans redessiner ni déformer les façades.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate'),dir=path.join(base,'production/retouches');
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
fs.copyFileSync(path.join(base,'production/fresque-en-cours.png'),path.join(base,'production/fresque-avant-restauration-vitrines-riches.png'));
const items=[
 {id:'restauration-riches-b-vitrine',ancien:'riches-b-rdc-dessin',source:'riches-b-rdc-dessin-avant.png',normaliser:false,hauteur:440},
 {id:'restauration-riches-c-cabinet',ancien:'riches-c-cabinet-distinct',source:'riches-c-cabinet-distinct-generation.png',normaliser:true,hauteur:344},
 {id:'restauration-riches-c-institut',ancien:'riches-c-institut-distinct',source:'riches-c-institut-distinct-generation.png',normaliser:true,hauteur:344},
];
for(const e of items){
 const m=JSON.parse(fs.readFileSync(path.join(dir,e.id+'.json'))),old=JSON.parse(fs.readFileSync(path.join(dir,e.ancien+'.json')));
 const src=path.join(dir,e.source),native=path.join(dir,e.id+'-source-native.png');
 if(e.normaliser)await sharp(src).resize(old.canvasWidth,old.canvasHeight,{fit:'fill'}).ensureAlpha().png().toFile(native);
 else fs.copyFileSync(src,native);
 const source=readPng(native),dest=readPng(m.guide);
 const sourceX=m.x-(old.x-old.context),sourceY=m.y-old.y;
 for(let y=0;y<e.hauteur;y++)for(let x=0;x<m.w;x++){
  const p=((sourceY+y)*source.width+sourceX+x)*4,q=(y*dest.width+m.context+x)*4;
  if(source.data[p+3]!==255)throw new Error('Source non opaque.');
  source.data.copy(dest.data,q,p,p+4);
 }
 const sortie=path.join(dir,e.id+'-source-restauree.png');writePng(sortie,dest);
 m.replaceTop=0;m.replaceHeight=e.hauteur;fs.writeFileSync(path.join(dir,e.id+'.json'),JSON.stringify(m,null,2));
 e.sourceOriginale=src;e.sourceRestauree=sortie;e.pixelsOriginauxConservesSansDeformation=true;
}
fs.writeFileSync(path.join(base,'production/restauration-vitrines-riches.json'),JSON.stringify({date:new Date().toISOString(),methode:'Restauration des sources originales avant calage, sans fondu. Les vitrines et panneaux gardent leurs proportions. Le sol en dessous de la retouche est conservé.',restaurations:items},null,2));
console.log('Trois sources naturelles préparées ; aucun nouveau dessin ni calage par cellules.');


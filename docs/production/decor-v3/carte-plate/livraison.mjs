// Export des fichiers définitifs et mesures, sans retoucher les images.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../scripts/lib/png.mjs';
import {plateTiles} from '../../../../scripts/fresque-plate-gabarits.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate');
const source=path.join(base,'production/fresque-en-cours.png');
const master=path.join(base,'fresque-plate-maitre.png');
const asset=path.resolve('assets/generated/masters/fresque-plate-maitre.png');
const pilot=path.join(base,'pilote/fresque-plate-maitre.png');
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const tiles=plateTiles(JSON.parse(fs.readFileSync('Présidentielles 2027/world_layout.json','utf8')));
const a=readPng(source);
if(a.width!==34560||a.height!==1080)throw new Error('Fresque incomplète.');
let transparent=0,topWrong=0;
for(let p=0;p<a.width*a.height;p++){
  const i=p*4;if(a.data[i+3]!==255)transparent++;
  if(p<a.width*64&&(a.data[i]!==159||a.data[i+1]!==207||a.data[i+2]!==238))topWrong++;
}
if(transparent||topWrong)throw new Error(`Transparence ${transparent}, pixels de bande supérieure incorrects ${topWrong}.`);
fs.mkdirSync(path.dirname(asset),{recursive:true});
fs.copyFileSync(source,master);fs.copyFileSync(source,asset);
function crop(left,width){const data=Buffer.alloc(width*a.height*4);for(let y=0;y<a.height;y++)a.data.copy(data,y*width*4,(y*a.width+left)*4,(y*a.width+left+width)*4);return{width,height:a.height,data};}
writePng(pilot,crop(0,5760));
const preview=[];
for(const t of tiles){
  const im=crop(t.masterLeft,1920);
  const thumb=await sharp(im.data,{raw:{width:1920,height:1080,channels:4}}).resize(640,360).png().toBuffer();
  const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="36"><rect width="640" height="36" fill="#173444"/><text x="16" y="25" font-family="Arial" font-size="21" fill="#fff">${t.number} — ${t.name}</text></svg>`);
  const x=(t.index%3)*640,y=Math.floor(t.index/3)*396;
  preview.push({input:label,left:x,top:y},{input:thumb,left:x,top:y+36});
}
await sharp({create:{width:1920,height:2376,channels:3,background:'#173444'}}).composite(preview).removeAlpha().png().toFile(path.join(base,'vue-carte-complete.png'));
const extensions=JSON.parse(fs.readFileSync(path.join(base,'production/generations.json'),'utf8')).extensions;
const edits=fs.readdirSync(path.join(base,'production/retouches')).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(base,'production/retouches',f),'utf8'))).filter(m=>m.source&&Number.isInteger(m.x)&&Number.isInteger(m.y)&&Number.isInteger(m.w)&&Number.isInteger(m.h)&&m.appliquee!==false);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const report={date:new Date().toISOString(),largeur:a.width,hauteur:a.height,tuiles:18,pixelsTransparents:transparent,pixelsBandeSuperieureNonConformes:topWrong,couleurBandeSuperieure:'#9FCFEE',hauteurBandeSuperieure:64,maitres:[master,asset].map(f=>({fichier:path.relative(process.cwd(),f).replaceAll('\\','/'),sha256:hash(f)})),pilote:{fichier:path.relative(process.cwd(),pilot).replaceAll('\\','/'),largeur:5760,hauteur:1080,sha256:hash(pilot)},extensionsConservantLesPixels:extensions.every(e=>e.pixelsPrecedentsIdentiques),retouchesConservantLesPixelsExterieurs:edits.every(e=>e.pixelsExterieursIdentiques),nombreRetouches:edits.length,limite:'Ces mesures valident le format, les pixels conservés et la bande supérieure. Elles ne valident pas la géométrie des portes, le sol, le storyboard ni tous les bords des retouches.'};
fs.writeFileSync(path.join(base,'audit-livraison.json'),JSON.stringify(report,null,2)+'\n');
console.log('Fresque complète, copie pour les assets, pilote actualisé, aperçu et audit produits.');
console.log(`34 560 × 1 080 px ; 0 pixel transparent ; 0 pixel incorrect dans les 64 lignes supérieures.`);

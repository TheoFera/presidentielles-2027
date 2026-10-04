// Vues de contrôle uniquement : aucun repère ajouté aux images du jeu.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
import {plateTiles} from '../../../../../scripts/fresque-plate-gabarits.mjs';
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const base=path.resolve('docs/production/decor-v3/carte-plate'),out=path.join(base,'production/controle-geometrie'),a=readPng(path.join(base,'production/fresque-en-cours.png'));
const tiles=plateTiles(JSON.parse(fs.readFileSync('Présidentielles 2027/world_layout.json','utf8'))),index=[];
fs.mkdirSync(out,{recursive:true});
for(const t of tiles)for(const [i,b] of t.buildings.entries()){
 const w=600,h=420,x=t.masterLeft+b.x-w/2,y=660,id='tuile-'+t.number+'-entree-'+(i+1),data=Buffer.alloc(w*h*4);
 for(let j=0;j<h;j++)a.data.copy(data,j*w*4,((y+j)*a.width+x)*4,((y+j)*a.width+x+w)*4);
 const file=path.join(out,id+'.png');writePng(file,{width:w,height:h,data});
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420"><g fill="none" stroke="#f000ff" stroke-width="1"><rect x="252" y="160" width="96" height="184"/><rect x="171" y="104" width="258" height="44"/><path d="M0 344H600"/></g></svg>');
 await sharp(data,{raw:{width:w,height:h,channels:4}}).composite([{input:svg}]).png().toFile(path.join(out,id+'-guide-qa.png'));
 index.push({tuile:t.number,nom:t.name,entree:i+1,centreX:b.x,fichier:path.relative(base,file).replaceAll('\\','/')});
}
fs.writeFileSync(path.join(out,'index-entrees.json'),JSON.stringify(index,null,2));
console.log(index.length+' entrées inspectables avec repères séparés des tuiles livrées.');

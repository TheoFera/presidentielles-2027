// Assemble une retouche peinte dans un candidat encore non publié, sans toucher les portes/panneaux calés.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const [parent,id,source]=process.argv.slice(2),base=path.resolve('docs/production/decor-v3/carte-plate/production/retouches');
const m=JSON.parse(fs.readFileSync(path.join(base,id+'.json'))),cal=JSON.parse(fs.readFileSync(path.join(base,parent+'-calibrage.json'))),file=path.join(base,parent+'-calibree.png');
const a=readPng(file),before=Buffer.from(a.data),raw=path.join(base,id+'-generation.png'),norm=path.join(base,id+'-normalisee.png');
fs.copyFileSync(source,raw);await sharp(raw).resize(m.canvasWidth,m.canvasHeight,{fit:'cover',position:'centre'}).ensureAlpha().png().toFile(norm);
const b=readPng(norm),x=m.context+(m.replaceLeft||0),y=m.replaceTop||0,w=m.replaceWidth||m.w,h=m.replaceHeight||m.h;
for(const c of cal.cellules.filter(c=>['porte','panneau'].includes(c.role))){const v=c.cible;if(x<v.x+v.w&&x+w>v.x&&y<v.y+v.h&&y+h>v.y)throw new Error('La bande touche un rectangle calé.');}
for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const p=(j*a.width+i)*4;if(b.data[p+3]!==255)throw new Error('Transparence.');b.data.copy(a.data,p,p,p+4);}
for(let j=0;j<a.height;j++){
 const row=j*a.width*4;
 if(j<y||j>=y+h){if(!a.data.subarray(row,row+a.width*4).equals(before.subarray(row,row+a.width*4)))throw new Error('Pixel extérieur modifié.');}
 else for(const [l,r] of [[0,x],[x+w,a.width]])if(!a.data.subarray(row+l*4,row+r*4).equals(before.subarray(row+l*4,row+r*4)))throw new Error('Pixel extérieur modifié.');
}
const backup=path.join(base,parent+'-calibree-avant-'+id+'.png');if(!fs.existsSync(backup))writePng(backup,{width:a.width,height:a.height,data:before});
writePng(file,a);m.source=raw;m.appliquee=false;m.integreeDansCandidat=parent;m.pixelsExterieursIdentiques=true;m.rectangle={x,y,w,h};fs.writeFileSync(path.join(base,id+'.json'),JSON.stringify(m,null,2));
console.log('Bande opaque intégrée dans '+parent+' ; portes, panneaux et pixels extérieurs identiques.');

// Calage d'un résultat ImageGen : cellules opaques adjacentes, pixels hors cellules conservés.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const [file,generation]=process.argv.slice(2),p=JSON.parse(fs.readFileSync(file)),base=path.resolve('docs/production/decor-v3/carte-plate/production/retouches'),id=p.id;
const meta=JSON.parse(fs.readFileSync(path.join(base,id+'.json'))),author=path.join(base,id+'-generation.png'),norm=path.join(base,id+'-auteur-normalisee.png');
if(path.resolve(generation)!==author)fs.copyFileSync(generation,author);
await sharp(author).resize(meta.canvasWidth,meta.canvasHeight,{fit:'cover',position:'centre'}).ensureAlpha().png().toFile(norm);
const a=readPng(norm),source=Buffer.from(a.data),written=new Uint8Array(a.width*a.height),cells=[];
async function cell(sx,sy,sw,sh,dx,dy,dw,dh,role,fit='fill'){
 const b=Buffer.alloc(sw*sh*4);for(let y=0;y<sh;y++)source.copy(b,y*sw*4,((sy+y)*a.width+sx)*4,((sy+y)*a.width+sx+sw)*4);
 const data=await sharp(b,{raw:{width:sw,height:sh,channels:4}}).resize(dw,dh,{fit,position:'centre'}).raw().toBuffer();
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){const i=(dy+y)*a.width+dx+x,j=(y*dw+x)*4;
  if(written[i])throw new Error('Superposition de cellules.');if(data[j+3]!==255)throw new Error('Transparence.');written[i]=1;data.copy(a.data,i*4,j,j+4);}
 cells.push({source:{x:sx,y:sy,w:sw,h:sh},cible:{x:dx,y:dy,w:dw,h:dh},role,fit});
}
if(p.cells){for(const c of p.cells)await cell(...c.source,...c.target,c.role,c.fit||'fill');}
else{
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)await cell(p.header.sx[i],p.header.sy[j],p.header.sx[i+1]-p.header.sx[i],p.header.sy[j+1]-p.header.sy[j],p.header.dx[i],p.header.dy[j],p.header.dx[i+1]-p.header.dx[i],p.header.dy[j+1]-p.header.dy[j],i===1&&j===1?'panneau':'encadrement');
  for(let i=0;i<3;i++)await cell(p.body.sx[i],p.body.sy[0],p.body.sx[i+1]-p.body.sx[i],p.body.sy[1]-p.body.sy[0],p.body.dx[i],p.body.dy[0],p.body.dx[i+1]-p.body.dx[i],p.body.dy[1]-p.body.dy[0],i===1?'porte':'vitrine',i===1?'fill':(p.body.fit||'fill'));
  await cell(...p.ground.source,...p.ground.target,'trottoir et chaussée');
}
for(let i=0;i<written.length;i++)if(!written[i]&&!a.data.subarray(i*4,i*4+4).equals(source.subarray(i*4,i*4+4)))throw new Error('Pixel hors cellule modifié.');
const out=path.join(base,id+'-calibree.png');writePng(out,a);
const frame=role=>{const found=cells.find(c=>c.role===role);if(!found)return null;const c=found.cible;return {...c,xDansTuile:meta.x-p.tileLeft+c.x-meta.context,yDansFresque:meta.y+c.y,centreX:meta.x-p.tileLeft+c.x-meta.context+c.w/2,bas:meta.y+c.y+c.h};};
const report={id,auteur:author,sortie:out,profil:path.resolve(file),cellules:cells,porte:frame('porte'),panneau:frame('panneau'),superpositions:0,pixelsNonOpaques:0,pixelsHorsCellulesConserves:true,limite:'Calage des cellules exact ; contours artistiques et raccords à vérifier sur le rendu.'};
fs.writeFileSync(path.join(base,id+'-calibrage.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({id,porte:report.porte,panneau:report.panneau,superpositions:0,pixelsNonOpaques:0}));


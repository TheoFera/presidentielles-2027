// Mise à dimension du résultat généré : cellules adjacentes opaques, aucun mélange d'images.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const base=path.resolve('docs/production/decor-v3/carte-plate/production/retouches'),id='paris-a-rdc-calage';
const generation=process.argv[2]||path.join(base,id+'-generation.png'),normalisee=path.join(base,id+'-auteur-normalisee.png');
fs.copyFileSync(generation,path.join(base,id+'-generation.png'));
await sharp(generation).resize(992,480,{fit:'cover',position:'centre'}).ensureAlpha().png().toFile(normalisee);
const a=readPng(normalisee),source=Buffer.from(a.data),written=new Uint8Array(a.width*a.height),cells=[];
async function cell(sx,sy,sw,sh,dx,dy,dw,dh,role){
 const input=Buffer.alloc(sw*sh*4);for(let y=0;y<sh;y++)source.copy(input,y*sw*4,((sy+y)*a.width+sx)*4,((sy+y)*a.width+sx+sw)*4);
 const data=await sharp(input,{raw:{width:sw,height:sh,channels:4}}).resize(dw,dh,{fit:'fill'}).raw().toBuffer();
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){const p=(dy+y)*a.width+dx+x,q=(y*dw+x)*4;
  if(written[p])throw new Error('Deux cellules se superposent.');written[p]=1;if(data[q+3]!==255)throw new Error('Pixel non opaque.');data.copy(a.data,p*4,q,q+4);}
 cells.push({source:{x:sx,y:sy,w:sw,h:sh},cible:{x:dx,y:dy,w:dw,h:dh},role});
}
const colsHeader=[[260,326,260,337],[326,599,337,595],[599,648,595,648]];
const rowsHeader=[[133,151,135,164],[151,186,164,208],[186,201,208,220]];
for(const [sx,ex,dx,fx] of colsHeader)for(const [sy,ey,dy,fy] of rowsHeader)await cell(sx,sy,ex-sx,ey-sy,dx,dy,fx-dx,fy-dy,sx===326&&sy===151?'panneau':'encadrement du panneau');
for(const [sx,ex,dx,fx] of [[260,432,260,418],[432,523,418,514],[523,648,514,648]])await cell(sx,201,ex-sx,197,dx,220,fx-dx,184,sx===432?'porte':'vitrine latérale');
await cell(260,407,388,73,260,404,388,76,'trottoir et chaussée');
const out=path.join(base,id+'-calibree.png');writePng(out,a);
const report={source:path.join(base,id+'-generation.png'),sortie:out,cellules:cells,superpositions:0,pixelsNonOpaques:0,porte:{cadre:{x:418,y:220,w:96,h:184},centreDansTuile:1084+466-256,hautDansFresque:600+220,piedDansFresque:600+404},panneau:{cadre:{x:337,y:164,w:258,h:44},centreDansTuile:1084+466-256,hautDansFresque:600+164,basDansFresque:600+208},solDansFresque:1004,limite:'Les dimensions des cellules et leur placement sont exacts. Inspection visuelle nécessaire : le contour artistique interne à une cellule peut conserver une bordure ; la continuité avec le reste de la fresque n’est pas prouvée par cette mesure.'};
fs.writeFileSync(path.join(base,id+'-calibrage.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));


// Mesures de l'aplat coloré des portes et panneaux d'un essai, sans toucher à l'art.
// Le contour de l'aplat n'est pas une preuve de la dimension extérieure de l'huisserie.
import fs from 'node:fs';
import path from 'node:path';
import {readPng} from '../../../../../scripts/lib/png.mjs';
import {seamScore} from '../../../../../scripts/fresque-plate-raccords.mjs';
import {plateTiles} from '../../../../../scripts/fresque-plate-gabarits.mjs';
const dir=path.resolve('docs/production/decor-v3/carte-plate/production/retouches');
const id=process.argv[2]||'paris-c-geometrie';
const tiles=plateTiles(JSON.parse(fs.readFileSync('Présidentielles 2027/world_layout.json','utf8'))),tileIndex=Number(process.argv[3]||3)-1,t=tiles[tileIndex];
const a=readPng(path.join(dir,`${id}-normalisee.png`));
function region(cx,cy,w,h,tol){
  const x0=Math.max(0,cx-Math.floor(w/2)),y0=Math.max(0,cy-Math.floor(h/2)),x1=Math.min(a.width,x0+w),y1=Math.min(a.height,y0+h);
  const p0=(cy*a.width+cx)*4,seed=[...a.data.subarray(p0,p0+3)],seen=new Set(),queue=[[cx,cy]];
  let left=cx,right=cx,top=cy,bottom=cy;
  while(queue.length){const [x,y]=queue.pop(),p=y*a.width+x;if(x<x0||x>=x1||y<y0||y>=y1||seen.has(p))continue;seen.add(p);
    const i=p*4;if(seed.some((c,k)=>Math.abs(a.data[i+k]-c)>tol))continue;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    queue.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
  }
  return{couleurEchantillon:seed,gauche:left,droite:right,haut:top,bas:bottom,largeur:right-left+1,hauteur:bottom-top+1,centreX:(left+right)/2};
}
const measures=t.buildings.map(b=>b.x+256).map(cx=>({centreAttenduDansCadre:cx,centreAttenduDansTuile:cx-256,porte:{attendu:{haut:820,bas:1003,largeur:96,hauteur:184},aplatObserve:region(cx,910,240,220,15)},panneau:{attendu:{haut:764,bas:807,largeur:258,hauteur:44},aplatObserve:region(cx,785,360,100,22)}}));
const candidate={width:1920,height:1080,data:Buffer.alloc(1920*1080*4)};
for(let y=0;y<1080;y++)a.data.copy(candidate.data,y*1920*4,(y*a.width+256)*4,(y*a.width+2176)*4);
const prev=readPng(path.join(dir,'../../tuiles',tiles[(tileIndex+17)%18].file)),next=readPng(path.join(dir,'../../tuiles',tiles[(tileIndex+1)%18].file));
const report={image:a.width+' × '+a.height,mesures:measures,raccordsProposition:{gauche:seamScore(prev,candidate),droite:seamScore(candidate,next)},limite:'Mesures des aplats connectés, pas des contours artistiques extérieurs ; la conformité au pixel près exige une inspection des huisseries. Aucun seuil du vérificateur officiel modifié.'};
fs.writeFileSync(path.join(dir,`${id}-mesures.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

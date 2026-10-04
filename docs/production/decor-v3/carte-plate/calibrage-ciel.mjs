// Calibrage opaque des couleurs du ciel spécifiées par le cahier.
// Aucune interpolation entre deux images, aucune couche alpha, aucune déformation.
import fs from 'node:fs';
import path from 'node:path';
import {readPng,writePng} from '../../../../scripts/lib/png.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate/production'),file=path.join(base,'fresque-en-cours.png');
const a=readPng(file),{width:W,height:H,data}=a,visited=new Uint8Array(W*H),queue=new Uint32Array(W*H);
const candidate=p=>{const i=p*4,r=data[i],g=data[i+1],b=data[i+2],y=Math.floor(p/W);return (r>=90||(y<420&&r>=45))&&g>=180&&b>=220&&g-r>=12&&b-g>=3;};
const traverse=p=>{const i=p*4,r=data[i],g=data[i+1],b=data[i+2];return candidate(p)||(r>=175&&g>=180&&b>=185&&r<=g+8&&b>=g-5);};
let first=0,last=0;
for(let x=0;x<W;x++){const p=64*W+x;if(candidate(p)){visited[p]=1;queue[last++]=p;}}
while(first<last){const p=queue[first++],x=p%W,y=Math.floor(p/W);
  for(const q of [x?p-1:-1,x<W-1?p+1:-1,y>64?p-W:-1,y<H-1?p+W:-1])if(q>=0&&!visited[q]&&traverse(q)){visited[q]=1;queue[last++]=q;}}
const backup=path.join(base,'fresque-avant-calibrage-ciel.png');if(!fs.existsSync(backup))fs.copyFileSync(file,backup);
let count=0;for(let y=0;y<H;y++){const t=Math.max(0,Math.min(1,(y-64)/640)),c=[Math.round(159+69*t),Math.round(207+34*t),Math.round(238+8*t)];
  for(let x=0;x<W;x++){const p=y*W+x;if(y<64||(visited[p]&&candidate(p))){const i=p*4;data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];data[i+3]=255;count++;}}}
const temp=path.join(base,'fresque-ciel-calibre.png');writePng(temp,a);fs.renameSync(temp,file);
fs.writeFileSync(path.join(base,'calibrage-ciel.json'),JSON.stringify({pixels:count,methode:'Aplats opaques dans le ciel bleu connecté au haut ; couleurs chiffrées du cahier ; nuages et éléments figuratifs conservés sauf bande supérieure imposée.',bleuHaut:'#9FCFEE',horizon:'#E4F1F6',hauteurBandeUnie:64,fondu:false,transparence:false},null,2));
console.log(`${count} pixels de ciel calibrés, bande supérieure de 64 px exacte.`);

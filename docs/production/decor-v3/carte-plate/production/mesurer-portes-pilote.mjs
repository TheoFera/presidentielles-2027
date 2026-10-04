import fs from 'node:fs';
import {readPng} from '../../../../../scripts/lib/png.mjs';
const a=readPng('docs/production/decor-v3/carte-plate/production/fresque-en-cours.png');
for(const cx of [4298,5265]){
 const points=[];
 for(let y=810;y<1010;y++)for(let x=cx-60;x<cx+60;x++){
  const i=(y*a.width+x)*4,[r,g,b]=a.data.subarray(i,i+3);
  if(r<55&&g>30&&g<95&&b>g&&g>r+12)points.push([x,y]);
 }
 console.log(JSON.stringify({cx,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1])),points:points.length}));
}

import {createRequire} from 'node:module';
import {readPng} from '../../../../../scripts/lib/png.mjs';
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const file='docs/production/decor-v3/carte-plate/production/retouches/banlieue-a-composition-equilibree-normalisee.png';
await sharp(file).extract({left:720,top:680,width:470,height:400}).png().toFile('docs/production/decor-v3/carte-plate/production/controle-geometrie/banlieue-a-rdc.png');
const a=readPng(file),points=[];
for(let y=800;y<1020;y++)for(let x=855;x<1005;x++){
 const i=(y*a.width+x)*4,[r,g,b]=a.data.subarray(i,i+3);
 if(r<55&&g>30&&g<95&&b>g&&g>r+12)points.push([x,y]);
}
console.log(JSON.stringify({xMin:Math.min(...points.map(p=>p[0])),xMax:Math.max(...points.map(p=>p[0])),yMin:Math.min(...points.map(p=>p[1])),yMax:Math.max(...points.map(p=>p[1]))}));

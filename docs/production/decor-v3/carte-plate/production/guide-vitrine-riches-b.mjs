import fs from 'node:fs';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const base='docs/production/decor-v3/carte-plate/production/retouches/',parent='riches-b-rdc-dessin';
const a=readPng(base+parent+'-apres.png');
for(let y=160;y<404;y++)for(let x=270;x<427;x++){
 const p=(y*a.width+x)*4,c=(x<288||y<220||y>390)?[218,200,169]:[164,133,81];
 a.data[p]=c[0];a.data[p+1]=c[1];a.data[p+2]=c[2];a.data[p+3]=255;
}
writePng(base+'riches-b-vitrine-finition-guide.png',a);
const parentMeta=JSON.parse(fs.readFileSync(base+parent+'.json'));
for(const [id,x,y,w,h] of [['riches-b-vitrine-finition',270,160,157,244],['riches-b-sol-finition',270,404,586,76]]){
 const m={...parentMeta,id,replaceTop:y,replaceHeight:h,replaceLeft:x-256,replaceWidth:w,guide:base+'riches-b-vitrine-finition-guide.png'};
 delete m.source;delete m.pixelsModifies;delete m.pixelsExterieursIdentiques;m.appliquee=false;
 fs.writeFileSync(base+id+'.json',JSON.stringify(m,null,2));
}

import fs from 'node:fs';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const [parent,leftText,rightText]=process.argv.slice(2),left=Number(leftText),right=Number(rightText),base='docs/production/decor-v3/carte-plate/production/retouches/';
const a=readPng(base+parent+'-apres.png'),m=JSON.parse(fs.readFileSync(base+parent+'.json'));
const bands=[['haut',left,60,right-left,100],['gauche',left,160,437-left,60],['droite',695,160,right-695,60],['sol',left,404,right-left,76]];
const guide=base+parent+'-maconnerie-guide.png';
for(const [name,x,y,w,h] of bands){
 if(name!=='sol')for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){
  const p=(j*a.width+i)*4;a.data[p]=230;a.data[p+1]=206;a.data[p+2]=169;a.data[p+3]=255;
 }
 const id=parent+'-finition-'+name,meta={...m,id,guide,replaceLeft:x-m.context,replaceWidth:w,replaceTop:y,replaceHeight:h,appliquee:false};
 delete meta.source;delete meta.pixelsModifies;delete meta.pixelsExterieursIdentiques;
 fs.writeFileSync(base+id+'.json',JSON.stringify(meta,null,2));
}
writePng(guide,a);

// Retouches rectangulaires opaques : tous les pixels extérieurs restent identiques.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../scripts/lib/png.mjs';
import {plateTiles} from '../../../../scripts/fresque-plate-gabarits.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate'), out=path.join(base,'production/retouches');
const master=path.join(base,'production/fresque-en-cours.png');
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const tiles=plateTiles(JSON.parse(fs.readFileSync('Présidentielles 2027/world_layout.json','utf8')));
const [mode,id,arg,arg2,arg3,arg4,arg5]=process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});
function extract(a,x,y,w,h){const data=Buffer.alloc(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const xx=(x+i+a.width)%a.width;a.data.copy(data,(j*w+i)*4,((y+j)*a.width+xx)*4,((y+j)*a.width+xx+1)*4);}return{width:w,height:h,data};}
function fill(a,x,y,w,h,c){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const p=(j*a.width+i)*4;a.data[p]=c[0];a.data[p+1]=c[1];a.data[p+2]=c[2];a.data[p+3]=255;}}
const metadata=path.join(out,`${id}.json`);
if(mode==='preparer'){
  const a=readPng(master),x=Number(arg),y=Number(arg2),w=Number(arg3),h=Number(arg4),context=Number(arg5||256);
  const guide=extract(a,x-context,y,w+2*context,h);
  writePng(path.join(out,`${id}-avant.png`),guide);
  const meta={id,x,y,w,h,context,canvasWidth:guide.width,canvasHeight:h,guide:path.join(out,`${id}-guide.png`)};
  writePng(meta.guide,guide);fs.writeFileSync(metadata,JSON.stringify(meta,null,2));console.log(JSON.stringify(meta));
}else if(mode==='limiter'){
  const m=JSON.parse(fs.readFileSync(metadata));m.replaceTop=Number(arg);m.replaceHeight=Number(arg2);fs.writeFileSync(metadata,JSON.stringify(m,null,2));console.log(JSON.stringify(m));
}else if(mode==='limiter-largeur'){
  const m=JSON.parse(fs.readFileSync(metadata));m.replaceLeft=Number(arg);m.replaceWidth=Number(arg2);if(m.replaceLeft<0||m.replaceWidth<1||m.replaceLeft+m.replaceWidth>m.w)throw new Error('Rectangle hors zone.');fs.writeFileSync(metadata,JSON.stringify(m,null,2));console.log(JSON.stringify(m));
}else if(mode==='vide'){
  const m=JSON.parse(fs.readFileSync(metadata)),a=readPng(m.guide);fill(a,m.context,0,m.w,m.h,[227,217,193]);writePng(m.guide,a);console.log(m.guide);
}else if(mode==='croquis-tuile'){
  const m=JSON.parse(fs.readFileSync(metadata)),a=readPng(m.guide),t=tiles[Number(arg)-1];
  for(let y=0;y<m.h;y++){const yy=y+m.y,k=Math.max(0,Math.min(1,(yy-64)/640)),c=yy<1004?[Math.round(159+69*k),Math.round(207+34*k),Math.round(238+8*k)]:[189,185,173];fill(a,m.context,y,m.w,1,c);}
  fill(a,m.context,900-m.y,m.w,104,[224,217,197]);
  for(const b of t.buildings){const x=t.masterLeft+b.x-m.x+m.context;fill(a,x-184,520-m.y,368,484,[218,200,169]);fill(a,x-129,764-m.y,258,44,[243,228,197]);fill(a,x-48,820-m.y,96,184,[35,60,67]);fill(a,x+24,900-m.y,5,30,[192,147,68]);}
  writePng(m.guide,a);console.log(m.guide);
}else if(mode==='differencier'){
  const m=JSON.parse(fs.readFileSync(metadata)),a=readPng(m.guide),t=tiles[Number(arg)-1];
  for(const [i,b] of t.buildings.entries()){const x=t.masterLeft+b.x-m.x+m.context,y=(i===0?352:520)-m.y;
    fill(a,x-184,y,368,1004-m.y-y,i===0?[218,200,169]:[166,104,84]);
    fill(a,x-129,764-m.y,258,44,[243,228,197]);fill(a,x-48,820-m.y,96,184,[35,60,67]);fill(a,x+24,900-m.y,5,30,[192,147,68]);}
  writePng(m.guide,a);console.log(m.guide);
}else if(mode==='croquis-riches-b'){
  const m=JSON.parse(fs.readFileSync(metadata)),a=readPng(m.guide);
  for(let y=100;y<820;y++){const k=Math.max(0,Math.min(1,(y-64)/640));fill(a,m.context,y,m.w,1,[Math.round(159+69*k),Math.round(207+34*k),Math.round(238+8*k)]);}
  const cx=m.context+m.w/2;
  for(let y=320;y<555;y++){const w=Math.max(3,Math.round((y-320)*.3));fill(a,Math.round(cx-w/2),y,w,1,[125,134,144]);}
  [[m.context+95,580,155,228,[218,200,169]],[m.context+275,632,130,176,[190,159,134]],[m.context+435,552,170,256,[225,211,185]]].forEach(([x,y,w,h,c])=>fill(a,x,y,w,h,c));
  writePng(m.guide,a);console.log(m.guide);
}else if(mode==='rdc-guide'){
  const m=JSON.parse(fs.readFileSync(metadata)),a=readPng(m.guide),t=tiles[Number(arg)-1];
  const facade=Number(arg2||360),couleur=arg3?JSON.parse(arg3):[30,88,93],top=Number(arg4||735);
  for(const b of t.buildings){const x=t.masterLeft+b.x-m.x+m.context;
    if(x>=m.context&&x<m.context+m.w){fill(a,x-facade/2,top-m.y,facade,1004-top,couleur);fill(a,x-129,764-m.y,258,44,[243,228,197]);fill(a,x-48,820-m.y,96,184,[35,60,67]);fill(a,x+24,900-m.y,5,30,[192,147,68]);}}
  writePng(m.guide,a);console.log(m.guide);
}else if(mode==='porte-guide'){
  const m=JSON.parse(fs.readFileSync(metadata)),a=readPng(m.guide),t=tiles[Number(arg)-1];
  for(const b of t.buildings){const x=t.masterLeft+b.x-m.x+m.context,y=0-m.y;
    if(x>=m.context&&x<m.context+m.w){fill(a,x-129,y+764,258,44,[243,228,197]);fill(a,x-48,y+820,96,184,[35,60,67]);fill(a,x+24,y+900,5,30,[192,147,68]);}}
  writePng(m.guide,a);console.log(m.guide);
}else if(mode==='appliquer'||mode==='essayer'||mode==='annuler'){
  const m=JSON.parse(fs.readFileSync(metadata)),a=readPng(master),before=Buffer.from(a.data);
  const raw=path.join(out,`${id}-brute.png`),norm=path.join(out,`${id}-normalisee.png`);
  if(mode!=='annuler'){fs.copyFileSync(arg,raw);await sharp(raw).resize(m.canvasWidth,m.canvasHeight,{fit:'cover',position:'centre'}).ensureAlpha().png().toFile(norm);}
  const b=readPng(mode==='annuler'?path.join(out,`${id}-avant.png`):norm);
  const sourceTop=m.replaceTop||0,sourceLeft=m.replaceLeft||0,y0=m.y+sourceTop,h=m.replaceHeight||m.h,w=m.replaceWidth||m.w,shift=mode==='annuler'?0:Number(arg2||0);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const xx=(m.x+sourceLeft+i+a.width)%a.width,sy=j+sourceTop-shift,dst=((y0+j)*a.width+xx)*4;
    if(sy<0){a.data[dst]=159;a.data[dst+1]=207;a.data[dst+2]=238;a.data[dst+3]=255;continue;}
    if(sy>=b.height)throw new Error('Décalage hors image.');const src=(sy*b.width+m.context+sourceLeft+i)*4;
    if(b.data[src+3]!==255)throw new Error('Transparence interdite.');b.data.copy(a.data,dst,src,src+4);}
  let changed=0;const start=(m.x+sourceLeft+a.width)%a.width,end=start+w;
  const same=(p,q)=>{if(!a.data.subarray(p,q).equals(before.subarray(p,q)))throw new Error('Pixel extérieur modifié.');};
  for(let j=0;j<a.height;j++){const row=j*a.width*4;
    if(j<y0||j>=y0+h)same(row,row+a.width*4);
    else{if(end<=a.width){same(row,row+start*4);same(row+end*4,row+a.width*4);}else same(row+(end-a.width)*4,row+start*4);
      for(let i=0;i<w;i++){const p=row+((start+i)%a.width)*4;if(!a.data.subarray(p,p+4).equals(before.subarray(p,p+4)))changed++;}}
  }
  if(mode!=='essayer'){const temp=path.join(out,`${id}-maitre.png`);writePng(temp,a);fs.renameSync(temp,master);}
  writePng(path.join(out,`${id}-${mode==='annuler'?'restaure':'apres'}.png`),extract(a,m.x-m.context,m.y,m.canvasWidth,m.h));
  m.source=raw;m.pixelsModifies=changed;m.pixelsExterieursIdentiques=true;m.appliquee=mode==='appliquer';m.translationVerticale=shift;if(mode==='annuler')m.annuleeLe=new Date().toISOString();fs.writeFileSync(metadata,JSON.stringify(m,null,2));console.log(JSON.stringify(m));
}else if(mode==='vues'){
  const a=readPng(master);const parts=[];for(const t of tiles){const p=path.join(out,`tuile-${t.number}-echelle.png`),v=extract(a,t.masterLeft,0,1920,1080);
    const b=t.buildings[0],x=Math.min(1750,Math.max(150,b.x+155));
    // Silhouette de contrôle uniquement, jamais incorporée à la fresque.
    fill(v,x-13,842,26,30,[65,69,77]);fill(v,x-20,872,40,73,[65,69,77]);fill(v,x-18,945,14,59,[65,69,77]);fill(v,x+4,945,14,59,[65,69,77]);writePng(p,v);
    const thumb=await sharp(v.data,{raw:{width:1920,height:1080,channels:4}}).resize(640,360).png().toBuffer();parts.push({input:thumb,left:(t.index%3)*640,top:Math.floor(t.index/3)*360});}
  await sharp({create:{width:1920,height:2160,channels:4,background:'#fff'}}).composite(parts).png().toFile(path.join(base,'production/vue-18-tuiles.png'));console.log('18 vues d’échelle et une planche complète produites.');
}else throw new Error('Mode inconnu.');

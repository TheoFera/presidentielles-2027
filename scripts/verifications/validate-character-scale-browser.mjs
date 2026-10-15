import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from '../validate-campaign.mjs';
import { checkCharacterRuntime } from './character-scale-runtime.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CAMPAIGN_TEST_NODE_MODULES ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright') : 'playwright');
const output=path.resolve('artifacts/animation-audit');await mkdir(output,{recursive:true});
const poses=JSON.parse(await readFile(path.join(output,'inventory-after.json')));
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try {
 const page=await browser.newPage({viewport:{width:1680,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/scale-audit',r=>r.fulfill({contentType:'text/html',body:'<html lang="fr"><body style="margin:0;background:#ddd5bf"><canvas></canvas></body></html>'}));
 await page.goto((process.env.CAMPAIGN_TEST_URL||'http://localhost:2027')+'/scale-audit');
 const groups=[...new Set(poses.map(p=>p.group))],reports=[];
 for(const group of groups){
 const list=poses.filter(p=>p.group===group);
 const report=await page.evaluate(async list=>{
  const {drawCharacterAtlasFrame}=await import('/src/presentation/personnages/character-scale.js');
  const canvas=document.querySelector('canvas'),cols=6,cw=280,ch=245,H=150;
  canvas.width=cw*cols;canvas.height=Math.ceil(list.length/cols)*ch;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#e9e1ce';ctx.fillRect(0,0,canvas.width,canvas.height);
  const images=new Map(await Promise.all([...new Set(list.map(p=>p.file))].map(async file=>{const image=new Image();image.src='/assets/'+file.split(/[\\/]assets[\\/]/)[1].replaceAll('\\','/');await image.decode();return[file,image];})));
  const atlases=new Map();
  for(const p of list){const key=p.sheet+':'+p.sprite;let atlas=atlases.get(key);if(!atlas){atlas={frames:[],clips:[],isolated:p.isolated};atlases.set(key,atlas);}atlas.frames[p.index]=p.frame;atlas.clips[p.index]=p.clip;}
  const measurements=[];
  for(const [i,p]of list.entries()){
   const [sx,sy,sw,sh,px,py]=p.frame,kx=p.scaleX*H,ky=p.scaleY*H;
   const x=i%cols*cw+cw/2,y=Math.floor(i/cols)*ch+ch-30;
   ctx.save();ctx.beginPath();ctx.rect(i%cols*cw,Math.floor(i/cols)*ch,cw,ch);ctx.clip();
   ctx.fillStyle='#223440';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText(`${p.group} · ${p.sheet} ${p.index}`,x,Math.floor(i/cols)*ch+20);
   ctx.strokeStyle='#998e75';ctx.beginPath();ctx.moveTo(x-cw/2+8,y);ctx.lineTo(x+cw/2-8,y);ctx.stroke();
   ctx.strokeStyle='#b7aa87';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(x-cw/2+8,y-H*296/340*1.1236);ctx.lineTo(x+cw/2-8,y-H*296/340*1.1236);ctx.stroke();ctx.setLineDash([]);
   const image=images.get(p.file),atlas=atlases.get(p.sheet+':'+p.sprite);
   ctx.save();ctx.translate(x,y);drawCharacterAtlasFrame(ctx,image,atlas,p.index,kx);ctx.restore();
   ctx.fillStyle='#45616e';ctx.font='11px system-ui';ctx.fillText(`H ${(sh*ky).toFixed(1)} · L ${(sw*kx).toFixed(1)} · X/Y ${(kx/ky).toFixed(4)}`,x,y+19);
   // Contrôle de la matrice ET du drawImage réellement exécutés, aux deux orientations et trois tailles.
   const variants=[];
   for(const height of [80,150,220])for(const facing of [-1,1]){
    const probe=document.createElement('canvas').getContext('2d'),draws=[];
    const monitored=new Proxy(probe,{get(target,key){if(key==='drawImage')return(...a)=>{const m=target.getTransform();const sourceW=a.length===9?a[3]:a[0].width,sourceH=a.length===9?a[4]:a[0].height;const dw=a.at(-2),dh=a.at(-1);draws.push({x:Math.hypot(m.a,m.b)*dw/sourceW,y:Math.hypot(m.c,m.d)*dh/sourceH});};const value=target[key];return typeof value==='function'?value.bind(target):value;},set(target,key,value){target[key]=value;return true;}});
    monitored.translate(200,250);monitored.scale(facing,1);drawCharacterAtlasFrame(monitored,image,atlas,p.index,p.scaleX*height);
    if(draws.length!==1)throw new Error('Nombre de dessins inattendu');
    const {x:ax,y:ay}=draws[0];variants.push({height,facing,ratio:ax/ay});
   }
   measurements.push({group:p.group,sheet:p.sheet,index:p.index,width:sw*kx,height:sh*ky,ratio:kx/ky,variants});ctx.restore();
  }
  return {width:canvas.width,height:canvas.height,measurements};
 },list);
 await page.setViewportSize({width:report.width,height:Math.max(800,report.height)});
 await page.screenshot({path:path.join(output,group.replace(':','-')+'.png')});
 reports.push(...report.measurements);
 }
 assert.deepEqual(errors,[]);assert.ok(reports.every(p=>Math.abs(p.ratio-1)<1e-12));
 assert.ok(reports.every(p=>p.variants.every(v=>Math.abs(v.ratio-1)<1e-12)));
 await writeFile(path.join(output,'rendered-measurements.json'),JSON.stringify({reports,errors},null,2));
 const runtime=await checkCharacterRuntime(page,campaignConfig());
 await writeFile(path.join(output,'runtime-measurements.json'),JSON.stringify(runtime,null,2));
 assert.equal(runtime.failures.length,0,JSON.stringify(runtime.failures.slice(0,4)));
 await writeFile(path.join(output,'index.html'),`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Contrôle des animations</title><style>body{font:16px system-ui;background:#e9e1ce;color:#223440;margin:24px}img{max-width:100%;height:auto}a{margin-right:15px}section{margin:50px 0}</style><h1>Contrôle des ${reports.length} poses</h1><p>Rendu commun au jeu, sans étirement. Ligne pointillée : taille de garde de Philippe. Les poses courbées ou couchées gardent naturellement une hauteur inférieure. Chaque pose est également mesurée à 80, 150 et 220 pixels, à gauche et à droite. Les poses de référence et les anciennes découpes encore enregistrées sont incluses.</p><nav>${groups.map(g=>`<a href="#${g}">${g}</a>`).join('')}</nav>${groups.map(g=>`<section id="${g}"><h2>${g}</h2><img loading="lazy" src="${g.replace(':','-')}.png" alt="Toutes les poses ${g}"></section>`).join('')}</html>`);
 console.log(`${reports.length} poses, ${reports.length*6} contrôles de dessin réels, ${groups.length} planches, aucune déformation largeur/hauteur.`);
 console.log(`${runtime.checked} situations avec le rendu complet du jeu, ${runtime.failures.length} anomalie.`);
}finally{await browser.close();}

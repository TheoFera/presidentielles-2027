import { ringDelta } from '../simulation/world.js';
import { PAINTED_PLANES, paintedScene, paintedAssets } from './france-peinte-data.js';
import { drawFresqueGround } from './world-v3/fresque/sol.js';
import { frontPropPlacements } from './world-v3/front.js';
import { drawCompletePlane, drawCompleteStreets, drawCompleteFurniture, COMPLETE_ZONES } from './france-peinte-complete.js';

// Rectangles de découpe normalisés. Le calage est indépendant de la résolution livrée par ImageGen.
export const ATLAS_ROWS = {
  paris: [
    [0,.395,[0,.265,.542,.765,1]],
    [.395,.705,[0,.26,.545,.76,1]],
    [.705,1,[0,.213,.476,.76,1]],
  ],
  periurbain: [[0,.397,[0,.25,.50,.75,1]],[.397,.72,[0,.25,.50,.75,1]],[.72,1,[0,.25,.50,.75,1]]],
  banlieue: [[0,.344,[0,.25,.50,.75,1]],[.344,.673,[0,.25,.50,.75,1]],[.673,1,[0,.25,.50,.75,1]]],
  campagne: [[0,.337,[0,.25,.50,.75,1]],[.337,.674,[0,.25,.50,.75,1]],[.674,1,[0,.25,.50,.75,1]]],
  retraites: [[0,.336,[0,.25,.50,.75,1]],[.336,.668,[0,.25,.50,.75,1]],[.668,1,[0,.25,.50,.75,1]]],
  riches: [[0,.342,[0,.25,.50,.75,1]],[.342,.668,[0,.25,.50,.75,1]],[.668,1,[0,.25,.50,.75,1]]],
  nature: [[0,.426,[0,.25,.52,.75,1]],[.426,.699,[0,.25,.515,.745,1]],[.699,1,[0,.255,.535,.75,1]]],
};
const prepared = new WeakMap();
/** Retire les petits fragments des cellules voisines, sans toucher à la silhouette principale. */
function cleanCell(canvas) {
  const ctx=canvas.getContext('2d'), W=canvas.width, H=canvas.height;
  const pixels=ctx.getImageData(0,0,W,H), data=pixels.data;
  const labels=new Int32Array(W*H), queue=new Int32Array(W*H), sizes=[0];
  let label=0;
  for (let i=0; i<labels.length; i++) {
    if (labels[i] || data[i*4+3]<70) continue;
    label++; let head=0, tail=1; queue[0]=i; labels[i]=label;
    while(head<tail) {
      const p=queue[head++], x=p%W;
      for (const n of [x>0?p-1:-1,x<W-1?p+1:-1,p>=W?p-W:-1,p<W*(H-1)?p+W:-1]) {
        if(n<0 || labels[n] || data[n*4+3]<70) continue;
        labels[n]=label; queue[tail++]=n;
      }
    }
    sizes[label]=tail;
  }
  const largest=Math.max(...sizes);
  let left=W, right=0, top=H, bottom=0;
  for(let i=0;i<labels.length;i++) {
    if (!labels[i] || sizes[labels[i]]<largest*.015) { data[i*4+3]=0; continue; }
    const x=i%W,y=Math.floor(i/W);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  ctx.putImageData(pixels,0,0);
  const result=document.createElement('canvas');result.width=Math.max(1,right-left+1);result.height=Math.max(1,bottom-top+1);
  result.getContext('2d').drawImage(canvas,left,top,result.width,result.height,0,0,result.width,result.height);
  return { canvas:result,w:result.width,h:result.height };
}
export function preparePaintedAtlas(id, image) {
  if (!id.startsWith('peint-') || prepared.has(image)) return;
  const name = id.slice(6), W = image.naturalWidth, H = image.naturalHeight;
  const scratch = document.createElement('canvas'); scratch.width = W; scratch.height = H;
  const ctx = scratch.getContext('2d', { willReadFrequently:true }); ctx.drawImage(image,0,0);
  if(name==='hiver') {
    const rgba=ctx.getImageData(0,0,W,H);
    for(let i=3;i<rgba.data.length;i+=4) if(rgba.data[i]<180) rgba.data[i]=0;
    ctx.putImageData(rgba,0,0);
    const edges=[0,.276,.543,.826,1], winter=[];
    for(let i=0;i<4;i++) {
      const x=Math.round(edges[i]*W), width=Math.round(edges[i+1]*W)-x;
      const cell=document.createElement('canvas');cell.width=width;cell.height=H;
      cell.getContext('2d').drawImage(scratch,x,0,width,H,0,0,width,H);
      winter.push(cleanCell(cell));
    }
    prepared.set(image,winter);return;
  }
  if (name==='basilique' || name==='montblanc' || name==='mer' || name==='tour') {
    const rgba=ctx.getImageData(0,0,W,H);
    for(let i=3;i<rgba.data.length;i+=4) if(rgba.data[i]<180) rgba.data[i]=0;
    ctx.putImageData(rgba,0,0); prepared.set(image,[cleanCell(scratch)]); return;
  }
  const pixels = ctx.getImageData(0,0,W,H).data, cells = [];
  for (let row=0; row<3; row++) {
    const [ya,yb,xs] = ATLAS_ROWS[name]?.[row] || [row/3,(row+1)/3,[0,.25,.5,.75,1]];
    for (let col=0; col<4; col++) {
      const a=Math.round(xs[col]*W), b=Math.round(xs[col+1]*W), t=Math.round(ya*H), d=Math.round(yb*H);
      let left=b, right=a, top=d, bottom=t;
      for (let y=t; y<d; y++) for (let x=a; x<b; x++) {
        if (pixels[(y*W+x)*4+3] < 100) continue;
        left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
      }
      const w=Math.max(1,right-left+1), h=Math.max(1,bottom-top+1);
      const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(image,left,top,w,h,0,0,w,h);
      cells.push(cleanCell(canvas));
    }
  }
  prepared.set(image,cells);
}

/** La parallaxe est limitée au quartier : un monument lointain ne dérive pas dans un autre biome. */
export function paintedProjection(camera, item, length, pixelsPerUnit, anchor, speed) {
  const delta=ringDelta(camera,item.x,length);
  const limit=item.zone.width*.16;
  const drift=limit*Math.tanh(delta*(1-speed)/limit);
  return anchor+(delta-drift)*pixelsPerUnit;
}

const hazyCells=new WeakMap();
function atmosphericSprite(cell,haze) {
  if(!haze) return cell.canvas;
  let variants=hazyCells.get(cell.canvas);
  if(!variants) { variants=new Map();hazyCells.set(cell.canvas,variants); }
  if(variants.has(haze)) return variants.get(haze);
  const canvas=document.createElement('canvas');canvas.width=cell.w;canvas.height=cell.h;
  const ctx=canvas.getContext('2d');ctx.drawImage(cell.canvas,0,0);
  ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=haze;
  ctx.fillStyle='#c9dae6';ctx.fillRect(0,0,cell.w,cell.h);
  variants.set(haze,canvas);return canvas;
}

function spriteFrame(renderer,item,cell,plane) {
  const u=renderer.metrics.characterHeight/81;
  const maxW=item.w*renderer.metrics.pixelsPerUnit, maxH=item.h*u;
  // Même facteur horizontal/vertical : les façades ne sont jamais étirées.
  const scale=Math.min(maxW/cell.w,maxH/cell.h);
  const w=cell.w*scale, h=cell.h*scale;
  const x=paintedProjection(renderer.cameraX,item,renderer.fixedWorldState.world.length,renderer.metrics.pixelsPerUnit,renderer.metrics.anchorX,plane.speed);
  return { x, y:renderer.metrics.groundY-plane.base*u, w, h, scale, u };
}

export function drawPaintedWorld(renderer,state,tools) {
  const scene=paintedScene(state.world,state.buildings), {ctx}=renderer;
  renderer.paintedScene=scene;
  renderer.paintedSiteFrames=new Map();
  // Une assise de terrain continue relie les silhouettes transparentes jusqu'au trottoir.
  // Ce sol procédural suit le monde et les saisons, comme la chaussée commune aux décors.
  ctx.save(); ctx.filter=tools.seasonFilter('back');
  const u=renderer.metrics.characterHeight/81, ground=renderer.metrics.groundY;
  const terrain=ctx.createLinearGradient(0,ground-95*u,0,ground);
  terrain.addColorStop(0,'#94ab7b');terrain.addColorStop(1,'#708959');
  ctx.fillStyle=terrain;ctx.beginPath();ctx.moveTo(-10,ground);
  for(let x=-10;x<=renderer.width+20;x+=12) {
    const worldX=renderer.cameraX+(x-renderer.metrics.anchorX)/renderer.metrics.pixelsPerUnit;
    const phase=worldX/state.world.length*Math.PI*2;
    ctx.lineTo(x,ground-(125+14*Math.sin(phase*7)+8*Math.sin(phase*19))*u);
  }
  ctx.lineTo(renderer.width+20,ground);ctx.closePath();ctx.fill();ctx.restore();
  for (const [planeId,plane] of Object.entries(PAINTED_PLANES)) {
    drawCompletePlane(renderer,state,tools,planeId);
    ctx.save(); ctx.filter=tools.seasonFilter(planeId);
    for (const item of scene.planes[planeId]) {
      // Les quartiers en production remplacent les assemblages de façades isolées.
      // Conserver seulement les arbres indépendants, nécessaires aux saisons.
      if (COMPLETE_ZONES.has(item.zone.id) && !item.tree) continue;
      const image=renderer.assets.get(`peint-${item.atlas}`);
      if (!image) continue;
      preparePaintedAtlas(`peint-${item.atlas}`,image);
      const cell=prepared.get(image)[item.cell], frame=spriteFrame(renderer,item,cell,plane);
      if (frame.x+frame.w/2<0 || frame.x-frame.w/2>renderer.width) continue;
      if(item.atlas==='mer') {
        // Répéter la texture de l'eau, sans étirer ni les vagues ni les falaises.
        const band=Math.min(32,cell.h), height=band*frame.scale;
        for(let y=frame.y-1;y<renderer.metrics.groundY;y+=height)
          ctx.drawImage(cell.canvas,0,cell.h-band,cell.w,band,frame.x-frame.w/2,y,frame.w,height+1);
      }
      const winterImage=item.tree && renderer.assets.get('peint-hiver');
      const winter= winterImage ? Math.min(1,tools.snow) : 0;
      if(winterImage) preparePaintedAtlas('peint-hiver',winterImage);
      const bare=winterImage && prepared.get(winterImage)[item.cell];
      ctx.save();ctx.globalAlpha=1-winter;
      ctx.drawImage(atmosphericSprite(cell,plane.haze),frame.x-frame.w/2,frame.y-frame.h,frame.w,frame.h);
      ctx.restore();
      if(winter>0) {
        const w=frame.h*bare.w/bare.h;
        ctx.save();ctx.globalAlpha=winter;
        ctx.drawImage(atmosphericSprite(bare,plane.haze),frame.x-w/2,frame.y-frame.h,w,frame.h);ctx.restore();
      }
      if (tools.snow>.02 && planeId!=='horizon') {
        const snowCell=winter>.5?bare:cell, w=frame.h*snowCell.w/snowCell.h;
        ctx.save(); ctx.globalAlpha=tools.snow;
        ctx.drawImage(tools.snowCap(snowCell.canvas),frame.x-w/2,frame.y-frame.h,w,frame.h); ctx.restore();
      }
      if (item.building) renderer.paintedSiteFrames.set(item.building.site_id,frame);
    }
    ctx.restore();
  }
  drawCompleteStreets(renderer,state,tools);
  drawFresqueGround(renderer,state,renderer.metrics.characterHeight/81);
}

export function drawPaintedFront(renderer,state) {
  const {ctx,metrics:m}=renderer, u=m.characterHeight/81;
  const image=renderer.assets.get('peint-nature');
  if(!image) return;
  preparePaintedAtlas('peint-nature',image);
  const cells=prepared.get(image);
  drawCompleteFurniture(renderer,state);
  for(const prop of frontPropPlacements(state)) {
    const cell=cells[prop.kind.startsWith('lampadaire')?10:11];
    const zone=state.world.subzones.find(z=>prop.x>=z.start && prop.x<z.end);
    if(state.buildings.some(b=>Math.abs(ringDelta(prop.x,b.x,state.world.length))<(b.type==='meeting'?5:(renderer.paintedScene.sites[b.site_id].w/2+1.7)))) continue;
    const x=paintedProjection(renderer.cameraX,{x:prop.x,zone},state.world.length,m.pixelsPerUnit,m.anchorX,1.35);
    const h=(prop.kind.startsWith('lampadaire')?170:38)*u, w=h*cell.w/cell.h;
    if(x+w/2<0 || x-w/2>renderer.width) continue;
    ctx.drawImage(cell.canvas,x-w/2,m.groundY+18*u-h,w,h);
  }
}

/** Le panneau dynamique suit la façade peinte, au-dessus de sa vraie porte. */
export function paintedSignFrame(renderer,building) {
  const complete = renderer.completeSiteSigns?.get(building.site_id);
  if (complete) return complete;
  const frame=renderer.paintedSiteFrames?.get(building.site_id);
  if (!frame) return null;
  return { x:frame.x, y:frame.y-Math.min(105*frame.u,frame.h*.27), w:Math.min(frame.w*.64,150*frame.u), h:22*frame.u, painted:false };
}

export { paintedAssets };

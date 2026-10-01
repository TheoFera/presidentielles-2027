import { ringDelta } from '../simulation/world.js';
import { drawFresqueGround } from './world-v3/fresque/sol.js';
import { drawMarketPilot } from './world-v2-market.js';
import { EXPANDED_ATLASES, EXPANDED_SITES, EXPANDED_ZONES, EXPANDED_ART, EXPANDED_TRANSITIONS, EXPANDED_PLANES, EXPANDED_LANDSCAPES, expandedWorldAssetIds } from './world-v2-expanded-data.js';

const prepared = new WeakMap();
function removeFragments(data,width,height) {
  const labels=new Int32Array(width*height),queue=new Int32Array(width*height),sizes=[0];
  let label=0;
  for(let i=0;i<labels.length;i++) {
    if(labels[i] || !data[i*4+3]) continue;
    label++;let head=0,tail=1;queue[0]=i;labels[i]=label;
    while(head<tail) {
      const p=queue[head++],x=p%width;
      for(const n of [x>0?p-1:-1,x<width-1?p+1:-1,p>=width?p-width:-1,p<width*(height-1)?p+width:-1]) {
        if(n<0 || labels[n] || !data[n*4+3]) continue;
        labels[n]=label;queue[tail++]=n;
      }
    }
    sizes[label]=tail;
  }
  const threshold=Math.max(...sizes)*.006;
  for(let i=0;i<labels.length;i++)if(!labels[i] || sizes[labels[i]]<threshold)data[i*4+3]=0;
}
/** Découpe les nouveaux éléments indépendants, une seule fois au chargement. */
export function prepareExpandedAtlas(id, image) {
  if (!id.startsWith('world2-') || prepared.has(image)) return;
  const rows = EXPANDED_ATLASES[id.slice(7)];
  if (!rows) return;
  const factor = (image.naturalWidth || image.width) / 1254, cells = [];
  for (const [top,bottom,edges] of rows) for (let col=0;col<4;col++) {
    const left=edges[col], right=edges[col+1];
    const canvas=document.createElement('canvas');
    canvas.width=Math.round((right-left)*factor); canvas.height=Math.round((bottom-top)*factor);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,left*factor,top*factor,(right-left)*factor,(bottom-top)*factor,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height), data=pixels.data;
    let base=0;
    for(let i=3;i<data.length;i+=4) {
      const r=data[i-3],g=data[i-2],b=data[i-1];
      if(id==='world2-nature' && r>160 && b>140 && g<90 && r-g>70 && b-g>70)data[i]=0;
      // Les halos générés ne doivent pas former de rectangles autour des silhouettes.
      data[i]=data[i]<150?0:255;
      if(data[i]) base=Math.max(base,Math.floor((i/4)/canvas.width));
    }
    removeFragments(data,canvas.width,canvas.height);
    // Les paysages livrés côte à côte peuvent toucher la gouttière : un contour de
    // bocage opaque redescend avant chaque bord. Aucun fondu entre deux images.
    if(cells.length>=8 && !['world2-nature','world2-landscapes'].includes(id)) for(let x=0;x<canvas.width;x++) {
      const edge=Math.min(x,canvas.width-1-x)/(canvas.width*.22);
      if(edge>=1) continue;
      const t=Math.max(0,edge),rise=t*t*(3-2*t);
      const crest=base-(base+1)*rise+Math.sin(x*.29)*3*(1-rise);
      for(let y=0;y<canvas.height;y++)if(y<crest || x<2 || x>=canvas.width-2)data[(y*canvas.width+x)*4+3]=0;
    }
    let minX=canvas.width,minY=canvas.height,maxX=0,maxY=0;
    for(let i=3;i<data.length;i+=4)if(data[i]) {
      const x=Math.floor(i/4)%canvas.width,y=Math.floor(Math.floor(i/4)/canvas.width);
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    ctx.putImageData(pixels,0,0);
    const cropped=document.createElement('canvas');cropped.width=Math.max(1,maxX-minX+1);cropped.height=Math.max(1,maxY-minY+1);
    cropped.getContext('2d').drawImage(canvas,minX,minY,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
    cells.push({canvas:cropped,w:cropped.width,h:cropped.height,left:left+minX/factor,top:top+minY/factor,factor,base:cropped.height-1});
  }
  prepared.set(image,cells);
}
export function expandedCell(renderer, atlas, index) {
  const image=renderer.assets.get(`world2-${atlas}`);
  if(!image) return null;
  prepareExpandedAtlas(`world2-${atlas}`,image);
  return prepared.get(image)?.[index];
}

/** Parallaxe bornée : les monuments restent dans leur territoire, y compris au bouclage. */
export function expandedProjection(camera,x,length,metrics,speed,span) {
  const delta=ringDelta(camera,x,length), limit=Math.max(1,span*.14);
  const drift=limit*Math.tanh(delta*(1-speed)/limit);
  return metrics.anchorX+(delta-drift)*metrics.pixelsPerUnit;
}

/** Une porte = 1,15 personnage ; même facteur pour les deux axes, sans limite liée au zoom. */
export function expandedSiteFrame(metrics,world,camera,entry,cell,x) {
  const [, ,doorX,doorY,doorHeight,sign]=entry;
  const scale=metrics.characterHeight*1.15/(doorHeight*cell.factor);
  const doorScreen=metrics.anchorX+ringDelta(camera,x,world.length)*metrics.pixelsPerUnit;
  const base=metrics.groundY-12*metrics.characterHeight/81;
  const left=doorScreen-(doorX-cell.left)*cell.factor*scale;
  const top=base-(doorY-cell.top)*cell.factor*scale;
  const [sx,sy,sw,sh]=sign;
  return {left,top,width:cell.w*scale,height:cell.h*scale,scale,doorScreen,doorHeight:doorHeight*cell.factor*scale,
    sign:{x:left+(sx-cell.left+sw/2)*cell.factor*scale,y:top+(sy-cell.top+sh/2)*cell.factor*scale,w:sw*cell.factor*scale,h:sh*cell.factor*scale}};
}

const scenes=new WeakMap();
export function expandedScene(world,buildings) {
  if(scenes.has(world)) return scenes.get(world);
  const planes=Object.fromEntries(Object.keys(EXPANDED_PLANES).map(id=>[id,[]]));
  const scenery=item=>{
    const replacement=EXPANDED_LANDSCAPES[`${item.atlas}:${item.cell}`];
    return replacement===undefined?item:{...item,atlas:'landscapes',cell:replacement};
  };
  for(const zone of world.subzones) {
    // Le pilote possède une rue complète et un fond peint : aucun remplissage ni grillage par-dessus son marché.
    if(zone.id==='banlieue_b') continue;
    const atlas=EXPANDED_ART[zone.biome_id];
    for(const [plane,cell,ratio,w,h] of EXPANDED_ZONES[zone.id] || [])
      planes[plane].push(scenery({atlas,cell,x:zone.start+ratio*zone.width,w,h,span:zone.width,zone}));
    // Des silhouettes de fond supplémentaires prolongent chaque quartier sur toute sa largeur.
    const fill={paris:[5,3.2],banlieue:[9,3],periurbain:[8,2.7],campagne:[10,3],retraites:[10,2.6],riches:[5,3.5]}[atlas];
    for(const ratio of [.08,.35,.65,.94]) {
      // Les barres voisines ne doivent pas déborder dans la vieille rue commerçante de Saint-Denis.
      if((zone.id==='banlieue_a' && ratio===.94) || (zone.id==='banlieue_c' && ratio===.08)) continue;
      const item={atlas,cell:fill[0],x:zone.start+ratio*zone.width,w:14,h:fill[1],span:zone.width,zone,fill:true};
      if(atlas==='retraites' && zone.local_index===1){item.atlas='landscapes';item.cell=5;item.h=1.8;item.w=10;}
      if(atlas==='retraites' && zone.local_index===2){item.atlas='landscapes';item.cell=11;}
      planes.mid.push(scenery(item));
    }
    // Raccords bas peints sur toute la largeur, derrière les façades : les
    // sprites se chevauchent par leurs feuilles, sans porte masquée ni fondu.
    const vergeCell={paris:4,banlieue:6,periurbain:6,campagne:3,retraites:2,riches:9}[atlas];
    for(let offset=0;offset<zone.width;offset+=3.2)
      planes.back.push({atlas:'nature',cell:vergeCell,x:zone.start+offset,w:6,h:1.2,span:zone.width,zone,verge:true});
  }
  for(const [atlas,start,cell,w,h] of EXPANDED_TRANSITIONS) {
    const zone=world.subzones.find(z=>z.id===start);
    if(zone) planes.back.push(scenery({atlas,cell,x:zone.start,w,h,span:w,zone,transition:true}));
  }
  const sites=buildings.filter(b=>b.type!=='meeting' && EXPANDED_SITES[b.site_id]).map(b=>({id:b.site_id,x:b.x,zone:world.subzones.find(z=>z.id===b.subzone_id)}));
  planes.back.sort((a,b)=>Number(!!a.verge)-Number(!!b.verge));
  const result={planes,sites}; scenes.set(world,result); return result;
}

function decorFrame(renderer,state,item,cell,plane) {
  const m=renderer.metrics, u=m.characterHeight/81;
  const scale=Math.min(item.w*m.pixelsPerUnit/cell.w,item.h*m.characterHeight/cell.h);
  const width=cell.w*scale, height=cell.h*scale;
  const x=expandedProjection(renderer.cameraX,item.x,state.world.length,m,plane.speed,item.span);
  return {left:x-width/2,top:m.groundY-plane.base*u-cell.base*scale,width,height,scale};
}

/** Ciel + cinq plans peints + sol commun : aucune image opaque coupée au bord d'un biome. */
export function drawExpandedWorld(renderer,state,tools) {
  if(!expandedWorldAssetIds().every(id=>renderer.assets.get(id))) return false;
  const {ctx,metrics:m}=renderer, scene=expandedScene(state.world,state.buildings), u=m.characterHeight/81;
  renderer.worldV2Sites=new Map();
  const siteFrames=scene.sites.map(site=>{
    const entry=EXPANDED_SITES[site.id],cell=expandedCell(renderer,entry[0],entry[1]);
    const frame=expandedSiteFrame(m,state.world,renderer.cameraX,entry,cell,site.x);
    renderer.worldV2Sites.set(site.id,frame.sign);
    return {...site,cell,frame};
  });
  const view=renderer.visibleWorld || {left:0,right:renderer.width};
  // Assise continue derrière toutes les silhouettes : pas de vide entre deux sprites.
  const terrain=ctx.createLinearGradient(0,m.groundY-130*u,0,m.groundY);
  terrain.addColorStop(0,'#a1b28a');terrain.addColorStop(1,'#758f60');
  ctx.save();ctx.filter=tools.seasonFilter('mid');ctx.fillStyle=terrain;
  ctx.beginPath();ctx.moveTo(view.left,m.groundY);
  for(let x=view.left;x<=view.right+12;x+=12) {
    const worldX=renderer.cameraX+(x-m.anchorX)/m.pixelsPerUnit;
    const phase=worldX/state.world.length*Math.PI*2;
    ctx.lineTo(x,m.groundY-(93+13*Math.sin(phase*9)+7*Math.sin(phase*17))*u);
  }
  ctx.lineTo(view.right+12,m.groundY);ctx.closePath();ctx.fill();ctx.restore();
  for(const [id,plane] of Object.entries(EXPANDED_PLANES)) {
    ctx.save();ctx.filter=tools.seasonFilter(id);
    for(const item of scene.planes[id]) {
      const cell=expandedCell(renderer,item.atlas,item.cell),frame=decorFrame(renderer,state,item,cell,item.verge?{speed:1,base:12}:plane);
      if(frame.left+frame.width<view.left || frame.left>view.right) continue;
      if(id==='street') {
        // Ne couvrir ni une entrée interactive ni les 30 % centraux d'une place B.
        const blocked=siteFrames.some(site=>Math.abs(ringDelta(item.x,site.x,state.world.length))*m.pixelsPerUnit < frame.width/2+site.frame.width/2+4*u);
        const meeting=item.zone.local_index===1 && Math.abs(item.x-item.zone.center)*m.pixelsPerUnit < frame.width/2+item.zone.width*.15*m.pixelsPerUnit;
        if(blocked || meeting) continue;
      }
      ctx.drawImage(cell.canvas,frame.left,frame.top,frame.width,frame.height);
      if(tools.snow>.02 && id==='street') {
        ctx.save();ctx.globalAlpha=tools.snow;ctx.drawImage(tools.snowCap(cell.canvas),frame.left,frame.top,frame.width,frame.height);ctx.restore();
      }
    }
    if(id==='far' || id==='street') drawMarketPilot(renderer,state,tools,id);
    if(id==='street') for(const {id:siteId,cell,frame} of siteFrames) {
      if(siteId==='site:banlieue_b') continue;
      if(frame.left+frame.width<view.left || frame.left>view.right) continue;
      ctx.drawImage(cell.canvas,frame.left,frame.top,frame.width,frame.height);
      if(tools.snow>.02) {ctx.save();ctx.globalAlpha=tools.snow;ctx.drawImage(tools.snowCap(cell.canvas),frame.left,frame.top,frame.width,frame.height);ctx.restore();}
    }
    ctx.restore();
  }
  // La bordure commune recouvre les petites semelles peintes des différents éléments.
  drawFresqueGround(renderer,state,u);
  return true;
}

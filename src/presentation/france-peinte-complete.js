import { ringDelta } from '../simulation/world.js';
import { COMPLETE_CALIBRATION } from './france-peinte-calibration.js';
import { COMPLETE_ZONES } from './france-peinte-complete-data.js';

// Le calage déplace l'image entière pour aligner sa porte avec le site existant.
// Aucun étirement et aucune modification des coordonnées de la simulation.
export function completeStreetFrame(metrics, world, camera, entry, building) {
  const zone = world.subzones.find(z => z.id === entry.zone);
  const span = zone.width / 2, scale = span * metrics.pixelsPerUnit / entry.width;
  const signCenter = entry.sign && entry.sign[0] + entry.sign[2] / 2;
  const origin = building ? building.x - signCenter * span / entry.width : zone.start + entry.half * span;
  const center = metrics.anchorX + ringDelta(camera,origin+span/2,world.length) * metrics.pixelsPerUnit;
  const base = metrics.groundY - 12 * metrics.characterHeight / 81;
  return { left: center-span*metrics.pixelsPerUnit/2, top: base-entry.baseline*scale,
    width:entry.width*scale, height:entry.height*scale, scale, origin, span };
}

const tinted = new WeakMap();
const seasonal = new WeakMap();
function seasonImage(renderer,id,snow) {
  const summer=renderer.assets.get(id), winter=renderer.assets.get(`${id}-hiver`);
  if(!summer || !winter || snow<=0) return summer;
  const weight=Math.round(Math.min(1,snow)*10)/10;
  if(weight===0) return summer;
  if(weight===1 && summer.naturalWidth===winter.naturalWidth && summer.naturalHeight===winter.naturalHeight) return winter;
  // Les variantes gardent le même cadrage. Additionner les couleurs prémultipliées
  // conserve des murs opaques pendant le changement de saison.
  let cached=seasonal.get(summer);
  if(!cached || cached.weight!==weight || cached.winter!==winter) {
    const canvas=cached?.canvas || document.createElement('canvas');
    tinted.delete(canvas);
    canvas.width=summer.naturalWidth;canvas.height=summer.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.globalAlpha=1-weight;ctx.drawImage(summer,0,0);
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=weight;ctx.drawImage(winter,0,0);
    cached={weight,winter,canvas};seasonal.set(summer,cached);
  }
  return cached.canvas;
}
function atmosphericImage(image, haze) {
  if (!haze) return image;
  let values = tinted.get(image);
  if (!values) { values = new Map(); tinted.set(image,values); }
  if (!values.has(haze)) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image,0,0);
    ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = haze;
    ctx.fillStyle = '#c9dae7'; ctx.fillRect(0,0,canvas.width,canvas.height);
    values.set(haze,canvas);
  }
  return values.get(haze);
}

const PARIS_LAYERS = {
  horizon: { centers:[11,33,55], span:22, base:130, speed:.2, haze:.28 },
  far: { centers:[35], span:18, base:116, speed:.3, haze:.2 },
  mid: { centers:[8,22,36,50,64], span:14, base:64, speed:.5, haze:.16 },
  back: { centers:[8,22,36,50,64], span:14, base:30, speed:.72, haze:.05 },
};
// Les cités, le vieux centre de Saint-Denis et les pavillons ont chacun leur fond.
const BANLIEUE_LAYERS = {
  horizon:[['banlieue-horizon',82,22,132,.2,.28],['banlieue-horizon',104,22,132,.2,.28],['banlieue-horizon',126,22,132,.2,.28]],
  far:[['banlieue-far',84,22,112,.3,.2],['banlieue-far',108,22,112,.3,.2],['banlieue-far',132,22,112,.3,.2],['saint-denis',108,6,125,.3,.17]],
  mid:[['banlieue-mid-a',84,22,64,.5,.14],['banlieue-mid-b',108,20,64,.5,.14],['banlieue-mid-c',138,22,100,.5,.14]],
  back:[['banlieue-back-a',80,13,30,.72,.05],['banlieue-back-a',91,13,30,.72,.05],['banlieue-back-b',102,14,30,.72,.05],['banlieue-back-b',114,14,30,.72,.05],['banlieue-back-c',126,14,30,.72,.05],['banlieue-back-c',138,14,30,.72,.05],['banlieue-marche',108,14.4,32,.86,0]],
};
const PERIURBAIN_LAYERS = {
  horizon:[['periurbain-horizon-a',156,24,132,.2,.24],['periurbain-massif',202,58,20,.2,.18]],
  far:[['periurbain-far',156,24,112,.3,.2],['periurbain-far',180,24,112,.3,.2],['periurbain-far',204,24,112,.3,.2]],
  mid:[['periurbain-mid-a',156,24,210,.5,.14],['periurbain-mid-b',180,22,64,.5,.14],['periurbain-mid-c',204,24,64,.5,.14]],
  back:[['periurbain-back-a',150,14,30,.72,.05],['periurbain-back-a',163,14,30,.72,.05],['periurbain-back-b',180,20,32,.72,.02],['periurbain-back-c',204,24,30,.72,.05]],
};

export function drawCompletePlane(renderer,state,tools,planeId) {
  const {ctx,metrics:m} = renderer, plane = PARIS_LAYERS[planeId];
  if (!plane) return;
  const name = `paris-${planeId}`, image = seasonImage(renderer,`quartier-${name}`,tools.snow);
  const entry = COMPLETE_CALIBRATION.layers[name];
  if (!image || !entry) return;
  const zone = state.world.subzones.find(z=>z.id==='paris_b'), u=m.characterHeight/81;
  ctx.save(); ctx.filter=tools.seasonFilter(planeId);
  for (const center of plane.centers) {
    const delta=ringDelta(renderer.cameraX,center,state.world.length), limit=zone.width*.16;
    const drift=limit*Math.tanh(delta*(1-plane.speed)/limit);
    const x=m.anchorX+(delta-drift)*m.pixelsPerUnit, width=plane.span*m.pixelsPerUnit;
    if (x+width/2<0 || x-width/2>renderer.width) continue;
    const scale=width/entry.width, top=m.groundY-plane.base*u-entry.baseline*scale;
    ctx.drawImage(atmosphericImage(image,plane.haze),x-width/2,top,width,entry.height*scale);
    if (tools.snow>.02 && planeId==='back' && !renderer.assets.get(`quartier-${name}-hiver`)) {
      ctx.save();ctx.globalAlpha=tools.snow;
      ctx.drawImage(tools.snowCap(image),x-width/2,top,width,entry.height*scale);ctx.restore();
    }
  }
  ctx.restore();
  for(const [name,center,span,base,speed,haze] of BANLIEUE_LAYERS[planeId] || [])
    drawCompleteDetail(renderer,state,tools,name,center,span,base,speed,planeId,haze);
  for(const [name,center,span,base,speed,haze] of PERIURBAIN_LAYERS[planeId] || [])
    drawCompleteDetail(renderer,state,tools,name,center,span,base,speed,planeId,haze);
  if (planeId==='back') {
    drawCompleteDetail(renderer,state,tools,'banlieue-transition-est',144,16,100,.72);
    drawCompleteDetail(renderer,state,tools,'periurbain-transition-est',216,16,30,.72);
    drawCompleteDetail(renderer,state,tools,'paris-transition-ouest',0,16,30,.72);
    drawCompleteDetail(renderer,state,tools,'paris-transition-est',72,16,30,.72);
    drawCompleteDetail(renderer,state,tools,'paris-canal',60.6,12,12,.72);
    drawCompleteDetail(renderer,state,tools,'paris-marche',36,14.4,32,.86);
  }
}

function drawCompleteDetail(renderer,state,tools,name,center,span,base,speed,plane='back',haze=0) {
  const image=seasonImage(renderer,`quartier-${name}`,tools.snow), entry=COMPLETE_CALIBRATION.layers[name];
  if(!image || !entry) return;
  const {ctx,metrics:m}=renderer, delta=ringDelta(renderer.cameraX,center,state.world.length);
  const limit=3.84, drift=limit*Math.tanh(delta*(1-speed)/limit);
  const x=m.anchorX+(delta-drift)*m.pixelsPerUnit, width=span*m.pixelsPerUnit;
  if(x+width/2<0 || x-width/2>renderer.width) return;
  const scale=width/entry.width, top=m.groundY-base*m.characterHeight/81-entry.baseline*scale;
  ctx.save();ctx.filter=tools.seasonFilter(plane);
  ctx.drawImage(atmosphericImage(image,haze),x-width/2,top,width,entry.height*scale);
  if(tools.snow>.02 && plane==='back' && !renderer.assets.get(`quartier-${name}-hiver`)) {
    ctx.globalAlpha=tools.snow;ctx.drawImage(tools.snowCap(image),x-width/2,top,width,entry.height*scale);
  }
  ctx.restore();
}

export function drawCompleteFurniture(renderer,state) {
  // Un seul petit ensemble peint à la bordure de l'escalier ; aucun mobilier sur le QG.
  const image=seasonImage(renderer,'quartier-paris-mobilier',renderer.completeSnow || 0), entry=COMPLETE_CALIBRATION.layers['paris-mobilier'];
  if(!image || !entry) return;
  const {ctx,metrics:m}=renderer, span=7.5, width=span*m.pixelsPerUnit;
  const delta=ringDelta(renderer.cameraX,9.3,state.world.length);
  const drift=3.84*Math.tanh(delta*(1-1.35)/3.84);
  const x=m.anchorX+(delta-drift)*m.pixelsPerUnit;
  if(x+width/2<0 || x-width/2>renderer.width) return;
  const scale=width/entry.width, top=m.groundY-entry.baseline*scale;
  ctx.drawImage(image,x-width/2,top,width,entry.height*scale);
}

export function drawCompleteStreets(renderer,state,tools) {
  const {ctx,metrics:m}=renderer;
  renderer.completeSnow=tools.snow;
  renderer.completeSiteSigns=new Map();
  ctx.save();ctx.filter=tools.seasonFilter('street');
  for(const [name,entry] of Object.entries(COMPLETE_CALIBRATION.street)) {
    const image=seasonImage(renderer,`quartier-${name}`,tools.snow);
    if(!image) continue;
    const building=entry.site && state.buildings.find(b=>b.site_id===entry.site);
    const frame=completeStreetFrame(m,state.world,renderer.cameraX,entry,building);
    if(frame.left+frame.width<0 || frame.left>renderer.width) continue;
    ctx.drawImage(image,frame.left,frame.top,frame.width,frame.height);
    if(tools.snow>.02 && !renderer.assets.get(`quartier-${name}-hiver`)) {
      ctx.save();ctx.globalAlpha=tools.snow;
      ctx.drawImage(tools.snowCap(image),frame.left,frame.top,frame.width,frame.height);ctx.restore();
    }
    if(building) {
      const [sx,sy,sw,sh]=entry.sign;
      renderer.completeSiteSigns.set(entry.site,{x:frame.left+(sx+sw/2)*frame.scale,
        y:frame.top+(sy+sh/2)*frame.scale,w:sw*frame.scale,h:sh*frame.scale,painted:true});
      renderer.paintedSiteFrames.set(entry.site,{x:renderer.screenX(building.x),y:m.groundY,
        w:frame.width*.4,h:frame.height,u:m.characterHeight/81});
    }
  }
  ctx.restore();
}

export { COMPLETE_ZONES };

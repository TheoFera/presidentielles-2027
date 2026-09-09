import { ringDelta } from '../simulation/world.js';
import { neighboringSubzones } from './visual-assets.js';
import { buildingAssetId } from './illustrated-buildings.js';
import { seasonAt } from '../simulation/campaign-events.js';

const masked = new WeakMap();
const biomeNames = ['bobo','banlieue','periurbain','campagne','retraites','riches'];
export const sceneryParallax = Object.freeze({ street: 1, middle: .55, distant: .26 });
export function sceneryGroups(world) {
  return world.subzones.filter(z => z.local_index === 0).map(z => {
    const zones = world.subzones.filter(s => s.biome_index === z.biome_index);
    const width = zones.reduce((sum,s) => sum + s.width, 0);
    return { biome: biomeNames[z.biome_index], index:z.biome_index, start:z.start, center:z.start+width/2, width };
  });
}
export function sceneryProjection(camera, center, worldLength, pixelsPerUnit, anchor, speed) { return anchor + ringDelta(camera, center, worldLength) * pixelsPerUnit * speed; }
export const backgroundAssetId = zone => `background-${zone.index}`;
export const sceneryImageHeight = (image, width) => width * image.naturalHeight / image.naturalWidth;
export function scenerySeasonFilter(progress) {
  const season=seasonAt(progress||0), values=[[1,0,1],[.65,.3,1],[.24,0,1.06],[1.08,.06,1.08]];
  const current=values[season.index],next=values[(season.index+1)%4];
  const [saturation,sepia,brightness]=current.map((v,i)=>v+(next[i]-v)*season.blend);
  return `saturate(${saturation}) sepia(${sepia}) brightness(${brightness})`;
}

export function preloadWorld(renderer, state, zone) {
  if (renderer.artZone === zone.index) return;
  renderer.artZone = zone.index;
  const neighbors = neighboringSubzones(state.world.subzones, zone.index);
  const wanted = new Set(neighbors.map(backgroundAssetId));
  wanted.add('background-arena');
  wanted.add('distant-clouds');
  for (const index of [(zone.biome_index+5)%6,zone.biome_index,(zone.biome_index+1)%6]) {
    wanted.add(`background-strip-${biomeNames[index]}`); wanted.add(`distant-${biomeNames[index]}`);
    wanted.add(`street-${biomeNames[index]}`); wanted.add(`landscape-${biomeNames[index]}`);
  }
  for (const building of state.buildings) {
    if (neighbors.some(z => z.id === building.subzone_id)) wanted.add(buildingAssetId(building, state.world));
  }
  for (const id of Object.keys(renderer.assets.manifest)) {
    if (/^(character-|npc-|security-|crs-|journalist-|vegetation-|fx-|ui-)/.test(id)) wanted.add(id);
  }
  void renderer.assets.keep([...wanted]);
}

export function drawIllustratedSky(renderer, state) {
  const { ctx, width, metrics: m } = renderer;
  const season = seasonAt(state.campaign_progress_01 || 0);
  const colors = [[91,171,218],[158,180,201],[160,186,208],[119,191,219]];
  const a = colors[season.index], b = colors[(season.index + 1) % 4];
  const color = a.map((v, i) => Math.round(v + (b[i] - v) * season.blend));
  const sky = ctx.createLinearGradient(0, 0, 0, m.groundY);
  sky.addColorStop(0, `rgb(${color.join(',')})`); sky.addColorStop(1, '#e5e9d8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, renderer.height);
  const clouds = renderer.assets.get('distant-clouds');
  if (clouds) {
    const drift = Math.sin(renderer.cameraX / state.world.length * Math.PI * 2) * 65;
    ctx.save(); ctx.globalAlpha = .56; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(clouds, -80 + drift, renderer.height * .18, width + 160, renderer.height * .20);
    ctx.restore();
  }
}

const distantStrips = new WeakMap();
const landscapeEdges = new WeakMap();
function landscapeJoin(image) {
  if(landscapeEdges.has(image))return landscapeEdges.get(image);
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const c=canvas.getContext('2d');c.drawImage(image,0,0);
  // Opaque, irregular foliage contours interlock inside the overlap. This
  // avoids a vertical cut through trees without translucent double scenery.
  c.globalCompositeOperation='destination-in';c.beginPath();
  const edge=y=>38+20*Math.sin(y*.035)+9*Math.sin(y*.17)+5*Math.sin(y*.63);
  c.moveTo(edge(0),0);
  for(let y=0;y<=canvas.height;y+=2)c.lineTo(edge(y),y);
  c.lineTo(canvas.width,canvas.height);c.lineTo(canvas.width,0);c.closePath();c.fill();
  landscapeEdges.set(image,canvas);return canvas;
}
export function drawIllustratedDistance(renderer, state) {
  const {ctx, width, height, metrics: m} = renderer;
  ctx.save(); ctx.imageSmoothingEnabled = true;ctx.filter=scenerySeasonFilter(state.campaign_progress_01);
  const groups = sceneryGroups(state.world).map(group => ({...group, x:sceneryProjection(renderer.cameraX,group.center,state.world.length,m.pixelsPerUnit,m.anchorX,sceneryParallax.distant)})).sort((a,b)=>a.x-b.x);
  for (const group of groups) {
    const w = group.width*m.pixelsPerUnit*sceneryParallax.distant+36;
    if(group.x+w/2<0||group.x-w/2>width) continue;
    const image = renderer.assets.get(`distant-${group.biome}`); if(!image) continue;
    let strip = distantStrips.get(image);
    if(!strip) {
      strip=document.createElement('canvas');strip.width=image.naturalWidth;strip.height=image.naturalHeight;
      const c=strip.getContext('2d');c.drawImage(image,0,0);
      // Interleave the low woodland ends along a leaf-sized contour. The
      // overlapping ink stays opaque, so no tree dissolves into the sky.
      c.globalCompositeOperation='destination-in';c.fillStyle='#000';c.beginPath();
      const edge=y=>12+7*Math.sin(y*.19)+4*Math.sin(y*.53);
      c.moveTo(edge(0),0);
      for(let y=0;y<=strip.height;y+=2)c.lineTo(edge(y),y);
      c.lineTo(strip.width-edge(strip.height),strip.height);
      for(let y=strip.height;y>=0;y-=2)c.lineTo(strip.width-edge(y+13),y);
      c.closePath();c.fill();
      distantStrips.set(image,strip);
    }
    const h=sceneryImageHeight(image,w);
    const base=m.groundY-height*.32;
    ctx.drawImage(strip,0,strip.height-24,strip.width,24,group.x-w/2,base-1,w,m.groundY-base+1);
    ctx.drawImage(strip,group.x-w/2,base-h,w,h);
  }
  ctx.restore();
}

export function drawIllustratedMiddle(renderer,state) {
  const {ctx,width,height,metrics:m}=renderer;
  const visible=sceneryGroups(state.world).map(group=>({...group,x:sceneryProjection(renderer.cameraX,group.center,state.world.length,m.pixelsPerUnit,m.anchorX,sceneryParallax.middle),w:group.width*m.pixelsPerUnit*sceneryParallax.middle+2})).filter(group=>group.x+group.w/2>=0&&group.x-group.w/2<=width);
  const separated=visible.every(group=>renderer.assets.get(`landscape-${group.biome}`));
  if(!separated&&visible.some(group=>!renderer.assets.get(`background-strip-${group.biome}`)))return false;
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.filter=scenerySeasonFilter(state.campaign_progress_01);
  for(const group of visible.sort((a,b)=>a.x-b.x)) {
    const image=renderer.assets.get(`${separated?'landscape':'background-strip'}-${group.biome}`);
    const repeats=separated?2:1;
    for(let i=0;i<repeats;i++) {
    const w=group.w/repeats+(separated?80:0);
    const x=group.x+group.w*((i+.5)/repeats-.5);
    const h=sceneryImageHeight(image,w);
    const base=m.groundY-(separated?height*.12:0);
    const strip=separated?landscapeJoin(image):image;
    if(separated) {
      // The last rows contain only terrain. Continue that ground down behind
      // the street while preserving the proportions of every landmark above.
      ctx.drawImage(strip,0,strip.height-24,strip.width,24,x-w/2,base-1,w,m.groundY-base+1);
    }
    ctx.drawImage(strip,x-w/2,base-h,w,h);
    }
  }
  ctx.restore();return true;
}

export function drawIllustratedStreet(renderer,state) {
  const {ctx,width,metrics:m}=renderer;
  ctx.save();ctx.imageSmoothingEnabled=true;
  for(const group of sceneryGroups(state.world)) {
    const image=renderer.assets.get(`street-${group.biome}`);if(!image)continue;
    // Neighboring facades share the exact coordinates and speed of playable
    // sites. Only the landscape behind this row has parallax.
    for(let repeat=0;repeat<2;repeat++) {
      const center=group.start+group.width*(repeat+.5)/2;
      const x=sceneryProjection(renderer.cameraX,center,state.world.length,m.pixelsPerUnit,m.anchorX,sceneryParallax.street);
      const w=group.width*m.pixelsPerUnit/2+2;
      if(x+w/2<0||x-w/2>width)continue;
      const h=sceneryImageHeight(image,w);
      ctx.drawImage(image,x-w/2,m.groundY-h,w,h);
    }
  }
  ctx.restore();
}

// Opaque architecture over one shared sky, never two translucent facades.
// Only the sky connected to the image border is masked. Blue windows stay intact.
function sceneryCutout(image) {
  if (masked.has(image)) return masked.get(image);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  // The panorama's pavement is not part of the playable ground layer.
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = pixels, w = canvas.width, h = canvas.height;
  const visited = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const enqueue = index => {
    if (index < 0 || index >= visited.length || visited[index]) return;
    visited[index] = 1;
    const p = index * 4, r = data[p], g = data[p + 1], b = data[p + 2];
    const sky = b > r + 45 && g > r + 30 && b > g + 10;
    const exportMargin = index < w * h * 0.08 && r > 200 && g > 175 && b > 130;
    if (sky || exportMargin) queue[tail++] = index;
  };
  for (let x = 0; x < w; x++) enqueue(x);
  while (head < tail) {
    const i = queue[head++]; data[i * 4 + 3] = 0;
    if (i % w) enqueue(i - 1); if (i % w < w - 1) enqueue(i + 1);
    enqueue(i - w); enqueue(i + w);
  }
  // Locate the ink baseline above the deliberately empty ochre export margin.
  // Each panorama may have a different margin; a fixed crop reintroduces a second ground.
  let baseline = Math.floor(h * 0.9);
  for (let y = h - 1; y > h * 0.55; y--) {
    let ink = 0;
    for (let x = 0; x < w; x += 2) { const p = (y * w + x) * 4; if (data[p] < 130 && data[p + 1] < 125 && data[p + 2] < 115) ink++; }
    if (ink > w * 0.03) { baseline = y + 1; break; }
  }
  ctx.putImageData(pixels, 0, 0);
  const trimmed = document.createElement('canvas'); trimmed.width = w; trimmed.height = baseline;
  trimmed.getContext('2d').drawImage(canvas, 0, 0);
  masked.set(image, trimmed); return trimmed;
}

export function drawIllustratedZone(renderer, zone, left) {
  const image = renderer.assets.get(backgroundAssetId(zone));
  if (!image) return false;
  const { ctx, metrics: m } = renderer;
  const width = zone.width * m.pixelsPerUnit;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  // Wide rural vistas are distant hills, not a wall the height of a city block.
  const scales = { 3: 0.56, 4: 0.56, 5: 0.60, 10: 0.43 };
  const h = renderer.height * (scales[zone.index] || 0.74);
  ctx.drawImage(sceneryCutout(image), left, m.groundY - h, width, h);
  ctx.restore(); return true;
}

export function drawIllustratedGround(renderer) {
  const { ctx, metrics: m, width, height } = renderer;
  ctx.fillStyle = '#c9bd9f'; ctx.fillRect(0, m.groundY, width, m.groundThickness);
  ctx.fillStyle = '#3f4643'; ctx.fillRect(0, m.groundY, width, 2);
  ctx.fillStyle = '#e4d6b9'; ctx.fillRect(0, m.groundY + 3, width, 2);
  ctx.strokeStyle = '#8d8573'; ctx.lineWidth = 1;
  for (let x = -80 - renderer.cameraX * m.pixelsPerUnit % 80; x < width; x += 80) { ctx.beginPath(); ctx.moveTo(x, m.groundY + 3); ctx.lineTo(x - 5, m.groundY + m.groundThickness); ctx.stroke(); }
  const roadTop = m.groundY + m.groundThickness;
  const asphalt = ctx.createLinearGradient(0, roadTop, 0, height);
  asphalt.addColorStop(0, '#626967'); asphalt.addColorStop(1, '#4e5757');
  ctx.fillStyle = asphalt; ctx.fillRect(0, roadTop, width, height - roadTop);
  const phase = renderer.cameraX * m.pixelsPerUnit;
  ctx.fillStyle = '#c4c2ac24';
  for (let i = 0; i < 150; i++) {
    const x = ((i * 71.37 - phase) % width + width) % width;
    const y = roadTop + 2 + (i * 19.73 % Math.max(1, height - roadTop - 3));
    ctx.fillRect(x, y, i % 3 + 1, .65);
  }
}


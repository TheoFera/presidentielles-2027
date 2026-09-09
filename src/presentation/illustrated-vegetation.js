import { seasonAt } from '../simulation/campaign-events.js';

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const ink = '#374637';
const seasonalCanopies = new WeakMap();
function canopySeasons(image) {
  if (seasonalCanopies.has(image)) return seasonalCanopies.get(image);
  const variants = ['saturate(.7)', 'hue-rotate(-55deg) saturate(.85)', 'grayscale(.8)', 'hue-rotate(8deg) saturate(.7) brightness(1.13)'].map(filter => {
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); context.filter = filter; context.drawImage(image, 0, 0); return canvas;
  });
  seasonalCanopies.set(image, variants); return variants;
}
const shapes = [
  { name: 'platane urbain', width: 0.65, crown: 0.39, forks: 5 },
  { name: 'arbre de rue', width: 0.44, crown: 0.50, forks: 4 },
  { name: 'arbre de parc', width: 0.75, crown: 0.46, forks: 6 },
  { name: 'chêne rural', width: 0.89, crown: 0.40, forks: 7 },
  { name: 'haie taillée', width: 1.65, crown: 0.72, forks: 8 },
];

export function drawSeasonalTree(ctx, x, ground, height, shapeIndex, progress, seed = 0, canopy = null) {
  const shape = shapes[shapeIndex % shapes.length], season = seasonAt(progress);
  const palette = [[92,135,60],[193,121,49],[146,131,88],[135,176,73]];
  const color = mix(palette[season.index], palette[(season.index + 1) % 4], season.blend);
  const amount = [1,0.82,0,0.53];
  const leafAlpha = amount[season.index] + (amount[(season.index + 1) % 4] - amount[season.index]) * season.blend;
  const wide = height * shape.width, crownY = -height * (1 - shape.crown / 2);
  ctx.save(); ctx.translate(x, ground);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#453d31'; ctx.lineWidth = Math.max(5, height * 0.055);
  ctx.beginPath(); ctx.moveTo(-height * 0.035, 0); ctx.bezierCurveTo(3, -height * 0.3, -5, -height * 0.6, 1, -height * 0.82); ctx.stroke();
  ctx.strokeStyle = '#9e7751'; ctx.lineWidth *= 0.52;
  ctx.beginPath(); ctx.moveTo(-height * 0.025, -2); ctx.bezierCurveTo(4, -height * 0.3, -3, -height * 0.6, 2, -height * 0.81); ctx.stroke();
  for (let i = 0; i < shape.forks; i++) {
    const t = i / Math.max(1, shape.forks - 1), dx = (t - 0.5) * wide * 0.88;
    const endY = -height * (0.65 + Math.sin(t * Math.PI) * 0.29);
    ctx.strokeStyle = '#5c4935'; ctx.lineWidth = Math.max(1.5, height * 0.024);
    ctx.beginPath(); ctx.moveTo(0, -height * 0.35); ctx.quadraticCurveTo(dx * 0.4, -height * 0.60, dx, endY); ctx.stroke();
    ctx.lineWidth *= 0.5;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(dx * 0.68, endY + height * 0.14); ctx.lineTo(dx + side * height * 0.07, endY - height * 0.07); ctx.stroke(); }
  }
  if (leafAlpha > 0.001) {
    if (canopy) {
      const variants = canopySeasons(canopy), crownHeight = height * shape.crown * 1.3;
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = leafAlpha * (1 - season.blend);
      ctx.drawImage(variants[season.index], -wide * .57, crownY - crownHeight * .52, wide * 1.14, crownHeight);
      ctx.globalAlpha = leafAlpha * season.blend;
      ctx.drawImage(variants[(season.index + 1) % 4], -wide * .57, crownY - crownHeight * .52, wide * 1.14, crownHeight);
      ctx.globalAlpha = 1;
    } else {
    ctx.globalAlpha = leafAlpha;
    ctx.fillStyle = `rgb(${color.join(',')})`; ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * Math.PI * 2, bump = 1 + Math.sin(a * 11 + seed) * 0.055 + Math.sin(a * 19) * 0.035;
      const px = Math.cos(a) * wide * 0.5 * bump, py = crownY + Math.sin(a) * height * shape.crown * 0.56 * bump;
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 52; i++) {
      const a = i * 2.399 + seed, radius = Math.sqrt((i + 0.5) / 52);
      const px = Math.cos(a) * wide * 0.46 * radius, py = crownY + Math.sin(a) * height * shape.crown * 0.48 * radius;
      const light = i % 3 ? 17 : -24;
      ctx.strokeStyle = `rgb(${color.map(c => Math.max(0,Math.min(255,c+light))).join(',')})`;
      ctx.lineWidth = 2 + i % 3;
      ctx.beginPath(); ctx.moveTo(px - 2, py + 1); ctx.quadraticCurveTo(px, py - 3, px + 3, py); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    }
  }
  if (season.index === 3 && season.blend < 0.8) {
    ctx.fillStyle = '#f5e5c6';
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(Math.sin(i * 3 + seed) * wide * 0.32, crownY + Math.cos(i * 2) * height * shape.crown * 0.31, 1.5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

export function drawSeasonalScenery(renderer, state) {
  const { ctx, metrics: m } = renderer, progress = state.campaign_progress_01 || 0;
  const tree = (x, height, shape, seed) => {
    const canopy = renderer.assets.get(`vegetation-${shape}`) || renderer.assets.get('vegetation-0');
    if (!canopy) void renderer.assets.load(`vegetation-${shape}`);
    drawSeasonalTree(ctx, x, m.groundY, height, shape, progress, seed, canopy);
  };
  for (const zone of state.world.subzones) {
    const boundaryX = renderer.screenX(zone.start);
    if (boundaryX > -180 && boundaryX < renderer.width + 180) {
      // A low hedgerow belongs to the landscape; a giant tree must not hide a missing horizon.
      tree(boundaryX - 24, 46, 4, zone.index + 31);
      tree(boundaryX + 29, 38, 4, zone.index + 47);
    }
    for (let i = 0; i < 3; i++) {
      const x = renderer.screenX(zone.start + zone.width * (i + 0.6) / 3);
      if (x < -100 || x > renderer.width + 100) continue;
      const shape = zone.biome_index === 3 ? 3 : zone.biome_index === 4 ? (i === 1 ? 4 : 2) : (zone.index + i) % 3;
      tree(x, shape === 4 ? 35 : 74 + (zone.index * 17 + i * 11) % 32, shape, zone.index * 7 + i);
    }
  }
}

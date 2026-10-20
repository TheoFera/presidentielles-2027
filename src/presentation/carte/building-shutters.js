import { buildingShutterProgress } from '../../simulation/building-shutters.js';
import { plateFeatureFrame } from './carte-plate.js';
import { buildingGeometry } from './illustrated-buildings.js';

export const BUILDING_SHUTTER_ASSET = 'building-shutter-metal';
export const BUILDING_DOORS_ASSET = 'building-barn-doors';
export const BUILDING_DOOR_BACKDROP_ASSET = 'building-barn-door-backdrop';
export const BUILDING_CLOSURE_ASSETS = [BUILDING_SHUTTER_ASSET, BUILDING_DOORS_ASSET, BUILDING_DOOR_BACKDROP_ASSET, 'building-foreground-riches-b'];

// Ouvertures peintes en pixels dans les tuiles 1 920 × 1 080, indépendantes des points d'achat.
// Les grandes vitrines reçoivent un rideau large ; les autres locaux ferment seulement leur porte.
export const BUILDING_OPENINGS = {
  // Fermer la vitre seulement : les montants et le soubassement bleu restent visibles.
  'site:paris_a': { x: 1100, y: 820, w: 334, h: 130 },
  'site:paris_b': { x: 448, y: 772, w: 313, h: 173,
    foreground: [[[441, 883], [477, 887], [490, 939], [483, 941], [484, 951], [478, 951],
      [475, 944], [443, 944], [439, 952], [433, 951], [436, 940], [436, 890]]] },
  'site:paris_c': { x: 410, y: 820, w: 96, h: 184 },
  'site:banlieue_a': { x: 678, y: 830, w: 84, h: 169 },
  'site:banlieue_b': { x: 277, y: 757, w: 280, h: 183 },
  'site:banlieue_c': { x: 792, y: 822, w: 90, h: 181 },
  'site:periurbain_a': { x: 1058, y: 824, w: 88, h: 180 },
  'site:periurbain_b': { x: 175, y: 815, w: 280, h: 189 },
  'site:periurbain_c': { x: 890, y: 822, w: 94, h: 182 },
  'site:campagne_a': { x: 1434, y: 785, w: 195, h: 195, kind: 'doors',
    // Retire uniquement les battants peints dans la tuile ; l'intérieur et le reste du décor restent d'origine.
    repair: [{ x: 1379, y: 780, w: 55, h: 209 }, { x: 1629, y: 780, w: 67, h: 211 }] },
  'site:campagne_b': { x: 375, y: 822, w: 94, h: 182 },
  'site:campagne_c': { x: 642, y: 822, w: 94, h: 182 },
  'site:retraites_a': { x: 1208, y: 824, w: 94, h: 180 },
  'site:retraites_b': { x: 304, y: 810, w: 120, h: 187 },
  'site:retraites_c': { x: 1238, y: 820, w: 84, h: 184 },
  'site:riches_a': { x: 970, y: 840, w: 86, h: 92 },
  'site:riches_b': { x: 146, y: 694, w: 348, h: 305,
    // Les arbustes et leurs pots sont devant la vitrine : leur détourage (scripts/outils-images) est remis devant le rideau.
    foregroundImage: { id: 'building-foreground-riches-b', x: 262, y: 838 } },
  'site:riches_c': { x: 241, y: 741, w: 378, h: 230 },
};

/** Étendue occupée par une fermeture, y compris ses battants ouverts. */
export function buildingOpeningBounds(opening) {
  if (opening.kind !== 'doors') return opening;
  return { x: opening.x - 60, y: opening.y - 10, w: opening.w + 130, h: opening.h + 22 };
}

function drawDoors(renderer, opening, frame, progress, sprite, backdrop) {
  const { ctx } = renderer;
  if (renderer.fixedWorldActive && backdrop) {
    const sw = backdrop.naturalWidth || backdrop.width, sh = backdrop.naturalHeight || backdrop.height;
    for (const rect of opening.repair) {
      ctx.drawImage(backdrop, rect.x / 1920 * sw, rect.y / 1080 * sh, rect.w / 1920 * sw, rect.h / 1080 * sh,
        frame.x0 + rect.x * frame.scaleX, frame.y0 + rect.y * frame.scaleY, rect.w * frame.scaleX, rect.h * frame.scaleY);
    }
  }
  const half = frame.w / 2;
  // Les battants pivotent au-delà de 90° : ouverts, ils se rabattent de part et d'autre de l'entrée.
  const angle = (1 - progress) * Math.acos(-0.57), projection = Math.cos(angle);
  const perspective = Math.sin(angle) * 8 * frame.scaleY;
  // Rectangle opaque de la planche générée (les petites marges transparentes restent hors de la source).
  const bounds = { x: 95, y: 92, w: 1062, h: 1070 }, leafWidth = bounds.w / 2;
  for (const side of [0, 1]) {
    const hinge = frame.left + side * frame.w, direction = side === 0 ? 1 : -1;
    if (Math.abs(projection) < 0.015) {
      ctx.fillStyle = '#18383d'; ctx.fillRect(hinge - frame.scaleX, frame.top, 2 * frame.scaleX, frame.h);
      continue;
    }
    // Petites bandes pour suivre la perspective du battant, sans introduire un moteur 3D.
    for (let i = 0; i < 16; i++) {
      const a = i / 16, b = (i + 1) / 16, mid = (a + b) / 2;
      const x0 = hinge + direction * half * projection * a, x1 = hinge + direction * half * projection * b;
      const y = frame.top - perspective * mid, h = frame.h + perspective * mid * 2;
      const w = Math.abs(x1 - x0) + frame.scaleX * 0.15;
      ctx.save(); ctx.translate(projection < 0 ? Math.max(x0, x1) : Math.min(x0, x1), y);
      if (projection < 0) ctx.scale(-1, 1);
      ctx.fillStyle = '#285763'; ctx.fillRect(0, 0, w, h);
      if (sprite) {
        const sx = bounds.x + side * leafWidth + (side === 0 ? a : 1 - b) * leafWidth;
        ctx.drawImage(sprite, sx, bounds.y, leafWidth / 16, bounds.h, 0, 0, w, h);
      }
      ctx.restore();
    }
  }
}

// Les 32 bandes de perspective restent calculées pendant le mouvement. Au repos,
// on réutilise leur rendu à la résolution physique exacte du canevas, sans réduction.
const doorImages = new WeakMap();
function drawRestingDoors(renderer, opening, frame, progress, sprite, backdrop) {
  if ((progress !== 0 && progress !== 1) || !renderer.fixedWorldActive
    || !sprite || !backdrop || typeof document === 'undefined') return false;
  const { ctx } = renderer, t = ctx.getTransform();
  if (t.b !== 0 || t.c !== 0 || t.a <= 0 || t.d <= 0 || ctx.globalAlpha !== 1) return false;
  const bounds = buildingOpeningBounds(opening);
  const left = Math.floor((frame.x0 + bounds.x * frame.scaleX) * t.a + t.e) - 2;
  const top = Math.floor((frame.y0 + bounds.y * frame.scaleY) * t.d + t.f) - 2;
  const width = Math.ceil(bounds.w * frame.scaleX * t.a) + 4;
  const height = Math.ceil(bounds.h * frame.scaleY * t.d) + 4;
  const originX = frame.x0 * t.a + t.e - left, originY = frame.y0 * t.d + t.f - top;
  let cache = doorImages.get(renderer);
  if (!cache || cache.sprite !== sprite || cache.backdrop !== backdrop) {
    cache = { sprite, backdrop, images: new Map() }; doorImages.set(renderer, cache);
  }
  const key = [opening.x, opening.y, progress, frame.scaleX, frame.scaleY, t.a, t.d,
    originX.toFixed(8), originY.toFixed(8), width, height, ctx.imageSmoothingEnabled, ctx.imageSmoothingQuality].join('|');
  let image = cache.images.get(key);
  if (!image) {
    image = document.createElement('canvas'); image.width = width; image.height = height;
    const c = image.getContext('2d');
    c.imageSmoothingEnabled = ctx.imageSmoothingEnabled; c.imageSmoothingQuality = ctx.imageSmoothingQuality;
    c.setTransform(t.a, 0, 0, t.d, originX, originY);
    const local = { ...frame, x0: 0, y0: 0,
      left: frame.left - frame.x0, top: frame.top - frame.y0 };
    drawDoors({ ctx: c, fixedWorldActive: true }, opening, local, progress, sprite, backdrop);
    // Petit cache borné, y compris si le zoom ou l'orientation change.
    if (cache.images.size >= 16) cache.images.delete(cache.images.keys().next().value);
    cache.images.set(key, image);
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(image, left, top); ctx.restore();
  return true;
}

function drawPanel(ctx, texture, frame, progress) {
  const { left, top, w, h, scaleX, scaleY } = frame;
  const rail = 3 * scaleX, casing = 7 * scaleY;
  ctx.save();
  ctx.beginPath(); ctx.rect(left, top, w, h); ctx.clip();
  const lowered = h * progress;
  if (lowered > 0) {
    if (texture) {
      const sw = texture.naturalWidth || texture.width, sh = texture.naturalHeight || texture.height;
      // Le rideau glisse derrière son coffre : ses lames ne sont jamais écrasées pendant le mouvement.
      ctx.drawImage(texture, 0, sh * (1 - progress), sw, sh * progress, left + rail, top, w - rail * 2, lowered);
    } else {
      ctx.fillStyle = '#495457'; ctx.fillRect(left + rail, top, w - rail * 2, lowered);
      ctx.fillStyle = '#82908d';
      for (let y = top + lowered % (8 * scaleY); y < top + lowered; y += 8 * scaleY) ctx.fillRect(left + rail, y, w - rail * 2, scaleY);
    }
    const bar = Math.min(lowered, 4 * scaleY), bottom = top + lowered - bar;
    ctx.fillStyle = '#253338'; ctx.fillRect(left + rail, bottom, w - rail * 2, bar);
    ctx.fillStyle = '#8b9690'; ctx.fillRect(left + rail, bottom, w - rail * 2, scaleY);
    ctx.fillStyle = '#161f24'; ctx.fillRect(left + w / 2 - 6 * scaleX, bottom + scaleY, 12 * scaleX, 2 * scaleY);
  }
  ctx.fillStyle = '#273b40';
  ctx.fillRect(left, top, rail, h); ctx.fillRect(left + w - rail, top, rail, h);
  ctx.fillRect(left, top, w, casing);
  ctx.fillStyle = '#87908a'; ctx.fillRect(left, top, w, scaleY);
  ctx.fillStyle = '#14282e'; ctx.fillRect(left, top + casing - scaleY, w, scaleY);
  ctx.restore();
}

function restoreForeground(renderer, opening, frame) {
  const cutout = opening.foregroundImage && renderer.assets.get(opening.foregroundImage.id);
  if (cutout) {
    // Détourage exact : dessiné à sa place dans la tuile, seulement sur la partie couverte par le rideau.
    const { ctx } = renderer, { x, y } = opening.foregroundImage;
    ctx.save(); ctx.beginPath(); ctx.rect(frame.left, frame.top, frame.w, frame.h); ctx.clip();
    ctx.drawImage(cutout, frame.x0 + x * frame.scaleX, frame.y0 + y * frame.scaleY,
      (cutout.naturalWidth || cutout.width) * frame.scaleX, (cutout.naturalHeight || cutout.height) * frame.scaleY);
    ctx.restore(); return;
  }
  if (!opening.foreground) return;
  const image = renderer.assets.get(frame.tile);
  if (!image) return;
  const sw = image.naturalWidth || image.width, sh = image.naturalHeight || image.height;
  const { ctx } = renderer;
  // Seule la partie recouverte par le rideau doit être remise au premier plan.
  // Le reste du pot ou de l'arbuste est déjà présent dans la tuile.
  ctx.save(); ctx.beginPath(); ctx.rect(frame.left, frame.top, frame.w, frame.h); ctx.clip();
  ctx.beginPath();
  for (const polygon of opening.foreground) {
    polygon.forEach(([x, y], i) => {
      const px = frame.x0 + x * frame.scaleX, py = frame.y0 + y * frame.scaleY;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }
  ctx.clip();
  ctx.drawImage(image, 0, 0, sw, sh, frame.x0, frame.y0, 1920 * frame.scaleX, 1080 * frame.scaleY);
  ctx.restore();
}

/** Dessiné après les façades et avant les personnages ; limité aux 18 contrôles de territoire. */
export function drawBuildingShutters(renderer, state) {
  const hz = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const tick = renderer.buildingShutterTick ?? state.tick;
  const texture = renderer.assets.get(BUILDING_SHUTTER_ASSET);
  const doors = renderer.assets.get(BUILDING_DOORS_ASSET), backdrop = renderer.assets.get(BUILDING_DOOR_BACKDROP_ASSET);
  for (const id of BUILDING_CLOSURE_ASSETS) if (!renderer.assets.get(id)) void renderer.assets.load(id);
  for (const building of state.buildings) {
    if (!building.controls_zone) continue;
    const opening = BUILDING_OPENINGS[building.site_id];
    if (!opening) continue;
    let frame;
    if (renderer.fixedWorldActive) frame = plateFeatureFrame(renderer, building, opening);
    else {
      const geometry = buildingGeometry(renderer, building), scale = geometry.h / 400;
      frame = { left: renderer.screenX(building.x) - geometry.w * 0.12, top: renderer.metrics.groundY - geometry.h * 0.36,
        w: geometry.w * 0.24, h: geometry.h * 0.36, scaleX: scale, scaleY: scale };
    }
    const margin = opening.kind === 'doors' ? 70 * (frame?.scaleX || 1) : 0;
    if (!frame || frame.left + frame.w + margin < 0 || frame.left - margin > renderer.width) continue;
    const progress = buildingShutterProgress(building, tick, hz);
    if (opening.kind === 'doors') {
      if (!drawRestingDoors(renderer, opening, frame, progress, doors, backdrop)) drawDoors(renderer, opening, frame, progress, doors, backdrop);
    }
    else drawPanel(renderer.ctx, texture, frame, progress);
    if (renderer.fixedWorldActive && progress > 0) restoreForeground(renderer, opening, frame);
  }
}

import { ringDelta, zoneAt } from '../simulation/world.js';
import { buildingLabel } from '../simulation/building-rules.js';
import { formatEuros } from './money.js';
import { fixedWorldArt, PANORAMA_SCALE, PANORAMA_OVERLAP } from './fixed-world-data.js';

const prepared = new WeakMap();
export const fixedPanoramaId = biome => `panorama-${fixedWorldArt[biome].art}`;

/** Une seule échelle pour les deux axes, quelle que soit la résolution de l'écran. */
export function panoramaFrame(renderer, world, biomeId, image = null) {
  const zone = world.subzones.find(z => z.biome_id === biomeId);
  const art = fixedWorldArt[biomeId];
  const span = world.subzones.filter(z => z.biome_id === biomeId).reduce((sum, z) => sum + z.width, 0);
  const nominalWidth = span * renderer.metrics.pixelsPerUnit;
  const width = nominalWidth * PANORAMA_SCALE;
  const height = image ? width * image.naturalHeight / image.naturalWidth : width / art.aspect;
  const center = renderer.metrics.anchorX + ringDelta(renderer.cameraX, zone.start + span / 2, world.length) * renderer.metrics.pixelsPerUnit;
  return { left: center - width / 2, top: renderer.metrics.groundY - height * art.baseline,
    width, height, center, nominalWidth, biomeId };
}

export function preparePanorama(image) {
  if (prepared.has(image)) return prepared.get(image);
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
  // La scène précédente reste opaque sous ce fondu ; aucune trouée au raccord.
  const start = (0.5 - (0.5 + PANORAMA_OVERLAP) / PANORAMA_SCALE) * canvas.width;
  const end = (0.5 - (0.5 - PANORAMA_OVERLAP) / PANORAMA_SCALE) * canvas.width;
  const fade = ctx.createLinearGradient(start, 0, end, 0);
  fade.addColorStop(0, '#0000'); fade.addColorStop(1, '#000');
  ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = fade; ctx.fillRect(0, 0, canvas.width, canvas.height);
  prepared.set(image, canvas); return canvas;
}

export function drawFixedWorld(renderer, state) {
  const frames = Object.keys(fixedWorldArt).map(id => {
    const image = renderer.assets.get(fixedPanoramaId(id));
    return image && { ...panoramaFrame(renderer, state.world, id, image), image };
  });
  if (frames.some(frame => !frame)) return false;
  const { ctx, width, height, metrics: m } = renderer;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#9ecbe0'; ctx.fillRect(0, 0, width, height);
  const period = state.world.length * m.pixelsPerUnit;
  // Les copies périodiques traitent exactement comme les autres le raccord Riches → Paris.
  const copies = frames.flatMap(frame => [-period, 0, period].map(offset => ({ ...frame, left: frame.left + offset, center: frame.center + offset })))
    .filter(frame => frame.center + frame.nominalWidth * (0.5 + PANORAMA_OVERLAP) >= (renderer.visibleWorld?.left ?? 0)
      && frame.center - frame.nominalWidth * (0.5 + PANORAMA_OVERLAP) <= (renderer.visibleWorld?.right ?? width))
    .sort((a, b) => a.center - b.center);
  for (const frame of copies) {
    const clipLeft = frame.center - frame.nominalWidth * (0.5 + PANORAMA_OVERLAP);
    ctx.save(); ctx.beginPath(); ctx.rect(clipLeft, 0, frame.nominalWidth * (1 + 2 * PANORAMA_OVERLAP), m.groundY + 1); ctx.clip();
    ctx.drawImage(preparePanorama(frame.image), frame.left, frame.top, frame.width, frame.height);
    ctx.restore();
  }
  ctx.restore(); return true;
}

export function integratedBuildingGeometry(renderer, building) {
  if (!building.facade) return null;
  const art = fixedWorldArt[building.biome_id];
  const width = renderer.config.prototype.world.units_per_screen * renderer.config.layout.screens_per_subzone * 3 * renderer.metrics.pixelsPerUnit * PANORAMA_SCALE;
  const height = width / art.aspect;
  const [, , signY, signW] = building.facade;
  return { w: width * signW, h: height * (art.baseline - signY), top: renderer.metrics.groundY - height * (art.baseline - signY) };
}

/** La façade est déjà peinte dans le panorama. Seuls l'enseigne et le fanion sont dynamiques. */
export function drawIntegratedBuilding(renderer, state, building) {
  if (!building.facade || !renderer.fixedWorldActive) return false;
  const { ctx, metrics: m } = renderer;
  const image = renderer.assets.get(fixedPanoramaId(building.biome_id));
  const frame = panoramaFrame(renderer, state.world, building.biome_id, image);
  const [, sx, sy, sw, sh] = building.facade;
  const x = frame.left + sx * frame.width, y = frame.top + sy * frame.height;
  const w = sw * frame.width, h = sh * frame.height;
  if (x + w < 0 || x - w > renderer.width) return true;
  const faction = renderer.p.factions[building.owner_id];
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = building.headquarters ? 'QG · PERMANENCE' : buildingLabel(building).toUpperCase();
  ctx.fillStyle = '#f3e4c5'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = '#303c40'; ctx.font = `800 ${Math.max(8, Math.min(13, h * 0.5))}px system-ui`;
  ctx.fillText(label, x, y, w - 8);
  if (faction) {
    ctx.fillStyle = faction.color; ctx.fillRect(x - w / 2, y + h / 2 - 3, w, 3);
    if (building.controls_zone) {
      ctx.strokeStyle = '#343d3b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w / 2 + 4, y + h); ctx.lineTo(x + w / 2 + 4, y - 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w / 2 + 5, y - 30); ctx.lineTo(x + w / 2 + 27, y - 27 + Math.sin(state.tick / 12) * 2);
      ctx.lineTo(x + w / 2 + 25, y - 14); ctx.lineTo(x + w / 2 + 5, y - 17); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  const nearby = candidate && Math.abs(ringDelta(candidate.x, building.x, state.world.length)) < 3;
  if (nearby && building.owner_id === candidate.faction_id && ['permanence', 'financement'].includes(building.type)) {
    ctx.fillStyle = '#263b35'; ctx.fillRect(x - w / 2, y + h / 2 + 5, w, 19);
    ctx.fillStyle = '#ffedba'; ctx.font = '700 10px system-ui'; ctx.fillText(`Cagnotte : ${formatEuros(building.stored_money_cents)}`, x, y + h / 2 + 15, w - 4);
  }
  ctx.restore(); return true;
}

export function drawRallyAccessories(renderer, entity, x, feetY, height, state) {
  if (!entity.rally_event_id || entity.rally_index % 5) return;
  const { ctx } = renderer;
  const event = state.campaign_events.find(e => e.id === entity.rally_event_id);
  const text = { paris_19e: 'ENSEMBLE', banlieue: 'JUSTICE', periurbain_usine: 'EMPLOIS', campagne: 'NOS FERMES', retraites: 'HOMMAGE', quartiers_riches: 'SOLIDARITÉ' }[event?.target_biome_id] || 'ENSEMBLE';
  const y = feetY - height * 1.2 + Math.sin(state.tick / 8 + entity.rally_index) * 2;
  ctx.save(); ctx.strokeStyle = '#60442a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 14, feetY - height * 0.5); ctx.lineTo(x - 14, y); ctx.stroke();
  ctx.fillStyle = '#ecd3a2'; ctx.strokeStyle = '#473e31'; ctx.fillRect(x - 46, y - 22, 64, 23); ctx.strokeRect(x - 46, y - 22, 64, 23);
  ctx.fillStyle = '#343b38'; ctx.font = '800 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(text, x - 14, y - 7, 59); ctx.restore();
}

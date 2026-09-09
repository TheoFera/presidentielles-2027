import { biomeArtId } from './illustrated-characters.js';
import { zoneAt } from '../simulation/world.js';
import { factionVariant } from '../simulation/building-rules.js';

const families = { permanence: 'campaign_local', financement: 'financement', tour_communication: 'communication', faction: 'security_admin_slot', imprimerie: 'imprimerie', meeting: 'meeting_hall', institut_sondage: 'polling_institute' };
export function buildingAssetId(building, world) {
  return `building-${families[building.type]}-${biomeArtId(zoneAt(world, building.x).biome_id)}`;
}

export function buildingGeometry(renderer, building, sprite) {
  let h = renderer.metrics.characterHeight * (building.type === 'tour_communication' ? 2.85 : 2.4);
  const ratio = sprite ? sprite.naturalWidth / sprite.naturalHeight : 0.8;
  const w = Math.min(renderer.width * 0.21, h * ratio);
  h = w / ratio;
  return { w, h, top: renderer.metrics.groundY - h };
}

const signSlots = new WeakMap();
// Find the uninterrupted light sign panel in the illustration, once per loaded sprite.
// Keep its paper texture and ink border instead of drawing a second placard above it.
function signSlot(sprite) {
  if (signSlots.has(sprite)) return signSlots.get(sprite);
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 200;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sprite, 0, 0, 160, 200);
  const { data } = ctx.getImageData(0, 0, 160, 200);
  let start = -1, best = [18, 43];
  for (let y = 8; y <= 108; y++) {
    let light = 0;
    for (let x = 30; x < 130; x++) {
      const i = (y * 160 + x) * 4;
      if (data[i + 3] > 240 && data[i] > 190 && data[i + 1] > 165 && data[i + 2] > 120 && data[i] - data[i + 2] > 12) light++;
    }
    if (light >= 92 && y < 108) { if (start < 0) start = y; }
    else if (start >= 0) {
      if (y - start > best[1] - best[0] || (best[0] === 18 && y - start >= 12)) best = [start, y];
      start = -1;
    }
  }
  const slot = { center: (best[0] + best[1]) / 400, bottom: best[1] / 200 };
  signSlots.set(sprite, slot); return slot;
}

export function drawIllustratedBuilding(renderer, state, building) {
  const visibleX = renderer.screenX(building.x);
  if (visibleX < -renderer.width * 0.3 || visibleX > renderer.width * 1.3) return true;
  const id = buildingAssetId(building, state.world);
  const sprite = renderer.assets.get(id);
  if (!sprite) { void renderer.assets.load(id); return false; }
  const { ctx, metrics: m, p, width, height, config } = renderer;
  const service = ['meeting', 'institut_sondage'].includes(building.type);
  const { w, h } = buildingGeometry(renderer, building, sprite);
  const x = renderer.screenX(building.x), left = x - w / 2, top = m.groundY - h;
  if (x + w < 0 || x - w > width) return true;
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  const variant = building.type === 'faction' ? building.variant || factionVariant(candidate.faction_id) : building.type;
  const label = building.headquarters ? 'QG' : ({ permanence: 'PERMANENCE', financement: 'FINANCEMENT', tour_communication: 'COMMUNICATION', service_ordre: 'LOCAL SO', cabinet_administratif: 'CABINET', imprimerie: 'IMPRIMERIE', meeting: 'SALLE DE MEETING', institut_sondage: 'SONDAGES' }[variant] || 'LOCAL');
  const runningMeeting = building.type === 'meeting' && building.meeting_until_tick > state.tick;
  const faction = p.factions[service ? (runningMeeting ? building.meeting_faction_id : null) : building.owner_id];
  const ownershipAlpha = 1 - Math.min(1, building.closure_progress || 0);
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sprite, left, top, w, h);
  const sign = signSlot(sprite);
  ctx.textAlign = 'center'; ctx.fillStyle = '#2e3538'; ctx.font = '800 10px system-ui';
  ctx.fillText(label, x, top + h * sign.center + 3, w * 0.76);
  if (faction) {
    ctx.globalAlpha = ownershipAlpha;
    ctx.fillStyle = faction.color; ctx.fillRect(left + w * 0.12, top + h * sign.bottom - 2, w * 0.76, 3);
    for (let level = 0; level < (runningMeeting ? building.meeting_level : building.level); level++) {
      ctx.fillStyle = '#fff5db'; ctx.strokeStyle = faction.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(left + 11 + level * 15, top + h * sign.bottom + 7, 10, 14, 1); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = '#3b3730'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left + w - 8, top + 12); ctx.lineTo(left + w - 8, top - 25); ctx.stroke();
    ctx.fillStyle = faction.color; ctx.beginPath(); ctx.moveTo(left + w - 7, top - 25); ctx.lineTo(left + w + 18, top - 21 + Math.sin(state.tick / 8) * 2); ctx.lineTo(left + w + 16, top - 7); ctx.lineTo(left + w - 7, top - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (building.headquarters) {
      ctx.fillStyle = faction.color; ctx.strokeStyle = '#e7c36a'; ctx.lineWidth = 2;
      ctx.fillRect(left - 8, top + 28, 18, 58); ctx.strokeRect(left - 8, top + 28, 18, 58);
      ctx.fillStyle = '#fff7e3'; ctx.font = 'bold 10px system-ui'; ctx.fillText('QG', left + 1, top + 48);
      ctx.fillText('★', left + 1, top + 65);
    }
    ctx.globalAlpha = 1;
  }
  if (building.type === 'faction' && building.owner_id) {
    ctx.fillStyle = '#f6ecd9'; ctx.fillRect(x - 23, top + h * 0.48, 46, 18);
    ctx.fillStyle = '#303b41'; ctx.font = 'bold 8px system-ui'; ctx.fillText(variant === 'cabinet_administratif' ? 'DOSSIERS' : 'ÉQUIPEMENT', x, top + h * 0.48 + 12);
  }
  if (building.funding_state === 'RUNNING') {
    ctx.fillStyle = '#403d33'; ctx.fillRect(left + 16, top + h * 0.7, w - 32, 8);
    ctx.fillStyle = '#f3d37b'; ctx.fillRect(left + 18, top + h * 0.7 + 2, (w - 36) * building.funding_progress_01, 4);
    ctx.font = 'bold 19px system-ui'; ctx.fillText('€', x, top + h * 0.64);
  }
  if (building.type === 'imprimerie' && building.queue?.length) {
    ctx.fillStyle = '#fff1d2'; for (let i = 0; i < Math.min(8, building.queue.length); i++) ctx.fillRect(x + 20 + i, m.groundY - 25 - i * 3, 18, 3);
  }
  if (runningMeeting) {
    ctx.strokeStyle = faction?.color || '#c19943'; ctx.lineWidth = 2;
    const phase = (state.tick % 40) / 40; ctx.globalAlpha = 1 - phase;
    ctx.beginPath(); ctx.ellipse(x, m.groundY - 10, 25 + phase * 35, 8 + phase * 9, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (building.closure_progress > 0 || building.state === 'CLOSED') {
    ctx.globalAlpha = building.state === 'CLOSED' ? 0.9 : building.closure_progress;
    ctx.fillStyle = '#a4a09a'; ctx.fillRect(left + w * 0.2, top + h * 0.35, w * 0.6, h * 0.6);
    ctx.strokeStyle = '#544941'; ctx.lineWidth = 1;
    for (let y = top + h * 0.35; y < m.groundY - h * 0.05; y += 6) { ctx.beginPath(); ctx.moveTo(left + w * 0.2, y); ctx.lineTo(left + w * 0.8, y); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillStyle = '#f7ecd3'; ctx.fillRect(x - 26, top + h * 0.56, 52, 16);
    ctx.fillStyle = '#934d40'; ctx.font = 'bold 9px system-ui'; ctx.fillText(building.state === 'CLOSED' ? 'FERMÉ' : 'FERMETURE', x, top + h * 0.56 + 11);
  }
  if (building.state === 'ACTIVE' && building.type === 'faction') {
    const offsets = config.balance.faction_interactions;
    ctx.font = 'bold 8px system-ui'; ctx.fillStyle = '#343c3d';
    ctx.fillText(variant === 'service_ordre' ? '← RAID' : '← FERMER', renderer.screenX(building.x - offsets.side_offset), m.groundY - 7);
    ctx.fillText(variant === 'service_ordre' ? 'RAID →' : 'FERMER →', renderer.screenX(building.x + offsets.side_offset), m.groundY - 7);
  }
  if (building.state === 'ACTIVE' && building.type === 'financement' && building.level < config.balance.buildings.financement.max_level) {
    ctx.font = 'bold 8px system-ui'; ctx.fillStyle = '#343c3d'; ctx.fillText('↑ AMÉLIORER', renderer.screenX(building.x + config.balance.buildings.financement.upgrade_offset), m.groundY - 8);
  }
  if (building.type === 'financement' && building.funding_completed_tick !== null && state.tick - building.funding_completed_tick < config.balance.buildings.financement.completion_feedback_seconds * config.balance.simulation_architecture.fixed_tick_hz) {
    ctx.fillStyle = '#936826'; ctx.font = 'bold 13px system-ui'; ctx.fillText(`+${building.funding_last_payout.toLocaleString('fr-FR')} k €`, x, top - 18);
  }
  ctx.restore();
  return true;
}

import { CAMPAIGN_STYLES } from '../../simulation/campaign-styles.js';
import { garageVehicle } from '../../simulation/vehicles.js';
import { ringDelta } from '../../simulation/world.js';

const atlasFrames = new WeakMap();
const wheelMotion = new WeakMap();

// Centres horizontaux et rayons dans les images d'origine (rapportés à leur largeur).
// La hauteur se mesure depuis le bas de chaque pose, quelle que soit sa tenue.
const wheelLayouts = {
  melenchon: { velo: [[.161, .058], [.383, .058]], scooter: [[.638, .040], [.874, .041]] },
  le_pen: { velo: [[.184, .061], [.385, .061]], scooter: [[.634, .040], [.849, .042]] },
  philippe: { velo: [[.167, .059], [.369, .059]], scooter: [[.634, .041], [.868, .043]] },
  bardella: { velo: [[.111, .084], [.398, .084]], scooter: [[.605, .054], [.915, .055]] },
};

export function vehicleWheelTravel(renderer, entity, x, state) {
  let motions = wheelMotion.get(renderer);
  if (!motions) { motions = new Map(); wheelMotion.set(renderer, motions); }
  const worldX = renderer.cameraX + (x - renderer.metrics.anchorX) / renderer.metrics.pixelsPerUnit;
  const previous = motions.get(entity.id);
  const vehicle = `${entity.vehicle.type}:${entity.vehicle.site_id}`;
  const continuous = previous && previous.vehicle === vehicle && state.tick >= previous.tick && state.tick - previous.tick <= 30;
  const distance = continuous ? previous.distance + ringDelta(previous.x, worldX, state.world.length) : 0;
  motions.set(entity.id, { x: worldX, tick: state.tick, vehicle, distance });
  return distance;
}

function drawTurningWheels(renderer, entity, sprite, frame, h, w, distance) {
  const layout = wheelLayouts[entity.bardella_form ? 'bardella' : entity.faction_id]?.[entity.vehicle.type];
  if (!layout) return;
  const { ctx, metrics: m } = renderer;
  const scale = h / frame.height;
  for (const [centre, size] of layout) {
    const radius = size * sprite.naturalWidth * scale;
    const cx = (centre * sprite.naturalWidth - frame.x) * scale - w / 2;
    const cy = -radius;
    const angle = distance * m.pixelsPerUnit / radius * (entity.facing < 0 ? -1 : 1);
    ctx.save(); ctx.translate(cx, cy);
    // Seule la partie dégagée tourne : cadre, fourche, carter et garde-boue
    // restent devant la roue, comme dans l'illustration d'origine.
    ctx.beginPath(); ctx.rect(-radius, radius * .15, radius * 2, radius); ctx.clip();
    ctx.beginPath(); ctx.arc(0, 0, radius * .78, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = entity.vehicle.type === 'velo' ? '#303633' : '#8f9494';
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.rotate(angle);
    ctx.strokeStyle = entity.vehicle.type === 'velo' ? '#bac0b5' : '#dfe3df';
    ctx.lineWidth = Math.max(.65, radius * .045);
    const spokes = entity.vehicle.type === 'velo' ? 12 : 5;
    for (let i = 0; i < spokes; i++) {
      const a = i * Math.PI * 2 / spokes;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius * .2, Math.sin(a) * radius * .2);
      ctx.lineTo(Math.cos(a) * radius * .77, Math.sin(a) * radius * .77); ctx.stroke();
    }
    ctx.restore();
  }
}
export function prepareVehicleAtlas(id, image) {
  if (atlasFrames.has(image)) return atlasFrames.get(image);
  const rows = id === 'vehicles' || id === 'riders-bardella' ? 1 : 4;
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const frames = [];
  for (let col = 0; col < 2; col++) {
    const x0 = Math.floor(col * canvas.width / 2), x1 = Math.floor((col + 1) * canvas.width / 2);
    // Les espaces transparents séparent les poses : ne pas couper une roue ou
    // une coiffure lorsque le dessin déborde légèrement de sa cellule théorique.
    const bands = []; let band = null;
    for (let y = 0; y <= canvas.height; y++) {
      let ink = 0;
      if (y < canvas.height) for (let x = x0; x < x1; x++) if (data[(y * canvas.width + x) * 4 + 3] > 96) ink++;
      if (ink) {
        if (!band) band = { start: y, end: y + 1, ink: 0 };
        band.end = y + 1; band.ink += ink;
      } else if (band) { bands.push(band); band = null; }
    }
    const poses = bands.sort((a, b) => b.ink - a.ink).slice(0, rows).sort((a, b) => a.start - b.start);
    for (let row = 0; row < rows; row++) {
      const y0 = poses.length === rows ? poses[row].start : Math.floor(row * canvas.height / rows);
      const y1 = poses.length === rows ? poses[row].end : Math.floor((row + 1) * canvas.height / rows);
      let left = x1, right = x0, top = y1, bottom = y0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (data[(y * canvas.width + x) * 4 + 3] > 96) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      frames[row * 2 + col] = { x: left, y: top, width: Math.max(1, right - left + 1), height: Math.max(1, bottom - top + 1) };
    }
  }
  atlasFrames.set(image, frames); return frames;
}

export function drawMountedCandidate(renderer, entity, x, state) {
  if (entity.role !== 'CANDIDAT' || !entity.vehicle) return false;
  const id = `riders-${entity.bardella_form ? 'bardella' : entity.faction_id}`;
  const sprite = renderer.assets.get(id);
  if (!sprite) { void renderer.assets.load(id); return false; }
  const row = entity.bardella_form ? 0 : Math.max(0, 1 + CAMPAIGN_STYLES[entity.faction_id].findIndex(s => s.id === entity.current_campaign_style));
  const frame = prepareVehicleAtlas(id, sprite)[row * 2 + (entity.vehicle.type === 'scooter' ? 1 : 0)];
  const { ctx, metrics: m } = renderer;
  const h = m.characterHeight * 1.12, w = h * frame.width / frame.height;
  const bob = entity.moving ? Math.sin(state.tick * 0.6) * 0.6 : 0;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#28363325'; ctx.beginPath(); ctx.ellipse(x, m.groundY + 6, w * 0.45, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, m.groundY + 6 + bob); ctx.scale(entity.facing < 0 ? -1 : 1, 1);
  ctx.drawImage(sprite, frame.x, frame.y, frame.width, frame.height, -w / 2, -h, w, h);
  drawTurningWheels(renderer, entity, sprite, frame, h, w, vehicleWheelTravel(renderer, entity, x, state));
  ctx.restore(); return true;
}

export function drawVehiclePrompts(renderer, state) {
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  if (!candidate || candidate.eliminated) return;
  const { ctx, metrics: m } = renderer;
  for (const site of state.buildings) {
    const kind = garageVehicle(site.type);
    if (!kind || site.owner_id !== candidate.faction_id || site.state !== 'ACTIVE') continue;
    const x = renderer.screenX(site.x);
    if (Math.abs(ringDelta(candidate.x, site.x, state.world.length)) > 3 || candidate.vehicle) continue;
    const progress = candidate.vehicle_hold?.site_id === site.id ? candidate.vehicle_hold.elapsed_ticks / (renderer.config.balance.vehicles.mount_seconds * renderer.config.balance.simulation_architecture.fixed_tick_hz) : 0;
    // L'étiquette sert elle-même de jauge : elle se remplit pendant la montée.
    const label = `${kind === 'velo' ? 'Vélo' : 'Scooter'} · restez immobile`;
    const w = 150, h = 24, left = x - w / 2, top = m.groundY - m.characterHeight - 40;
    ctx.save(); ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffefd2'; ctx.strokeStyle = '#465c52'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(left, top, w, h, 12); ctx.fill();
    if (progress > 0) { ctx.fillStyle = '#b9d0a4'; ctx.beginPath(); ctx.roundRect(left, top, w * Math.min(1, progress), h, 12); ctx.fill(); }
    ctx.beginPath(); ctx.roundRect(left, top, w, h, 12); ctx.stroke();
    ctx.fillStyle = '#43594e'; ctx.fillText(label, x, top + h / 2 + 0.5); ctx.restore();
  }
}

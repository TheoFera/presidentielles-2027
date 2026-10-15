import { CAMPAIGN_STYLES } from '../../simulation/campaign-styles.js';
import { garageVehicle, vehicleMountSite } from '../../simulation/vehicles.js';
import { ringDelta } from '../../simulation/world.js';

const atlasFrames = new WeakMap();
const wheelMotion = new WeakMap();
const wheelSpins = new WeakMap();

// Le garage d'origine suffit à distinguer les deux scooters, y compris dans
// les anciennes sauvegardes et les instantanés multijoueurs.
export function mountedVehicleAssetId(entity, state) {
  const candidate = entity.bardella_form ? 'bardella' : entity.faction_id;
  const site = state.buildings?.find(b => b.id === entity.vehicle?.site_id);
  const modern = entity.vehicle?.type === 'scooter' && site?.subzone_id === 'periurbain_b';
  return `riders-${modern ? 'periurbain-' : ''}${candidate}`;
}

// Centres horizontaux et rayons dans les images d'origine (rapportés à leur largeur).
// La hauteur se mesure depuis le bas de chaque pose, quelle que soit sa tenue.
const wheelLayouts = {
  melenchon: { velo: [[.161, .058], [.383, .058]], scooter: [[.638, .040], [.874, .041]] },
  le_pen: { velo: [[.184, .061], [.385, .061]], scooter: [[.634, .040], [.849, .042]] },
  philippe: { velo: [[.167, .059], [.369, .059]], scooter: [[.634, .041], [.868, .043]] },
  bardella: { velo: [[.111, .084], [.398, .084]], scooter: [[.605, .054], [.915, .055]] },
};
const modernWheelLayouts = {
  melenchon: [[.166, .124], [.862, .132]],
  le_pen: [[.175, .127], [.872, .13]],
  philippe: [[.17, .125], [.86, .13]],
  bardella: [[.161, .134], [.849, .14]],
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

// Angle affiché d'une roue. À grande vitesse, les rayons avanceraient presque
// d'un écart entre deux rayons à chaque image et sembleraient tourner à
// l'envers : on limite donc le pas à un tiers de cet écart.
export function vehicleWheelSpin(spin, distance, pixelsPerUnit, radius, spokes) {
  const step = spin ? (distance - spin.distance) * pixelsPerUnit / radius : 0;
  const limit = Math.PI * 2 / spokes / 3;
  return { distance, angle: (spin?.angle || 0) + Math.max(-limit, Math.min(limit, step)) };
}

function drawTurningWheels(renderer, entity, sprite, frame, h, w, distance, modern = false) {
  // Les nouveaux pneus sont plus grands : leurs centres sont mesurés dans
  // chaque pose recadrée, et non dans l'ancienne planche vélo/scooter.
  const candidate = entity.bardella_form ? 'bardella' : entity.faction_id;
  const layout = modern ? modernWheelLayouts[candidate] : wheelLayouts[candidate]?.[entity.vehicle.type];
  if (!layout) return;
  const { ctx, metrics: m } = renderer;
  let spins = wheelSpins.get(renderer);
  if (!spins) { spins = new Map(); wheelSpins.set(renderer, spins); }
  const scale = h / frame.height;
  const spokes = entity.vehicle.type === 'velo' ? 12 : 5;
  layout.forEach(([centre, size], index) => {
    const radius = size * (modern ? frame.width : sprite.naturalWidth) * scale;
    const cx = modern ? centre * w - w / 2 : (centre * sprite.naturalWidth - frame.x) * scale - w / 2;
    const cy = -radius;
    const key = `${entity.id}:${index}`;
    const spin = vehicleWheelSpin(spins.get(key), distance, m.pixelsPerUnit, radius, spokes);
    spins.set(key, spin);
    // Le dessin est retourné quand le candidat regarde à gauche : on compense.
    const angle = spin.angle * (entity.facing < 0 ? -1 : 1);
    ctx.save(); ctx.translate(cx, cy);
    // Seule la partie dégagée tourne : cadre, fourche, carter et garde-boue
    // restent devant la roue, comme dans l'illustration d'origine.
    ctx.beginPath(); ctx.rect(-radius, radius * .15, radius * 2, radius); ctx.clip();
    ctx.beginPath(); ctx.arc(0, 0, radius * .78, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = modern ? '#292b28' : entity.vehicle.type === 'velo' ? '#303633' : '#8f9494';
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.rotate(angle);
    ctx.strokeStyle = modern ? '#74776d' : entity.vehicle.type === 'velo' ? '#bac0b5' : '#dfe3df';
    ctx.lineWidth = Math.max(.65, radius * .045);
    for (let i = 0; i < spokes; i++) {
      const a = i * Math.PI * 2 / spokes;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius * .2, Math.sin(a) * radius * .2);
      ctx.lineTo(Math.cos(a) * radius * .77, Math.sin(a) * radius * .77); ctx.stroke();
    }
    ctx.restore();
  });
}
export function prepareVehicleAtlas(id, image) {
  if (atlasFrames.has(image)) return atlasFrames.get(image);
  const modern = id.startsWith('riders-periurbain-');
  const columns = modern && id.endsWith('bardella') ? 1 : 2;
  const rows = id === 'vehicles' || id.endsWith('bardella') ? 1 : modern ? 2 : 4;
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const frames = [];
  for (let col = 0; col < columns; col++) {
    const x0 = Math.floor(col * canvas.width / columns), x1 = Math.floor((col + 1) * canvas.width / columns);
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
      frames[row * columns + col] = { x: left, y: top, width: Math.max(1, right - left + 1), height: Math.max(1, bottom - top + 1) };
    }
  }
  atlasFrames.set(image, frames); return frames;
}

export function drawMountedCandidate(renderer, entity, x, state) {
  if (entity.role !== 'CANDIDAT' || !entity.vehicle) return false;
  const id = mountedVehicleAssetId(entity, state);
  const sprite = renderer.assets.get(id);
  if (!sprite) { void renderer.assets.load(id); return false; }
  const row = entity.bardella_form ? 0 : Math.max(0, 1 + CAMPAIGN_STYLES[entity.faction_id].findIndex(s => s.id === entity.current_campaign_style));
  const modern = id.startsWith('riders-periurbain-');
  const frame = prepareVehicleAtlas(id, sprite)[modern ? row : row * 2 + (entity.vehicle.type === 'scooter' ? 1 : 0)];
  const { ctx, metrics: m } = renderer;
  const h = m.characterHeight * 1.12, w = h * frame.width / frame.height;
  const bob = entity.moving ? Math.sin(state.tick * 0.6) * 0.6 : 0;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#28363325'; ctx.beginPath(); ctx.ellipse(x, m.groundY + 6, w * 0.45, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, m.groundY + 6 + bob); ctx.scale(entity.facing < 0 ? -1 : 1, 1);
  ctx.drawImage(sprite, frame.x, frame.y, frame.width, frame.height, -w / 2, -h, w, h);
  drawTurningWheels(renderer, entity, sprite, frame, h, w, vehicleWheelTravel(renderer, entity, x, state), modern);
  ctx.restore(); return true;
}

export function drawVehiclePrompts(renderer, state) {
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  const site = vehicleMountSite(state, renderer.config, candidate);
  if (!site || candidate.vehicle_hold?.site_id !== site.id || !(candidate.vehicle_hold.elapsed_ticks > 0)) return;
  const { ctx, metrics: m } = renderer;
  const kind = garageVehicle(site.type);
  const x = renderer.screenX(site.x);
  const duration = Math.ceil(renderer.config.balance.vehicles.mount_seconds * renderer.config.balance.simulation_architecture.fixed_tick_hz);
  const progress = candidate.vehicle_hold.elapsed_ticks / duration;
  // L'étiquette sert elle-même de jauge : elle se remplit pendant la montée.
  const label = kind === 'velo' ? 'Monter sur le vélo' : 'Monter sur le scooter';
  const w = 150, h = 24, left = x - w / 2, top = m.groundY - m.characterHeight - 40;
  ctx.save(); ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffefd2'; ctx.strokeStyle = '#465c52'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(left, top, w, h, 12); ctx.fill();
  if (progress > 0) { ctx.fillStyle = '#b9d0a4'; ctx.beginPath(); ctx.roundRect(left, top, w * Math.min(1, progress), h, 12); ctx.fill(); }
  ctx.beginPath(); ctx.roundRect(left, top, w, h, 12); ctx.stroke();
  ctx.fillStyle = '#43594e'; ctx.fillText(label, x, top + h / 2 + 0.5); ctx.restore();
}

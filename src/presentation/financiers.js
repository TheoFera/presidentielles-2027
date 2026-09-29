import { ringDelta } from '../simulation/world.js';
import { visibleFinancier } from '../simulation/funding-encounters.js';
import { cleanGeneratedImage } from './fixed-world.js';

/**
 * Financiers occultes : visibles uniquement par le candidat pour qui ils sont apparus.
 * Planche de 3 poses côte à côte : discret, contrat tendu, liasse de billets.
 */
const boxes = new WeakMap();
/** Boîte opaque de chaque pose (le personnage ne remplit pas toute sa case). */
function poseBoxes(sheet) {
  if (boxes.has(sheet)) return boxes.get(sheet);
  const ctx = sheet.getContext('2d', { willReadFrequently: true });
  const cell = sheet.width / 3, { data } = ctx.getImageData(0, 0, sheet.width, sheet.height);
  const result = [0, 1, 2].map(index => {
    let left = cell, right = 0, top = sheet.height, bottom = 0;
    for (let y = 0; y < sheet.height; y += 2) for (let x = Math.floor(index * cell); x < (index + 1) * cell; x += 2) {
      if (data[(y * sheet.width + x) * 4 + 3] < 128) continue;
      const cx = x - index * cell; left = Math.min(left, cx); right = Math.max(right, cx); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return { x: index * cell + left, y: top, w: Math.max(1, right - left), h: Math.max(1, bottom - top) };
  });
  boxes.set(sheet, result); return result;
}

export function drawFinanciers(renderer, state) {
  const encounter = visibleFinancier(state, state.local_candidate_id);
  if (!encounter) return;
  const image = renderer.assets.get(`financier-${encounter.kind}`);
  if (!image) { void renderer.assets.load(`financier-${encounter.kind}`); return; }
  const { ctx, metrics: m, config } = renderer, settings = config.balance.funding_encounters;
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  const x = renderer.screenX(encounter.x), gap = ringDelta(encounter.x, candidate.x, state.world.length);
  if (x < -200 || x > renderer.width + 200) return;
  const signTicks = Math.ceil(settings.sign_seconds * config.balance.simulation_architecture.fixed_tick_hz);
  const progress = encounter.hold_ticks / signTicks;
  const pose = progress > 0.55 ? 2 : Math.abs(gap) <= settings.sign_radius_units + 1.2 ? 1 : 0;
  const sheet = cleanGeneratedImage(image), frame = poseBoxes(sheet)[pose];
  const height = m.characterHeight * 1.02, width = height * frame.w / frame.h, feet = m.groundY + 1;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = 'rgba(30,30,30,0.18)'; ctx.beginPath(); ctx.ellipse(x, feet, width * 0.42, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, feet); if (gap < 0) ctx.scale(-1, 1);
  ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, -width / 2, -height, width, height);
  ctx.restore();
  // Bulle : qui est-ce et comment signer.
  const amount = `${(settings.amount_eur).toLocaleString('fr-FR')} €`;
  const text = progress > 0 ? `Signature du contrat… ${amount}` : `${encounter.label} · restez immobile pour signer (${amount})`;
  ctx.save(); ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.min(renderer.width - 20, ctx.measureText(text).width + 22), y = feet - height - 26;
  ctx.fillStyle = '#fff6df'; ctx.strokeStyle = '#4c3a22'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12, w, 24, 8); ctx.fill(); ctx.stroke();
  if (progress > 0) { ctx.fillStyle = '#e4c569'; ctx.beginPath(); ctx.roundRect(x - w / 2 + 3, y - 9, (w - 6) * Math.min(1, progress), 18, 6); ctx.fill(); }
  ctx.fillStyle = '#3b2c19'; ctx.fillText(text, x, y + 1, w - 10);
  ctx.restore();
}

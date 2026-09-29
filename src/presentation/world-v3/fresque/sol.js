import { hash, mix } from './kit.js';
import { seasonalGround } from '../ground.js';
import { GROUND_KEYS, PLANES } from './scene.js';

/**
 * Trottoir, bordure et chaussée de la fresque, continus sur toute la carte : chaque quartier a sa matière
 * (pavés parisiens, bitume de banlieue, bas-côtés herbeux, chemin de campagne, promenade du bord de mer…)
 * et les couleurs se fondent sur quelques mètres aux frontières. Dessinés à chaque image (saisons).
 */
export const SOLS = {
  paris: { walk: '#d8ccb0', joint: '#b5a788', curb: '#a39f95', road: '#8d8880', pattern: 'paves' },
  banlieue: { walk: '#cbc7bd', joint: '#a9a59b', curb: '#aaa79f', road: '#66696b', pattern: 'bitume', line: 'dash' },
  periurbain: { walk: '#c7c1b0', joint: '#a8a28f', curb: '#8fae5e', road: '#6f7377', pattern: 'bitume', line: 'solid', verge: true },
  campagne: { walk: '#c9ad7c', joint: null, curb: '#86a75a', road: '#8f8a78', pattern: 'gravier', verge: true },
  retraites: { walk: '#e8dcc0', joint: '#cbbd9c', curb: '#c3b9a3', road: '#7a7b77', pattern: 'bitume', line: 'dash' },
  mer: { walk: '#efe4c8', joint: '#d8c9a4', curb: '#f4f1e8', road: '#ecd9a6', pattern: 'sable' },
  riches: { walk: '#e3d9c5', joint: '#c4b9a2', curb: '#a9a59b', road: '#5c6062', pattern: 'bitume' },
};

/** Matière dominante et mélange de couleurs à la position monde x. */
export function solAt(x, length = 432) {
  const w = ((x % length) + length) % length;
  let a = GROUND_KEYS[GROUND_KEYS.length - 1], b = GROUND_KEYS[0];
  for (let i = 0; i < GROUND_KEYS.length - 1; i++) if (w >= GROUND_KEYS[i][0] && w < GROUND_KEYS[i + 1][0]) { a = GROUND_KEYS[i]; b = GROUND_KEYS[i + 1]; break; }
  const span = b[0] - a[0], t = span > 0 ? (w - a[0]) / span : 0;
  const A = SOLS[a[1]], B = SOLS[b[1]];
  if (a[1] === b[1]) return { ...A, t: 0, key: a[1] };
  const mixed = {};
  for (const name of ['walk', 'curb', 'road']) mixed[name] = mix(A[name], B[name], t);
  return { ...(t < 0.5 ? A : B), ...mixed, joint: t < 0.5 ? A.joint : B.joint, t, key: t < 0.5 ? a[1] : b[1] };
}

export function drawFresqueGround(renderer, state, u) {
  const { ctx, metrics: m } = renderer, H = renderer.height, ppu = m.pixelsPerUnit;
  const view = renderer.visibleWorld || { left: 0, right: renderer.width };
  const top = m.groundY - PLANES.street.base * u, curbY = m.groundY + 7.6 * u, curbH = Math.max(3, 4.9 * u), bottom = H + 4;
  const season = seasonalGround(state.campaign_progress_01);
  const worldAt = sx => renderer.cameraX + (sx - m.anchorX) / ppu;
  const step = 4;
  ctx.save();
  for (let sx = Math.floor(view.left / step) * step; sx < view.right + step; sx += step) {
    const s = solAt(worldAt(sx + step / 2));
    ctx.fillStyle = s.walk; ctx.fillRect(sx, top, step + 0.5, curbY - top);
    ctx.fillStyle = s.curb; ctx.fillRect(sx, curbY, step + 0.5, curbH);
    ctx.fillStyle = s.road; ctx.fillRect(sx, curbY + curbH, step + 0.5, bottom - curbY - curbH);
    if (s.key === 'mer') { // la mer affleure au bas de l'écran, devant la plage
      const seaY = curbY + curbH + 9 * u;
      ctx.fillStyle = '#4f8fb5'; ctx.fillRect(sx, seaY, step + 0.5, bottom - seaY);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; const wave = Math.sin((worldAt(sx) * 3 + state.tick / 20)) * 1.5 * u; ctx.fillRect(sx, seaY - 1 + wave, step + 0.5, 2 * u);
    }
  }
  ctx.fillStyle = 'rgba(40,40,30,0.18)'; ctx.fillRect(view.left, top, view.right - view.left, Math.max(2, 2.6 * u));
  // Motifs : joints de dalles, pavés, gravier, lignes blanches, herbe du bas-côté.
  const x0 = worldAt(view.left) - 1, x1 = worldAt(view.right) + 1, X = x => m.anchorX + (x - renderer.cameraX) * ppu;
  ctx.lineWidth = 1;
  for (let x = Math.floor(x0 * 2) / 2; x < x1; x += 0.5) {
    const s = solAt(x), sx = X(x), rt = curbY + curbH;
    if (s.joint && x % 1.5 < 0.5) { ctx.strokeStyle = s.joint; ctx.beginPath(); ctx.moveTo(sx, top); ctx.lineTo(sx - (curbY - top) * 0.25, curbY); ctx.stroke(); }
    if (s.pattern === 'paves') { ctx.fillStyle = mix(s.road, '#b8b0a2', 0.45); for (let row = 0; row < 3; row++) ctx.fillRect(sx + (row % 2) * 6 * u, rt + (4 + row * 9) * u, 10 * u, 5 * u); }
    else if (s.pattern === 'gravier') { ctx.fillStyle = '#b3955f'; ctx.fillRect(sx + hash(x) * 16, top + (curbY - top) * hash(x, 1), 2, 2); ctx.fillStyle = mix(s.road, '#c8c0a8', 0.5); ctx.fillRect(sx + hash(x, 3) * 18, rt + 3 + hash(x, 4) * 14 * u, 2, 2); }
    else if (s.pattern === 'sable') { ctx.fillStyle = '#d9c28a'; ctx.fillRect(sx + hash(x) * 18, rt + 2 + hash(x, 2) * 6 * u, 1.5, 1.5); }
    else { ctx.fillStyle = mix(s.road, '#9a9ea2', 0.5); ctx.fillRect(sx + hash(x, 3) * 18, rt + 3 + hash(x, 4) * 16 * u, 2, 2); }
    if (s.line === 'dash' && x % 3 < 0.5) { ctx.fillStyle = '#ecebe2'; ctx.fillRect(sx, rt + 16 * u, 1.5 * ppu, 3 * u); }
    if (s.line === 'solid') { ctx.fillStyle = '#ecebe2'; ctx.fillRect(sx, rt + 16 * u, 0.5 * ppu + 0.5, 3 * u); }
    if (s.verge) { ctx.fillStyle = '#6f9146'; for (let k = 0; k < 3; k++) ctx.fillRect(sx + k * 6, curbY - 2 - hash(x, k + 2) * 4 * u, 2, (4 + hash(x, k + 2) * 4) * u); }
  }
  ctx.strokeStyle = '#2f3632'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(view.left, curbY); ctx.lineTo(view.right, curbY); ctx.moveTo(view.left, curbY + curbH); ctx.lineTo(view.right, curbY + curbH); ctx.stroke();
  // Saisons
  if (season.leaves > 0.02) {
    const palette = ['#c9772f', '#a4552a', '#d9a441'];
    for (let x = Math.floor(x0 / 0.37) * 0.37; x < x1; x += 0.37) if (hash(x, 5) < season.leaves * 0.8) {
      ctx.fillStyle = palette[Math.floor(hash(x, 6) * 3)]; ctx.beginPath(); ctx.ellipse(X(x), top + 3 + hash(x, 7) * (curbY - top), 3 * u, 1.6 * u, hash(x, 8) * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (season.snow > 0.02) {
    ctx.globalAlpha = Math.min(1, season.snow); ctx.fillStyle = '#f4f7f8';
    ctx.fillRect(view.left, curbY - 2, view.right - view.left, curbH * 0.6);
    for (let x = Math.floor(x0 / 0.55) * 0.55; x < x1; x += 0.55) { const w = ppu * (0.4 + hash(x, 9) * 0.9); ctx.beginPath(); ctx.ellipse(X(x), top + (curbY - top) * (0.2 + hash(x, 10) * 0.6), w / 2, (curbY - top) * 0.22, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

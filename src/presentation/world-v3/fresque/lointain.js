import { INK, alpha, box, glass, line, lit, mix, outline, pitchedRoof, rng, shade } from './kit.js';
import { lisiere } from './nature.js';

/**
 * Plans lointains : même style que la rue, simplifié (moins de détails, traits plus fins).
 * Chaque plan reçoit ensuite une brume uniforme (perspective atmosphérique) dans le rendu.
 * Ces éléments sont dessinés à l'échelle réelle ; le plan les réduit (`scale`).
 */

/** Église de village : nef, clocher carré, flèche d'ardoise, abat-sons. */
export function eglise(ctx, p = {}) {
  const c = p.color || '#d9c9a4', roof = p.roof || '#6f7780';
  box(ctx, -70, -120, 100, 120, c, 1.4); lit(ctx, -69, -119, 98, 118, c);
  ctx.beginPath(); ctx.moveTo(-76, -120); ctx.lineTo(-20, -168); ctx.lineTo(36, -120); ctx.closePath(); ctx.fillStyle = roof; ctx.fill(); outline(ctx, 1.4);
  for (const wx of [-50, -10]) { ctx.beginPath(); ctx.moveTo(wx - 7, -40); ctx.lineTo(wx - 7, -76); ctx.quadraticCurveTo(wx, -86, wx + 7, -76); ctx.lineTo(wx + 7, -40); ctx.closePath(); ctx.fillStyle = '#4d6275'; ctx.fill(); outline(ctx, 1); }
  box(ctx, 30, -200, 44, 200, shade(c, -0.03), 1.4);
  for (const sy of [-170, -140]) { ctx.beginPath(); ctx.moveTo(44, sy + 18); ctx.lineTo(44, sy); ctx.quadraticCurveTo(52, sy - 8, 60, sy); ctx.lineTo(60, sy + 18); ctx.closePath(); ctx.fillStyle = '#3a3a3a'; ctx.fill(); for (let yy = sy + 3; yy < sy + 18; yy += 4) line(ctx, 44, yy, 60, yy, 1, '#8a7a5a'); }
  ctx.beginPath(); ctx.moveTo(26, -200); ctx.lineTo(52, -268); ctx.lineTo(78, -200); ctx.closePath(); ctx.fillStyle = roof; ctx.fill(); outline(ctx, 1.4);
  line(ctx, 52, -268, 52, -286, 1.6); line(ctx, 46, -280, 58, -280, 1.6);
  ctx.save(); ctx.translate(52, 0); ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-11, -34); ctx.quadraticCurveTo(0, -46, 11, -34); ctx.lineTo(11, 0); ctx.closePath(); ctx.fillStyle = '#6b4a2e'; ctx.fill(); outline(ctx, 1.2); ctx.restore();
}

/** Éolienne : mât conique, nacelle, trois pales fines. */
export function eolienne(ctx, p = {}) {
  const h = p.h || 220, a = p.angle ?? 0.4;
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-2.5, -h); ctx.lineTo(2.5, -h); ctx.lineTo(5, 0); ctx.closePath(); ctx.fillStyle = '#f2f4f5'; ctx.fill(); outline(ctx, 1, '#8a9aa6');
  box(ctx, -4, -h - 5, 14, 8, '#f2f4f5', 1, '#8a9aa6');
  for (let i = 0; i < 3; i++) { const b = a + i * Math.PI * 2 / 3; ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(Math.cos(b - 0.05) * h * 0.46, -h + Math.sin(b - 0.05) * h * 0.46); ctx.lineTo(Math.cos(b + 0.03) * h * 0.46, -h + Math.sin(b + 0.03) * h * 0.46); ctx.closePath(); ctx.fillStyle = '#f7f8f9'; ctx.fill(); outline(ctx, 0.8, '#8a9aa6'); }
}

/** Rangée de toits de Paris : façades crème percées de fenêtres, toits de zinc, souches et lucarnes, quelques dômes. */
export function toitsParis(ctx, p) {
  const r = rng(p.seed || 1), w = p.w;
  let x = -w / 2;
  while (x < w / 2) {
    const bw = 90 + r() * 80, bh = 230 + r() * 90, stone = r.pick(['#ecdfc2', '#e6d6b4', '#efe4ca', '#e2cfb0']);
    box(ctx, x, -bh, bw, bh, stone, 1.2);
    ctx.fillStyle = alpha('#4d6275', 0.8); for (let yy = -bh + 16; yy < -20; yy += 30) for (let xx = x + 10; xx < x + bw - 10; xx += 18) ctx.fillRect(xx, yy, 8, 16);
    ctx.fillStyle = '#2b2826'; for (const yy of [-bh + 44, -bh + 104]) ctx.fillRect(x + 4, yy, bw - 8, 2);
    const rh = 34; ctx.beginPath(); ctx.moveTo(x - 2, -bh); ctx.lineTo(x + 10, -bh - rh); ctx.lineTo(x + bw - 10, -bh - rh); ctx.lineTo(x + bw + 2, -bh); ctx.closePath(); ctx.fillStyle = '#7f8b96'; ctx.fill(); outline(ctx, 1.1);
    for (let xx = x + 18; xx < x + bw - 14; xx += 26) box(ctx, xx, -bh - 22, 10, 14, '#eee6d4', 0.8);
    for (let k = 0; k < 2; k++) { const cx = x + bw * (0.25 + k * 0.5); box(ctx, cx - 9, -bh - rh - 16, 18, 18, '#d8bc9c', 0.9); for (let i = 0; i < 3; i++) box(ctx, cx - 7 + i * 5, -bh - rh - 21, 3.5, 5, '#c2673f', 0.5); }
    if (r() < 0.12) { const dx = x + bw / 2; ctx.beginPath(); ctx.moveTo(dx - 26, -bh - rh); ctx.quadraticCurveTo(dx - 26, -bh - rh - 50, dx, -bh - rh - 56); ctx.quadraticCurveTo(dx + 26, -bh - rh - 50, dx + 26, -bh - rh); ctx.closePath(); ctx.fillStyle = '#8a969f'; ctx.fill(); outline(ctx, 1.1); }
    x += bw;
  }
}

/** Grands ensembles au loin : tours et barres sur pelouses, arbres au pied. */
export function cite(ctx, p) {
  const r = rng(p.seed || 2), w = p.w;
  let x = -w / 2;
  while (x < w / 2) {
    const tower = !p.low && r() < 0.45, bw = tower ? 90 + r() * 30 : 220 + r() * 140, bh = tower ? 420 + r() * 180 : p.low ? 110 + r() * 50 : 160 + r() * 60;
    const c = r.pick(['#e1ddd2', '#d9d3c5', '#e6dfcf']), accent = r.pick(['#c9826a', '#7fa3bf', '#94b38a', '#d8b56a']);
    box(ctx, x + 20, -bh, bw, bh, c, 1.2); lit(ctx, x + 21, -bh + 1, bw - 2, bh - 2, c);
    for (let yy = -bh + 14; yy < -24; yy += 22) for (let xx = x + 30; xx < x + bw + 10; xx += 20) { ctx.fillStyle = r() < 0.2 ? accent : '#5d7082'; ctx.fillRect(xx, yy, 10, 12); }
    ctx.beginPath(); ctx.rect(x + 20, -bh, bw, bh); outline(ctx, 1.2);
    x += bw + 30 + r() * 60;
  }
  lisiere(ctx, { w, h: 80, seed: p.seed, color: '#6a9150' });
}

/**
 * Butte Montmartre : colline couverte d'immeubles en gradins et d'arbres, le Sacré-Cœur au sommet
 * (comme dans le panorama world-v2 de Paris B).
 */
export function butteMontmartre(ctx, p) {
  const w = p.w, H = p.h || 260, r = rng(p.seed || 9);
  const hill = x => -H * Math.pow(Math.cos(Math.min(1, Math.abs(x) / (w / 2)) * Math.PI / 2), 1.6);
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); for (let x = -w / 2; x <= w / 2; x += 6) ctx.lineTo(x, hill(x)); ctx.lineTo(w / 2, 0); ctx.closePath();
  ctx.fillStyle = '#7f9a62'; ctx.fill(); outline(ctx, 1.2);
  // Gradins d'immeubles parisiens, du haut vers le bas, entrecoupés d'arbres
  for (let row = 0; row < 6; row++) {
    const span = w * (0.16 + row * 0.14);
    for (let x = -span / 2; x < span / 2; x += 40 + r() * 26) {
      const base = hill(x) + 30 + row * 26, bw = 34 + r() * 20, bh = 44 + r() * 26;
      if (r() < 0.22) { ctx.fillStyle = r.pick(['#5f8a48', '#6a9450', '#557f42']); ctx.beginPath(); ctx.ellipse(x + bw / 2, base - bh * 0.45, bw * 0.6, bh * 0.5, 0, 0, Math.PI * 2); ctx.fill(); outline(ctx, 0.8); continue; }
      box(ctx, x, base - bh, bw, bh, r.pick(['#ecdfc2', '#e6d4b0', '#efe3c8', '#e2c9a6', '#dcc3a0']), 0.9);
      ctx.fillStyle = '#5d7082'; for (let yy = base - bh + 8; yy < base - 8; yy += 12) for (let xx = x + 5; xx < x + bw - 5; xx += 9) ctx.fillRect(xx, yy, 4, 6);
      ctx.beginPath(); ctx.moveTo(x - 2, base - bh); ctx.lineTo(x + 5, base - bh - 10); ctx.lineTo(x + bw - 5, base - bh - 10); ctx.lineTo(x + bw + 2, base - bh); ctx.closePath(); ctx.fillStyle = '#7f8b96'; ctx.fill(); outline(ctx, 0.8);
    }
  }
  ctx.save(); ctx.translate(0, hill(0) + 22); sacreCoeurSeul(ctx, 1.25); ctx.restore();
}
/** Le Sacré-Cœur seul (sans colline), pour le poser sur une butte dessinée ailleurs. */
function sacreCoeurSeul(ctx, s) {
  const c = '#f3efe6', ink = '#8a8574';
  ctx.save(); ctx.scale(s, s);
  const body = (x, y, w, h) => box(ctx, x, y, w, h, c, 1 / s, ink);
  const dome = (cx, base, rr, tall) => { ctx.beginPath(); ctx.moveTo(cx - rr, base); ctx.bezierCurveTo(cx - rr, base - tall * 0.9, cx - rr * 0.2, base - tall, cx, base - tall - 6); ctx.bezierCurveTo(cx + rr * 0.2, base - tall, cx + rr, base - tall * 0.9, cx + rr, base); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); outline(ctx, 1 / s, ink); ctx.fillRect(cx - 1, base - tall - 14, 2, 9); };
  body(-40, -44, 80, 44); body(-18, -76, 36, 32); dome(0, -76, 20, 40);
  for (const dx of [-30, 30]) { body(dx - 7, -60, 14, 16); dome(dx, -60, 8, 16); }
  body(40, -100, 14, 100); dome(47, -100, 7, 16);
  ctx.fillStyle = 'rgba(120,110,90,0.18)'; ctx.fillRect(4, -76, 14, 76);
  ctx.restore();
}

/** Entrepôt logistique géant : très longue boîte de bardage gris, bandeau de couleur, quais de chargement numérotés. */
export function entrepotGeant(ctx, p) {
  const w = p.w, x = -w / 2, h = p.h || 150;
  box(ctx, x, -h, w, h, '#dfe2e4', 1.4);
  ctx.strokeStyle = alpha('#aab1b7', 0.7); ctx.lineWidth = 1; ctx.beginPath(); for (let xx = x + 8; xx < x + w; xx += 8) { ctx.moveTo(xx, -h + 30); ctx.lineTo(xx, 0); } ctx.stroke();
  box(ctx, x, -h, w, 30, '#2f3e57', 1.2);
  box(ctx, x + w * 0.06, -h + 8, w * 0.1, 14, '#f29a2e', 0); // logo : simple bande orange, sans nom
  for (let xx = x + 30; xx < x + w - 50; xx += 58) { box(ctx, xx, -62, 42, 62, '#8e979e', 1); box(ctx, xx - 2, -66, 46, 5, '#f2c14b', 0.6); ctx.strokeStyle = '#737c83'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let yy = -56; yy < 0; yy += 7) { ctx.moveTo(xx, yy); ctx.lineTo(xx + 42, yy); } ctx.stroke(); }
  box(ctx, x - 2, -h - 6, w + 4, 6, '#b9bec2', 1);
  for (let xx = x + 60; xx < x + w; xx += 160) box(ctx, xx, -h - 16, 20, 10, '#b9bec2', 0.8); // extracteurs
}

/** Zone d'activité : entrepôts en bardage, bandeaux de couleur, lampadaires de parking. */
export function zoneActivite(ctx, p) {
  const r = rng(p.seed || 4), w = p.w;
  let x = -w / 2;
  while (x < w / 2) {
    const bw = 220 + r() * 200, bh = 110 + r() * 50, c = r.pick(['#e9e8e3', '#d9dde0', '#e4dfd2']);
    box(ctx, x, -bh, bw, bh, c, 1.2);
    ctx.strokeStyle = alpha('#9aa1a6', 0.6); ctx.lineWidth = 1; ctx.beginPath(); for (let xx = x + 8; xx < x + bw; xx += 8) { ctx.moveTo(xx, -bh + 22); ctx.lineTo(xx, 0); } ctx.stroke();
    box(ctx, x, -bh, bw, 20, r.pick(['#e2562f', '#2f7fbf', '#3f8a3a', '#f2c14b']), 1);
    for (let i = 0; i < Math.floor(bw / 70); i++) box(ctx, x + 20 + i * 70, -60, 44, 60, '#8e979e', 0.9);
    x += bw + 40;
    line(ctx, x - 20, 0, x - 20, -130, 2, '#8a9095'); line(ctx, x - 30, -130, x - 10, -130, 2, '#8a9095');
  }
}

/** Pylône de ligne à haute tension (treillis), consoles à isolateurs. */
export function pylone(ctx, p = {}) {
  const h = p.h || 380, c = '#8a9299';
  ctx.strokeStyle = c; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-8, -h); ctx.moveTo(40, 0); ctx.lineTo(8, -h); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < 12; i++) { const t0 = i / 12, t1 = (i + 1) / 12, w0 = 40 - 32 * t0, w1 = 40 - 32 * t1; ctx.moveTo(-w0, -h * t0); ctx.lineTo(w1, -h * t1); ctx.moveTo(w0, -h * t0); ctx.lineTo(-w1, -h * t1); ctx.moveTo(-w1, -h * t1); ctx.lineTo(w1, -h * t1); }
  ctx.stroke();
  for (const [y, span] of [[-h * 0.72, 70], [-h * 0.86, 56], [-h, 40]]) { line(ctx, -span, y, span, y, 2, c); for (const s of [-1, 1]) line(ctx, s * span, y, s * span, y + 14, 1.4, '#c9d0d4'); }
}

/** Château d'eau en béton (champignon). */
export function chateauDeau(ctx) {
  box(ctx, -12, -200, 24, 200, '#d9d6cc', 1.3); lit(ctx, -11, -199, 22, 198, '#d9d6cc');
  ctx.beginPath(); ctx.moveTo(-14, -200); ctx.lineTo(-60, -250); ctx.lineTo(-60, -290); ctx.lineTo(60, -290); ctx.lineTo(60, -250); ctx.lineTo(14, -200); ctx.closePath(); ctx.fillStyle = '#e6e3da'; ctx.fill(); outline(ctx, 1.4);
  ctx.fillStyle = 'rgba(40,28,18,0.12)'; ctx.fillRect(10, -290, 50, 40);
  box(ctx, -62, -296, 124, 8, '#d0ccc0', 1.2);
}

/** Lotissement vu de loin : toits d'ardoise alignés, crépis clairs, haies. */
export function lotissementLointain(ctx, p) {
  const w = p.w, r = rng(p.seed || 6);
  for (let x = -w / 2; x < w / 2 - 60; x += 150) {
    box(ctx, x, -100, 110, 100, r.pick(['#efe2b0', '#f1e6bf', '#f4ecd8']), 1.2);
    pitchedRoof(ctx, x, -100, 110, 90, p.tuile ? 'tuile' : 'ardoise', { overhang: 6, hip: 0.1 });
    box(ctx, x + 70, -64, 30, 64, '#f7f6f1', 1);
    for (const wx of [x + 18, x + 44]) box(ctx, wx, -60, 16, 24, '#5d7082', 0.8);
  }
  lisiere(ctx, { w, h: 40, seed: p.seed, color: '#3f6a3a' });
}

/** Village perché sur sa colline : maisons serrées en gradins, toits de tuiles, clocher au sommet. */
export function villagePerche(ctx, p) {
  const w = p.w, r = rng(p.seed || 8), H = p.h || 180;
  const hill = x => -H * Math.pow(Math.cos(Math.min(1, Math.abs(x) / (w / 2)) * Math.PI / 2), 1.3);
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); for (let x = -w / 2; x <= w / 2; x += 6) ctx.lineTo(x, hill(x)); ctx.lineTo(w / 2, 0); ctx.closePath();
  ctx.fillStyle = p.hill || '#8aa864'; ctx.fill(); outline(ctx, 1.2);
  // Église au sommet, à l'échelle des maisons
  ctx.save(); ctx.translate(-8, hill(0) + 16); ctx.scale(0.55, 0.55); eglise(ctx, { color: '#e0d2ae' }); ctx.restore();
  // Maisons en gradins, du haut vers le bas (les plus basses devant)
  const rows = 4;
  for (let row = 0; row < rows; row++) {
    const span = w * (0.22 + row * 0.1), n = 3 + row * 2;
    for (let i = 0; i < n; i++) {
      const hx = -span / 2 + (i + 0.5) * span / n + (r() - 0.5) * 8, base = hill(hx) + 20 + row * 20, hw = 34 + r() * 16, hh = 26 + r() * 12;
      box(ctx, hx - hw / 2, base - hh, hw, hh, r.pick(['#e8d9b6', '#dfcca4', '#eee2c4']), 0.9);
      ctx.fillStyle = '#4d6275'; ctx.fillRect(hx - hw / 4, base - hh + 8, 5, 7); ctx.fillRect(hx + hw / 8, base - hh + 8, 5, 7);
      ctx.beginPath(); ctx.moveTo(hx - hw / 2 - 3, base - hh); ctx.lineTo(hx - hw / 2 + 6, base - hh - 12); ctx.lineTo(hx + hw / 2 - 6, base - hh - 12); ctx.lineTo(hx + hw / 2 + 3, base - hh); ctx.closePath();
      ctx.fillStyle = r.pick(['#b8633f', '#a85d3e', '#c06a42']); ctx.fill(); outline(ctx, 0.9);
    }
  }
}

/** Silo à grains (deux cellules et tour de manutention). */
export function silo(ctx) {
  for (const dx of [-30, 30]) { ctx.beginPath(); ctx.rect(dx - 28, -300, 56, 300); const g = ctx.createLinearGradient(dx - 28, 0, dx + 28, 0); g.addColorStop(0, '#c9cdd0'); g.addColorStop(0.4, '#eef0f1'); g.addColorStop(1, '#a3a9ad'); ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.3); ctx.beginPath(); ctx.moveTo(dx - 28, -300); ctx.lineTo(dx, -318); ctx.lineTo(dx + 28, -300); ctx.closePath(); ctx.fillStyle = '#c9cdd0'; ctx.fill(); outline(ctx, 1.2); }
  box(ctx, -10, -360, 20, 60, '#b9bec2', 1.2);
  for (let yy = -30; yy > -300; yy -= 30) line(ctx, -58, yy, 58, yy, 1, '#8a9095');
}

export { INK, glass, mix };

/** Ligne à haute tension : pylônes réguliers et câbles en chaînette de l'un à l'autre. */
export function lignesHT(ctx, p) {
  const w = p.w, step = p.step || 520, h = p.h || 380;
  const xs = []; for (let x = -w / 2; x <= w / 2 + 1; x += step) xs.push(x);
  for (const x of xs) { ctx.save(); ctx.translate(x, 0); pylone(ctx, { h }); ctx.restore(); }
  ctx.strokeStyle = 'rgba(80,90,96,0.8)'; ctx.lineWidth = 1;
  for (const [y, span] of [[-h * 0.72, 70], [-h * 0.86, 56], [-h, 40]]) for (const s of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i < xs.length - 1; i++) { const a = xs[i] + s * span, b = xs[i + 1] + s * span; ctx.moveTo(a, y + 14); ctx.quadraticCurveTo((a + b) / 2, y + 14 + step * 0.12, b, y + 14); }
    ctx.stroke();
  }
}

/** Passerelle métallique des écluses, au-dessus du canal : arc surbaissé, garde-corps à barreaux, escaliers. */
export function passerelle(ctx, p) {
  const w = p.w, h = p.h || 90, c = '#2f5a44';
  ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2 + 22, -h); ctx.quadraticCurveTo(0, -h - 24, w / 2 - 22, -h); ctx.lineTo(w / 2, 0); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const t = i / 24, xx = -w / 2 + 22 + t * (w - 44), yy = -h - Math.sin(t * Math.PI) * 12; ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 22); }
  ctx.stroke();
  ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-w / 2 + 22, -h - 22); ctx.quadraticCurveTo(0, -h - 46, w / 2 - 22, -h - 22); ctx.stroke();
  for (const dx of [-w / 2 + 22, w / 2 - 22]) { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(dx, -h); ctx.lineTo(dx, 0); ctx.stroke(); }
}

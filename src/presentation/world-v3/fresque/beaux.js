import { DOOR, alpha, box, bush, castShadow, chimney, door, glass, hedge, ironRail, line, lit, mansard, outline, rng, shade, wall, windowUnit } from './kit.js';
import { haussmann, pictogram } from './paris.js';
import { velo } from './paris.js';

/**
 * Beaux quartiers : pierre de taille claire, fer forgé noir et or, boutiques de luxe laquées, kiosque vert,
 * hôtels particuliers derrière leurs grilles, start-up dans les rez-de-chaussée haussmanniens, berlines noires.
 */

/** Immeuble haussmannien cossu (R+3/R+4) : pierre plus claire, balcons dorés, grande porte cochère, boutiques de luxe. */
export function haussmannCossu(ctx, p) {
  haussmann(ctx, { floors: 3, color: '#f1e8d4', rich: true, ...p, rdc: 'none' });
  const x = -p.w / 2, w = p.w;
  if (p.boutiques?.length) {
    const slot = (w - 12) / p.boutiques.length;
    p.boutiques.forEach((kind, i) => boutique(ctx, x + 6 + slot * (i + 0.5), slot - 8, kind, (p.seed || 1) + i));
  } else {
    ctx.save(); ctx.translate(p.doorAt ?? 0, 0); door(ctx, 0, 50, DOOR + 22, p.doorColor || '#1f2a2e', 'cochere'); ctx.restore();
    for (const side of [-1, 1]) { const cx = side * Math.min(w / 2 - 26, 66); if (Math.abs(cx) > 44) windowUnit(ctx, cx, -22, 26, 64, { frame: '#f7f2e6', bars: '#1c1c1e', panes: 3 }, side); }
    box(ctx, 30, -60, 6, 9, '#b9a26a', 0.6); // digicode
  }
}

/**
 * Boutique de luxe : façade laquée noire ou bleu nuit, filets dorés, deux vitrines éclairées (sacs, silhouettes),
 * porte centrale, pictogramme en or (losange, fleur, feuille), jamais de nom.
 */
export function boutique(ctx, cx, w, kind = 'mode', seed = 1) {
  const r = rng(seed + 3), color = r.pick(['#17181a', '#1e2b3a', '#2a1f1a', '#20302a']), h = 118, x = cx - w / 2;
  box(ctx, x, -h, w, h, color, 1.5);
  ctx.strokeStyle = '#c9a54f'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, -h + 4, w - 8, h - 8);
  pictogram(ctx, kind === 'bijoux' ? 'diamant' : kind === 'parfum' ? 'fleur' : 'feuille', cx, -h + 16, 16, '#d8b867');
  const dw = 26, vw = (w - dw - 22) / 2;
  for (const vx of [x + 8, cx + dw / 2 + 3]) {
    box(ctx, vx, -h + 32, vw, h - 46, '#c9a54f', 1); glass(ctx, vx + 2, -h + 34, vw - 4, h - 50, true);
    ctx.save(); ctx.beginPath(); ctx.rect(vx + 2, -h + 34, vw - 4, h - 50); ctx.clip();
    ctx.fillStyle = 'rgba(255,240,200,0.25)'; ctx.fillRect(vx, -h + 34, vw, h - 50);
    if (kind === 'bijoux') { for (let i = 0; i < 3; i++) { box(ctx, vx + 6 + i * (vw - 12) / 3, -40, (vw - 12) / 3 - 4, 10, '#2a2a2a', 0.5); ctx.fillStyle = '#f4e3a0'; ctx.fillRect(vx + 10 + i * (vw - 12) / 3, -44, 4, 4); } }
    else { const mx = vx + vw / 2; ctx.fillStyle = r.pick(['#1b1b1b', '#8a1c2a', '#e8e1d2', '#c9a060']); ctx.beginPath(); ctx.moveTo(mx - 6, -78); ctx.lineTo(mx + 6, -78); ctx.lineTo(mx + 9, -32); ctx.lineTo(mx - 9, -32); ctx.closePath(); ctx.fill(); box(ctx, mx - 3, -86, 6, 7, '#e8dccb', 0); line(ctx, mx, -32, mx, -16, 1, '#c9a54f'); box(ctx, mx + 10, -30, 12, 10, r.pick(['#8a1c2a', '#c9a060', '#1b1b1b']), 0.6); }
    ctx.restore();
  }
  ctx.save(); ctx.translate(cx, 0); door(ctx, 0, dw, Math.min(DOOR, h - 30), '#c9a54f', 'vitree'); ctx.restore();
  // Petits orangers en pots de part et d'autre
  for (const px of [x - 2, x + w + 2]) { box(ctx, px - 6, -14, 12, 14, '#f1ece0', 0.9); bush(ctx, px, -14, 18, 20, '#3f6a3a', px); }
}

/** Kiosque à journaux vert : coupole, frise, présentoirs de journaux et magazines (sans inscription). */
export function kiosque(ctx) {
  const green = '#2f5a44';
  box(ctx, -28, -84, 56, 84, green, 1.4);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) box(ctx, -24 + i * 16, -78 + j * 17, 13, 14, ['#f4f1e8', '#e9d9a8', '#d9534f', '#4a78b5', '#f2c14b'][(i + j * 2) % 5], 0.6);
  ctx.beginPath(); ctx.moveTo(-36, -84); ctx.lineTo(36, -84); ctx.lineTo(26, -104); ctx.lineTo(-26, -104); ctx.closePath(); ctx.fillStyle = green; ctx.fill(); outline(ctx, 1.3);
  box(ctx, -26, -102, 52, 9, '#e8d9a8', 0.8); for (let i = 0; i < 8; i++) box(ctx, -22 + i * 6, -100, 3, 5, green, 0);
  ctx.beginPath(); ctx.moveTo(-14, -104); ctx.quadraticCurveTo(0, -128, 14, -104); ctx.closePath(); ctx.fillStyle = green; ctx.fill(); outline(ctx, 1.2);
  box(ctx, -1.5, -134, 3, 8, green, 0.8);
}

/** Hôtel particulier entre cour et jardin : grille dorée, piliers, cour pavée, façade à mansardes. */
export function hotelParticulier(ctx, p) {
  const w = p.w, x = -w / 2, h = 184, bx = x + 26, bw = w - 52;
  wall(ctx, bx, -h, bw, h, '#f1e8d4', { courses: 10 });
  for (const f of [0, 1]) for (let i = 0; i < 5; i++) windowUnit(ctx, bx + bw * (i + 0.5) / 5, -26 - f * 84, 22, 62, { frame: '#f7f2e6', bars: f ? '#1c1c1e' : null, panes: 3, lit: (i + f) % 4 === 0, sill: '#f3ead6' }, f * 5 + i);
  box(ctx, bx - 6, -h - 8, bw + 12, 9, '#f5eddc', 1.2); castShadow(ctx, bx, -h + 1, bw, 9, 0.28);
  mansard(ctx, bx + 4, -h - 8, bw - 8, 46, { dormers: 4, seed: 3, color: '#6c7a86' });
  chimney(ctx, bx + 24, -h - 50, 18, 20, '#e6d6ba'); chimney(ctx, bx + bw - 24, -h - 50, 18, 20, '#e6d6ba');
  // Cour pavée, grille à pointes dorées, piliers à pots à feu
  ctx.fillStyle = '#d2c9b6'; ctx.fillRect(x, -6, w, 6);
  box(ctx, x, -16, w, 12, '#e9e0cc', 1.1);
  ironRail(ctx, x, -76, w, 60, '#1c1c1e');
  ctx.fillStyle = '#c9a54f'; for (let xx = x + 2.5; xx < x + w; xx += 3.5) { ctx.beginPath(); ctx.moveTo(xx - 1.3, -76); ctx.lineTo(xx, -81); ctx.lineTo(xx + 1.3, -76); ctx.fill(); }
  for (const px of [x + 4, -24, 24, x + w - 4]) { box(ctx, px - 8, -94, 16, 94, '#ece3cf', 1.2); box(ctx, px - 10, -98, 20, 5, '#f5eddc', 1); ctx.beginPath(); ctx.moveTo(px - 5, -98); ctx.quadraticCurveTo(px, -112, px + 5, -98); ctx.closePath(); ctx.fillStyle = '#c9a54f'; ctx.fill(); outline(ctx, 0.8); }
  for (const dx of [x + 18, x + w - 18]) { box(ctx, dx - 7, -30, 14, 14, '#ece3cf', 0.9); bush(ctx, dx, -30, 20, 34, '#2f5a38', dx); }
}

/** Rez-de-chaussée de start-up dans un immeuble haussmannien : grande vitre, néon de couleur, écrans, poufs, plantes. */
export function startup(ctx, cx, w, seed = 1) {
  const r = rng(seed + 5), h = 118, x = cx - w / 2, neon = r.pick(['#5fe0c0', '#ff6fa8', '#7fb0ff']);
  box(ctx, x, -h, w, h, '#2a2d31', 1.5);
  box(ctx, x + 6, -h + 6, w - 12, h - 12, '#3a3f45', 1); glass(ctx, x + 8, -h + 8, w - 16, h - 22, true);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 8, -h + 8, w - 16, h - 22); ctx.clip();
  ctx.fillStyle = 'rgba(240,245,250,0.55)'; ctx.fillRect(x + 8, -h + 8, w - 16, h - 22);
  line(ctx, x + 14, -h + 22, x + w - 14, -h + 22, 3, neon); // néon
  for (let i = 0; i < (w - 24) / 26; i++) { const dx = x + 16 + i * 26; box(ctx, dx, -48, 18, 12, '#1d2227', 0.6); ctx.fillStyle = neon; ctx.fillRect(dx + 2, -46, 14, 8); box(ctx, dx - 2, -36, 22, 3, '#e8e2d6', 0.5); }
  ctx.fillStyle = r.pick(['#e8622c', '#f2c14b', '#5f9fd0']); ctx.beginPath(); ctx.ellipse(x + w - 26, -22, 12, 8, 0, 0, Math.PI * 2); ctx.fill(); // pouf
  bush(ctx, x + 18, -14, 16, 30, '#4f8a4a', seed);
  ctx.restore();
  box(ctx, x + 6, -14, w - 12, 8, '#2a2d31', 1);
}

/** Immeuble haussmannien dont le rez-de-chaussée accueille des start-up. */
export function haussmannStartup(ctx, p) {
  haussmann(ctx, { floors: 3, color: '#ece2ca', ...p, rdc: 'none' });
  const slots = p.count || 1, slot = (p.w - 12) / slots;
  for (let i = 0; i < slots; i++) startup(ctx, -p.w / 2 + 6 + slot * (i + 0.5), slot - 8, (p.seed || 1) + i);
}

/** Berline noire (voiture de fonction), garée. */
export function berline(ctx, p = {}) {
  const dir = p.dir === -1 ? -1 : 1, len = 166, x = -len / 2;
  ctx.save(); ctx.scale(dir, 1);
  const body = () => { ctx.beginPath(); ctx.moveTo(x + 3, -14); ctx.lineTo(x + 2, -40); ctx.quadraticCurveTo(x + 4, -46, x + 24, -47); ctx.lineTo(x + len * 0.3, -66); ctx.lineTo(x + len * 0.62, -66); ctx.lineTo(x + len * 0.76, -47); ctx.lineTo(x + len - 6, -44); ctx.quadraticCurveTo(x + len, -40, x + len - 1, -28); ctx.lineTo(x + len - 3, -14); ctx.closePath(); };
  body(); const g = ctx.createLinearGradient(0, -66, 0, -12); g.addColorStop(0, '#4a4f55'); g.addColorStop(1, '#16181a'); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + len * 0.33, -62); ctx.lineTo(x + len * 0.6, -62); ctx.lineTo(x + len * 0.72, -48); ctx.lineTo(x + len * 0.26, -48); ctx.closePath(); ctx.save(); ctx.clip(); glass(ctx, x, -66, len, 20); ctx.restore();
  ctx.beginPath(); ctx.moveTo(x + len * 0.33, -62); ctx.lineTo(x + len * 0.6, -62); ctx.lineTo(x + len * 0.72, -48); ctx.lineTo(x + len * 0.26, -48); ctx.closePath(); outline(ctx, 1);
  line(ctx, x + len * 0.47, -62, x + len * 0.47, -48, 2.4, '#16181a'); line(ctx, x + 8, -30, x + len - 8, -30, 0.9, '#8a8f94');
  body(); outline(ctx, 1.4);
  for (const wx of [x + 32, x + len - 32]) { ctx.beginPath(); ctx.arc(wx, -14, 13, 0, Math.PI * 2); ctx.fillStyle = '#26282b'; ctx.fill(); outline(ctx, 1); ctx.beginPath(); ctx.arc(wx, -14, 6, 0, Math.PI * 2); ctx.fillStyle = '#c9ccd0'; ctx.fill(); }
  castShadow(ctx, x + 6, -1, len - 12, 3, 0.35);
  ctx.restore();
}

/** Lisière du bois : grille haute de parc, portail, lampadaire, massifs (les grands arbres sont dessinés à part). */
export function lisiereBois(ctx, p) {
  const w = p.w, x = -w / 2;
  ctx.fillStyle = '#7fae52'; ctx.fillRect(x, -8, w, 8);
  box(ctx, x, -14, w, 10, '#d9d0bc', 1.1);
  ironRail(ctx, x, -84, w, 70, '#1f2a24');
  ctx.fillStyle = '#1f2a24'; for (let xx = x + 2.5; xx < x + w; xx += 3.5) { ctx.beginPath(); ctx.moveTo(xx - 1.2, -84); ctx.lineTo(xx, -89); ctx.lineTo(xx + 1.2, -84); ctx.fill(); }
  for (const px of [-w * 0.2, w * 0.2]) box(ctx, px - 7, -98, 14, 98, '#d9d0bc', 1.2);
  bush(ctx, x + w * 0.1, -14, 44, 38, '#3f6a35', 1); bush(ctx, x + w * 0.42, -14, 56, 44, '#4a7a3a', 2); bush(ctx, x + w * 0.8, -14, 50, 40, '#3f6a35', 3);
}

export { lit, hedge };

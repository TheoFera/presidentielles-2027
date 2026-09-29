import { DOOR, INK, RDC, alpha, awning, balcony, box, castShadow, chimney, door, flowerBox, glass, grass, ironRail, line, lit, mansard, outline, pitchedRoof, rng, shade, wall, windowUnit } from './kit.js';

/**
 * Paris : immeubles haussmanniens et de faubourg, rez-de-chaussée commerçants. Les commerces se reconnaissent
 * à leur vitrine, leur couleur et leur pictogramme peint (jamais de nom écrit).
 */

const STONE = ['#ecdfc2', '#e8d8b6', '#efe4ca'];
const PLASTER = ['#e8c9a2', '#e2b99c', '#dccbaa', '#efd9b5', '#d9b7a3', '#cfc6ae'];

/* ---------- Pictogrammes peints sur les bandeaux ---------- */

/** Pictogramme doré ou peint, centré en (cx, cy), taille s (≈ hauteur du bandeau). */
export function pictogram(ctx, kind, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, s * 0.08); ctx.lineCap = 'round';
  const k = s / 20;
  switch (kind) {
    case 'pain': // épi de blé et baguette croisés
      ctx.beginPath(); ctx.ellipse(0, 0, 11 * k, 2.6 * k, -0.35, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo((-6 + i * 5) * k, (2 - i * 1.7) * k); ctx.lineTo((-4 + i * 5) * k, (-1 - i * 1.7) * k); ctx.strokeStyle = shade(color, -0.5); ctx.stroke(); }
      ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(-3 * k, 8 * k); ctx.lineTo(4 * k, -8 * k); ctx.stroke();
      for (let i = 0; i < 4; i++) for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse((2.2 + i * 1.3 + side * 1.2) * k, (-6 + i * 3) * k, 1.1 * k, 2 * k, side * 0.6, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'fromage': // part de meule à trous
      ctx.beginPath(); ctx.moveTo(-9 * k, 5 * k); ctx.lineTo(9 * k, 5 * k); ctx.lineTo(9 * k, -1 * k); ctx.lineTo(-9 * k, -6 * k); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (const [hx, hy] of [[-3, 1], [3, 2], [5, -1]]) { ctx.beginPath(); ctx.arc(hx * k, hy * k, 1.3 * k, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'boeuf': // tête de bœuf
      ctx.beginPath(); ctx.moveTo(-4 * k, -3 * k); ctx.lineTo(4 * k, -3 * k); ctx.lineTo(3 * k, 5 * k); ctx.quadraticCurveTo(0, 8 * k, -3 * k, 5 * k); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-4 * k, -2 * k); ctx.quadraticCurveTo(-10 * k, -3 * k, -9 * k, -8 * k); ctx.moveTo(4 * k, -2 * k); ctx.quadraticCurveTo(10 * k, -3 * k, 9 * k, -8 * k); ctx.lineWidth = 1.6 * k; ctx.stroke();
      break;
    case 'tasse': // tasse de café fumante
      ctx.beginPath(); ctx.moveTo(-6 * k, -2 * k); ctx.lineTo(5 * k, -2 * k); ctx.lineTo(4 * k, 5 * k); ctx.lineTo(-5 * k, 5 * k); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(5 * k, 0); ctx.quadraticCurveTo(9 * k, 1 * k, 4.5 * k, 3.5 * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8 * k, 7 * k); ctx.lineTo(7 * k, 7 * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2 * k, -4 * k); ctx.quadraticCurveTo(-4 * k, -7 * k, -2 * k, -9 * k); ctx.moveTo(2 * k, -4 * k); ctx.quadraticCurveTo(0, -7 * k, 2 * k, -9 * k); ctx.stroke();
      break;
    case 'fleur':
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 3.5 * k, -2 * k + Math.sin(a) * 3.5 * k, 2.6 * k, 1.6 * k, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(0, 2 * k); ctx.lineTo(0, 9 * k); ctx.stroke();
      break;
    case 'livre':
      ctx.beginPath(); ctx.moveTo(0, -5 * k); ctx.quadraticCurveTo(-5 * k, -7 * k, -10 * k, -5 * k); ctx.lineTo(-10 * k, 6 * k); ctx.quadraticCurveTo(-5 * k, 4 * k, 0, 6 * k); ctx.quadraticCurveTo(5 * k, 4 * k, 10 * k, 6 * k); ctx.lineTo(10 * k, -5 * k); ctx.quadraticCurveTo(5 * k, -7 * k, 0, -5 * k); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(0, -5 * k); ctx.lineTo(0, 6 * k); ctx.stroke();
      break;
    case 'bocal':
      ctx.fillRect(-4 * k, -7 * k, 8 * k, 3 * k); ctx.beginPath(); ctx.roundRect(-5.5 * k, -4 * k, 11 * k, 11 * k, 2 * k); ctx.fill();
      break;
    case 'croix': // croix de pharmacie
      ctx.fillRect(-2.6 * k, -8 * k, 5.2 * k, 16 * k); ctx.fillRect(-8 * k, -2.6 * k, 16 * k, 5.2 * k);
      break;
    case 'broche': // broche à kebab
      ctx.beginPath(); ctx.moveTo(0, -9 * k); ctx.lineTo(0, 9 * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5 * k, -6 * k); ctx.quadraticCurveTo(-7 * k, 0, -4 * k, 6 * k); ctx.lineTo(4 * k, 6 * k); ctx.quadraticCurveTo(7 * k, 0, 5 * k, -6 * k); ctx.closePath(); ctx.fill();
      break;
    case 'ciseaux':
      ctx.beginPath(); ctx.moveTo(-7 * k, -7 * k); ctx.lineTo(5 * k, 5 * k); ctx.moveTo(7 * k, -7 * k); ctx.lineTo(-5 * k, 5 * k); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-6 * k, 6 * k, 2.6 * k, 2 * k, 0, 0, Math.PI * 2); ctx.ellipse(6 * k, 6 * k, 2.6 * k, 2 * k, 0, 0, Math.PI * 2); ctx.lineWidth = 1.2 * k; ctx.stroke();
      break;
    case 'feuille': // concept store : feuille stylisée
      ctx.beginPath(); ctx.moveTo(-7 * k, 6 * k); ctx.quadraticCurveTo(-8 * k, -6 * k, 7 * k, -7 * k); ctx.quadraticCurveTo(6 * k, 6 * k, -7 * k, 6 * k); ctx.fill();
      break;
    case 'diamant':
      ctx.beginPath(); ctx.moveTo(-7 * k, -3 * k); ctx.lineTo(-3 * k, -7 * k); ctx.lineTo(3 * k, -7 * k); ctx.lineTo(7 * k, -3 * k); ctx.lineTo(0, 7 * k); ctx.closePath(); ctx.fill();
      break;
  }
  ctx.restore();
}

/* ---------- Marchandises vues à travers la vitrine ---------- */

function goods(ctx, kind, x, y, w, h, seed) {
  const r = rng(seed + 29);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const shelf = (yy, color = '#7b5433') => box(ctx, x, yy, w, 3, color, 0.6);
  const n = Math.max(2, Math.floor(w / 7));
  switch (kind) {
    case 'pain':
      shelf(y + h * 0.5); shelf(y + h * 0.84);
      for (let i = 0; i < n; i++) { const bx = x + 3 + i * (w - 6) / n; ctx.fillStyle = r() < 0.5 ? '#d99a4a' : '#e0a95a'; ctx.beginPath(); ctx.roundRect(bx, y + h * 0.08 + r() * 4, 4.5, h * 0.42, 2.2); ctx.fill(); ctx.strokeStyle = '#8a5424'; ctx.lineWidth = 0.6; ctx.stroke(); }
      for (let i = 0; i < w / 11; i++) { ctx.fillStyle = r() < 0.5 ? '#c98a3e' : '#e5b25e'; ctx.beginPath(); ctx.ellipse(x + 6 + i * 11, y + h * 0.78, 5, 3.4, 0, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < w / 8; i++) { ctx.fillStyle = r.pick(['#f1d7e0', '#e7b64d', '#7a4a2a', '#f4e3b0']); ctx.beginPath(); ctx.arc(x + 4 + i * 8, y + h * 0.84, 3, Math.PI, 0); ctx.fill(); }
      break;
    case 'fromage':
      shelf(y + h * 0.42); shelf(y + h * 0.76);
      for (let row = 0; row < 3; row++) for (let i = 0; i < w / 12; i++) {
        const cx = x + 6 + i * 12 + (row % 2) * 4, cy = y + h * [0.4, 0.74, 0.98][row];
        ctx.fillStyle = r.pick(['#f1d27a', '#f6e7b8', '#e9b85a', '#fbf4df', '#d9a441']);
        ctx.beginPath(); if (r() < 0.5) ctx.ellipse(cx, cy - 4, 5.5, 3.6, 0, 0, Math.PI * 2); else { ctx.moveTo(cx - 5.5, cy); ctx.lineTo(cx + 5.5, cy); ctx.lineTo(cx + 5.5, cy - 7); ctx.closePath(); }
        ctx.fill(); ctx.strokeStyle = '#8a6a2a'; ctx.lineWidth = 0.6; ctx.stroke();
      }
      break;
    case 'viande':
      line(ctx, x, y + 5, x + w, y + 5, 1, '#8b8f94');
      for (let i = 0; i < w / 10; i++) { const cx = x + 5 + i * 10; line(ctx, cx, y + 5, cx, y + 9, 0.8, '#8b8f94'); ctx.fillStyle = r() < 0.5 ? '#b8444a' : '#c86a5a'; ctx.beginPath(); ctx.ellipse(cx, y + 17 + r() * 3, 3.4, 8, 0, 0, Math.PI * 2); ctx.fill(); }
      box(ctx, x, y + h * 0.64, w, h * 0.36, '#f1f3f3', 0.6);
      for (let i = 0; i < w / 9; i++) { ctx.fillStyle = r.pick(['#c4474d', '#d77b6c', '#e3a58c']); ctx.fillRect(x + 2 + i * 9, y + h * 0.69, 7, 4); }
      break;
    case 'bar':
      box(ctx, x, y + h * 0.6, w, h * 0.4, '#6d4527', 0.8);
      shelf(y + h * 0.34, '#5a3a22');
      for (let i = 0; i < w / 5; i++) { ctx.fillStyle = r.pick(['#5d8a4f', '#b25a35', '#e9c46a', '#3f5a7a']); ctx.fillRect(x + 2 + i * 5, y + h * 0.34 - 11, 3, 11); }
      ctx.fillStyle = '#f3e4c0'; ctx.fillRect(x + w * 0.6, y + h * 0.1, w * 0.3, h * 0.16); // ardoise du jour
      break;
    case 'fleurs': case 'legumes':
      for (let i = 0; i < w / 5; i++) { const cx = x + 3 + i * 5; ctx.fillStyle = '#4f7d3a'; ctx.fillRect(cx, y + h * 0.5, 1.5, h * 0.5); ctx.fillStyle = r.pick(kind === 'fleurs' ? ['#e2445a', '#f7d046', '#f39ac0', '#ffffff', '#b574d8'] : ['#d9412b', '#f28c28', '#6ea83a', '#f2d23a']); ctx.beginPath(); ctx.arc(cx, y + h * (0.35 + r() * 0.2), 2.8, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'livres':
      for (let row = 0; row < 3; row++) { shelf(y + h * (0.33 + row * 0.33), '#5a3a22'); for (let i = 0; i < w / 3.5; i++) { ctx.fillStyle = r.pick(['#8e3b3b', '#2f4f7f', '#e0c070', '#3f6f4f', '#f1ece0']); ctx.fillRect(x + 1 + i * 3.5, y + h * (0.33 + row * 0.33) - 11 - r() * 3, 3, 11 + r() * 3); } }
      break;
    case 'bocaux':
      for (let row = 0; row < 2; row++) { shelf(y + h * (0.42 + row * 0.4)); for (let i = 0; i < w / 7; i++) { ctx.fillStyle = r.pick(['#e9c46a', '#b5442f', '#6a994e', '#f4a261', '#7b3f2a']); ctx.beginPath(); ctx.roundRect(x + 2 + i * 7, y + h * (0.42 + row * 0.4) - 10, 5, 10, 1.5); ctx.fill(); } }
      break;
    case 'mode':
      for (let i = 0; i < 3; i++) { const cx = x + w * (i + 1) / 4; ctx.fillStyle = r.pick(['#d9b38c', '#6c8a9e', '#f0e6d8', '#c26a4a']); ctx.beginPath(); ctx.moveTo(cx - 6, y + h * 0.25); ctx.lineTo(cx + 6, y + h * 0.25); ctx.lineTo(cx + 8, y + h * 0.72); ctx.lineTo(cx - 8, y + h * 0.72); ctx.closePath(); ctx.fill(); line(ctx, cx, y + h * 0.18, cx, y + h * 0.25, 1, '#8a8a8a'); }
      ctx.fillStyle = '#6a9a48'; ctx.beginPath(); ctx.ellipse(x + w - 7, y + h * 0.7, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'pharma':
      for (let row = 0; row < 3; row++) { shelf(y + h * (0.3 + row * 0.3), '#e1e5e8'); for (let i = 0; i < w / 6; i++) { ctx.fillStyle = r.pick(['#ffffff', '#9fd3b0', '#f2b8b8', '#b8d4f2']); ctx.fillRect(x + 2 + i * 6, y + h * (0.3 + row * 0.3) - 8, 4, 8); } }
      break;
    case 'presse':
      for (let row = 0; row < 3; row++) for (let i = 0; i < w / 9; i++) { ctx.fillStyle = r.pick(['#f4f1e8', '#e8d9a8', '#d9534f', '#4a78b5']); ctx.fillRect(x + 2 + i * 9, y + 5 + row * h * 0.3, 7, h * 0.24); }
      break;
    case 'snack':
      box(ctx, x, y + h * 0.6, w, h * 0.4, '#d9d6cf', 0.6);
      ctx.fillStyle = '#9b5a2a'; ctx.beginPath(); ctx.roundRect(x + w * 0.66, y + h * 0.18, 9, h * 0.42, 4); ctx.fill(); line(ctx, x + w * 0.66 + 4.5, y + h * 0.1, x + w * 0.66 + 4.5, y + h * 0.62, 1, '#777');
      for (let i = 0; i < 3; i++) box(ctx, x + 4 + i * 12, y + 6, 10, 8, r.pick(['#f2c14b', '#e86f4f', '#8fbf5f']), 0.5); // photos de plats
      break;
    case 'coiffure':
      box(ctx, x + w * 0.15, y + h * 0.22, w * 0.22, h * 0.36, '#c9d6de', 0.6); box(ctx, x + w * 0.6, y + h * 0.22, w * 0.22, h * 0.36, '#c9d6de', 0.6);
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(x + w * 0.18, y + h * 0.7, w * 0.16, h * 0.3); ctx.fillRect(x + w * 0.63, y + h * 0.7, w * 0.16, h * 0.3);
      break;
  }
  ctx.restore();
}

/**
 * Commerces : couleur de devanture, pictogramme, marchandises, store éventuel et étal extérieur.
 * Ce qui fait reconnaître le commerce : la vitrine et le pictogramme, jamais un mot.
 */
export const SHOPS = {
  boulangerie: { frame: '#7a2f2a', fascia: '#7a2f2a', picto: 'pain', pictoColor: '#e3b85a', goods: 'pain', awning: ['#e0b84c', '#f7ecd0'] },
  fromagerie: { frame: '#e8dcaa', fascia: '#3f5a3a', picto: 'fromage', pictoColor: '#f1d27a', goods: 'fromage', awning: ['#f1e2a8', '#fbf6e4'] },
  boucherie: { frame: '#a3262b', fascia: '#a3262b', picto: 'boeuf', pictoColor: '#e3c05a', goods: 'viande', awning: ['#b8272d', '#f8f1e6'], tiles: true },
  cafe: { frame: '#2f5a44', fascia: '#2f5a44', picto: 'tasse', pictoColor: '#f2d58f', goods: 'bar', awning: ['#2f5a44', '#e9dcc0'], terrace: true },
  fleuriste: { frame: '#3f6b4a', fascia: '#3f6b4a', picto: 'fleur', pictoColor: '#f3c1cf', goods: 'fleurs', outside: 'fleurs' },
  librairie: { frame: '#5b3f6e', fascia: '#5b3f6e', picto: 'livre', pictoColor: '#f1e5c8', goods: 'livres' },
  epicerie: { frame: '#2d3f36', fascia: '#2d3f36', picto: 'bocal', pictoColor: '#d9bf7a', goods: 'bocaux' },
  concept: { frame: '#ece7dc', fascia: '#ece7dc', picto: 'feuille', pictoColor: '#7a9a6a', goods: 'mode' },
  pharmacie: { frame: '#eef1ec', fascia: '#eef1ec', picto: 'croix', pictoColor: '#1fa05a', goods: 'pharma', cross: true },
  tabac: { frame: '#274a7a', fascia: '#274a7a', picto: null, goods: 'presse', carotte: true },
  kebab: { frame: '#c3402f', fascia: '#f2c14b', picto: 'broche', pictoColor: '#c3402f', goods: 'snack' },
  coiffeur: { frame: '#1f2a33', fascia: '#1f2a33', picto: 'ciseaux', pictoColor: '#e9e2d0', goods: 'coiffure' },
  primeur: { frame: '#4d7a3a', fascia: '#4d7a3a', picto: null, goods: 'legumes', outside: 'legumes', awning: ['#3f8a3a', '#f5ecd0'] },
};

/** Devanture de commerce au rez-de-chaussée (centrée en cx, largeur w, hauteur h). */
export function shopfront(ctx, cx, w, kind, seed = 0, h = RDC - 10) {
  const s = SHOPS[kind], x = cx - w / 2, y = -h, fasciaH = 20;
  // Coffrage en bois peint, pilastres
  box(ctx, x, y, w, h, s.frame, 1.5);
  lit(ctx, x + 1, y + 1, w - 2, h - 2, s.frame, { light: 0.08, dark: 0.12 });
  ctx.beginPath(); ctx.rect(x, y, w, h); outline(ctx, 1.5);
  for (const px of [x, x + w - 6]) box(ctx, px, y, 6, h, shade(s.frame, -0.08), 1);
  // Bandeau et pictogramme
  box(ctx, x + 6, y + 4, w - 12, fasciaH, s.fascia, 1.1);
  if (s.picto) pictogram(ctx, s.picto, cx, y + 4 + fasciaH / 2, fasciaH * 0.85, s.pictoColor);
  castShadow(ctx, x + 6, y + 4 + fasciaH, w - 12, 6, 0.25);
  // Vitrine et porte vitrée
  const doorW = Math.min(28, w * 0.24), top = y + fasciaH + 10, bottom = -14;
  const doorX = x + w - 6 - doorW / 2 - 3, vx = x + 9, vw = doorX - doorW / 2 - 5 - vx;
  box(ctx, vx - 2, top - 2, vw + 4, bottom - top + 4, shade(s.frame, 0.2), 1);
  glass(ctx, vx, top, vw, bottom - top, true);
  goods(ctx, s.goods, vx + 2, top + 2, vw - 4, bottom - top - 4, seed);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(vx, top, vw * 0.18, bottom - top);
  box(ctx, vx - 3, bottom, vw + 6, 14, s.tiles ? '#f1f1ee' : shade(s.frame, -0.18), 1); // soubassement
  if (s.tiles) { ctx.strokeStyle = '#cfcfca'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let xx = vx; xx < vx + vw; xx += 5) { ctx.moveTo(xx, bottom); ctx.lineTo(xx, 0); } ctx.stroke(); }
  ctx.save(); ctx.translate(doorX, 0); door(ctx, 0, doorW, Math.min(DOOR, -top + 4), shade(s.frame, -0.05), 'vitree'); ctx.restore();
  if (s.awning) awning(ctx, x + 3, y + fasciaH + 6, w - 6, 15, s.awning, Math.max(5, Math.round(w / 11)));
  if (s.cross) { // croix verte lumineuse en drapeau
    const px = x + w + 8, py = y - 2; line(ctx, x + w, py + 10, px, py + 10, 2, '#6a6f72');
    ctx.fillStyle = '#2fbf5c'; ctx.fillRect(px - 3, py, 7, 21); ctx.fillRect(px - 10, py + 7, 21, 7); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(px - 3, py, 7, 21);
  }
  if (s.carotte) { // losange rouge du tabac, sans inscription
    const px = x + w + 7, py = y + 2; line(ctx, x + w, py + 4, px, py + 4, 2, '#6a6f72');
    ctx.beginPath(); ctx.moveTo(px, py - 8); ctx.lineTo(px + 5, py + 10); ctx.lineTo(px, py + 30); ctx.lineTo(px - 5, py + 10); ctx.closePath(); ctx.fillStyle = '#d23b2e'; ctx.fill(); outline(ctx, 1);
  }
  if (s.outside) etalExterieur(ctx, x + 10, doorX - doorW / 2 - 6, s.outside, seed);
}

/** Étal devant la boutique : seaux de fleurs ou cagettes de légumes. */
function etalExterieur(ctx, x0, x1, kind, seed) {
  const r = rng(seed + 61);
  box(ctx, x0, -22, x1 - x0, 4, '#8a6a45', 0.9); line(ctx, x0 + 3, -18, x0 + 3, 0, 1.2, '#6a4a2f'); line(ctx, x1 - 3, -18, x1 - 3, 0, 1.2, '#6a4a2f');
  for (let xx = x0 + 6; xx < x1 - 6; xx += 11) {
    if (kind === 'fleurs') { box(ctx, xx - 4, -32, 9, 10, '#8f9aa2', 0.8); for (let k = 0; k < 4; k++) { ctx.fillStyle = r.pick(['#e2445a', '#f7d046', '#f39ac0', '#ffffff', '#b574d8']); ctx.beginPath(); ctx.arc(xx - 2 + k * 2.2, -35 - r() * 6, 2.4, 0, Math.PI * 2); ctx.fill(); } }
    else { box(ctx, xx - 5, -30, 10, 8, '#c9a060', 0.8); ctx.fillStyle = r.pick(['#d9412b', '#f28c28', '#6ea83a', '#f2d23a']); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(xx - 3 + k * 3, -31, 2.4, 0, Math.PI * 2); ctx.fill(); } }
  }
}

/** Terrasse de café : guéridons, chaises cannées, une ardoise. */
export function terrace(ctx, x0, x1, seed = 0) {
  const r = rng(seed + 41);
  for (let x = x0 + 14; x < x1 - 10; x += 30) {
    for (const side of [-9, 9]) {
      const cx = x + side; ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(cx - 4, 0); ctx.lineTo(cx - 4, -14); ctx.moveTo(cx + 4, 0); ctx.lineTo(cx + 4, -14); ctx.moveTo(cx + side * 0.45, -14); ctx.lineTo(cx + side * 0.5, -27); ctx.stroke();
      box(ctx, cx - 5, -16, 10, 3, '#c9a060', 0.7);
    }
    line(ctx, x, 0, x, -20, 1.6, '#2e2e2e');
    ctx.beginPath(); ctx.ellipse(x, -21, 9, 2.4, 0, 0, Math.PI * 2); ctx.fillStyle = '#c8ccce'; ctx.fill(); outline(ctx, 0.9);
    if (r() < 0.7) box(ctx, x - 2, -27, 4, 6, r.pick(['#f5f0e6', '#8a4a2a', '#e8c35a']), 0.5);
  }
}

/* ---------- Immeubles ---------- */

/**
 * Immeuble haussmannien : soubassement à refends, étage noble à balcon filant, fenêtres à fronton,
 * corniche, balcon filant au dernier étage, toit de zinc à lucarnes, souches de cheminée.
 * `p` : { w, floors (2 à 4), shops: [types], porte: 'cochere', rich: bool (beaux quartiers), color }.
 */
export function haussmann(ctx, p) {
  const r = rng(p.seed || 1), w = p.w, floors = p.floors ?? 2, fh = p.floorH || FLOOR_H, rdc = p.rdcH || RDC;
  const color = p.color || STONE[Math.floor(r() * STONE.length)], x = -w / 2, top = -(rdc + floors * fh);
  wall(ctx, x, top, w, -top, color, { courses: 10, joints: 0 });
  // Refends du rez-de-chaussée et de l'entresol
  ctx.strokeStyle = alpha(shade(color, -0.4), 0.5); ctx.lineWidth = 1; ctx.beginPath();
  for (let yy = -9; yy > -rdc; yy -= 11) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
  ctx.stroke();
  box(ctx, x - 2, -rdc - 4, w + 4, 5, shade(color, 0.12), 1.1); castShadow(ctx, x, -rdc + 1, w, 7, 0.2); // bandeau
  const n = p.windows || Math.max(2, Math.round(w / 48)), bay = w / n;
  for (let f = 0; f < floors; f++) {
    const bottom = -rdc - f * fh - 12, wh = fh * (f === 0 ? 0.7 : 0.62), noble = f === 0, last = f === floors - 1;
    for (let i = 0; i < n; i++) {
      const cx = x + bay * (i + 0.5), ww = Math.min(22, bay * 0.44);
      windowUnit(ctx, cx, bottom, ww, wh, { frame: '#f6f0e2', panes: 3, lit: r() < 0.1, curtain: r() < 0.35 ? '#f2ead8' : null, bars: noble || last ? null : '#2b2826', box: !noble && !last && r() < 0.2, sill: shade(color, 0.1) }, (p.seed || 1) * 7 + f * 13 + i);
      // Encadrement sculpté : fronton à l'étage noble, agrafe ailleurs
      if (noble) { ctx.beginPath(); ctx.moveTo(cx - ww / 2 - 5, bottom - wh - 3); ctx.lineTo(cx, bottom - wh - (p.rich ? 13 : 10)); ctx.lineTo(cx + ww / 2 + 5, bottom - wh - 3); ctx.closePath(); ctx.fillStyle = shade(color, 0.1); ctx.fill(); outline(ctx, 1); castShadow(ctx, cx - ww / 2 - 4, bottom - wh - 2, ww + 8, 4, 0.2); }
      else box(ctx, cx - 3, bottom - wh - 6, 6, 6, shade(color, 0.08), 0.9);
    }
    if (noble || last) balcony(ctx, x + 3, bottom + 2, w - 6, '#2b2826', shade(color, 0.06));
    if (!last) box(ctx, x - 1, -rdc - (f + 1) * fh - 2, w + 2, 3, shade(color, 0.08), 0.8);
  }
  // Corniche à modillons
  box(ctx, x - 6, top - 8, w + 12, 8, shade(color, 0.14), 1.3);
  ctx.fillStyle = shade(color, -0.1); for (let xx = x - 2; xx < x + w; xx += 8) ctx.fillRect(xx, top - 1, 4, 3);
  castShadow(ctx, x, top, w, 10, 0.3);
  // Toit de zinc et souches
  const roofH = p.roofH || 46;
  mansard(ctx, x + 3, top - 8, w - 6, roofH, { dormers: Math.max(2, n - 1), seed: p.seed });
  const chim = p.chimneys ?? (w > 180 ? 2 : 1);
  for (let i = 0; i < chim; i++) chimney(ctx, x + w * (chim === 1 ? 0.7 : 0.2 + 0.6 * i), top - 8 - roofH + 3, 22 + r() * 10, 20 + r() * 6, r() < 0.5 ? '#dcc2a2' : '#e6d6ba');
  // Rez-de-chaussée
  if (p.rdc !== 'none') ground(ctx, p, x, w, rdc, color);
  // Murs mitoyens légèrement ombrés
  ctx.fillStyle = 'rgba(40,28,18,0.1)'; ctx.fillRect(x + w - 5, top, 5, -top);
}
const FLOOR_H = 82;

function ground(ctx, p, x, w, rdc, color) {
  const shops = p.shops || [];
  if (!shops.length) {
    ctx.save(); ctx.translate(p.doorAt ?? 0, 0); door(ctx, 0, 46, DOOR + 18, p.doorColor || '#2e4b5e', 'cochere'); ctx.restore();
    for (const side of [-1, 1]) {
      const cx = side * Math.min(w / 2 - 24, 64);
      if (Math.abs(cx) > 40) windowUnit(ctx, cx, -22, 26, 62, { frame: '#f6f0e2', bars: '#2b2826', panes: 3, sill: shade(color, 0.1) }, side);
    }
    return;
  }
  const slot = (w - 12) / shops.length;
  shops.forEach((kind, i) => {
    const cx = x + 6 + slot * (i + 0.5);
    shopfront(ctx, cx, slot - 6, kind, (p.seed || 1) * 5 + i, rdc - 12);
    if (SHOPS[kind]?.terrace && p.terrace !== false) terrace(ctx, cx - slot / 2, cx + slot / 2, (p.seed || 1) + i);
  });
}

/**
 * Immeuble de faubourg (Paris populaire) : enduit coloré, volets persiennés, fenêtres simples à garde-corps,
 * toit de zinc ou de tuiles, commerces en pied d'immeuble.
 */
export function faubourg(ctx, p) {
  const r = rng(p.seed || 2), w = p.w, floors = p.floors ?? 2, fh = p.floorH || 76, rdc = p.rdcH || RDC - 6;
  const color = p.color || PLASTER[Math.floor(r() * PLASTER.length)], x = -w / 2, top = -(rdc + floors * fh);
  wall(ctx, x, top, w, -top, color);
  const n = p.windows || Math.max(2, Math.round(w / 46)), bay = w / n;
  const shutter = p.shutter === undefined ? r.pick([null, '#6f8f9f', '#4f6f5a', '#8c9aa0', '#b0a58a']) : p.shutter;
  box(ctx, x - 1, -rdc - 3, w + 2, 4, shade(color, 0.12), 1);
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < n; i++) windowUnit(ctx, x + bay * (i + 0.5), -rdc - f * fh - 14, 20, fh * 0.6, { shutters: shutter, bars: '#2b2826', lit: r() < 0.1, box: r() < 0.3, curtain: r() < 0.3 ? '#efe6d2' : null }, (p.seed || 2) * 3 + f * 7 + i);
  }
  box(ctx, x - 3, top - 5, w + 6, 6, shade(color, 0.1), 1.1); castShadow(ctx, x, top + 1, w, 8, 0.25);
  if (p.roof === 'tuile') pitchedRoof(ctx, x, top - 5, w, p.roofH || 34, 'tuile', { overhang: 5, hip: 0.04 });
  else mansard(ctx, x + 3, top - 5, w - 6, p.roofH || 36, { dormers: Math.max(1, n - 1), seed: p.seed, color: '#7f8b95' });
  chimney(ctx, x + w * 0.75, top - 5 - (p.roofH || 36) + 3, 18, 18, '#d8b99b');
  // Descente d'eau
  box(ctx, x + w - 7, top, 3, -top, '#8e969c', 0.7);
  if (p.rdc !== 'none') ground(ctx, p, x, w, rdc, color);
}

/* ---------- Mobilier et lieux parisiens ---------- */

/**
 * Escalier de la butte vu depuis la rue : marches qui montent en fuyant entre deux murs pignons,
 * rampe centrale, lampadaire au palier ; le ciel et le fond restent visibles au-dessus. (Paris A, rue en pente.)
 */
export function escalier(ctx, p) {
  const w = p.w, x = -w / 2, H = 170, inner = w - 22;
  for (const side of [-1, 1]) wall(ctx, side < 0 ? x : x + w - 10, -H, 10, H, '#d8c7a6', { line: 1.2 });
  const steps = 13;
  for (let i = 0; i < steps; i++) {
    const t = i / steps, sw = inner * (1 - t * 0.55), sh = 9.5 * (1 - t * 0.35), sy = -4 - i * 9.5;
    box(ctx, -sw / 2, sy - sh, sw, sh, shade('#c8b99a', t * 0.25), 0.9);
    line(ctx, -sw / 2 + 1, sy - sh + 1.5, sw / 2 - 1, sy - sh + 1.5, 0.8, shade('#c8b99a', 0.35)); // nez de marche éclairé
  }
  const topY = -4 - steps * 9.5;
  box(ctx, -inner * 0.22, topY - 6, inner * 0.44, 6, '#d6c9ab', 0.9);
  line(ctx, 0, -6, 0, topY - 6, 1.8, '#2b2826');
  for (let i = 0; i < steps; i += 3) line(ctx, -4, -10 - i * 9.5, 4, -10 - i * 9.5, 1.2, '#2b2826');
  const lx = inner * 0.18;
  line(ctx, lx, topY - 6, lx, topY - 52, 2, '#2f4a3f');
  ctx.beginPath(); ctx.moveTo(lx - 5, topY - 52); ctx.lineTo(lx + 5, topY - 52); ctx.lineTo(lx + 3, topY - 62); ctx.lineTo(lx - 3, topY - 62); ctx.closePath(); ctx.fillStyle = '#f6e7a8'; ctx.fill(); outline(ctx, 1);
}

/** Quai du canal : parapet de pierre et garde-corps vert ; l'eau et la passerelle sont dans le plan du fond. */
export function quai(ctx, p) {
  const w = p.w, x = -w / 2;
  box(ctx, x, -12, w, 12, '#d4c7a8', 1.2);
  ctx.strokeStyle = '#2f4a3f'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x, -38); ctx.lineTo(x + w, -38); ctx.moveTo(x, -24); ctx.lineTo(x + w, -24);
  for (let xx = x + 4; xx < x + w; xx += 20) { ctx.moveTo(xx, -12); ctx.lineTo(xx, -40); } ctx.stroke();
  for (let xx = x + 28; xx < x + w; xx += 70) box(ctx, xx - 4, -22, 8, 10, '#2f4a3f', 0.9);
}

/** Place du marché : pavés, bancs, puis étals dessinés à part. */
export function place(ctx, p) {
  const w = p.w, x = -w / 2, color = { paves: '#cfc2a4', dalles: '#d9d2c2', gravier: '#d6c49a', beton: '#cdc9bf' }[p.paving] || '#d6cbb3';
  ctx.fillStyle = color; ctx.fillRect(x, -10, w, 10);
  ctx.strokeStyle = shade(color, -0.2); ctx.lineWidth = 0.7; ctx.beginPath();
  for (let xx = x; xx < x + w; xx += p.paving === 'dalles' ? 22 : 8) { ctx.moveTo(xx, -10); ctx.lineTo(xx - 3, 0); }
  ctx.moveTo(x, -5); ctx.lineTo(x + w, -5); ctx.stroke();
  if (p.bancs !== false) for (const bx of [x + w * 0.1, x + w * 0.9]) banc(ctx, bx);
}
export function banc(ctx, bx, color = '#4f7a4a') {
  box(ctx, bx - 17, -15, 34, 4, color, 0.9); box(ctx, bx - 17, -27, 34, 5, color, 0.9);
  line(ctx, bx - 14, -11, bx - 14, 0, 1.6, '#2b2826'); line(ctx, bx + 14, -11, bx + 14, 0, 1.6, '#2b2826');
}

/** Étals de marché : barnums rayés, cagettes de fruits et légumes, balances. */
export function marche(ctx, p) {
  const r = rng(p.seed || 12), w = p.w, n = Math.max(1, Math.round(w / 88)), sw = w / n;
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + sw * (i + 0.5), colors = r.pick([['#d8433a', '#f4ecd8'], ['#2f7a4a', '#f4ecd8'], ['#2f5f9f', '#f4ecd8'], ['#e8a23a', '#fdf4e0']]);
    for (const dx of [-sw / 2 + 7, sw / 2 - 7]) line(ctx, cx + dx, 0, cx + dx, -96, 2, '#7a7f84');
    awning(ctx, cx - sw / 2 + 5, -108, sw - 10, 20, colors, 7);
    box(ctx, cx - sw / 2 + 9, -40, sw - 18, 5, '#8a6a45', 1);
    for (let k = 0; k < (sw - 22) / 13; k++) {
      const kx = cx - sw / 2 + 12 + k * 13, fruit = r.pick(['#d9412b', '#f28c28', '#6ea83a', '#f2d23a', '#8a4fb0', '#e9e2cf']);
      box(ctx, kx, -50, 12, 10, '#c9a060', 0.8);
      for (let f = 0; f < 4; f++) { ctx.fillStyle = fruit; ctx.beginPath(); ctx.arc(kx + 2.5 + f * 2.5, -51 + (f % 2), 2.5, 0, Math.PI * 2); ctx.fill(); }
      if (r() < 0.35) { box(ctx, kx + 3, -60, 7, 5, '#f7f4ea', 0.5); }
    }
    for (const leg of [-sw / 2 + 13, sw / 2 - 13]) line(ctx, cx + leg, -35, cx + leg, 0, 1.2, '#6a6f72');
    for (let k = 0; k < 2; k++) box(ctx, cx - 14 + k * 16, -12, 14, 12, '#c9a060', 0.8);
  }
}

/** Fontaine Wallace (fonte verte, quatre cariatides stylisées). */
export function fontaineWallace(ctx) {
  const c = '#2f5a44', hi = shade(c, 0.28);
  box(ctx, -13, -10, 26, 10, c, 1.2); box(ctx, -10, -16, 20, 6, c, 1.1);
  for (const dx of [-7, -2.4, 2.4, 7]) { // cariatides : robe évasée, buste, tête
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(dx - 2.2, -16); ctx.lineTo(dx - 1.1, -38); ctx.lineTo(dx + 1.1, -38); ctx.lineTo(dx + 2.2, -16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(dx, -40.5, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hi; ctx.fillRect(dx - 1.1, -34, 0.9, 16);
  }
  box(ctx, -12, -46, 24, 3, c, 1);
  ctx.beginPath(); ctx.moveTo(-12, -46); ctx.quadraticCurveTo(-10, -60, 0, -62); ctx.quadraticCurveTo(10, -60, 12, -46); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); outline(ctx, 1.1);
  ctx.fillStyle = hi; for (let i = -1; i <= 1; i++) ctx.fillRect(i * 5 - 0.5, -57 + Math.abs(i) * 3, 1, 9);
  box(ctx, -1, -70, 2, 8, c, 0.8);
  line(ctx, -1.5, -17, -1.5, -10, 0.8, '#9fc4d6'); // filet d'eau
}

/** Arceaux à vélos avec deux vélos attachés. */
export function veloParking(ctx, p) {
  const w = p.w || 80;
  for (let i = 0; i < 3; i++) { const ax = -w / 2 + 12 + i * (w - 24) / 2; ctx.beginPath(); ctx.moveTo(ax - 8, 0); ctx.lineTo(ax - 8, -18); ctx.quadraticCurveTo(ax, -26, ax + 8, -18); ctx.lineTo(ax + 8, 0); outline(ctx, 2, '#6c747a'); }
  for (let i = 0; i < 2; i++) velo(ctx, -w / 4 + i * w / 2, ['#2f6fb0', '#c8352b'][i]);
}
export function velo(ctx, x, color = '#2f6fb0') {
  ctx.strokeStyle = '#2b2826'; ctx.lineWidth = 1.2;
  for (const wx of [x - 11, x + 11]) { ctx.beginPath(); ctx.arc(wx, -10, 9, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x - 11, -10); ctx.lineTo(x - 3, -24); ctx.lineTo(x + 8, -24); ctx.lineTo(x + 11, -10); ctx.moveTo(x - 3, -24); ctx.lineTo(x + 1, -10); ctx.lineTo(x - 11, -10); ctx.moveTo(x + 1, -10); ctx.lineTo(x + 8, -24); ctx.stroke();
  line(ctx, x - 5, -28, x - 1, -28, 2, '#2b2826'); line(ctx, x + 8, -24, x + 9, -30, 1.4, '#2b2826'); line(ctx, x + 6, -31, x + 12, -30, 1.6, '#2b2826');
}

export { flowerBox, grass, ironRail };

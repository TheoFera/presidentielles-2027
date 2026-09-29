import { DOOR, alpha, box, bush, castShadow, door, glass, grass, hedge, line, lit, outline, pitchedRoof, rng, shade, wall, windowUnit } from './kit.js';
import { shopfront } from './paris.js';
import { grillage, voiture } from './periurbain.js';

/**
 * Banlieue : cités « dortoirs » de grands ensembles posés sur des pelouses (jamais collés les uns aux autres),
 * peu de commerces, linge aux balcons, paraboles, city-stade, parkings ; pavillons modestes et fatigués ;
 * sortie de ville en terrain vague avec camp de caravanes.
 */

const BETON = ['#e1ddd2', '#d9d3c5', '#e6dfcf'];
const PASTEL = ['#c9826a', '#7fa3bf', '#94b38a', '#d8b56a', '#b893a8'];

/** Parabole vue de profil : coupelle inclinée sur son bras (pas un disque). */
export function parabole(ctx, x, y, s = 1, dir = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.beginPath(); ctx.moveTo(-2, -9); ctx.quadraticCurveTo(-8, 0, -2, 9); ctx.quadraticCurveTo(-4, 0, -2, -9); ctx.closePath();
  ctx.fillStyle = '#eceae4'; ctx.fill(); outline(ctx, 0.9);
  line(ctx, -3, 0, 6, 0, 0.9); line(ctx, 0, 8, 4, 12, 1.2, '#8a8f94');
  ctx.restore();
}

/** Linge étendu sur un fil ou un étendoir de balcon. */
export function linge(ctx, x0, x1, y, seed) {
  const r = rng(seed + 71);
  line(ctx, x0, y, x1, y, 0.7, '#6f6f6a');
  for (let x = x0 + 2; x < x1 - 5; x += 7 + r() * 3) { ctx.fillStyle = r.pick(['#f4f4f0', '#e86f6f', '#6fa8e8', '#f2d06f', '#9fd0a0', '#2f3e57']); const h = 6 + r() * 5; ctx.fillRect(x, y, 5, h); ctx.strokeStyle = 'rgba(40,28,18,0.35)'; ctx.lineWidth = 0.5; ctx.strokeRect(x, y, 5, h); }
}

/**
 * Tour de cité (R+14), isolée sur sa pelouse : panneaux de béton, cage d'escalier vitrée, loggias aux garde-corps
 * de couleur passée, volets roulants à mi-hauteur, linge, quelques paraboles, hall avec auvent.
 */
export function tourCite(ctx, p) {
  const r = rng(p.seed || 4), w = p.w, floors = p.floors ?? 13, fh = 40, base = 112, x = -w / 2, top = -(base + floors * fh);
  const beton = p.color || BETON[Math.floor(r() * BETON.length)], accent = p.accent || PASTEL[Math.floor(r() * PASTEL.length)];
  wall(ctx, x, top, w, -top, beton);
  // Cage d'escalier : bande verticale en saillie à petites fenêtres
  const sx = x + w * (p.stairAt ?? 0.5) - 13;
  box(ctx, sx, top, 26, -top - base, shade(beton, -0.06), 1.2);
  for (let f = 0; f < floors; f++) glass(ctx, sx + 7, -base - f * fh - 30, 12, 18);
  const bays = Math.max(4, Math.round((w - 26) / 34)), bw = (w - 26) / bays;
  for (let f = 0; f < floors; f++) {
    const y = -base - f * fh;
    line(ctx, x, y, x + w, y, 0.8, alpha(shade(beton, -0.4), 0.5)); // joint de dalle
    for (let i = 0; i < bays; i++) {
      const left = i < bays / 2, bx = left ? x + i * bw : x + 26 + i * bw, cx = bx + bw / 2;
      if (i % 3 === 1) { // loggia
        box(ctx, bx + 3, y - fh + 5, bw - 6, fh - 7, shade(beton, -0.35), 1);
        glass(ctx, cx - bw * 0.22, y - fh + 9, bw * 0.44, fh - 16, r() < 0.12);
        box(ctx, bx + 2, y - 15, bw - 4, 13, shade(accent, r() * 0.1), 1);
        if (r() < 0.35) linge(ctx, bx + 5, bx + bw - 5, y - 30, f * 11 + i);
        if (r() < 0.12) parabole(ctx, bx + bw - 8, y - 24, 0.9, -1);
      } else {
        windowUnit(ctx, cx, y - 8, bw * 0.52, fh * 0.56, { frame: '#f2efe8', panes: 1, sill: '#d6d1c4', roller: r() < 0.5 ? 0.3 + r() * 0.55 : 0, rollerColor: r.pick(['#dcd6c8', '#c9d3db']), curtain: r() < 0.3 ? r.pick(['#f1e4c8', '#e8b8a0', '#c8d8e8']) : null, lit: r() < 0.06 }, f * 17 + i);
      }
    }
  }
  // Hall : vitrage, auvent de béton, interphone
  box(ctx, -34, -base, 68, base, shade(beton, -0.08), 1.3);
  box(ctx, -26, -DOOR, 52, DOOR, '#8d9aa3', 1.3); glass(ctx, -23, -DOOR + 3, 46, DOOR - 3); line(ctx, 0, -DOOR + 3, 0, 0, 2, '#8d9aa3');
  box(ctx, -40, -DOOR - 12, 80, 8, shade(beton, -0.15), 1.2); castShadow(ctx, -38, -DOOR - 4, 76, 12, 0.3);
  box(ctx, 30, -54, 7, 12, '#9aa0a4', 0.8);
}

/** Barre (R+4) : longue façade régulière, loggias alternées, linge, volets roulants. */
export function barre(ctx, p) {
  const r = rng(p.seed || 9), w = p.w, floors = p.floors ?? 4, fh = 46, base = 110, x = -w / 2, top = -(base + floors * fh);
  const beton = p.color || BETON[Math.floor(r() * BETON.length)], accent = p.accent || PASTEL[Math.floor(r() * PASTEL.length)];
  wall(ctx, x, top, w, -top, beton);
  const bays = Math.max(3, Math.round(w / 34)), bw = w / bays;
  for (let f = 0; f < floors; f++) {
    const y = -base - f * fh;
    line(ctx, x, y, x + w, y, 0.8, alpha(shade(beton, -0.4), 0.5));
    for (let i = 0; i < bays; i++) {
      const bx = x + i * bw, cx = bx + bw / 2;
      if ((i + f) % 4 === 0) { box(ctx, bx + 3, y - fh + 5, bw - 6, fh - 7, shade(beton, -0.35), 1); box(ctx, bx + 2, y - 16, bw - 4, 14, accent, 1); if (r() < 0.4) linge(ctx, bx + 5, bx + bw - 5, y - 32, f * 13 + i); }
      else windowUnit(ctx, cx, y - 8, bw * 0.52, fh * 0.56, { frame: '#f2efe8', panes: 1, sill: '#d6d1c4', roller: r() < 0.45 ? 0.3 + r() * 0.5 : 0, curtain: r() < 0.3 ? '#f1e4c8' : null }, f * 7 + i);
    }
  }
  box(ctx, x - 3, top - 7, w + 6, 7, shade(beton, -0.1), 1.2);
  for (const hx of p.halls || [0]) { box(ctx, hx - 22, -DOOR, 44, DOOR, '#8d9aa3', 1.2); glass(ctx, hx - 19, -DOOR + 3, 38, DOOR - 3); box(ctx, hx - 28, -DOOR - 10, 56, 7, shade(beton, -0.15), 1.1); castShadow(ctx, hx - 26, -DOOR - 3, 52, 10, 0.3); }
}

/** Immeuble de banlieue R+3 (années 60) : rez-de-chaussée avec commerces ou hall, loggias colorées. */
export function immeubleBanlieue(ctx, p) {
  const r = rng(p.seed || 3), w = p.w, floors = p.floors ?? 3, fh = 64, rdc = p.rdcH || 128, x = -w / 2, top = -(rdc + floors * fh);
  const beton = p.color || BETON[Math.floor(r() * BETON.length)], accent = p.accent || PASTEL[Math.floor(r() * PASTEL.length)];
  wall(ctx, x, top, w, -top, beton);
  const bays = Math.max(2, Math.round(w / 44)), bw = w / bays;
  for (let f = 0; f < floors; f++) {
    const y = -rdc - f * fh;
    line(ctx, x, y, x + w, y, 0.8, alpha(shade(beton, -0.4), 0.5));
    for (let i = 0; i < bays; i++) {
      const bx = x + i * bw, cx = bx + bw / 2;
      if ((i + f) % 2 === 0) { box(ctx, bx + 4, y - fh + 7, bw - 8, fh - 9, shade(beton, -0.33), 1); glass(ctx, cx - bw * 0.2, y - fh + 12, bw * 0.4, fh - 22); box(ctx, bx + 3, y - 17, bw - 6, 15, accent, 1); if (r() < 0.35) linge(ctx, bx + 6, bx + bw - 6, y - 34, f * 5 + i); if (r() < 0.15) parabole(ctx, bx + bw - 9, y - 26, 0.9, -1); }
      else windowUnit(ctx, cx, y - 12, bw * 0.46, fh * 0.56, { frame: '#f2efe8', panes: 2, sill: '#d6d1c4', roller: r() < 0.4 ? 0.3 + r() * 0.4 : 0, curtain: r() < 0.4 ? r.pick(['#f1e4c8', '#e8b8a0', '#c8d8e8']) : null }, f * 9 + i);
    }
  }
  box(ctx, x - 3, top - 8, w + 6, 8, shade(beton, -0.1), 1.2);
  box(ctx, x - 1, -rdc - 3, w + 2, 4, shade(beton, -0.12), 1);
  if (p.rdc === 'none') return;
  if (p.shops?.length) {
    const slot = (w - 8) / p.shops.length;
    p.shops.forEach((kind, i) => shopfront(ctx, x + 4 + slot * (i + 0.5), slot - 6, kind, (p.seed || 3) * 3 + i, rdc - 16));
  } else {
    box(ctx, -24, -DOOR, 48, DOOR, '#8d9aa3', 1.2); glass(ctx, -21, -DOOR + 3, 42, DOOR - 3); line(ctx, 0, -DOOR + 3, 0, 0, 2, '#8d9aa3');
    box(ctx, -30, -DOOR - 10, 60, 7, shade(beton, -0.15), 1.1); castShadow(ctx, -28, -DOOR - 3, 56, 10, 0.3);
    for (const side of [-1, 1]) if (w > 150) windowUnit(ctx, side * w * 0.3, -34, 34, 44, { frame: '#f2efe8', panes: 1, roller: 0.5 }, side + 3);
  }
}

/** Pelouse de cité avec allée de béton, bacs, arbustes (les arbres sont dessinés en direct). */
export function pelouseCite(ctx, p) {
  const w = p.w, x = -w / 2;
  ctx.fillStyle = '#8ab25c'; ctx.fillRect(x, -7, w, 7); grass(ctx, x, w, p.seed, '#709c48');
  ctx.fillStyle = '#cfcac0'; ctx.fillRect(-(p.path || 20) / 2, -7, p.path || 20, 7);
  if (p.bush !== false) bush(ctx, x + w * 0.25, -6, 34, 18, '#5d8a40', p.seed);
  // Barrière basse en arceaux métalliques
  for (let xx = x + 8; xx < x + w - 8; xx += 22) { ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, -10); ctx.quadraticCurveTo(xx + 5, -15, xx + 10, -10); ctx.lineTo(xx + 10, 0); outline(ctx, 1.4, '#8d9499'); }
}

/** City-stade : terrain multisport grillagé, gazon synthétique, cage de but et panier. */
export function cityStade(ctx, p) {
  const w = p.w, x = -w / 2, h = 112;
  ctx.fillStyle = '#4f8f4a'; ctx.fillRect(x, -8, w, 8);
  // Parois basses en bois et haut grillage
  box(ctx, x, -24, w, 18, '#8a6a45', 1.1);
  ctx.strokeStyle = alpha('#3e4e57', 0.8); ctx.lineWidth = 0.7; ctx.beginPath();
  for (let xx = x; xx < x + w; xx += 5) { ctx.moveTo(xx, -24); ctx.lineTo(xx + 5, -h); ctx.moveTo(xx + 5, -24); ctx.lineTo(xx, -h); }
  ctx.stroke();
  for (let xx = x; xx <= x + w + 0.1; xx += w / 4) box(ctx, xx - 2, -h - 4, 4, h + 4, '#5a6a72', 0.9);
  line(ctx, x, -h, x + w, -h, 1.6, '#5a6a72');
  // Cage de but et panier de basket
  ctx.strokeStyle = '#f4f4f0'; ctx.lineWidth = 2; ctx.strokeRect(x + 10, -40, 22, 32);
  line(ctx, x + w - 16, -8, x + w - 16, -78, 2.4, '#5a6a72'); box(ctx, x + w - 30, -86, 22, 14, '#f4f4f0', 1); line(ctx, x + w - 26, -74, x + w - 14, -74, 1.6, '#e8622c');
}

/** Abribus (sans publicité lisible) : toit, vitres, banc, affiche colorée abstraite. */
export function abribus(ctx) {
  box(ctx, -42, -88, 84, 6, '#5f6a72', 1.2);
  for (const dx of [-40, 40]) box(ctx, dx - 2, -88, 4, 88, '#5f6a72', 1);
  ctx.fillStyle = 'rgba(170,200,220,0.35)'; ctx.fillRect(-38, -82, 76, 66); ctx.strokeStyle = '#8fa9ba'; ctx.lineWidth = 1; ctx.strokeRect(-38, -82, 76, 66);
  box(ctx, 14, -78, 22, 54, '#f4efe0', 1); ctx.fillStyle = '#e2562f'; ctx.fillRect(16, -74, 18, 22); ctx.fillStyle = '#2f6fb0'; ctx.beginPath(); ctx.arc(25, -40, 6, 0, Math.PI); ctx.fill();
  box(ctx, -32, -26, 38, 4, '#8a8f94', 0.8);
}

/**
 * Pavillon modeste et fatigué : crépi gris-beige taché, tuiles mécaniques, volets roulants, parabole sur le mur,
 * grillage souple, voiture ancienne devant.
 */
export function pavillonModeste(ctx, p) {
  const r = rng(p.seed || 5), w = p.w, x = -w / 2, h = p.floors === 0 ? 108 : 176, color = p.color || r.pick(['#d7cdb8', '#cfc6b2', '#dcd2bd']);
  wall(ctx, x, -h, w, h, color);
  // Taches d'humidité sous l'avant-toit et au pied
  const stain = ctx.createLinearGradient(0, -h, 0, -h + 40); stain.addColorStop(0, 'rgba(90,80,60,0.14)'); stain.addColorStop(1, 'rgba(90,80,60,0)'); ctx.fillStyle = stain; ctx.fillRect(x, -h, w, 40);
  ctx.fillStyle = 'rgba(90,80,60,0.12)'; ctx.fillRect(x, -14, w, 14);
  const doorX = x + w * (p.doorAt ?? 0.3);
  ctx.save(); ctx.translate(doorX, 0); door(ctx, 0, 28, 86, p.doorColor || r.pick(['#6d4b33', '#7a3b33', '#4f6f5f', '#8a8f94']), 'bois'); ctx.restore();
  box(ctx, doorX - 20, -98, 40, 4, '#b9c9d2', 1); for (const dx of [-17, 17]) line(ctx, doorX + dx, -94, doorX + dx * 0.7, -88, 1, '#6b737a'); // marquise
  windowUnit(ctx, x + w * 0.72, -34, 34, 46, { frame: '#f0ede4', panes: 2, roller: 0.35 + r() * 0.3, rollerColor: '#d3cfc4', curtain: '#f1e8d8' }, p.seed);
  if (h > 150) for (const t of [0.28, 0.72]) windowUnit(ctx, x + w * t, -110, 28, 40, { frame: '#f0ede4', panes: 2, roller: r() < 0.5 ? 0.6 : 0.2 }, p.seed + t * 10);
  pitchedRoof(ctx, x, -h, w, 48, 'tuile', { overhang: 8, hip: 0.25, color: '#a65a3e' });
  if (r() < 0.8) parabole(ctx, x + w - 12, -h + 30, 1, -1);
  if (p.front !== false) { ctx.fillStyle = '#8aa65a'; ctx.fillRect(x, -4, w, 4); grass(ctx, x, w, p.seed); grillageSouple(ctx, x, w, 30); }
}

/** Grillage souple à mailles losanges, un peu affaissé, poteaux verts. */
export function grillageSouple(ctx, x, w, h) {
  ctx.strokeStyle = alpha('#4a5a44', 0.7); ctx.lineWidth = 0.6; ctx.beginPath();
  for (let xx = x; xx < x + w; xx += 5) { ctx.moveTo(xx, 0); ctx.lineTo(xx + h * 0.5, -h + Math.sin(xx) * 1.5); ctx.moveTo(xx + h * 0.5, 0); ctx.lineTo(xx, -h + Math.sin(xx) * 1.5); }
  ctx.stroke();
  for (let xx = x; xx <= x + w + 0.1; xx += 40) box(ctx, xx - 1.2, -h - 2, 2.4, h + 2, '#3f5a3f', 0.6);
  line(ctx, x, -h, x + w, -h + 2, 0.9, '#4a5a44');
}

/** Petit bâtiment d'un niveau à toit plat avec une devanture (le kebab du quartier). */
export function snackQuartier(ctx, p) {
  const w = p.w, x = -w / 2, h = 132, color = '#dcd4c4';
  wall(ctx, x, -h, w, h, color);
  box(ctx, x - 3, -h - 8, w + 6, 8, shade(color, -0.12), 1.2);
  shopfront(ctx, 0, w - 16, 'kebab', p.seed || 1, 116);
  box(ctx, x + w - 26, -h + 6, 18, 12, '#b9bec2', 0.8); // climatiseur
}

/** Terrain vague : herbes sèches, pneus, caddie abandonné, palissade de chantier. */
export function terrainVague(ctx, p) {
  const w = p.w, x = -w / 2, r = rng(p.seed || 17);
  ctx.fillStyle = '#b3aa82'; ctx.fillRect(x, -8, w, 8);
  ctx.strokeStyle = '#9a9460'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < w / 2; i++) { const px = x + r() * w, hh = 6 + r() * 16; ctx.moveTo(px, -4); ctx.lineTo(px + (r() - 0.5) * 6, -4 - hh); } ctx.stroke();
  for (let i = 0; i < 3; i++) { const tx = x + w * 0.22 + (i === 2 ? 4 : 0), ty = -i * 9; ctx.beginPath(); ctx.roundRect(tx - 16, ty - 9, 32, 9, 4); ctx.fillStyle = '#2d2d2d'; ctx.fill(); outline(ctx, 0.9); line(ctx, tx - 12, ty - 4.5, tx + 12, ty - 4.5, 0.7, '#555'); }
  const cx = x + w * 0.55; ctx.strokeStyle = '#8a8f94'; ctx.lineWidth = 1; ctx.strokeRect(cx - 9, -26, 18, 14); line(ctx, cx + 9, -26, cx + 13, -32, 1, '#8a8f94'); ctx.beginPath(); ctx.arc(cx - 6, -9, 2.5, 0, Math.PI * 2); ctx.arc(cx + 6, -9, 2.5, 0, Math.PI * 2); ctx.stroke();
  // Palissade de chantier en tôle, affiches arrachées
  const px = x + w * 0.7, pw = w * 0.28; box(ctx, px, -70, pw, 70, '#9aa3a8', 1.2);
  ctx.strokeStyle = '#838c91'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let xx = px + 4; xx < px + pw; xx += 5) { ctx.moveTo(xx, -70); ctx.lineTo(xx, 0); } ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.fillStyle = r.pick(['#e2562f', '#f2d06f', '#6fa8e8', '#f4f4f0']); ctx.fillRect(px + 6 + i * pw / 3.4, -58 + r() * 10, pw / 4, 22); }
}

/** Camp de caravanes derrière son portail et son grillage : caravanes, linge, fourgon. */
export function caravanes(ctx, p) {
  const r = rng(p.seed || 13), w = p.w, x = -w / 2;
  ctx.fillStyle = '#c9c1a8'; ctx.fillRect(x, -6, w, 6);
  const n = Math.max(1, Math.round(w / 160));
  for (let i = 0; i < n; i++) {
    const cx = x + (i + 0.5) * w / n + (r() - 0.5) * 10, cw = 84;
    ctx.save(); ctx.translate(cx, 0); ctx.scale(1.6, 1.6); ctx.translate(-cx, 0);
    ctx.beginPath(); ctx.roundRect(cx - cw / 2, -62, cw, 46, [10, 10, 4, 4]); ctx.fillStyle = '#f4f2ea'; ctx.fill(); outline(ctx, 1.3);
    box(ctx, cx - cw / 2, -34, cw, 5, r.pick(['#8a5a3a', '#3f7fbf', '#6a8f3a', '#9a3a3a']), 0.7);
    glass(ctx, cx - cw / 2 + 8, -54, 20, 12); glass(ctx, cx + 8, -54, 18, 12);
    box(ctx, cx - 6, -54, 12, 36, '#e8e6de', 1); // porte
    ctx.beginPath(); ctx.arc(cx + 18, -14, 8, 0, Math.PI * 2); ctx.fillStyle = '#26282b'; ctx.fill(); outline(ctx, 1);
    line(ctx, cx + cw / 2, -20, cx + cw / 2 + 14, -10, 1.6, '#6a6f72');
    ctx.restore();
  }
  line(ctx, x + 10, -118, x + w - 10, -122, 0.8, '#777');
  for (let i = 0; i < w / 32; i++) { ctx.fillStyle = r.pick(['#f4f4f4', '#e86f6f', '#6fa8e8', '#f2d06f']); ctx.fillRect(x + 16 + i * 32, -120, 10, 13); }
  grillage(ctx, x, w * 0.3, 62, '#51605a'); grillage(ctx, x + w * 0.7, w * 0.3, 62, '#51605a');
  // Portail ouvert : deux piliers
  box(ctx, x + w * 0.3 - 5, -72, 10, 72, '#6b737a', 1); box(ctx, x + w * 0.7 - 5, -72, 10, 72, '#6b737a', 1);
}

/** Panneau publicitaire 4 × 3 sur pieds, affiche colorée sans texte. */
export function panneau4x3(ctx, p) {
  const r = rng(p.seed || 23);
  for (const dx of [-30, 30]) box(ctx, dx - 3, -80, 6, 80, '#6b737a', 1);
  box(ctx, -62, -150, 124, 76, '#4a5156', 1.3);
  const colors = r.pick([['#f2c14b', '#e2562f', '#2f6fb0'], ['#8fd0e8', '#f4f4f0', '#e2562f'], ['#9ad07a', '#2f7a4a', '#f4f4f0']]);
  ctx.fillStyle = colors[0]; ctx.fillRect(-58, -146, 116, 68);
  ctx.fillStyle = colors[1]; ctx.beginPath(); ctx.roundRect(-44, -138, 42, 52, 8); ctx.fill();
  ctx.fillStyle = colors[2]; ctx.fillRect(10, -136, 40, 12); ctx.fillRect(10, -118, 30, 8); ctx.fillRect(10, -104, 36, 8);
}

export { hedge, lit, voiture };

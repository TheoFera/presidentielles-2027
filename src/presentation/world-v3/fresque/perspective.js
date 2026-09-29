import { alpha, box, glass, line, mix, outline, rng, shade } from './kit.js';
import { basilique, laDefense, sacreCoeur } from './paysage.js';
import { arbre } from './nature.js';

/**
 * Rue qui s'enfonce en perspective dans une trouée de la rue jouable : deux alignements de façades fuient vers
 * un point de fuite à hauteur d'yeux, la chaussée et les trottoirs convergent, et un monument ferme la vue.
 * C'est ce qui donne la profondeur des panoramas world-v2 (canal, rue de Saint-Denis, avenue de La Défense).
 *
 * Repère 3D : X latéral (px du plan de rue), Y vertical (0 = sol à l'entrée, négatif vers le haut),
 * D = profondeur. Projection : z = 1 + D / FOCALE ; x = X / z ; y = -OEIL + (Y + OEIL) / z.
 */
const EYE = 72, FOCAL = 190;
const proj = (X, Y, D) => { const z = 1 + D / FOCAL; return [X / z, -EYE + (Y + EYE) / z]; };

function quad(ctx, pts, fill, width = 1, ink) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (width) outline(ctx, width, ink);
}

/**
 * Variantes :
 * - escalier : rue de la butte (Paris A) qui grimpe en escaliers entre des immeubles de faubourg ;
 * - montmartre : rue commerçante qui monte vers le Sacré-Cœur (retour vers Paris) ;
 * - saintdenis : rue commerçante populaire, guirlandes, rideaux baissés, basilique au bout ;
 * - defense : avenue plantée haussmannienne qui file vers la Grande Arche et les tours.
 */
const VARIANTS = {
  escalier: { slope: 0.42, length: 900, stairs: true, facades: ['#e8d3b3', '#dcc6a4', '#efdcbd', '#d9c09c'], floors: [3, 4, 3, 4], zinc: true, shops: 0, end: null, trees: 0 },
  montmartre: { slope: 0.22, length: 1100, facades: ['#ecdcbc', '#e4c9a6', '#f0e2c6', '#dfc7a2', '#e9d4b0'], floors: [4, 4, 3, 4, 3], zinc: true, shops: 1, end: 'sacreCoeur', trees: 0, awnings: true },
  saintdenis: { slope: 0, length: 1300, facades: ['#e3d6c0', '#d8c8ae', '#e9dcc6', '#d2c3a8', '#e1cfb2'], floors: [4, 3, 5, 4, 4], zinc: false, shops: 1, end: 'basilique', trees: 0, garlands: true, shutters: true },
  defense: { slope: 0, length: 1700, facades: ['#efe6d2', '#ebe0c8', '#f1e8d4', '#ece2cc'], floors: [5, 5, 5, 5], zinc: true, shops: 0, end: 'defense', trees: 4, treeSpan: 0.35, wide: true },
};

export function ruePerspective(ctx, p) {
  const v = VARIANTS[p.kind] || VARIANTS.saintdenis, r = rng(p.seed || 3), w = p.w;
  const half = w / 2, walk = v.wide ? w * 0.16 : w * 0.2, L = v.length;
  const ground = D => -v.slope * D; // hauteur du sol à la profondeur D
  const P = (X, Y, D) => proj(X, Y + ground(D), D);
  // Tout reste dans la trouée : les toits qui fuient vers l'extérieur sont cachés par les immeubles voisins.
  ctx.save(); ctx.beginPath(); ctx.rect(-half, -1200, w, 1204); ctx.clip();
  // Ciel de la trouée : laissé transparent (les plans du fond se voient au-dessus des toits).
  // 0. Fond de la rue (dessiné d'abord : les façades le recouvrent) : monument à l'échelle de la distance
  const [, endY] = P(0, 0, L), zEnd = 1 + L / FOCAL;
  if (v.end) {
    ctx.save(); ctx.translate(0, endY - 2);
    if (v.end === 'sacreCoeur') sacreCoeur(ctx, { scale: 0.95, hill: '#8aa46e' });
    if (v.end === 'basilique') basilique(ctx, { scale: 0.95 });
    if (v.end === 'defense') { ctx.scale(0.75, 0.75); laDefense(ctx, { w: 240, archeX: 0 }); }
    ctx.restore();
  }
  // Immeubles qui ferment la rue (face à nous), à l'échelle du fond
  const endH = 120 / zEnd * (v.end === 'defense' ? 0.2 : 1);
  if (v.end !== 'defense') { const x0 = -half / zEnd; box(ctx, x0, endY - endH, half * 2 / zEnd, endH, mix(v.facades[0], '#c9dae6', 0.35), 0.6); }
  // 1. Chaussée, trottoirs, bordures
  quad(ctx, [P(-half, 0, 0), P(half, 0, 0), P(half, 0, L), P(-half, 0, L)], v.stairs ? '#cdbf9f' : '#8d8a84', 0);
  for (const s of [-1, 1]) quad(ctx, [P(s * half, 0, 0), P(s * (half - walk), 0, 0), P(s * (half - walk), 0, L), P(s * half, 0, L)], v.stairs ? '#d9ccae' : '#cfc6b2', 0);
  if (v.stairs) { // marches : nez de marche clair, contremarche ombrée
    for (let D = 0; D < L; D += 26) {
      const [a0, y0] = P(-half + walk, 0, D), [a1] = P(half - walk, 0, D), [, y1] = P(0, 0, D + 26);
      ctx.fillStyle = 'rgba(40,28,18,0.18)'; ctx.fillRect(a0, y1, a1 - a0, y0 - y1);
      line(ctx, a0, y0, a1, y0, 1, '#efe6d0');
    }
    // Rampe centrale
    const pts = []; for (let D = 0; D <= L; D += 40) pts.push(P(0, -34, D));
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); outline(ctx, 1.6, '#2b2826');
    for (let D = 0; D <= L; D += 120) { const [x0, y0] = P(0, 0, D), [, y1] = P(0, -34, D); line(ctx, x0, y0, x0, y1, 1.2, '#2b2826'); }
  } else {
    for (const s of [-1, 1]) { const [x0, y0] = P(s * (half - walk), 0, 0), [x1, y1] = P(s * (half - walk), 0, L); line(ctx, x0, y0, x1, y1, 1.2, '#6f6a60'); }
    for (let D = 30; D < L; D += 110) { const [x0, y0] = P(0, 0, D), [x1, y1] = P(0, 0, D + 55); line(ctx, x0, y0, x1, y1, Math.max(0.6, 3 / (1 + D / FOCAL)), '#f1efe6'); }
  }
  // 2. Façades des deux côtés : immeubles successifs, du fond vers l'avant (les plus proches recouvrent)
  const segments = [];
  for (let D = 0, i = 0; D < L; i++) { const len = 170 + r() * 110; segments.push({ D0: D, D1: Math.min(L, D + len), color: v.facades[i % v.facades.length], floors: v.floors[i % v.floors.length] + (r() < 0.3 ? 1 : 0), shop: v.shops && r() < 0.85, i }); D += len; }
  for (const side of [-1, 1]) for (const seg of [...segments].reverse()) wallSegment(ctx, side * half, seg, v, P, r, side);
  // 3. Arbres d'alignement, lampadaires, guirlandes (du fond vers l'avant)
  for (let k = v.trees - 1; k >= 0; k--) for (const s of [-1, 1]) {
    const D = 60 + k * (L * (v.treeSpan || 1) - 120) / Math.max(1, v.trees - 1), [x0, y0] = P(s * (half - walk * 0.5), 0, D), z = 1 + D / FOCAL;
    ctx.save(); ctx.translate(x0, y0); ctx.scale(1 / z, 1 / z); arbre(ctx, 190, 'platane', { index: 0, blend: 0 }, k * 2 + (s > 0 ? 1 : 0)); ctx.restore();
  }
  if (v.garlands) for (let D = 520; D > 40; D -= 120) {
    const [xa, ya] = P(-half, -150, D), [xb, yb] = P(half, -150, D), z = 1 + D / FOCAL;
    ctx.beginPath(); ctx.moveTo(xa, ya); ctx.quadraticCurveTo(0, (ya + yb) / 2 + 16 / z, xb, yb); outline(ctx, Math.max(0.5, 1 / z), '#4a4540');
    for (let t = 0.1; t < 1; t += 0.1) { const x = xa + (xb - xa) * t, y = ya + (yb - ya) * t + 4 * t * (1 - t) * 16 / z; ctx.fillStyle = ['#f7d86a', '#f2f2ea', '#e85a4f'][Math.round(t * 10) % 3]; ctx.fillRect(x - 1.2, y, 2.4, 2.4 / Math.sqrt(z) + 1); }
  }
  // 5. Ombre portée des immeubles de premier plan sur l'entrée de la rue
  ctx.fillStyle = 'rgba(40,28,18,0.10)'; ctx.fillRect(-half, -6, w, 6);
  ctx.restore();
}

/** Un immeuble d'un côté de la rue, entre les profondeurs D0 et D1 : mur, fenêtres, rez-de-chaussée, corniche, toit. */
function wallSegment(ctx, X, seg, v, P, r, side) {
  const FH = 64, RDC = 96, H = RDC + seg.floors * FH, haze = t => mix(seg.color, '#c9dae6', Math.min(0.45, t));
  const zMid = 1 + (seg.D0 + seg.D1) / 2 / FOCAL, fade = (zMid - 1) / 8;
  const face = side < 0 ? shade(haze(fade), -0.04) : shade(haze(fade), -0.14); // le côté droit est à l'ombre
  quad(ctx, [P(X, 0, seg.D0), P(X, -H, seg.D0), P(X, -H, seg.D1), P(X, 0, seg.D1)], face, 0.9);
  // Corniche et toit (zinc ou tuiles) vus en fuite
  quad(ctx, [P(X, -H, seg.D0), P(X, -H - 6, seg.D0), P(X, -H - 6, seg.D1), P(X, -H, seg.D1)], shade(face, 0.15), 0.6);
  if (v.zinc) quad(ctx, [P(X, -H - 6, seg.D0), P(X + side * 26, -H - 40, seg.D0), P(X + side * 26, -H - 40, seg.D1), P(X, -H - 6, seg.D1)], mix('#7a8794', '#c9dae6', Math.min(0.45, fade)), 0.6);
  else quad(ctx, [P(X, -H - 6, seg.D0), P(X, -H - 10, seg.D0), P(X, -H - 10, seg.D1), P(X, -H - 6, seg.D1)], shade(face, -0.1), 0.5);
  // Fenêtres : baies régulières en profondeur, à chaque étage
  const bay = 58;
  for (let D = seg.D0 + 16; D < seg.D1 - 20; D += bay) {
    for (let f = 0; f < seg.floors; f++) {
      const yb = -RDC - f * FH - 14, yt = yb - FH * 0.58;
      const lit = r() < 0.12, col = lit ? '#f3d58f' : mix('#4d6275', '#c9dae6', Math.min(0.4, fade));
      quad(ctx, [P(X, yb, D), P(X, yt, D), P(X, yt, D + 26), P(X, yb, D + 26)], col, 0.5, alpha('#2b2826', 0.6));
      if (v.shutters && r() < 0.6) quad(ctx, [P(X, yb, D - 9), P(X, yt, D - 9), P(X, yt, D), P(X, yb, D)], mix('#7c8a8f', '#c9dae6', Math.min(0.4, fade)), 0);
      if (f === 0 && !v.shutters) quad(ctx, [P(X, yb + 2, D - 4), P(X, yb - 10, D - 4), P(X, yb - 10, D + 30), P(X, yb + 2, D + 30)], 'rgba(30,28,26,0.35)', 0); // balcon
    }
  }
  // Rez-de-chaussée : vitrines colorées, rideaux baissés, portes
  if (seg.shop) {
    const colors = ['#7a2f2a', '#2f5a44', '#2f4a7a', '#c3402f', '#5b3f6e', '#e8a23a'];
    for (let D = seg.D0 + 8; D < seg.D1 - 30; D += 70) {
      const c = colors[Math.floor(r() * colors.length)], shut = v.shutters && r() < 0.35;
      quad(ctx, [P(X, -6, D), P(X, -RDC + 16, D), P(X, -RDC + 16, D + 58), P(X, -6, D + 58)], shut ? '#9aa1a6' : mix(c, '#c9dae6', Math.min(0.4, fade)), 0.6);
      if (!shut) quad(ctx, [P(X, -10, D + 6), P(X, -RDC + 34, D + 6), P(X, -RDC + 34, D + 52), P(X, -10, D + 52)], '#f3d58f', 0);
      if (v.awnings && r() < 0.6) quad(ctx, [P(X, -RDC + 20, D), P(X - side * 20, -RDC + 34, D), P(X - side * 20, -RDC + 34, D + 58), P(X, -RDC + 20, D + 58)], r() < 0.5 ? '#b8323a' : '#2f5a44', 0.5);
    }
  } else for (let D = seg.D0 + 40; D < seg.D1 - 40; D += 120) quad(ctx, [P(X, 0, D), P(X, -86, D), P(X, -86, D + 34), P(X, 0, D + 34)], mix('#2e4b5e', '#c9dae6', Math.min(0.4, fade)), 0.5);
  void glass;
}

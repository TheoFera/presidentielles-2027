import { INK, alpha, line, mix, outline, rng, shade } from './kit.js';

/**
 * Arbres dessinés dans le style de la fresque, qui suivent les saisons de la campagne :
 * index 0 = fin d'été (vert), 1 = automne (roux, feuilles qui tombent), 2 = hiver (branches nues), 3 = printemps (vert tendre, fleurs).
 * `season` = { index, blend } (comme seasonAt de la simulation).
 */
const LEAF = [['#5f8f3f', '#4a7a33', '#79a650'], ['#c8843a', '#b0602c', '#dca24a'], ['#8a7d5e', '#7a6d50', '#9a8d6e'], ['#8fbf5a', '#76a84a', '#a8d06a']];
const AMOUNT = [1, 0.85, 0, 0.7];

function seasonal(season, slot) {
  const a = LEAF[season.index], b = LEAF[(season.index + 1) % 4];
  return mix(a[slot], b[slot], season.blend);
}
export function leafAmount(season) { return AMOUNT[season.index] + (AMOUNT[(season.index + 1) % 4] - AMOUNT[season.index]) * season.blend; }

/** Masse de feuillage festonnée (jamais un disque) autour de (cx, cy), rayon rx × ry. */
function lobe(ctx, cx, cy, rx, ry, fill, seed, width = 1.2) {
  const r = rng(seed), n = 11;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, k = 0.86 + r() * 0.2, px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(px, py);
    else { const am = (i - 0.5) / n * Math.PI * 2; ctx.quadraticCurveTo(cx + Math.cos(am) * rx * 1.12, cy + Math.sin(am) * ry * 1.12, px, py); }
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.8, cy + ry);
  g.addColorStop(0, shade(fill, 0.16)); g.addColorStop(0.55, fill); g.addColorStop(1, shade(fill, -0.18));
  ctx.fillStyle = g; ctx.fill(); if (width) outline(ctx, width);
  // Grappes de feuilles : petits festons plus sombres dans la moitié basse
  if (rx > 14) { ctx.save(); ctx.clip(); ctx.strokeStyle = alpha(shade(fill, -0.3), 0.55); ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { const px = cx - rx * 0.7 + r() * rx * 1.4, py = cy - ry * 0.1 + r() * ry * 0.9, k = rx * (0.14 + r() * 0.1); ctx.beginPath(); ctx.arc(px, py, k, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); } ctx.restore(); }
}

/**
 * Arbre complet posé au sol en (0, 0), hauteur h.
 * `kind` : 'platane' (rues de Paris, écorce tachetée), 'tilleul' (rond), 'peuplier' (colonne), 'pin' (pin parasol), 'chene' (campagne).
 */
export function arbre(ctx, h, kind, season, seed = 1) {
  // Le pin parasol est persistant : toujours vert, quelle que soit la saison.
  if (kind === 'pin') season = { index: 0, blend: 0 };
  const r = rng(seed), amount = leafAmount(season);
  const trunkH = kind === 'pin' ? h * 0.62 : kind === 'peuplier' ? h * 0.25 : h * 0.42, tw = Math.max(5, h * (kind === 'pin' ? 0.04 : 0.055));
  // Tronc et charpentières (visibles en hiver, partiellement le reste de l'année)
  const bark = kind === 'platane' ? '#9a8a6a' : kind === 'pin' ? '#7a5a40' : '#6a5540';
  ctx.beginPath(); ctx.moveTo(-tw * 0.7, 0); ctx.quadraticCurveTo(-tw * 0.4, -trunkH * 0.5, -tw * 0.35, -trunkH); ctx.lineTo(tw * 0.35, -trunkH); ctx.quadraticCurveTo(tw * 0.4, -trunkH * 0.5, tw * 0.7, 0); ctx.closePath();
  ctx.fillStyle = bark; ctx.fill(); outline(ctx, 1.2);
  if (kind === 'platane') { ctx.fillStyle = '#d6cfae'; for (let i = 0; i < 5; i++) ctx.fillRect(-tw * 0.3 + r() * tw * 0.4, -trunkH * (0.2 + r() * 0.7), tw * 0.35, trunkH * 0.08); }
  const branches = kind === 'peuplier' ? 5 : kind === 'pin' ? 4 : 6;
  ctx.strokeStyle = shade(bark, -0.2); ctx.lineCap = 'round';
  for (let i = 0; i < branches; i++) {
    const t = i / (branches - 1), side = t < 0.5 ? -1 : 1, spread = kind === 'peuplier' ? 0.12 : kind === 'pin' ? 0.46 : 0.34;
    const ex = (t - 0.5) * 2 * h * spread, ey = -trunkH - h * (kind === 'pin' ? 0.22 : 0.3 + 0.25 * Math.sin(t * Math.PI));
    ctx.lineWidth = Math.max(1.4, tw * 0.45); ctx.beginPath(); ctx.moveTo(0, -trunkH * 0.92); ctx.quadraticCurveTo(ex * 0.3, (ey - trunkH) / 2, ex, ey); ctx.stroke();
    if (amount < 0.5) { ctx.lineWidth = 1; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(ex * 0.7, ey * 0.9); ctx.lineTo(ex + s * h * 0.06, ey - h * 0.08); ctx.stroke(); } void side; }
  }
  if (amount < 0.02) return;
  // Feuillage : plusieurs masses festonnées, ombre à droite et en bas, lumière en haut à gauche
  ctx.save(); ctx.globalAlpha = Math.min(1, amount * 1.15);
  const dark = seasonal(season, 1), mid = seasonal(season, 0), light = seasonal(season, 2);
  const masses = kind === 'peuplier' ? [[0, -h * 0.62, h * 0.13, h * 0.38]]
    : kind === 'pin' ? [[-h * 0.2, -h * 0.84, h * 0.24, h * 0.1], [h * 0.14, -h * 0.88, h * 0.26, h * 0.11], [0, -h * 0.94, h * 0.2, h * 0.09]]
    : [[-h * 0.24, -h * 0.6, h * 0.19, h * 0.15], [h * 0.23, -h * 0.58, h * 0.2, h * 0.15], [0, -h * 0.6, h * 0.24, h * 0.16], [-h * 0.14, -h * 0.76, h * 0.2, h * 0.16], [h * 0.14, -h * 0.78, h * 0.2, h * 0.16], [0, -h * 0.9, h * 0.18, h * 0.13]];
  const scale = kind === 'chene' ? 1.15 : kind === 'tilleul' ? 0.95 : 1;
  masses.forEach(([cx, cy, rx, ry], i) => lobe(ctx, cx * scale, cy, rx * scale * (0.6 + 0.4 * amount), ry * (0.6 + 0.4 * amount), dark, seed * 7 + i));
  masses.forEach(([cx, cy, rx, ry], i) => lobe(ctx, cx * scale - rx * 0.12, cy - ry * 0.12, rx * scale * 0.78 * (0.6 + 0.4 * amount), ry * 0.74 * (0.6 + 0.4 * amount), mid, seed * 11 + i, 0));
  masses.forEach(([cx, cy, rx, ry], i) => lobe(ctx, cx * scale - rx * 0.3, cy - ry * 0.34, rx * scale * 0.34, ry * 0.3, light, seed * 13 + i, 0));
  if (season.index === 3 && kind === 'tilleul') { ctx.fillStyle = '#f7e4ec'; for (let i = 0; i < 14; i++) ctx.fillRect(-h * 0.3 + r() * h * 0.6, -h * 0.9 + r() * h * 0.4, 2.5, 2.5); }
  ctx.restore();
  // Feuilles mortes au pied en automne
  if (season.index === 1 || (season.index === 0 && season.blend > 0.7)) { ctx.fillStyle = '#c8743a'; for (let i = 0; i < 8; i++) ctx.fillRect(-h * 0.2 + r() * h * 0.4, -2 - r() * 3, 3, 2); }
  void INK; void line;
}

/**
 * Lisière de bois ou rideau d'arbres lointains (plans du fond) : festons de feuillage continus, sans tronc visible.
 * Couleurs de fin d'été : le filtre de saison du plan les fait évoluer.
 */
export function lisiere(ctx, p) {
  const w = p.w, h = p.h || 60, r = rng(p.seed || 3), base = p.color || '#5f8a48';
  for (let layer = 0; layer < 2; layer++) {
    const c = layer ? base : shade(base, -0.14);
    for (let x = -w / 2; x < w / 2 + 10; x += h * 0.45) {
      const hh = h * (0.6 + r() * 0.5) * (layer ? 0.85 : 1), rx = h * (0.3 + r() * 0.14);
      if (p.cypress && r() < 0.22) { lobe(ctx, x, -hh * 0.55, rx * 0.35, hh * 0.55, shade(c, -0.06), x + layer, 1); continue; }
      lobe(ctx, x + (layer ? h * 0.2 : 0), -hh + rx * 0.7, rx, rx * 0.8, c, x * 3 + layer, layer ? 0.9 : 1);
      ctx.fillStyle = c; ctx.fillRect(x - rx, -hh + rx * 0.7, rx * 2, hh - rx * 0.7);
    }
  }
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); outline(ctx, 1);
}

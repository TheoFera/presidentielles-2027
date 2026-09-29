/**
 * Grammaire visuelle de la fresque : une seule façon de dessiner, du premier plan à l'horizon.
 * - Encre chaude et unique (INK), traits de 1,5 px pour les volumes et 1 px pour les détails.
 * - Lumière venant de la gauche : faces claires à gauche, ombres portées sous les corniches, balcons, auvents.
 * - Fenêtres avec embrasure (profondeur), appui et linteau ; aucune boucle ni rond décoratif.
 * Mesures en pixels logiques du jeu : 1 unité = 40 px, un personnage mesure 81 px.
 * Origine (0, 0) au sol, au centre de l'objet ; y négatif vers le haut.
 */
export const INK = '#3a3129';
export const DOOR = 92;   // porte ≈ 1,15 × un personnage
export const RDC = 128;   // rez-de-chaussée commerçant
export const FLOOR = 84;  // étage courant

/** Générateur pseudo-aléatoire déterministe. */
export function rng(seed) {
  let a = (Math.floor(seed * 9973) ^ 0x9e3779b9) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (min, max) => min + next() * (max - min);
  next.int = (min, max) => Math.floor(min + next() * (max - min + 1));
  next.pick = list => list[Math.floor(next() * list.length)];
  next.chance = p => next() < p;
  return next;
}
export const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------- Couleurs ---------- */

const parse = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const format = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const x = parse(a), y = parse(b); return format(x.map((v, i) => v + (y[i] - v) * t)); };
/** Éclaircit (amount > 0) ou assombrit (amount < 0) en gardant la teinte chaude. */
export const shade = (color, amount) => amount >= 0 ? mix(color, '#fffaf0', amount) : mix(color, '#2a2018', -amount);
export const alpha = (hex, a) => { const [r, g, b] = parse(hex); return `rgba(${r},${g},${b},${a})`; };

/* ---------- Traits ---------- */

export function outline(ctx, width = 1.5, color = INK) { ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
export function line(ctx, x0, y0, x1, y1, width = 1, color = INK) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); outline(ctx, width, color); }

/** Rectangle rempli et encré. */
export function box(ctx, x, y, w, h, fill, width = 1.3, ink = INK) {
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fillStyle = fill; ctx.fill();
  if (width) outline(ctx, width, ink);
}

/** Volume éclairé de la gauche : dégradé horizontal doux + léger assombrissement au pied. */
export function lit(ctx, x, y, w, h, color, { light = 0.07, dark = 0.1 } = {}) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(color, light)); g.addColorStop(1, shade(color, -dark));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const v = ctx.createLinearGradient(0, y + h - Math.min(40, h * 0.3), 0, y + h);
  v.addColorStop(0, 'rgba(40,28,18,0)'); v.addColorStop(1, 'rgba(40,28,18,0.1)');
  ctx.fillStyle = v; ctx.fillRect(x, y + h - Math.min(40, h * 0.3), w, Math.min(40, h * 0.3));
}

/** Mur : volume éclairé, assises de pierre éventuelles, contour. */
export function wall(ctx, x, y, w, h, color, { courses = 0, joints = 0, line: width = 1.5 } = {}) {
  lit(ctx, x, y, w, h, color);
  if (courses) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = alpha(shade(color, -0.35), 0.35); ctx.lineWidth = 0.8; ctx.beginPath();
    for (let yy = y + h - courses; yy > y; yy -= courses) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
    if (joints) for (let row = 0, yy = y + h; yy > y; yy -= courses, row++) for (let xx = x + (row % 2) * joints / 2; xx < x + w; xx += joints) { ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - courses); }
    ctx.stroke(); ctx.restore();
  }
  if (width) { ctx.beginPath(); ctx.rect(x, y, w, h); outline(ctx, width); }
}

/** Ombre portée douce sous une avancée (corniche, balcon, auvent, avant-toit). */
export function castShadow(ctx, x, y, w, h = 10, strength = 0.22) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(40,28,18,${strength})`); g.addColorStop(1, 'rgba(40,28,18,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

/* ---------- Fenêtres et portes ---------- */

/** Vitre : ciel reflété bleu-gris avec reflet diagonal, ou intérieur allumé chaud. */
export function glass(ctx, x, y, w, h, lit = false) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  if (lit) { g.addColorStop(0, '#ffe6a8'); g.addColorStop(1, '#e8a95e'); } else { g.addColorStop(0, '#8fa6b6'); g.addColorStop(1, '#3f5367'); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath(); ctx.moveTo(x + w * 0.55, y); ctx.lineTo(x + w * 0.8, y); ctx.lineTo(x + w * 0.2, y + h); ctx.lineTo(x - w * 0.05, y + h); ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.beginPath(); // aucun tracé résiduel : un contour appelé ensuite ne dessine rien par erreur
}

/**
 * Fenêtre complète. `o` : { frame, lit, curtain, shutters: couleur de volets battants, roller: part de volet roulant baissé (0 à 1),
 * sill: couleur d'appui, bars: garde-corps en fer, box: jardinière, arch: cintrée, panes: nombre de carreaux par battant }.
 */
export function windowUnit(ctx, cx, bottom, w, h, o = {}, seed = 0) {
  const x = cx - w / 2, y = bottom - h, frame = o.frame || '#f4eee2';
  if (o.shutters) for (const side of [-1, 1]) {
    const sx = side < 0 ? x - w * 0.5 - 1 : x + w + 1, sw = w * 0.5;
    box(ctx, sx, y, sw, h, o.shutters, 1.1);
    ctx.strokeStyle = shade(o.shutters, -0.25); ctx.lineWidth = 0.8; ctx.beginPath();
    for (let yy = y + 3; yy < bottom - 1; yy += 3.5) { ctx.moveTo(sx + 1.5, yy); ctx.lineTo(sx + sw - 1.5, yy); }
    ctx.stroke();
  }
  // Embrasure (profondeur du mur) puis dormant
  ctx.fillStyle = 'rgba(40,28,18,0.28)'; ctx.fillRect(x - 1, y - 1, w + 3, h + 1);
  ctx.beginPath();
  if (o.arch) { ctx.moveTo(x, bottom); ctx.lineTo(x, y + w / 2); ctx.arc(cx, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, bottom); ctx.closePath(); }
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = frame; ctx.fill();
  ctx.save(); ctx.clip();
  const f = Math.max(2, w * 0.1);
  glass(ctx, x + f, y + f, w - f * 2, h - f * 2, o.lit);
  if (o.curtain) { ctx.fillStyle = o.curtain; ctx.fillRect(x + f, y + f, (w - f * 2) * 0.24, h - f * 2); ctx.fillRect(x + w - f - (w - f * 2) * 0.24, y + f, (w - f * 2) * 0.24, h - f * 2); }
  if (o.roller) { // volet roulant partiellement baissé
    const rh = (h - f * 2) * o.roller; ctx.fillStyle = o.rollerColor || '#e2ddd2'; ctx.fillRect(x + f, y + f, w - f * 2, rh);
    ctx.strokeStyle = 'rgba(40,28,18,0.25)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let yy = y + f + 2.5; yy < y + f + rh; yy += 2.5) { ctx.moveTo(x + f, yy); ctx.lineTo(x + w - f, yy); } ctx.stroke();
  }
  // Petits bois : un montant central et des traverses
  ctx.strokeStyle = frame; ctx.lineWidth = Math.max(1.2, w * 0.07); ctx.beginPath();
  if (w > 14 && o.panes !== 0) { ctx.moveTo(cx, y); ctx.lineTo(cx, bottom); }
  const panes = o.panes ?? (h > w * 1.5 ? 3 : 2);
  for (let i = 1; i < panes; i++) { const yy = y + f + (h - f * 2) * i / panes; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
  ctx.stroke();
  ctx.restore();
  ctx.beginPath(); if (o.arch) { ctx.moveTo(x, bottom); ctx.lineTo(x, y + w / 2); ctx.arc(cx, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, bottom); ctx.closePath(); } else ctx.rect(x, y, w, h);
  outline(ctx, 1.1);
  // Appui
  if (o.sill !== false) { box(ctx, x - 3, bottom, w + 6, 3, o.sill || '#e9e1d0', 1); castShadow(ctx, x - 2, bottom + 3, w + 4, 5, 0.18); }
  if (o.bars) ironRail(ctx, x - 1, bottom - h * 0.33, w + 2, h * 0.33, o.bars);
  if (o.box) flowerBox(ctx, cx, bottom, w + 4, seed);
}

/** Garde-corps en fer : barreaux droits, lisse haute et basse, frise de losanges (jamais de ronds). */
export function ironRail(ctx, x, y, w, h, color = '#2b2826') {
  ctx.strokeStyle = color; ctx.lineWidth = 1.1; ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h);
  for (let xx = x + 2.5; xx < x + w - 1; xx += 3.5) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
  ctx.stroke();
  if (h > 9) {
    ctx.lineWidth = 0.8; ctx.beginPath();
    const my = y + h * 0.5, d = Math.min(3, h * 0.25);
    for (let xx = x + 5; xx < x + w - 4; xx += 7) { ctx.moveTo(xx - d, my); ctx.lineTo(xx, my - d); ctx.lineTo(xx + d, my); ctx.lineTo(xx, my + d); ctx.closePath(); }
    ctx.stroke();
  }
}

/** Balcon filant : dalle moulurée, ombre, garde-corps. */
export function balcony(ctx, x, y, w, color = '#2b2826', stone = '#e6d9bd') {
  box(ctx, x, y, w, 5, stone, 1.1);
  castShadow(ctx, x + 2, y + 5, w - 4, 8, 0.25);
  ironRail(ctx, x + 1, y - 15, w - 2, 15, color);
}

/** Jardinière fleurie (géraniums rouges et roses sur feuillage). */
export function flowerBox(ctx, cx, bottom, w, seed = 0) {
  const r = rng(seed + 11);
  box(ctx, cx - w / 2 + 1, bottom - 3, w - 2, 5, '#9a6440', 0.9);
  for (let i = 0; i < w / 3.2; i++) {
    const px = cx - w / 2 + 3 + r() * (w - 6), py = bottom - 4 - r() * 5;
    ctx.fillStyle = r() < 0.5 ? '#4f7d3a' : '#65923f'; ctx.fillRect(px - 2, py - 1.5, 4, 3);
    if (r() < 0.6) { ctx.fillStyle = r.pick(['#d8434c', '#e8657a', '#d8434c', '#f4f0ea']); ctx.fillRect(px - 1, py - 3, 2.4, 2.4); }
  }
}

/** Porte. `kind` : 'cochere' (double, cintrée, moulurée), 'bois', 'pvc' (blanche), 'vitree', 'metal'. */
export function door(ctx, cx, w, h, color = '#2f4a5f', kind = 'bois') {
  const x = cx - w / 2, y = -h, arch = kind === 'cochere';
  ctx.fillStyle = 'rgba(40,28,18,0.3)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 2); // embrasure
  const path = () => { ctx.beginPath(); if (arch) { ctx.moveTo(x, 0); ctx.lineTo(x, y + w * 0.35); ctx.quadraticCurveTo(cx, y - w * 0.12, x + w, y + w * 0.35); ctx.lineTo(x + w, 0); ctx.closePath(); } else ctx.rect(x, y, w, h); };
  path(); ctx.fillStyle = color; ctx.fill();
  ctx.save(); path(); ctx.clip();
  lit(ctx, x, y - 10, w, h + 10, color, { light: 0.1, dark: 0.12 });
  const panel = shade(color, -0.22);
  if (kind === 'cochere') {
    for (const px of [x + w * 0.08, cx + w * 0.04]) { box(ctx, px, y + h * 0.3, w * 0.38, h * 0.3, color, 0.9, panel); box(ctx, px, y + h * 0.66, w * 0.38, h * 0.28, color, 0.9, panel); }
    line(ctx, cx, y, cx, 0, 1.2, panel);
    glass(ctx, x + w * 0.2, y + w * 0.12, w * 0.6, h * 0.14);
  } else if (kind === 'pvc') {
    ctx.strokeStyle = '#d8d6ce'; ctx.lineWidth = 1; ctx.strokeRect(x + w * 0.15, y + h * 0.1, w * 0.7, h * 0.35); ctx.strokeRect(x + w * 0.15, y + h * 0.55, w * 0.7, h * 0.35);
    glass(ctx, x + w * 0.3, y + h * 0.14, w * 0.4, h * 0.2);
  } else if (kind === 'vitree') {
    glass(ctx, x + w * 0.14, y + h * 0.08, w * 0.72, h * 0.66, true);
  } else if (kind === 'metal') {
    ctx.strokeStyle = panel; ctx.lineWidth = 0.8; ctx.beginPath(); for (let yy = y + 4; yy < 0; yy += 4) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); } ctx.stroke();
  } else {
    box(ctx, x + w * 0.16, y + h * 0.1, w * 0.68, h * 0.36, color, 0.9, panel);
    box(ctx, x + w * 0.16, y + h * 0.54, w * 0.68, h * 0.38, color, 0.9, panel);
  }
  ctx.restore();
  path(); outline(ctx, 1.4);
  if (kind !== 'metal') { ctx.fillStyle = '#c9a54f'; ctx.fillRect(cx + (kind === 'cochere' ? 3 : w * 0.3), -h * 0.48, 2.2, 5); }
  box(ctx, x - 3, -2, w + 6, 2, '#bdb3a0', 0.8); // seuil
}

/** Store (auvent) rayé ou uni avec lambrequin festonné et ombre portée. */
export function awning(ctx, x, y, w, depth, colors = ['#b8323a', '#f4ead8'], stripes = 9) {
  ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + w + 2, y); ctx.lineTo(x + w + 6, y + depth); ctx.lineTo(x - 6, y + depth); ctx.closePath();
  ctx.save(); ctx.clip();
  const sw = (w + 12) / stripes;
  for (let i = 0; i < stripes; i++) { ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(x - 6 + i * sw, y, sw + 0.5, depth + 1); }
  const g = ctx.createLinearGradient(0, y, 0, y + depth); g.addColorStop(0, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(40,28,18,0.15)');
  ctx.fillStyle = g; ctx.fillRect(x - 7, y, w + 14, depth);
  ctx.restore(); outline(ctx, 1.3);
  const n = Math.max(4, Math.round((w + 12) / 9)), step = (w + 12) / n;
  ctx.beginPath(); ctx.moveTo(x - 6, y + depth);
  for (let i = 0; i < n; i++) { const a = x - 6 + i * step; ctx.quadraticCurveTo(a + step / 2, y + depth + 6, a + step, y + depth); }
  ctx.closePath(); ctx.fillStyle = colors[0]; ctx.fill(); outline(ctx, 1.1);
  castShadow(ctx, x, y + depth + 4, w, 14, 0.2);
}

/* ---------- Toits ---------- */

/** Toit mansardé en zinc (Paris) : brisis, lucarnes à fronton, souches de cheminée. */
export function mansard(ctx, x, y, w, h, { color = '#7a8794', dormers = 3, seed = 0, lit: litShare = 0.15 } = {}) {
  const inset = h * 0.32, r = rng(seed + 5);
  ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + w + 3, y); ctx.lineTo(x + w - inset, y - h); ctx.lineTo(x + inset, y - h); ctx.closePath();
  ctx.save(); ctx.clip(); lit(ctx, x - 4, y - h, w + 8, h, color, { light: 0.1, dark: 0.12 });
  ctx.strokeStyle = alpha(shade(color, -0.35), 0.6); ctx.lineWidth = 0.8; ctx.beginPath();
  for (let xx = x + 4; xx < x + w; xx += 5) { ctx.moveTo(xx, y); ctx.lineTo(xx + (x + w / 2 - xx) * 0.08, y - h); }
  ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + w + 3, y); ctx.lineTo(x + w - inset, y - h); ctx.lineTo(x + inset, y - h); ctx.closePath(); outline(ctx, 1.4);
  line(ctx, x + inset, y - h, x + w - inset, y - h, 2.2, shade(color, -0.4)); // faîtage
  for (let i = 0; i < dormers; i++) {
    const cx = x + w * (i + 0.5) / dormers, dw = Math.min(18, w / dormers * 0.42), dh = h * 0.66;
    box(ctx, cx - dw / 2 - 3, y - dh - 1, dw + 6, dh, '#efe7d6', 1.1);
    ctx.beginPath(); ctx.moveTo(cx - dw / 2 - 6, y - dh - 1); ctx.lineTo(cx, y - dh - 10); ctx.lineTo(cx + dw / 2 + 6, y - dh - 1); ctx.closePath();
    ctx.fillStyle = '#e6dcc6'; ctx.fill(); outline(ctx, 1.1);
    glass(ctx, cx - dw / 2, y - dh + 2, dw, dh - 6, r() < litShare);
    line(ctx, cx, y - dh + 2, cx, y - 4, 1.3, '#efe7d6');
  }
}

/** Souche de cheminée maçonnée avec ses pots en terre cuite. */
export function chimney(ctx, cx, y, w = 18, h = 24, color = '#d9bf9f') {
  box(ctx, cx - w / 2, y - h, w, h, color, 1.2);
  ctx.fillStyle = 'rgba(40,28,18,0.12)'; ctx.fillRect(cx + w * 0.15, y - h, w * 0.35, h);
  box(ctx, cx - w / 2 - 2, y - h - 3, w + 4, 4, shade(color, -0.12), 1);
  const pots = Math.max(1, Math.floor(w / 6));
  for (let i = 0; i < pots; i++) box(ctx, cx - w / 2 + 2 + i * (w - 4) / pots, y - h - 9, Math.min(4.5, (w - 4) / pots - 1), 6, '#c2673f', 0.9);
}

/**
 * Toit à deux pans vu de face (long pan) : tuiles romanes, tuiles plates ou ardoise.
 * `kind` : 'tuile' | 'ardoise' | 'plate'.
 */
export function pitchedRoof(ctx, x, y, w, h, kind = 'tuile', { overhang = 8, hip = 0.2, color } = {}) {
  const c = color || { tuile: '#b8633f', ardoise: '#4c535b', plate: '#9c4f36' }[kind];
  const inset = w * hip;
  const path = () => { ctx.beginPath(); ctx.moveTo(x - overhang, y); ctx.lineTo(x + w + overhang, y); ctx.lineTo(x + w - inset, y - h); ctx.lineTo(x + inset, y - h); ctx.closePath(); };
  path(); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, y - h, 0, y); g.addColorStop(0, shade(c, 0.12)); g.addColorStop(1, shade(c, -0.1));
  ctx.fillStyle = g; ctx.fillRect(x - overhang, y - h, w + overhang * 2, h);
  ctx.strokeStyle = alpha(shade(c, -0.4), 0.55); ctx.lineWidth = 0.8; ctx.beginPath();
  const rowH = kind === 'ardoise' ? 4 : 5.5;
  for (let yy = y - rowH, row = 0; yy > y - h; yy -= rowH, row++) {
    ctx.moveTo(x - overhang, yy); ctx.lineTo(x + w + overhang, yy);
    const step = kind === 'tuile' ? 7 : 6;
    for (let xx = x - overhang + (row % 2) * step / 2; xx < x + w + overhang; xx += step) { ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + rowH); }
  }
  ctx.stroke(); ctx.restore();
  path(); outline(ctx, 1.5);
  line(ctx, x + inset, y - h, x + w - inset, y - h, 2.2, shade(c, -0.35));
  castShadow(ctx, x, y, w, 9, 0.28);
}

/** Pignon (toit vu de profil) : triangle avec rive et ombre. */
export function gableRoof(ctx, x, y, w, h, kind = 'tuile', { overhang = 7, color } = {}) {
  const c = color || { tuile: '#b8633f', ardoise: '#4c535b', plate: '#9c4f36' }[kind];
  ctx.beginPath(); ctx.moveTo(x - overhang, y); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w + overhang, y); ctx.lineTo(x + w + overhang - 4, y + 3); ctx.lineTo(x + w / 2, y - h + 5); ctx.lineTo(x - overhang + 4, y + 3); ctx.closePath();
  ctx.fillStyle = c; ctx.fill(); outline(ctx, 1.4);
  castShadow(ctx, x, y + 2, w, 8, 0.22);
}

/* ---------- Végétation basse ---------- */

/** Haie taillée (thuyas, charmille, troènes) : bloc net, dessus arrondi, feuillage suggéré. */
export function hedge(ctx, x, w, h, color = '#4f7b3a', seed = 0) {
  ctx.beginPath(); ctx.roundRect(x, -h, w, h, [7, 7, 0, 0]);
  const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, shade(color, 0.14)); g.addColorStop(1, shade(color, -0.22));
  ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.3);
  const r = rng(seed + 3); ctx.fillStyle = alpha(shade(color, 0.3), 0.6);
  for (let i = 0; i < w * h / 55; i++) { const px = x + 3 + r() * (w - 6), py = -h + 3 + r() * (h - 6); ctx.beginPath(); ctx.arc(px, py, 1.6, Math.PI, 0); ctx.fill(); }
}

/** Buisson arrondi (massif, arbuste) : festons de feuillage, jamais un disque. */
export function bush(ctx, cx, bottom, w, h, color = '#5d8a40', seed = 0) {
  const r = rng(seed + 7), n = Math.max(5, Math.round(w / 9));
  ctx.beginPath(); ctx.moveTo(cx - w / 2, bottom);
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = cx - w / 2 + t * w, py = bottom - h * Math.sin(Math.PI * (0.08 + t * 0.84)) * (0.85 + r() * 0.15);
    ctx.quadraticCurveTo(px - w / n / 2, py - 5, px, py);
  }
  ctx.lineTo(cx + w / 2, bottom); ctx.closePath();
  const g = ctx.createLinearGradient(cx - w / 2, bottom - h, cx + w / 2, bottom); g.addColorStop(0, shade(color, 0.18)); g.addColorStop(1, shade(color, -0.22));
  ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.2);
}

/** Touffes d'herbe au pied des murs et des clôtures. */
export function grass(ctx, x, w, seed = 0, color = '#6f9a45') {
  const r = rng(seed + 19); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < w / 3; i++) { const px = x + r() * w, hh = 3 + r() * 5; ctx.moveTo(px, 0); ctx.lineTo(px + (r() - 0.5) * 3, -hh); }
  ctx.stroke();
}

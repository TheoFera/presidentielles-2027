import { INK, alpha, box, castShadow, door, gableRoof, glass, grass, hedge, line, lit, outline, pitchedRoof, rng, shade, wall, windowUnit } from './kit.js';

/**
 * Périurbain : lotissements neufs tous pareils, voiture devant chaque garage, grillage vert, thuyas,
 * trampoline et barbecue ; zones commerciales en bardage ; maisons de brique ; usines de vallée.
 */

const CREPI = ['#efe2b0', '#f1e6bf', '#ede0b6'];
const PVC = '#f7f6f1';
const SLATE = '#4a5158';

/** Fenêtre PVC blanche, sans volet battant (coffre de volet roulant intégré). */
function pvcWindow(ctx, cx, bottom, w, h, seed, lit = false) {
  windowUnit(ctx, cx, bottom, w, h, { frame: PVC, panes: w > h ? 1 : 2, sill: '#d9d6cc', lit, roller: seed % 3 === 0 ? 0.25 : 0, rollerColor: '#ecebe6' }, seed);
}

/**
 * Maison de lotissement « French Dream », proportions relevées sur la photo de référence
 * (src/presentation/world-v3/references/) : crépi jaune pâle, grand toit d'ardoise très pentu, pignon avant à gauche
 * avec haute fenêtre étroite et baie au pied, porte blanche étroite, fenêtre carrée, fenêtres de toit,
 * garage accolé à droite sous son propre toit, porte sectionnelle blanche, applique, descentes d'eau blanches,
 * grillage vert rigide, boîte aux lettres sur pied. Largeur conseillée : 7 unités.
 * Hauteurs fixées par la porte (88 px) : égout 134 px, faîtage 284 px.
 */
export function maisonLotissement(ctx, p) {
  // Toutes les maisons du lotissement sont identiques (même couleur, mêmes fenêtres) : c'est voulu.
  const W = p.w, X = -W / 2, crepi = '#ece0bd', lawn = 14;
  const fx = t => X + t * W; // positions relatives à la largeur, comme mesurées sur la photo
  // Pelouse pelée devant, en premier plan
  ctx.fillStyle = '#93ad62'; ctx.fillRect(X, -lawn - 3, W, lawn + 3); grass(ctx, X, W, 3, '#7f9a4f');
  // La maison est en retrait derrière sa pelouse : un peu plus petite et plus haute que la rue.
  ctx.save(); ctx.translate(0, -lawn); ctx.scale(0.9, 0.9); if (p.mirror) ctx.scale(-1, 1);
  const EAVE = 134, RIDGE = 284, GEAVE = 124, GRIDGE = 258;
  // Aplats sans relief : crépi uniforme, ardoise artificielle unie (maison de catalogue)
  const flat = (x, y, w, h, c) => box(ctx, x, y, w, h, c, 1.1);
  const roof = (x, y, w, h, hip) => { ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + w + 6, y); ctx.lineTo(x + w - w * hip, y - h); ctx.lineTo(x + w * hip, y - h); ctx.closePath(); ctx.fillStyle = SLATE; ctx.fill(); outline(ctx, 1.1); ctx.strokeStyle = alpha('#2a2f34', 0.35); ctx.lineWidth = 0.6; ctx.beginPath(); for (let yy = y - 12; yy > y - h; yy -= 12) { ctx.moveTo(x - 4, yy); ctx.lineTo(x + w + 4, yy); } ctx.stroke(); };
  flat(fx(0.655), -GEAVE, W * 0.345, GEAVE, crepi);
  roof(fx(0.655), -GEAVE, W * 0.345, GRIDGE - GEAVE, 0.1);
  const gdx = fx(0.705), gdw = W * 0.24, gdh = 92;
  flat(gdx, -gdh, gdw, gdh, PVC);
  ctx.strokeStyle = '#dcdad2'; ctx.lineWidth = 1; ctx.beginPath(); for (let yy = -gdh + 18; yy < 0; yy += 18) { ctx.moveTo(gdx + 1, yy); ctx.lineTo(gdx + gdw - 1, yy); } ctx.stroke();
  flat(fx(0.82) - 4, -114, 8, 6, '#f5f3ec'); // applique
  flat(fx(0), -EAVE, W * 0.665, EAVE, crepi);
  roof(fx(0), -EAVE, W * 0.665, RIDGE - EAVE, 0.05);
  velux(ctx, fx(0.46), -196, 26, 16);
  box(ctx, fx(0.3) - 3, -272, 6, 20, '#a9adb1', 0.8); // conduit de fumée en inox, sans souche
  // Pignon avant : pan de crépi qui monte dans le toit
  const pc = fx(0.155), pw = Math.max(46, W * 0.17), wallTop = 216, apex = 250;
  flat(pc - pw / 2, -wallTop, pw, wallTop - EAVE + 1, crepi);
  ctx.beginPath(); ctx.moveTo(pc - pw / 2 - 7, -wallTop + 6); ctx.lineTo(pc, -apex); ctx.lineTo(pc + pw / 2 + 7, -wallTop + 6); ctx.closePath(); ctx.fillStyle = SLATE; ctx.fill(); outline(ctx, 1.1);
  pvcWindow(ctx, pc, -134, Math.max(18, pw * 0.34), 64, 6);
  pvcWindow(ctx, pc, -4, Math.max(26, pw * 0.56), 80, 1);
  ctx.save(); ctx.translate(fx(0.25), 0); door(ctx, 0, 26, 88, PVC, 'pvc'); ctx.restore();
  pvcWindow(ctx, fx(0.47), -46, 40, 50, 1);
  for (const t of [0.012, 0.645]) box(ctx, fx(t) - 1.5, -EAVE + 2, 3, EAVE - 2, '#f1f0ea', 0.6);
  ctx.restore();
  // Devant : grillage vert rigide sur toute la largeur, portillon, boîte aux lettres
  if (p.front !== false) {
    grillage(ctx, X, W * 0.56, 36); grillage(ctx, X + W * 0.6, W * 0.06, 36);
    mailbox(ctx, X + W * 0.63);
    ctx.fillStyle = '#6f7275'; ctx.fillRect(X + W * 0.68, -lawn - 3, W * 0.3, lawn + 3); // allée d'enrobé devant le garage
  }
}

/** Fenêtre de toit (type Velux) posée dans le pan d'ardoise. */
export function velux(ctx, cx, cy, w, h) {
  ctx.save(); ctx.translate(cx, cy); ctx.transform(1, 0, -0.18, 1, 0, 0);
  box(ctx, -w / 2, -h / 2, w, h, '#5b636a', 1.1);
  glass(ctx, -w / 2 + 2.5, -h / 2 + 2.5, w - 5, h - 5);
  ctx.restore();
}

/** Grillage à panneaux rigides vert, poteaux, plis horizontaux. */
export function grillage(ctx, x, w, h, color = '#3f6f45') {
  ctx.strokeStyle = alpha(color, 0.85); ctx.lineWidth = 0.8; ctx.beginPath();
  for (let xx = x + 2; xx < x + w; xx += 4) { ctx.moveTo(xx, 0); ctx.lineTo(xx, -h); }
  for (const yy of [-h, -h * 0.66, -h * 0.33, -2]) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
  ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, -h * 0.5); ctx.lineTo(x + w, -h * 0.5); ctx.stroke(); // pli
  for (let xx = x; xx <= x + w + 0.1; xx += Math.max(30, w / Math.round(w / 40))) box(ctx, xx - 1.5, -h - 3, 3, h + 3, shade(color, -0.1), 0.8);
}

/** Boîte aux lettres sur pied (plastique crème, comme sur la photo). */
export function mailbox(ctx, x) {
  line(ctx, x, 0, x, -34, 2.2, '#8b8f93');
  box(ctx, x - 11, -48, 22, 15, '#efe8d6', 1.1);
  ctx.beginPath(); ctx.moveTo(x - 12, -48); ctx.lineTo(x + 12, -48); ctx.lineTo(x + 10, -52); ctx.lineTo(x - 10, -52); ctx.closePath(); ctx.fillStyle = '#e4dcc6'; ctx.fill(); outline(ctx, 1);
  line(ctx, x - 6, -43, x + 6, -43, 1, '#9b927c');
}

/** Voiture citadine garée (profil), couleurs sages ; `kind` : 'citadine' | 'break' | 'utilitaire' | 'berline'. */
export function voiture(ctx, p) {
  const r = rng(p.seed || 3), color = p.color || r.pick(['#c9ccd0', '#f1f1ee', '#9aa3ab', '#b3372f', '#2f3e57', '#5d6a57']);
  const kind = p.kind || 'citadine', len = { citadine: 132, break: 150, utilitaire: 158, berline: 158 }[kind], s = p.dir === -1 ? -1 : 1;
  ctx.save(); ctx.scale(s, 1);
  const x = -len / 2, bodyTop = -44, roof = kind === 'utilitaire' ? -90 : -64;
  // Profil : arrière à gauche, capot et phares à droite
  const back = kind === 'break' ? 0.07 : kind === 'citadine' ? 0.14 : 0.2, front = kind === 'citadine' ? 0.66 : 0.6;
  const bodyPath = () => {
    ctx.beginPath(); ctx.moveTo(x + 3, -12); ctx.lineTo(x + 1, bodyTop + 6); ctx.quadraticCurveTo(x + 2, bodyTop - 2, x + 10, bodyTop - 3);
    if (kind === 'utilitaire') { ctx.lineTo(x + 6, roof + 4); ctx.quadraticCurveTo(x + 6, roof, x + 14, roof); ctx.lineTo(x + len * 0.72, roof); ctx.lineTo(x + len * 0.84, bodyTop - 4); }
    else { ctx.lineTo(x + len * back, roof + 4); ctx.quadraticCurveTo(x + len * back, roof, x + len * (back + 0.06), roof); ctx.lineTo(x + len * (front - 0.06), roof); ctx.lineTo(x + len * (front + 0.1), bodyTop - 4); }
    ctx.lineTo(x + len - 7, bodyTop + 1); ctx.quadraticCurveTo(x + len, bodyTop + 3, x + len - 1, bodyTop + 14); ctx.lineTo(x + len - 3, -12); ctx.closePath();
  };
  bodyPath();
  const g = ctx.createLinearGradient(0, roof, 0, -10); g.addColorStop(0, shade(color, 0.2)); g.addColorStop(1, shade(color, -0.14));
  ctx.fillStyle = g; ctx.fill();
  // Vitres latérales et montant central
  const winPath = () => { ctx.beginPath(); if (kind === 'utilitaire') ctx.rect(x + len * 0.73, roof + 6, len * 0.08, bodyTop - roof - 12); else { ctx.moveTo(x + len * (back + 0.02), bodyTop - 5); ctx.lineTo(x + len * (back + 0.05), roof + 5); ctx.lineTo(x + len * (front - 0.07), roof + 5); ctx.lineTo(x + len * (front + 0.06), bodyTop - 5); ctx.closePath(); } };
  winPath(); ctx.save(); ctx.clip(); glass(ctx, x, roof, len, bodyTop - roof); ctx.restore(); winPath(); outline(ctx, 1.1);
  if (kind !== 'utilitaire') line(ctx, x + len * (back + front) / 2, roof + 5, x + len * (back + front) / 2, bodyTop - 5, 2.4, shade(color, -0.2));
  bodyPath(); outline(ctx, 1.4);
  line(ctx, x + 10, bodyTop + 14, x + len - 8, bodyTop + 14, 0.9, shade(color, -0.3)); // ligne de caisse
  box(ctx, x + len * 0.55, bodyTop + 6, 8, 2, '#d8d8d0', 0.6); // poignée
  box(ctx, x + len - 6, bodyTop + 4, 5, 6, '#f6e7b0', 0.8); box(ctx, x + 1, bodyTop + 6, 4, 6, '#d0453a', 0.8); // feux
  for (const wx of [x + 26, x + len - 26]) {
    ctx.beginPath(); ctx.arc(wx, -12, 13, Math.PI, 0); ctx.fillStyle = '#2a2622'; ctx.fill();
    ctx.beginPath(); ctx.arc(wx, -12, 11, 0, Math.PI * 2); ctx.fillStyle = '#26282b'; ctx.fill(); outline(ctx, 1);
    ctx.beginPath(); ctx.arc(wx, -12, 5.5, 0, Math.PI * 2); ctx.fillStyle = '#a9adb1'; ctx.fill(); outline(ctx, 0.8);
  }
  castShadow(ctx, x + 6, -1, len - 12, 3, 0.35);
  ctx.restore();
}

/** Jardin de lotissement : pelouse, grillage, et selon `items` barbecue, trampoline, salon de jardin, balançoire. */
export function jardinLotissement(ctx, p) {
  const w = p.w, x = -w / 2, r = rng(p.seed || 4);
  ctx.fillStyle = '#86ad57'; ctx.fillRect(x, -5, w, 5); grass(ctx, x, w, p.seed);
  for (const item of p.items || []) {
    const ix = x + item.at * w;
    if (item.t === 'thuyas') hedge(ctx, ix - item.w / 2, item.w, 58, '#3f6a3a', p.seed);
    if (item.t === 'barbecue') barbecue(ctx, ix);
    if (item.t === 'trampoline') trampoline(ctx, ix);
    if (item.t === 'salon') salonJardin(ctx, ix, r);
    if (item.t === 'balancoire') balancoire(ctx, ix);
    if (item.t === 'abri') { box(ctx, ix - 22, -44, 44, 44, '#8a6a4a', 1.2); gableRoof(ctx, ix - 22, -44, 44, 14, 'ardoise', { overhang: 3, color: '#5d4a3a' }); ctx.strokeStyle = shade('#8a6a4a', -0.25); ctx.lineWidth = 0.8; ctx.beginPath(); for (let xx = ix - 18; xx < ix + 22; xx += 6) { ctx.moveTo(xx, -44); ctx.lineTo(xx, 0); } ctx.stroke(); }
  }
  if (p.fence !== false) grillage(ctx, x, w, 34);
}

/** Barbecue charbon sur pieds, grillades ; la fumée est animée par le rendu. */
export function barbecue(ctx, x) {
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x - 5, -24); ctx.moveTo(x + 10, 0); ctx.lineTo(x + 5, -24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 14, -26); ctx.quadraticCurveTo(x, -8, x + 14, -26); ctx.closePath(); ctx.fillStyle = '#2b2e31'; ctx.fill(); outline(ctx, 1.1);
  line(ctx, x - 14, -27, x + 14, -27, 1.2, '#8a8f94');
  ctx.fillStyle = '#e8622c'; ctx.fillRect(x - 11, -27, 22, 1.5);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 1 ? '#c8783a' : '#8a3b24'; ctx.fillRect(x - 10 + i * 7, -30, 6, 2.6); }
  // Pince et tablette
  line(ctx, x + 14, -26, x + 22, -16, 2, '#8a8f94'); box(ctx, x + 16, -18, 12, 3, '#9a7a55', 0.8);
}

function trampoline(ctx, x) {
  ctx.fillStyle = '#1f2327'; ctx.fillRect(x - 32, -26, 64, 3); outline(ctx, 0);
  line(ctx, x - 34, -25, x + 34, -25, 2.4, '#2f7ac0');
  for (const lx of [-28, 0, 28]) line(ctx, x + lx, -24, x + lx * 1.06, 0, 1.6, '#3a3d40');
  ctx.fillStyle = 'rgba(40,40,40,0.22)'; ctx.fillRect(x - 32, -74, 64, 48);
  ctx.strokeStyle = 'rgba(40,40,40,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let xx = x - 32; xx <= x + 32; xx += 5) { ctx.moveTo(xx, -74); ctx.lineTo(xx, -26); } ctx.stroke();
  for (const px of [x - 33, x + 33]) line(ctx, px, -26, px, -76, 1.6, '#2f7ac0');
  line(ctx, x - 33, -76, x + 33, -76, 1.4, '#2f7ac0');
}
function salonJardin(ctx, x, r) {
  for (const dx of [-15, 15]) { box(ctx, x + dx - 6, -17, 12, 3, '#f4f3ee', 0.8); box(ctx, x + dx + (dx < 0 ? -6 : 3), -30, 3, 14, '#f4f3ee', 0.8); line(ctx, x + dx - 5, -14, x + dx - 5, 0, 1, '#9a9a94'); line(ctx, x + dx + 5, -14, x + dx + 5, 0, 1, '#9a9a94'); }
  box(ctx, x - 11, -22, 22, 3, '#f4f3ee', 0.8); line(ctx, x, -19, x, 0, 1.2, '#9a9a94');
  line(ctx, x, -22, x, -74, 1.4, '#77736b');
  ctx.beginPath(); ctx.moveTo(x - 32, -64); ctx.quadraticCurveTo(x, -86, x + 32, -64); ctx.closePath(); ctx.fillStyle = r.pick(['#d9533f', '#2f7ac0', '#e8b83a']); ctx.fill(); outline(ctx, 1.1);
}
function balancoire(ctx, x) {
  ctx.strokeStyle = '#3f7f5f'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 24, 0); ctx.lineTo(x - 15, -58); ctx.lineTo(x - 6, 0); ctx.moveTo(x + 24, 0); ctx.lineTo(x + 15, -58); ctx.lineTo(x + 6, 0); ctx.moveTo(x - 16, -58); ctx.lineTo(x + 16, -58); ctx.stroke();
  line(ctx, x - 4, -58, x - 4, -18, 0.9, '#555'); line(ctx, x + 4, -58, x + 4, -18, 0.9, '#555'); box(ctx, x - 6, -19, 12, 3, '#c9542f', 0.8);
}

/** Maisons de brique du Nord et de l'Est (périurbain B), en bande, porte et fenêtres à linteau blanc. */
export function maisonsBrique(ctx, p) {
  const w = p.w, n = p.count || Math.max(1, Math.round(w / 130)), mw = w / n, r = rng(p.seed || 5);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + i * mw, h = 150, brick = r.pick(['#b25d42', '#a9563d', '#b96548']);
    wall(ctx, x, -h, mw, h, brick);
    ctx.save(); ctx.beginPath(); ctx.rect(x, -h, mw, h); ctx.clip(); ctx.strokeStyle = alpha(shade(brick, -0.35), 0.45); ctx.lineWidth = 0.6; ctx.beginPath(); for (let yy = -4; yy > -h; yy -= 4.5) { ctx.moveTo(x, yy); ctx.lineTo(x + mw, yy); } ctx.stroke(); ctx.restore();
    const dx = x + mw * (i % 2 ? 0.72 : 0.28);
    ctx.save(); ctx.translate(dx, 0); door(ctx, 0, 28, 88, r.pick(['#2f4a5f', '#6d2f2f', '#3f5f45']), 'bois'); ctx.restore();
    box(ctx, dx - 17, -94, 34, 5, '#efe9dc', 1);
    for (const wx of [x + mw * (i % 2 ? 0.28 : 0.72)]) windowUnit(ctx, wx, -26, 30, 52, { frame: '#f4f1e8', sill: '#efe9dc', curtain: '#f1e8d8' }, i);
    for (const wx of [x + mw * 0.28, x + mw * 0.72]) windowUnit(ctx, wx, -104, 26, 40, { frame: '#f4f1e8', sill: '#efe9dc', box: r() < 0.4 }, i + 7);
    box(ctx, x, -h - 4, mw, 6, '#e6ded0', 1);
  }
  pitchedRoof(ctx, -w / 2, -150, w, 46, 'ardoise', { overhang: 5, hip: 0.02, color: '#5a6168' });
  for (let i = 0; i < n; i++) { const cx = -w / 2 + (i + 1) * mw - 2; box(ctx, cx - 7, -150 - 60, 14, 24, '#a9563d', 1.1); }
}

/** Grande surface de zone commerciale : bardage métallique, bandeau coloré, logo géométrique sans texte, entrée vitrée. */
export function grandeSurface(ctx, p) {
  const w = p.w, x = -w / 2, h = 118, color = p.color || '#e2562f';
  box(ctx, x, -h, w, h, '#e9e8e3', 1.5);
  ctx.strokeStyle = '#cfcdc6'; ctx.lineWidth = 1; ctx.beginPath(); for (let xx = x + 6; xx < x + w; xx += 6) { ctx.moveTo(xx, -h + 26); ctx.lineTo(xx, 0); } ctx.stroke();
  box(ctx, x, -h, w, 26, color, 1.3);
  // Logo : formes simples (lisibles de loin, jamais de nom)
  if (p.logo === 'feuille') { ctx.beginPath(); ctx.ellipse(0, -h + 13, 16, 8, -0.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); line(ctx, -12, -h + 20, 12, -h + 6, 1.4, color); }
  else { ctx.beginPath(); ctx.moveTo(-18, -h + 21); ctx.lineTo(0, -h + 5); ctx.lineTo(18, -h + 21); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); }
  // Sas d'entrée vitré et auvent
  box(ctx, -44, -84, 88, 84, '#aabfcc', 1.4); glass(ctx, -40, -80, 80, 80); line(ctx, 0, -80, 0, 0, 2, '#e9e8e3');
  box(ctx, -52, -92, 104, 8, shade(color, -0.1), 1.2); castShadow(ctx, -48, -84, 96, 12, 0.25);
  // Chariots rangés
  for (let i = 0; i < 4; i++) { const cx = x + w - 34 - i * 8; ctx.strokeStyle = '#8a8f94'; ctx.lineWidth = 1; ctx.strokeRect(cx - 6, -24, 12, 12); line(ctx, cx + 6, -24, cx + 9, -30, 1, '#8a8f94'); }
  castShadow(ctx, x, -h + 26, w, 8, 0.2);
}

/** Usine de décolletage en brique à sheds vitrés, haute cheminée (vallée industrielle). */
export function usine(ctx, p) {
  const w = p.w, x = -w / 2, h = 140, brick = '#b35e43';
  wall(ctx, x, -h, w, h, brick);
  ctx.save(); ctx.beginPath(); ctx.rect(x, -h, w, h); ctx.clip(); ctx.strokeStyle = alpha(shade(brick, -0.35), 0.45); ctx.lineWidth = 0.6; ctx.beginPath(); for (let yy = -4; yy > -h; yy -= 4.5) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); } ctx.stroke(); ctx.restore();
  const n = Math.max(2, Math.round(w / 64));
  for (let i = 0; i < n; i++) {
    const sx = x + i * w / n, sw = w / n;
    ctx.beginPath(); ctx.moveTo(sx, -h); ctx.lineTo(sx + sw * 0.72, -h - 34); ctx.lineTo(sx + sw * 0.72, -h - 4); ctx.lineTo(sx + sw, -h); ctx.closePath(); ctx.fillStyle = '#7f8890'; ctx.fill(); outline(ctx, 1.2);
    glass(ctx, sx + sw * 0.74, -h - 31, sw * 0.24, 25);
  }
  for (let i = 0; i < Math.round(w / 40) - 1; i++) windowUnit(ctx, x + 22 + i * 40, -54, 24, 62, { arch: true, frame: '#e9dcc4', panes: 4, sill: '#d9ccb4' }, i);
  const dx = x + w * 0.74; box(ctx, dx - 32, -86, 64, 86, '#5e6a74', 1.4); ctx.strokeStyle = '#48525a'; ctx.lineWidth = 1; ctx.beginPath(); for (let yy = -80; yy < 0; yy += 7) { ctx.moveTo(dx - 32, yy); ctx.lineTo(dx + 32, yy); } ctx.stroke();
  // Cheminée de brique
  const cx = x + w * 0.16; ctx.beginPath(); ctx.moveTo(cx - 10, -h); ctx.lineTo(cx - 7, -h - 160); ctx.lineTo(cx + 7, -h - 160); ctx.lineTo(cx + 10, -h); ctx.closePath(); ctx.fillStyle = '#a4533c'; ctx.fill(); outline(ctx, 1.3);
  for (let yy = -h - 24; yy > -h - 160; yy -= 26) box(ctx, cx - 9, yy - 2, 18, 3, '#8c4431', 0.6);
  box(ctx, cx - 9, -h - 166, 18, 6, '#7c3b2b', 1);
}

export { INK, lit, hedge };

/**
 * Îlot du rond-point : butte gazonnée bordée de pavés, fleurs, herbes de la pampa, roue de tracteur géante
 * sur socle, panneaux directionnels blancs à flèche (sans aucun nom). Le centre reste libre pour l'estrade.
 */
export function rondPoint(ctx, p) {
  const w = p.w, r = rng(p.seed || 14);
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.bezierCurveTo(-w * 0.38, -46, w * 0.38, -46, w / 2, 0); ctx.closePath();
  const g = ctx.createLinearGradient(0, -40, 0, 0); g.addColorStop(0, '#94c264'); g.addColorStop(1, '#6f9a45'); ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.4);
  box(ctx, -w / 2 - 4, -7, w + 8, 7, '#e2ded2', 1.1);
  for (let xx = -w / 2; xx < w / 2; xx += 12) { ctx.fillStyle = '#c4bfb2'; ctx.fillRect(xx, -6, 1.2, 6); }
  for (let i = 0; i < w / 5; i++) { const fx = -w / 2 + 20 + r() * (w - 40), fy = -10 - r() * 18 * (1 - Math.abs(fx) / (w / 2)); ctx.fillStyle = r.pick(['#e2445a', '#f7d046', '#f39ac0', '#ffffff', '#b574d8', '#f28c28']); ctx.fillRect(fx - 1.5, fy - 1.5, 3, 3); }
  for (const px of [-w * 0.2, w * 0.22]) for (let k = 0; k < 7; k++) {
    const a0 = -0.5 + k / 6, len = 46 + r() * 16;
    ctx.strokeStyle = '#8a9a5a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, -20); ctx.quadraticCurveTo(px + a0 * 10, -20 - len * 0.6, px + a0 * 22, -20 - len); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(px + a0 * 22, -20 - len, 4, 11, a0 * 0.6, 0, Math.PI * 2); ctx.fillStyle = '#efe6cf'; ctx.fill(); outline(ctx, 0.6, '#b9ab86');
  }
  // Sculpture : roue de tracteur dressée sur son socle
  const sx = p.sculptureX ?? -w * 0.36;
  box(ctx, sx - 18, -42, 36, 22, '#cfc8b8', 1.2);
  ctx.beginPath(); ctx.arc(sx, -86, 44, 0, Math.PI * 2); ctx.fillStyle = '#2b2d30'; ctx.fill(); outline(ctx, 1.5);
  ctx.strokeStyle = '#3d4044'; ctx.lineWidth = 6; ctx.beginPath(); for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; ctx.moveTo(sx + Math.cos(t) * 35, -86 + Math.sin(t) * 35); ctx.lineTo(sx + Math.cos(t) * 44, -86 + Math.sin(t) * 44); } ctx.stroke();
  ctx.beginPath(); ctx.arc(sx, -86, 22, 0, Math.PI * 2); ctx.fillStyle = '#e0b54a'; ctx.fill(); outline(ctx, 1.2);
  // Panneaux directionnels blancs à flèche, vierges
  const px = w * 0.4;
  line(ctx, px, -8, px, -104, 3, '#8a9095');
  for (const y of [-104, -86]) { ctx.beginPath(); ctx.moveTo(px - 4, y); ctx.lineTo(px + 58, y); ctx.lineTo(px + 66, y + 6); ctx.lineTo(px + 58, y + 12); ctx.lineTo(px - 4, y + 12); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); outline(ctx, 1); line(ctx, px + 6, y + 6, px + 44, y + 6, 1.4, '#9aa3aa'); }
}

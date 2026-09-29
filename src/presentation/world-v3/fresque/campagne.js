import { DOOR, alpha, box, bush, castShadow, door, gableRoof, glass, grass, hedge, line, lit, outline, pitchedRoof, rng, shade, wall, windowUnit } from './kit.js';
import { shopfront, terrace } from './paris.js';

/**
 * Campagne : peu de choses au premier plan, beaucoup d'espace. Maisons de pierre aux volets parfois clos,
 * commerce fermé, bar-tabac, mairie à drapeaux, monument aux morts ; fermes, serres, hangars, bottes de foin,
 * tracteur, vaches, poteaux électriques en bois.
 */

const PIERRE = ['#d9c8a2', '#d2bf97', '#dccdaa', '#cdb88e'];
const VOLETS = ['#7f9fb0', '#8fae8a', '#b8a58a', '#5f7f9f', '#9aa5a8', '#8a6f5a'];

/** Mur de moellons : pierres irrégulières suggérées, chaînes d'angle en pierre de taille. */
export function stoneWall(ctx, x, y, w, h, color, seed) {
  wall(ctx, x, y, w, h, color, { line: 0 });
  const r = rng(seed + 31);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = alpha(shade(color, -0.35), 0.35); ctx.lineWidth = 0.7;
  for (let row = 0, yy = y + h; yy > y; yy -= 7 + r() * 3, row++) for (let xx = x + r() * 8; xx < x + w; xx += 10 + r() * 8) { ctx.beginPath(); ctx.roundRect(xx, yy - 6, 8 + r() * 6, 5 + r() * 2, 2); ctx.stroke(); }
  ctx.restore();
  for (const cx of [x, x + w - 9]) for (let yy = y + h; yy > y + 4; yy -= 12) box(ctx, cx, yy - (yy / 12 % 2 ? 11 : 11), 9, 11, shade(color, 0.12), 0.6);
  ctx.beginPath(); ctx.rect(x, y, w, h); outline(ctx, 1.5);
}

/** Fenêtre de maison de village : volets battants ouverts, ou clos (maison fermée, résidence secondaire). */
function villageWindow(ctx, cx, bottom, w, h, volets, closed, seed) {
  if (closed) {
    ctx.fillStyle = 'rgba(40,28,18,0.28)'; ctx.fillRect(cx - w / 2 - 1, bottom - h - 1, w + 3, h + 1);
    box(ctx, cx - w / 2, bottom - h, w, h, volets, 1.1);
    ctx.strokeStyle = shade(volets, -0.3); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx, bottom - h); ctx.lineTo(cx, bottom);
    for (let yy = bottom - h + 4; yy < bottom; yy += 4) { ctx.moveTo(cx - w / 2 + 1, yy); ctx.lineTo(cx + w / 2 - 1, yy); } ctx.stroke();
    // Écharpe en Z des volets pleins
    line(ctx, cx - w / 2 + 2, bottom - 4, cx - 1, bottom - h + 4, 1, shade(volets, -0.35)); line(ctx, cx + 1, bottom - 4, cx + w / 2 - 2, bottom - h + 4, 1, shade(volets, -0.35));
    box(ctx, cx - w / 2 - 3, bottom, w + 6, 3, '#e3d6b8', 0.9);
  } else windowUnit(ctx, cx, bottom, w, h, { shutters: volets, frame: '#f1ebdd', panes: 3, sill: '#e3d6b8', box: seed % 3 === 0, curtain: '#f3ecdc' }, seed);
  box(ctx, cx - w / 2 - 3, bottom - h - 5, w + 6, 5, '#e6d9bb', 0.9); // linteau
}

/** Maison de village R+1 en pierre, grand toit de tuiles, cheminée ; `closed` : volets clos. */
export function maisonVillage(ctx, p) {
  const r = rng(p.seed || 1), w = p.w, x = -w / 2, h = p.floors === 0 ? 112 : 190, color = p.color || PIERRE[Math.floor(r() * PIERRE.length)];
  const volets = p.volets || VOLETS[Math.floor(r() * VOLETS.length)], closed = !!p.closed;
  stoneWall(ctx, x, -h, w, h, color, p.seed || 1);
  const doorX = x + w * (p.doorAt ?? (r() < 0.5 ? 0.3 : 0.7));
  ctx.save(); ctx.translate(doorX, 0); door(ctx, 0, 30, 90, p.doorColor || shade(volets, -0.15), 'bois'); ctx.restore();
  box(ctx, doorX - 20, -96, 40, 6, '#e6d9bb', 1); // linteau de porte
  const other = doorX < 0 ? x + w * 0.72 : x + w * 0.28;
  villageWindow(ctx, other, -34, 26, 50, volets, closed, p.seed || 1);
  if (h > 150) for (const t of [0.28, 0.72]) villageWindow(ctx, x + w * t, -120, 24, 44, volets, closed || (p.half && t > 0.5), (p.seed || 1) + t * 10);
  pitchedRoof(ctx, x, -h, w, 50, 'tuile', { overhang: 9, hip: 0.08, color: p.roofColor || '#b0603d' });
  box(ctx, x + w * 0.74 - 9, -h - 58, 18, 30, color, 1.2); box(ctx, x + w * 0.74 - 11, -h - 61, 22, 4, shade(color, -0.1), 1);
  if (p.vine) { // rosier grimpant le long de la porte
    ctx.strokeStyle = '#5f6f3a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(doorX + 20, 0); ctx.bezierCurveTo(doorX + 26, -40, doorX + 16, -70, doorX + 22, -100); ctx.stroke();
    const vr = rng(p.seed + 9); for (let i = 0; i < 16; i++) { const t = i / 16, vx = doorX + 20 + Math.sin(t * 9) * 5, vy = -8 - t * 94; ctx.fillStyle = '#5a8a40'; ctx.fillRect(vx - 3, vy - 2, 6, 4); if (vr() < 0.5) { ctx.fillStyle = vr() < 0.5 ? '#e05a6a' : '#f3c1cf'; ctx.fillRect(vx - 1, vy - 3, 3, 3); } }
  }
  if (p.bench) { box(ctx, doorX - 50, -16, 30, 4, '#8a6a45', 0.8); line(ctx, doorX - 47, -12, doorX - 47, 0, 1.4, '#6a4a2f'); line(ctx, doorX - 23, -12, doorX - 23, 0, 1.4, '#6a4a2f'); }
}

/**
 * Mairie de village : façade symétrique en pierre de taille, perron, fronton à horloge, drapeaux français et européen
 * (aucune inscription : on la reconnaît à ses drapeaux et à son horloge).
 */
export function mairie(ctx, p) {
  const w = p.w, x = -w / 2, h = 196, color = '#ebdfc4';
  wall(ctx, x, -h, w, h, color, { courses: 12 });
  for (const f of [0, 1]) for (let i = 0; i < 5; i++) if (!(f === 0 && i === 2)) windowUnit(ctx, x + w * (i + 0.5) / 5, -22 - f * 90, 22, 60, { shutters: '#3f5f7f', frame: '#f4ecd9', panes: 3, sill: '#f1e7cf' }, f * 5 + i);
  ctx.save(); door(ctx, 0, 42, DOOR + 8, '#3f5f7f', 'cochere'); ctx.restore();
  box(ctx, -36, -6, 72, 6, '#d6c9ad', 1); box(ctx, -30, -11, 60, 5, '#dfd3b8', 1);
  box(ctx, x - 4, -h - 6, w + 8, 8, '#f1e7cf', 1.2); castShadow(ctx, x, -h + 2, w, 8, 0.25);
  pitchedRoof(ctx, x, -h - 6, w, 36, 'ardoise', { overhang: 6, hip: 0.18, color: '#5d656c' });
  // Fronton triangulaire devant le toit, horloge (cadran aux aiguilles, sans chiffres)
  ctx.beginPath(); ctx.moveTo(-w * 0.3, -h - 6); ctx.lineTo(0, -h - 48); ctx.lineTo(w * 0.3, -h - 6); ctx.closePath(); ctx.fillStyle = '#efe4c8'; ctx.fill(); outline(ctx, 1.3);
  ctx.beginPath(); ctx.arc(0, -h - 22, 10, 0, Math.PI * 2); ctx.fillStyle = '#fbf6ea'; ctx.fill(); outline(ctx, 1.1);
  line(ctx, 0, -h - 22, 0, -h - 29, 1.3); line(ctx, 0, -h - 22, 5, -h - 20, 1.3);
  // Campanile et drapeaux sur la façade
  for (const side of [-1, 1]) {
    const fx = side * 30, fy = -118;
    line(ctx, fx, fy + 8, fx + side * 18, fy - 24, 1.6, '#4a4a4a');
    const colors = side < 0 ? ['#23408e', '#f4f4f4', '#d7263d'] : ['#003399', '#003399', '#003399'];
    for (let i = 0; i < 3; i++) { const ax = fx + side * (18 + i * 7), ay = fy - 24; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + side * 7, ay + 2); ctx.lineTo(ax + side * 7, ay + 18); ctx.lineTo(ax, ay + 16); ctx.closePath(); ctx.fillStyle = colors[i]; ctx.fill(); }
    if (side > 0) { ctx.fillStyle = '#f2d24b'; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.fillRect(fx + 28 + Math.cos(a) * 5.5, fy - 15 + Math.sin(a) * 5.5, 1.4, 1.4); } }
  }
}

/** Monument aux morts : obélisque sur socle, coq gaulois, gerbe tricolore, bornes et chaînes. */
export function monumentMorts(ctx) {
  box(ctx, -28, -14, 56, 14, '#cfc8b8', 1.2); box(ctx, -19, -46, 38, 32, '#dcd5c5', 1.2);
  ctx.beginPath(); ctx.moveTo(-11, -46); ctx.lineTo(-7, -128); ctx.lineTo(7, -128); ctx.lineTo(11, -46); ctx.closePath(); ctx.fillStyle = '#e4dece'; ctx.fill(); outline(ctx, 1.3);
  ctx.fillStyle = 'rgba(40,28,18,0.1)'; ctx.fillRect(2, -126, 6, 80);
  // Coq gaulois au sommet
  ctx.beginPath(); ctx.moveTo(-6, -128); ctx.quadraticCurveTo(-7, -140, -2, -142); ctx.lineTo(1, -146); ctx.lineTo(3, -141); ctx.quadraticCurveTo(10, -142, 7, -134); ctx.lineTo(9, -140); ctx.lineTo(10, -130); ctx.lineTo(6, -128); ctx.closePath(); ctx.fillStyle = '#b89a4a'; ctx.fill(); outline(ctx, 0.9);
  // Plaque (lignes gravées, pas de texte) et gerbe
  box(ctx, -12, -40, 24, 18, '#cfc6b2', 0.8); for (let i = 0; i < 4; i++) line(ctx, -8, -36 + i * 4, 8, -36 + i * 4, 0.7, '#8a8474');
  ctx.fillStyle = '#5f7f3a'; ctx.beginPath(); ctx.ellipse(0, -8, 10, 6, 0, Math.PI, 0); ctx.fill();
  for (const [c, dx] of [['#23408e', -5], ['#f4f4f4', 0], ['#d7263d', 5]]) { ctx.fillStyle = c; ctx.fillRect(dx - 2, -10, 4, 9); }
  for (const bx of [-42, 42]) box(ctx, bx - 3, -18, 6, 18, '#b9b2a2', 1);
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-42, -15); ctx.quadraticCurveTo(-35, -8, -28, -12); ctx.moveTo(42, -15); ctx.quadraticCurveTo(35, -8, 28, -12); ctx.stroke();
}

/** Bar-tabac du village : maison de pierre, devanture de café au rez-de-chaussée, losange rouge, deux tables dehors. */
export function barTabac(ctx, p) {
  const w = p.w, x = -w / 2, h = 190, color = p.color || '#dcc8a2';
  stoneWall(ctx, x, -h, w, h, color, p.seed || 3);
  for (const t of [0.28, 0.72]) villageWindow(ctx, x + w * t, -122, 24, 44, '#7f9fb0', false, (p.seed || 3) + t * 10);
  shopfront(ctx, 0, w - 14, 'cafe', p.seed || 3, 118);
  // Losange rouge du tabac, en drapeau
  const px = x + w - 2, py = -128; line(ctx, px - 8, py + 4, px + 8, py + 4, 2, '#6a6f72');
  ctx.beginPath(); ctx.moveTo(px + 8, py - 8); ctx.lineTo(px + 13, py + 10); ctx.lineTo(px + 8, py + 30); ctx.lineTo(px + 3, py + 10); ctx.closePath(); ctx.fillStyle = '#d23b2e'; ctx.fill(); outline(ctx, 1);
  pitchedRoof(ctx, x, -h, w, 48, 'tuile', { overhang: 8, hip: 0.1 });
  terrace(ctx, x + 4, x + w * 0.62, p.seed || 3);
}

/** Commerce fermé : ancienne vitrine sous rideau métallique baissé, bandeau délavé, affichette jaunie. */
export function commerceFerme(ctx, p) {
  const w = p.w, x = -w / 2, h = 176, color = p.color || '#d6c49e';
  stoneWall(ctx, x, -h, w, h, color, p.seed || 7);
  villageWindow(ctx, 0, -116, 26, 44, '#a3a59c', true, 3);
  box(ctx, x + 8, -112, w - 16, 104, '#8a6a4a', 1.3); // ancien coffrage
  box(ctx, x + 12, -108, w - 24, 18, '#b9a680', 1); // bandeau délavé, lettres effacées
  ctx.fillStyle = 'rgba(80,60,40,0.18)'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 18 + i * (w - 36) / 6, -103, (w - 36) / 9, 8);
  box(ctx, x + 14, -84, w - 28, 84, '#9aa1a6', 1.2);
  ctx.strokeStyle = '#7d858a'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let yy = -80; yy < 0; yy += 4) { ctx.moveTo(x + 14, yy); ctx.lineTo(x + w - 14, yy); } ctx.stroke();
  box(ctx, -8, -60, 16, 20, '#efe6c6', 0.8); for (let i = 0; i < 3; i++) line(ctx, -5, -55 + i * 5, 5, -55 + i * 5, 0.7, '#9a8a6a');
  pitchedRoof(ctx, x, -h, w, 44, 'tuile', { overhang: 8, hip: 0.1, color: '#a85d3e' });
}

/* ---------- Agriculture ---------- */

/** Tracteur : grande roue arrière, petite roue avant, cabine vitrée, capot. */
export function tracteur(ctx, p = {}) {
  const color = p.color || '#b8342b', dir = p.dir === -1 ? -1 : 1;
  ctx.save(); ctx.scale(dir, 1);
  box(ctx, -10, -64, 62, 30, color, 1.4); // capot et moteur
  ctx.beginPath(); ctx.moveTo(-44, -44); ctx.lineTo(-44, -118); ctx.lineTo(-4, -118); ctx.lineTo(4, -64); ctx.lineTo(4, -44); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); outline(ctx, 1.4);
  glass(ctx, -38, -112, 34, 44); ctx.beginPath(); ctx.moveTo(-44, -44); ctx.lineTo(-44, -118); ctx.lineTo(-4, -118); ctx.lineTo(4, -64); ctx.lineTo(4, -44); ctx.closePath(); outline(ctx, 1.4);
  box(ctx, -48, -122, 56, 6, shade(color, -0.2), 1.2);
  line(ctx, 38, -64, 38, -84, 3, '#3a3a3a');
  for (const [wx, rad] of [[-30, 32], [40, 18]]) {
    ctx.beginPath(); ctx.arc(wx, -rad, rad, 0, Math.PI * 2); ctx.fillStyle = '#26282b'; ctx.fill(); outline(ctx, 1.3);
    ctx.strokeStyle = '#3d4044'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.moveTo(wx + Math.cos(a) * (rad - 4), -rad + Math.sin(a) * (rad - 4)); ctx.lineTo(wx + Math.cos(a) * rad, -rad + Math.sin(a) * rad); } ctx.stroke();
    ctx.beginPath(); ctx.arc(wx, -rad, rad * 0.5, 0, Math.PI * 2); ctx.fillStyle = '#e0b54a'; ctx.fill(); outline(ctx, 1);
  }
  ctx.restore();
}

/** Botte de foin ronde vue de côté (longue face enrubannée), en rangée. */
export function bottesFoin(ctx, p) {
  const n = p.count || 3, r = rng(p.seed || 5);
  for (let i = 0; i < n; i++) {
    const bx = -((n - 1) * 30) / 2 + i * 30 + r() * 4, s = p.scale || 1;
    ctx.save(); ctx.translate(bx, 0); ctx.scale(s, s);
    ctx.beginPath(); ctx.roundRect(-26, -40, 52, 40, 14); const g = ctx.createLinearGradient(0, -40, 0, 0); g.addColorStop(0, '#ecd27a'); g.addColorStop(1, '#c9a74a'); ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.2);
    ctx.strokeStyle = 'rgba(140,100,40,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let k = -18; k <= 18; k += 6) { ctx.moveTo(k, -38); ctx.quadraticCurveTo(k + 3, -20, k, -2); } ctx.stroke();
    ctx.restore();
  }
}

/** Serres-tunnels de maraîcher avec rangs de tomates. */
export function serres(ctx, p) {
  const w = p.w, n = Math.max(1, Math.round(w / 120)), sw = w / n;
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + sw * (i + 0.5), half = sw / 2 - 4, H = 104;
    ctx.beginPath(); ctx.moveTo(cx - half, 0); ctx.bezierCurveTo(cx - half, -H * 1.3, cx + half, -H * 1.3, cx + half, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -H, 0, 0); g.addColorStop(0, 'rgba(244,250,250,0.94)'); g.addColorStop(1, 'rgba(206,224,220,0.9)'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    for (let k = 0; k < 7; k++) { const tx = cx - half + 12 + k * (half * 2 - 24) / 6; ctx.fillStyle = '#5f8f3f'; ctx.beginPath(); ctx.ellipse(tx, -24, 7, 20, 0, 0, Math.PI * 2); ctx.fill(); for (let t = 0; t < 3; t++) { ctx.fillStyle = '#d9412b'; ctx.fillRect(tx - 3 + t * 2, -34 + t * 8, 3, 3); } line(ctx, tx, -46, tx, 0, 0.8, '#8a6a45'); }
    ctx.strokeStyle = 'rgba(120,140,140,0.55)'; ctx.lineWidth = 1; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(cx - half + k * half * 2 / 5, 0); ctx.lineTo(cx - half + k * half * 2 / 5, -H * 1.1); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(cx - half * 0.6, -H * 0.95, half * 0.35, H * 0.8);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(cx - half, 0); ctx.bezierCurveTo(cx - half, -H * 1.3, cx + half, -H * 1.3, cx + half, 0); outline(ctx, 1.3);
  }
}

/** Hangar agricole ouvert : charpente métallique, bardage en haut, bottes rondes et tracteur à l'abri. */
export function hangar(ctx, p) {
  const w = p.w, x = -w / 2, h = 150;
  ctx.fillStyle = 'rgba(40,40,40,0.32)'; ctx.fillRect(x + 6, -h + 30, w - 12, h - 30);
  box(ctx, x, -h, w, 32, '#8f9ba3', 1.3); ctx.strokeStyle = '#7a868e'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let xx = x + 5; xx < x + w; xx += 5) { ctx.moveTo(xx, -h); ctx.lineTo(xx, -h + 32); } ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 10, -h); ctx.lineTo(0, -h - 30); ctx.lineTo(x + w + 10, -h); ctx.closePath(); ctx.fillStyle = '#7d878f'; ctx.fill(); outline(ctx, 1.3);
  for (const px of [x + 4, x + w / 2, x + w - 4]) box(ctx, px - 4, -h + 32, 8, h - 32, '#6b737a', 1.1);
  ctx.save(); ctx.translate(x + w * 0.28, 0); bottesFoin(ctx, { count: 2, seed: 3 }); ctx.translate(0, -40); bottesFoin(ctx, { count: 1, seed: 4 }); ctx.restore();
  ctx.save(); ctx.translate(x + w * 0.72, 0); bottesFoin(ctx, { count: 2, seed: 7 }); ctx.restore();
}

/** Vaches montbéliardes (robe pie rouge, tête blanche, cloche), certaines broutent. */
export function vaches(ctx, p) {
  const r = rng(p.seed || 15), n = p.count || 3;
  for (let i = 0; i < n; i++) {
    const cx = -p.w / 2 + 40 + i * (p.w - 80) / Math.max(1, n - 1) + r() * 8, dir = r() < 0.5 ? -1 : 1, s = p.scale || 1.4, grazing = r() < 0.5;
    ctx.save(); ctx.translate(cx, 0); ctx.scale(dir * s, s);
    for (const [lx, back] of [[-15, 1], [-9, 0], [11, 1], [16, 0]]) { box(ctx, lx - 2, -20, 4.5, 20, back ? '#e2d8c6' : '#f2ebdd', 0.8); ctx.fillStyle = '#3a3230'; ctx.fillRect(lx - 2, -3, 4.5, 3); }
    ctx.beginPath(); ctx.moveTo(-22, -36); ctx.quadraticCurveTo(-22, -46, -10, -46); ctx.lineTo(16, -45); ctx.quadraticCurveTo(24, -44, 23, -34); ctx.quadraticCurveTo(22, -21, 10, -22); ctx.quadraticCurveTo(0, -18, -12, -22); ctx.quadraticCurveTo(-23, -24, -22, -36); ctx.closePath();
    ctx.fillStyle = '#f6f0e4'; ctx.fill(); outline(ctx, 1.1);
    ctx.save(); ctx.clip(); ctx.fillStyle = '#b4532b'; ctx.beginPath(); ctx.ellipse(-8, -38, 11, 9, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(14, -41, 8, 6, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#8a4a2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-22, -40); ctx.quadraticCurveTo(-28, -30, -26, -20); ctx.stroke();
    const hy = grazing ? -18 : -44, hx = 30;
    ctx.beginPath(); ctx.moveTo(20, -42); ctx.lineTo(hx - 4, hy - 4); ctx.lineTo(hx + 2, hy + 6); ctx.lineTo(22, -30); ctx.closePath(); ctx.fillStyle = '#b4532b'; ctx.fill(); outline(ctx, 0.9);
    ctx.beginPath(); ctx.ellipse(hx + 2, hy + 2, 6.5, 8.5, grazing ? 0.9 : 0.3, 0, Math.PI * 2); ctx.fillStyle = '#f8f3ea'; ctx.fill(); outline(ctx, 1);
    ctx.fillStyle = '#eab8ab'; ctx.beginPath(); ctx.ellipse(hx + 4, hy + 8, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b4532b'; ctx.beginPath(); ctx.ellipse(hx - 5, hy - 3, 4, 2, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2622'; ctx.fillRect(hx + 2, hy - 2, 2, 2);
    ctx.fillStyle = '#d9b84a'; ctx.fillRect(hx - 4, hy + 9, 4, 4);
    ctx.restore();
  }
}

/** Pré clôturé de piquets et de fil (vaches optionnelles), herbe haute. */
export function pre(ctx, p) {
  const w = p.w, x = -w / 2;
  ctx.fillStyle = '#86b25a'; ctx.fillRect(x, -10, w, 10); grass(ctx, x, w, p.seed, '#6d9a45');
  if (p.cows) vaches(ctx, { w, count: p.cows, seed: p.seed });
  if (p.bales) { ctx.save(); ctx.translate(p.bales * w - w / 2, 0); bottesFoin(ctx, { count: 2, seed: p.seed }); ctx.restore(); }
  for (let xx = x + 4; xx < x + w; xx += 36) box(ctx, xx - 2, -38, 4, 38, '#8a6a45', 0.8);
  for (const yy of [-32, -20]) line(ctx, x, yy, x + w, yy, 0.8, '#6f6a60');
}

/** Champ de blé au bord de la route : épis, coquelicots, et en option un calvaire. */
export function champ(ctx, p) {
  const w = p.w, x = -w / 2, r = rng(p.seed || 9);
  ctx.fillStyle = '#d6bb5a'; ctx.fillRect(x, -30, w, 30);
  ctx.strokeStyle = '#b89a3a'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < w / 2.5; i++) { const xx = x + r() * w; ctx.moveTo(xx, -2); ctx.lineTo(xx + 1, -32 - r() * 6); } ctx.stroke();
  ctx.fillStyle = '#e8d488'; for (let i = 0; i < w / 4; i++) ctx.fillRect(x + r() * w, -36 - r() * 4, 2, 3.5);
  for (let i = 0; i < w / 30; i++) if (r() < 0.6) { ctx.fillStyle = '#d8342a'; ctx.fillRect(x + r() * w, -18 - r() * 14, 3, 3); }
  if (p.calvaire != null) { ctx.save(); ctx.translate(x + p.calvaire * w, 0); calvaire(ctx); ctx.restore(); }
}

/** Calvaire de pierre au bord du chemin. */
export function calvaire(ctx) {
  box(ctx, -12, -14, 24, 14, '#cfc8b8', 1.1); box(ctx, -8, -24, 16, 10, '#d9d3c4', 1);
  box(ctx, -3, -86, 6, 62, '#d9d3c4', 1.1); box(ctx, -17, -72, 34, 6, '#d9d3c4', 1.1);
}

/** Poteau électrique en bois avec isolateurs (les câbles sont tendus d'un poteau à l'autre par `lignes`). */
export function poteauBois(ctx) {
  ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(-2.5, -150); ctx.lineTo(2.5, -150); ctx.lineTo(3.5, 0); ctx.closePath(); ctx.fillStyle = '#7a5a3a'; ctx.fill(); outline(ctx, 1);
  box(ctx, -16, -142, 32, 4, '#6a4a2f', 0.9);
  for (const dx of [-13, 0, 13]) box(ctx, dx - 1.5, -150, 3, 6, '#d8dde0', 0.7);
}

/** Haie bocagère : talus, haie d'arbustes et quelques arbres têtards. */
export function haieBocage(ctx, p) {
  const w = p.w, x = -w / 2, r = rng(p.seed || 3);
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(0, -18, x + w, 0); ctx.closePath(); ctx.fillStyle = '#7f9f55'; ctx.fill(); outline(ctx, 1);
  for (let xx = x + 10; xx < x + w - 10; xx += 22) bush(ctx, xx + r() * 6, -8, 34, 30 + r() * 14, r.pick(['#4f7a3a', '#5a8a40', '#466f35']), xx);
}

/** Corps de ferme : logis de pierre et grange à grande porte charretière, fumier et bottes. */
export function ferme(ctx, p) {
  const w = p.w, x = -w / 2, houseW = w * 0.44;
  ctx.save(); ctx.translate(x + houseW / 2, 0); maisonVillage(ctx, { w: houseW, seed: p.seed, doorAt: 0.5, volets: '#8a6f5a' }); ctx.restore();
  const bx = x + houseW, bw = w - houseW, bh = 160;
  stoneWall(ctx, bx, -bh, bw, bh, '#cdb88e', (p.seed || 1) + 5);
  gableRoof(ctx, bx, -bh, bw, 56, 'tuile', { overhang: 7 });
  const dw = Math.min(96, bw * 0.56), dcx = bx + bw / 2;
  ctx.beginPath(); ctx.moveTo(dcx - dw / 2, 0); ctx.lineTo(dcx - dw / 2, -bh * 0.6); ctx.quadraticCurveTo(dcx, -bh * 0.82, dcx + dw / 2, -bh * 0.6); ctx.lineTo(dcx + dw / 2, 0); ctx.closePath();
  ctx.fillStyle = '#7a5433'; ctx.fill(); ctx.save(); ctx.clip(); ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 1; ctx.beginPath(); for (let xx = dcx - dw / 2; xx < dcx + dw / 2; xx += 8) { ctx.moveTo(xx, 0); ctx.lineTo(xx, -bh); } ctx.moveTo(dcx, 0); ctx.lineTo(dcx, -bh); ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(dcx - dw / 2, 0); ctx.lineTo(dcx - dw / 2, -bh * 0.6); ctx.quadraticCurveTo(dcx, -bh * 0.82, dcx + dw / 2, -bh * 0.6); ctx.lineTo(dcx + dw / 2, 0); outline(ctx, 1.4);
}

export { hedge, lit, castShadow, glass };

import { DOOR, alpha, awning, box, bush, castShadow, door, gableRoof, glass, grass, hedge, ironRail, line, lit, outline, pitchedRoof, rng, shade, wall, windowUnit } from './kit.js';
import { banc } from './paris.js';
import { voiture } from './periurbain.js';
import { stoneWall } from './campagne.js';

/**
 * Retraités : pavillons impeccables aux haies taillées, nains de jardin, boulodrome, camping-car ;
 * front de mer (résidences à balcons, villas balnéaires, promenade, glacier, plage) ; villas bourgeoises en meulière.
 */

/** Pavillon impeccable : crépi blanc, tuiles, volets colorés, jardinières, haie taillée, rosiers, nain de jardin. */
export function pavillonImpeccable(ctx, p) {
  const r = rng(p.seed || 1), w = p.w, x = -w / 2, h = p.floors === 0 ? 118 : 190, color = p.color || r.pick(['#f6f1e6', '#f2ead8', '#f7f3ea']);
  const volets = p.volets || r.pick(['#5f86a8', '#6f9a7a', '#a8c0cf', '#c7a15a']);
  wall(ctx, x, -h, w, h, color);
  box(ctx, x, -18, w, 18, '#d9d2c2', 1); // soubassement
  const doorX = x + w * (p.doorAt ?? 0.5);
  ctx.save(); ctx.translate(doorX, 0); door(ctx, 0, 30, 90, p.doorColor || '#8a5a3a', 'bois'); ctx.restore();
  // Marquise en fer forgé et verre
  box(ctx, doorX - 24, -104, 48, 5, '#dbe6ea', 1); for (const dx of [-20, 20]) line(ctx, doorX + dx, -99, doorX + dx * 0.6, -92, 1.2, '#2b2826');
  for (const t of [0.2, 0.8]) windowUnit(ctx, x + w * t, -38, 28, 48, { shutters: volets, frame: '#ffffff', panes: 3, sill: '#e6ddc8', box: true, curtain: '#f6efe0' }, (p.seed || 1) + t * 10);
  if (h > 150) for (const t of [0.2, 0.5, 0.8]) windowUnit(ctx, x + w * t, -124, 24, 42, { shutters: volets, frame: '#ffffff', panes: 3, sill: '#e6ddc8', box: t !== 0.5 }, (p.seed || 1) + t * 20);
  pitchedRoof(ctx, x, -h, w, 50, 'tuile', { overhang: 10, hip: 0.3, color: '#b8603c' });
  box(ctx, x + w * 0.72 - 8, -h - 46, 16, 26, color, 1.1);
  if (p.front !== false) {
    ctx.fillStyle = '#7fb052'; ctx.fillRect(x, -5, w, 5);
    hedge(ctx, x - 2, w * 0.32, 44, '#3f6a3a', p.seed); hedge(ctx, x + w * 0.7, w * 0.32, 44, '#3f6a3a', (p.seed || 1) + 1);
    // Rosiers et nain de jardin dans l'allée
    for (const dx of [-38, 38]) { bush(ctx, doorX + dx, -2, 22, 20, '#5d8a40', dx); ctx.fillStyle = '#e05a6a'; for (let i = 0; i < 5; i++) ctx.fillRect(doorX + dx - 8 + i * 4, -18 + (i % 2) * 4, 3, 3); }
    if (p.gnome) nainJardin(ctx, doorX + 56);
  }
}

/** Nain de jardin : bonnet rouge, barbe blanche, veste bleue. */
export function nainJardin(ctx, x) {
  ctx.fillStyle = '#3f6fb0'; ctx.fillRect(x - 5, -12, 10, 12);
  ctx.fillStyle = '#f1d3b0'; ctx.fillRect(x - 3.5, -18, 7, 6);
  ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.moveTo(x - 4, -14); ctx.lineTo(x, -6); ctx.lineTo(x + 4, -14); ctx.fill();
  ctx.fillStyle = '#d63b2e'; ctx.beginPath(); ctx.moveTo(x - 5, -18); ctx.lineTo(x + 1, -30); ctx.lineTo(x + 5, -18); ctx.closePath(); ctx.fill(); outline(ctx, 0.7);
}

/** Garage du quartier : atelier ouvert, voiture sur le pont élévateur, pile de pneus, clé plate peinte sur le fronton. */
export function garageQuartier(ctx, p) {
  const w = p.w, x = -w / 2, h = 150, color = '#ece6d8';
  wall(ctx, x, -h, w, h, color);
  box(ctx, x - 3, -h - 8, w + 6, 10, '#c9c2b2', 1.2);
  box(ctx, x + 10, -h + 10, w - 20, 22, '#2f5f8f', 1.1);
  // Pictogramme : clé plate croisée d'une roue dentée stylisée (sans texte)
  ctx.save(); ctx.translate(0, -h + 21); ctx.rotate(-0.6); box(ctx, -14, -2, 28, 4, '#f4efe0', 0); ctx.beginPath(); ctx.moveTo(14, -5); ctx.lineTo(19, -5); ctx.lineTo(19, 5); ctx.lineTo(14, 5); ctx.lineTo(16, 0); ctx.closePath(); ctx.fillStyle = '#f4efe0'; ctx.fill(); ctx.restore();
  // Baie d'atelier ouverte : intérieur sombre, pont élévateur, voiture levée
  const bw = w * 0.6, bx = x + 12;
  box(ctx, bx, -100, bw, 100, '#4a4f53', 1.3);
  box(ctx, bx, -100, bw, 12, '#9aa1a6', 1); // rideau relevé
  line(ctx, bx + 16, 0, bx + 16, -60, 3, '#e0b54a'); line(ctx, bx + bw - 16, 0, bx + bw - 16, -60, 3, '#e0b54a');
  box(ctx, bx + 20, -58, bw - 40, 5, '#8a6a45', 0.8); for (let i = 0; i < 6; i++) box(ctx, bx + 26 + i * 12, -72, 4, 14, ['#c9a13a', '#8a8f94', '#b5442f'][i % 3], 0); // établi et outils
  // Pneus empilés et bureau vitré
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(x + w - 40, -9 - i * 9, 28, 9, 4); ctx.fillStyle = '#2d2d2d'; ctx.fill(); outline(ctx, 0.8); }
  windowUnit(ctx, x + w - 26, -58, 30, 38, { frame: '#e9e6de', panes: 1, lit: true }, 3);
}

/** Boulodrome : terrain de sable stabilisé, bordures de bois, bancs, boules et cochonnet. */
export function boulodrome(ctx, p) {
  const w = p.w, x = -w / 2;
  ctx.fillStyle = '#d9c9a0'; ctx.fillRect(x, -9, w, 9);
  box(ctx, x, -12, w, 4, '#8a6a45', 0.9);
  for (const bx of [x + w * 0.2, x + w * 0.8]) banc(ctx, bx, '#6a8a5a');
  // Boules (reflets métalliques) et cochonnet
  for (const [dx, c] of [[-10, '#9ea3a8'], [-2, '#8a8f94'], [8, '#b0b5b9'], [18, '#9ea3a8']]) { ctx.beginPath(); ctx.ellipse(dx, -12, 3.2, 3, 0, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); outline(ctx, 0.6); }
  ctx.fillStyle = '#e0b54a'; ctx.fillRect(3, -13, 2.5, 2.5);
  // Rangée de tilleuls taillés en rideau (troncs, feuillage en bloc)
  for (let xx = x + 20; xx < x + w - 10; xx += 46) { line(ctx, xx, -12, xx, -66, 3, '#6a5040'); ctx.save(); ctx.translate(0, -58); hedge(ctx, xx - 24, 48, 40, '#557f3a', xx); ctx.restore(); }
}

/** Camping-car garé, avec vélos à l'arrière. */
export function campingCar(ctx, p = {}) {
  const dir = p.dir === -1 ? -1 : 1;
  ctx.save(); ctx.scale(dir, 1);
  ctx.beginPath(); ctx.moveTo(-90, -14); ctx.lineTo(-90, -108); ctx.quadraticCurveTo(-90, -118, -78, -118); ctx.lineTo(50, -118); ctx.lineTo(62, -104); ctx.lineTo(62, -78); ctx.lineTo(88, -60); ctx.lineTo(90, -14); ctx.closePath();
  const g = ctx.createLinearGradient(0, -118, 0, -14); g.addColorStop(0, '#fbfaf5'); g.addColorStop(1, '#e2e0d8'); ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.4);
  box(ctx, -90, -58, 180, 7, '#7f8a96', 0.8); box(ctx, -90, -50, 180, 3, '#c9a15a', 0);
  glass(ctx, -70, -98, 34, 22); glass(ctx, -20, -98, 24, 22); glass(ctx, 64, -76, 20, 14);
  box(ctx, 20, -100, 22, 70, '#efede6', 1); // porte
  for (const wx of [-56, 56]) { ctx.beginPath(); ctx.arc(wx, -14, 14, 0, Math.PI * 2); ctx.fillStyle = '#26282b'; ctx.fill(); outline(ctx, 1); ctx.beginPath(); ctx.arc(wx, -14, 6, 0, Math.PI * 2); ctx.fillStyle = '#a9adb1'; ctx.fill(); }
  ctx.restore();
}

/* ---------- Front de mer ---------- */

/** Résidence de front de mer (années 70) : balcons filants à garde-corps vitrés, stores bannes colorés. */
export function residenceMer(ctx, p) {
  const r = rng(p.seed || 9), w = p.w, x = -w / 2, floors = p.floors ?? 4, fh = 62, rdc = p.rdcH || 120, top = -(rdc + floors * fh);
  wall(ctx, x, top, w, -top, p.color || '#f7f4ec');
  const n = Math.max(3, Math.round(w / 46));
  for (let f = 0; f < floors; f++) {
    const bottom = -rdc - f * fh;
    for (let i = 0; i < n; i++) {
      const cx = x + w * (i + 0.5) / n;
      windowUnit(ctx, cx, bottom - 6, w / n * 0.64, fh * 0.72, { frame: '#ffffff', panes: 1, sill: false, lit: r() < 0.08, curtain: r() < 0.3 ? '#f2e2c4' : null }, (p.seed || 9) + f * 9 + i);
      if (r() < 0.35) { const c = r.pick(['#3f7fbf', '#f2c14b', '#e8622c', '#2f9f7f']); ctx.beginPath(); ctx.moveTo(cx - 15, bottom - fh * 0.74); ctx.lineTo(cx + 15, bottom - fh * 0.74); ctx.lineTo(cx + 19, bottom - fh * 0.56); ctx.lineTo(cx - 19, bottom - fh * 0.56); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); outline(ctx, 0.9); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(cx - 8, bottom - fh * 0.74, 5, fh * 0.18); }
    }
    box(ctx, x - 5, bottom - 10, w + 10, 5, '#ffffff', 1); castShadow(ctx, x, bottom - 5, w, 7, 0.2);
    ctx.fillStyle = 'rgba(120,170,200,0.35)'; ctx.fillRect(x - 4, bottom - 24, w + 8, 14); ctx.strokeStyle = '#8fb2c9'; ctx.lineWidth = 1; ctx.strokeRect(x - 4, bottom - 24, w + 8, 14);
  }
  box(ctx, x - 4, top - 8, w + 8, 8, '#e4e0d6', 1.2);
  if (p.rdc !== 'none') {
    // Galerie commerçante à arcades au rez-de-chaussée
    const arches = Math.max(2, Math.round(w / 60));
    for (let i = 0; i < arches; i++) { const ax = x + w * (i + 0.5) / arches, aw = w / arches - 14; box(ctx, ax - aw / 2, -rdc + 20, aw, rdc - 20, '#e9e1cf', 1); glass(ctx, ax - aw / 2 + 4, -rdc + 26, aw - 8, rdc - 30, true); }
    for (let i = 0; i <= arches; i++) box(ctx, x + w * i / arches - 5, -rdc, 10, rdc, '#ffffff', 1);
  }
}

/** Villa balnéaire Belle Époque : enduit blanc, pignon à colombages décoratifs, balcon de bois, volets bleus, bow-window. */
export function villaBalneaire(ctx, p) {
  const w = p.w, x = -w / 2, h = 190, color = '#fbf8f1', volets = p.volets || '#3f7fb0';
  wall(ctx, x, -h, w, h, color);
  box(ctx, x, -20, w, 20, '#d9cfbc', 1);
  // Pignon à colombages
  const gw = w * 0.56, gx = x + w * 0.44;
  const eave = -h - 10, apex = eave - 64;
  wall(ctx, gx, eave, gw, h + 10, shade(color, -0.02));
  ctx.beginPath(); ctx.moveTo(gx, eave); ctx.lineTo(gx + gw / 2, apex); ctx.lineTo(gx + gw, eave); ctx.closePath(); ctx.fillStyle = shade(color, -0.02); ctx.fill(); outline(ctx, 1.3);
  // Colombages : entrait, poinçon, arbalétriers et croix dans le triangle du pignon
  ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(gx + 4, eave); ctx.lineTo(gx + gw - 4, eave);
  ctx.moveTo(gx + gw / 2, apex + 6); ctx.lineTo(gx + gw / 2, eave);
  ctx.moveTo(gx + gw * 0.2, eave); ctx.lineTo(gx + gw / 2, eave - 36); ctx.moveTo(gx + gw * 0.8, eave); ctx.lineTo(gx + gw / 2, eave - 36);
  ctx.moveTo(gx + 6, eave + 50); ctx.lineTo(gx + gw - 6, eave + 50);
  ctx.stroke();
  gableRoof(ctx, gx, eave, gw, 64, 'tuile', { overhang: 12, color: '#c96a45' });
  // Lambrequin de bois découpé sous la rive
  ctx.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) { const t = i / 8; ctx.beginPath(); ctx.moveTo(gx - 6 + t * gw * 0.5, -h - 10 - t * 60 + 4); ctx.lineTo(gx - 2 + t * gw * 0.5, -h - 10 - t * 60 + 12); ctx.lineTo(gx + 2 + t * gw * 0.5, -h - 10 - t * 60 + 4); ctx.fill(); }
  // Balcon de bois à l'étage
  box(ctx, gx + 6, -118, gw - 12, 5, '#8a5a3a', 1); for (let xx = gx + 10; xx < gx + gw - 8; xx += 6) line(ctx, xx, -118, xx, -134, 1.2, '#8a5a3a'); line(ctx, gx + 6, -134, gx + gw - 6, -134, 1.6, '#8a5a3a');
  windowUnit(ctx, gx + gw / 2, -122, 32, 54, { shutters: volets, frame: '#ffffff', panes: 3 }, 1);
  // Bow-window au rez-de-chaussée
  box(ctx, gx + gw / 2 - 30, -86, 60, 66, '#ffffff', 1.2); for (const dx of [-20, 0, 20]) glass(ctx, gx + gw / 2 + dx - 8, -80, 16, 54, dx === 0);
  box(ctx, gx + gw / 2 - 34, -92, 68, 6, '#e6ddc8', 1);
  // Corps gauche : porte et fenêtre, toit bas
  ctx.save(); ctx.translate(x + w * 0.2, 0); door(ctx, 0, 28, 88, volets, 'bois'); ctx.restore();
  windowUnit(ctx, x + w * 0.2, -124, 22, 40, { shutters: volets, frame: '#ffffff', panes: 3 }, 2);
  pitchedRoof(ctx, x, -h, w * 0.44, 36, 'tuile', { overhang: 6, hip: 0.1, color: '#c96a45' });
  if (p.hortensias !== false) for (const dx of [x + 10, gx - 6]) { bush(ctx, dx, 0, 30, 24, '#4f7b3a', dx); ctx.fillStyle = '#8fa8e0'; for (let i = 0; i < 6; i++) ctx.fillRect(dx - 10 + i * 4, -18 + (i % 2) * 5, 4, 4); }
}

/** Promenade du remblai : balustrade blanche, bancs tournés vers la mer, lampadaires à boule. */
export function promenade(ctx, p) {
  const w = p.w, x = -w / 2;
  ctx.fillStyle = '#e8dfca'; ctx.fillRect(x, -8, w, 8);
  box(ctx, x, -36, w, 5, '#f7f4ec', 1.1); box(ctx, x, -6, w, 6, '#ece6d8', 1);
  for (let xx = x + 5; xx < x + w - 3; xx += 9) { ctx.beginPath(); ctx.moveTo(xx - 2.5, -6); ctx.quadraticCurveTo(xx - 5, -19, xx - 2, -31); ctx.lineTo(xx + 2, -31); ctx.quadraticCurveTo(xx + 5, -19, xx + 2.5, -6); ctx.closePath(); ctx.fillStyle = '#fbf9f3'; ctx.fill(); outline(ctx, 0.7); }
  for (const lx of p.lamps || [-w * 0.4, w * 0.4]) {
    line(ctx, lx, 0, lx, -128, 3, '#f2f0e8'); line(ctx, lx, 0, lx, -128, 0.8);
    ctx.beginPath(); ctx.moveTo(lx - 7, -128); ctx.lineTo(lx + 7, -128); ctx.lineTo(lx + 5, -140); ctx.lineTo(lx - 5, -140); ctx.closePath(); ctx.fillStyle = '#f7e9a8'; ctx.fill(); outline(ctx, 0.8);
  }
}

/** Kiosque de glacier à rayures (cornet peint en guise d'enseigne). */
export function glacier(ctx) {
  box(ctx, -32, -84, 64, 84, '#fdf4e3', 1.3);
  awning(ctx, -36, -98, 72, 16, ['#6cc1d6', '#fdf4e3'], 8);
  glass(ctx, -26, -76, 52, 34, true);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#f7c6d9', '#fbe7a6', '#b9e3c6', '#8a5a3c', '#f4f4f4', '#f7c6d9'][i]; ctx.fillRect(-24 + i * 8, -52, 7, 7); }
  // Cornet géant sur le toit
  ctx.beginPath(); ctx.moveTo(-8, -104); ctx.lineTo(0, -84); ctx.lineTo(8, -104); ctx.closePath(); ctx.fillStyle = '#d9a45a'; ctx.fill(); outline(ctx, 1);
  ctx.beginPath(); ctx.moveTo(-10, -104); ctx.quadraticCurveTo(-10, -118, 0, -120); ctx.quadraticCurveTo(10, -118, 10, -104); ctx.closePath(); ctx.fillStyle = '#f7c6d9'; ctx.fill(); outline(ctx, 1);
}

/** Plage (fond proche) : sable, cabines rayées, parasols, serviettes, château de sable. */
export function plage(ctx, p) {
  const w = p.w, x = -w / 2, r = rng(p.seed || 5);
  ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, -8); for (let xx = x; xx <= x + w; xx += 20) ctx.lineTo(xx, -10 - 4 * Math.sin(xx * 0.02)); ctx.lineTo(x + w, 40); ctx.closePath();
  ctx.fillStyle = '#ecd9a6'; ctx.fill();
  ctx.fillStyle = '#d9c28a'; for (let i = 0; i < w / 3; i++) ctx.fillRect(x + r() * w, -r() * 10, 1.5, 1.5);
  for (let i = 0; i < 7; i++) {
    const cx = x + w * 0.05 + i * 36;
    ctx.beginPath(); ctx.rect(cx - 13, -64, 26, 54); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = ['#3f7fbf', '#d9412b', '#2f9f7f'][i % 3]; for (let s = cx - 13; s < cx + 13; s += 8) ctx.fillRect(s, -64, 4, 54); ctx.restore();
    ctx.beginPath(); ctx.rect(cx - 13, -64, 26, 54); outline(ctx, 1);
    ctx.beginPath(); ctx.moveTo(cx - 16, -64); ctx.lineTo(cx, -77); ctx.lineTo(cx + 16, -64); ctx.closePath(); ctx.fillStyle = '#f4f1e8'; ctx.fill(); outline(ctx, 1);
  }
  for (let i = 0; i < 8; i++) {
    const px = x + w * 0.4 + i * (w * 0.56 / 8) + r() * 10, col = r.pick(['#d9412b', '#f2c14b', '#3f7fbf', '#2f9f7f', '#f39ac0']);
    line(ctx, px, -6, px + 3, -46, 1.2, '#6a6a66');
    ctx.beginPath(); ctx.moveTo(px - 22, -42); ctx.quadraticCurveTo(px + 3, -62, px + 28, -42); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); outline(ctx, 0.9);
    ctx.fillStyle = r.pick(['#f4f4f4', '#6fa8e8', '#f2d06f', '#e86f6f']); ctx.fillRect(px - 16, -8, 24, 5);
  }
}

/* ---------- Banlieue bourgeoise ---------- */

/** Villa en meulière : moellons ocre, chaînages et linteaux de brique, bow-window, toit débordant, grille et portail. */
export function villaMeuliere(ctx, p) {
  const r = rng(p.seed || 7), w = p.w, x = -w / 2, h = 200;
  wall(ctx, x, -h, w, h, '#c9a577');
  ctx.save(); ctx.beginPath(); ctx.rect(x, -h, w, h); ctx.clip();
  for (let i = 0; i < w * h / 60; i++) { ctx.fillStyle = r.pick(['#b8905f', '#d4b286', '#a8804f', '#c49a68']); ctx.beginPath(); ctx.roundRect(x + r() * w, -h + r() * h, 6 + r() * 5, 4 + r() * 3, 2); ctx.fill(); }
  ctx.restore(); ctx.beginPath(); ctx.rect(x, -h, w, h); outline(ctx, 1.5);
  for (const cx of [x, x + w - 9]) for (let yy = 0; yy > -h; yy -= 12) box(ctx, cx, yy - 6, 9, 6, '#b5553a', 0.5);
  box(ctx, x, -104, w, 8, '#b5553a', 1); // bandeau de brique
  const doorX = x + w * 0.24;
  ctx.save(); ctx.translate(doorX, 0); door(ctx, 0, 30, 92, '#3f5f4f', 'bois'); ctx.restore();
  box(ctx, doorX - 20, -100, 40, 7, '#b5553a', 1);
  // Bow-window
  const bx = x + w * 0.66; box(ctx, bx - 32, -94, 64, 80, '#f1ebdc', 1.3); for (const dx of [-21, 0, 21]) glass(ctx, bx + dx - 8, -88, 16, 64, dx === 0 && r() < 0.5); box(ctx, bx - 36, -100, 72, 6, '#b5553a', 1); castShadow(ctx, bx - 32, -94, 64, 8, 0.25);
  for (const t of [0.24, 0.66]) windowUnit(ctx, x + w * t, -128, 26, 48, { shutters: r.pick(['#6c8c7a', '#7a8fa0']), frame: '#f1ebdc', panes: 3, box: true }, t * 10);
  pitchedRoof(ctx, x, -h, w, 58, 'tuile', { overhang: 14, hip: 0.22, color: '#9f5238' });
  // Épi de faîtage
  line(ctx, x + w * 0.5, -h - 58, x + w * 0.5, -h - 72, 2, '#6a3a2a');
  if (p.front !== false) {
    ctx.fillStyle = '#78a650'; ctx.fillRect(x, -5, w, 5);
    box(ctx, x - 2, -16, w + 4, 16, '#c9a577', 1.1); box(ctx, x - 4, -19, w + 8, 4, '#b5553a', 1);
    ironRail(ctx, x, -62, w, 44, '#2b2826');
    for (const px of [doorX - 20, doorX + 20]) box(ctx, px - 6, -78, 12, 78, '#c9a577', 1.1);
    for (const dx of [x + w * 0.5, x + w * 0.9]) { bush(ctx, dx, -16, 34, 28, '#4a7a3a', dx); ctx.fillStyle = '#b8a0e0'; for (let i = 0; i < 6; i++) ctx.fillRect(dx - 12 + i * 4, -36 + (i % 2) * 5, 4, 4); }
  }
}

export { lit, grass, stoneWall };

/** Haie de thuyas taillée au cordeau entre deux propriétés. */
export function haie(ctx, p) { hedge(ctx, -p.w / 2, p.w, p.h || 52, p.color || '#3f6a3a', p.seed || 1); }

import { DOOR, alpha, box, castShadow, door, gableRoof, glass, line, lit, outline, pitchedRoof, rng, shade, wall, windowUnit } from './kit.js';
import { faubourg, haussmann } from './paris.js';
import { immeubleBanlieue, tourCite, parabole } from './banlieue.js';
import { residenceMer } from './littoral.js';
import { stoneWall } from './campagne.js';

/**
 * Bâtiments interactifs du jeu, dessinés par le code comme le reste de la fresque.
 * Chaque bâtiment = une devanture propre à sa fonction (au rez-de-chaussée) + un corps dans le style du quartier.
 * Seules ces devantures portent un panneau crème, où le jeu écrit le nom du bâtiment et la couleur du propriétaire.
 */
export const FRONT_H = 128;
export const frontWidth = wPx => Math.min(160, Math.max(110, wPx - 28));

/** Rectangle du panneau crème (px, relatif au pied du bâtiment, centre x = 0). */
export function signRect(wPx) {
  const fw = frontWidth(wPx);
  return { x: 0, y: -FRONT_H + 17, w: fw * 0.84, h: 22 };
}

const CREAM = '#f3e4c5';

/* ---------- Devantures fonctionnelles ---------- */

function frame(ctx, fw, color) {
  const x = -fw / 2;
  box(ctx, x, -FRONT_H, fw, FRONT_H, color, 1.5);
  lit(ctx, x + 1, -FRONT_H + 1, fw - 2, FRONT_H - 2, color, { light: 0.08, dark: 0.12 });
  ctx.beginPath(); ctx.rect(x, -FRONT_H, fw, FRONT_H); outline(ctx, 1.5);
  const s = signRect(fw + 28);
  box(ctx, -s.w / 2 - 3, s.y - s.h / 2 - 3, s.w + 6, s.h + 6, shade(color, -0.2), 1.1);
  box(ctx, -s.w / 2, s.y - s.h / 2, s.w, s.h, CREAM, 1.1);
  castShadow(ctx, -s.w / 2, s.y + s.h / 2 + 3, s.w, 6, 0.25);
}

/** Vitrine à affiches de campagne (portraits stylisés, slogans en bandes de couleur), guirlande tricolore. */
function permanence(ctx, fw, seed) {
  const r = rng(seed), x = -fw / 2, top = -FRONT_H + 36;
  frame(ctx, fw, '#2f4a5f');
  const vw = fw - 50;
  box(ctx, x + 8, top, vw, -top - 16, '#e9e3d6', 1.1); glass(ctx, x + 10, top + 2, vw - 4, -top - 20, true);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 10, top + 2, vw - 4, -top - 20); ctx.clip();
  for (let i = 0; i < 3; i++) { // affiches
    const ax = x + 14 + i * (vw - 12) / 3, aw = (vw - 12) / 3 - 5, c = r.pick(['#d7263d', '#23408e', '#f2c14b', '#2f9f7f']);
    box(ctx, ax, top + 8, aw, 44, '#f7f4ec', 0.7); box(ctx, ax + 2, top + 10, aw - 4, 20, c, 0);
    ctx.fillStyle = '#e8c9a8'; ctx.beginPath(); ctx.roundRect(ax + aw / 2 - 5, top + 13, 10, 12, 4); ctx.fill(); // visage
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(ax + aw / 2 - 7, top + 24, 14, 6);
    for (let k = 0; k < 3; k++) box(ctx, ax + 3, top + 34 + k * 5, aw - 6, 2.5, c, 0);
  }
  box(ctx, x + 12, -34, vw - 8, 5, '#8a6a45', 0.8); for (let k = 0; k < 6; k++) box(ctx, x + 16 + k * 10, -40, 8, 6, r.pick(['#f7f4ec', '#d7263d', '#23408e']), 0.4); // tracts
  ctx.restore();
  // Guirlande tricolore dans la vitrine
  for (let i = 0; i < 9; i++) { const gx = x + 12 + i * (vw - 8) / 9; ctx.beginPath(); ctx.moveTo(gx, top + 3); ctx.lineTo(gx + 6, top + 3); ctx.lineTo(gx + 3, top + 10); ctx.closePath(); ctx.fillStyle = ['#23408e', '#f4f4f4', '#d7263d'][i % 3]; ctx.fill(); }
  box(ctx, x + 6, -16, vw + 4, 16, shade('#2f4a5f', -0.2), 1);
  ctx.save(); ctx.translate(x + fw - 22, 0); door(ctx, 0, 28, DOOR - 4, '#2f4a5f', 'vitree'); ctx.restore();
}

/** Atelier ou garage : rideau métallique à mi-hauteur, établi, deux-roues à l'intérieur et devant. */
function atelier(ctx, fw, seed, kind) {
  const x = -fw / 2, top = -FRONT_H + 36, color = kind === 'velo' ? '#2f6b4f' : '#7a3f2a';
  frame(ctx, fw, color);
  const bw = fw - 16;
  box(ctx, x + 8, top, bw, -top, '#3f4449', 1.2);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 8, top, bw, -top); ctx.clip();
  lit(ctx, x + 8, top, bw, -top, '#5a5f64', { light: 0.2, dark: 0.1 });
  box(ctx, x + 14, -44, bw * 0.4, 5, '#8a6a45', 0.8); // établi
  for (let i = 0; i < 5; i++) box(ctx, x + 16 + i * 8, -60, 3, 14, ['#c9a13a', '#8a8f94', '#b5442f'][i % 3], 0);
  ctx.restore();
  box(ctx, x + 8, top, bw, 26, '#9aa1a6', 1.1); // rideau relevé à mi-hauteur
  ctx.strokeStyle = '#7d858a'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let yy = top + 4; yy < top + 26; yy += 4) { ctx.moveTo(x + 8, yy); ctx.lineTo(x + 8 + bw, yy); } ctx.stroke();
  if (kind === 'velo') {
    for (let i = 0; i < 2; i++) { const vx = x + 30 + i * 50; ctx.strokeStyle = '#2b2826'; ctx.lineWidth = 1.2; for (const wx of [vx - 11, vx + 11]) { ctx.beginPath(); ctx.arc(wx, -10, 9, 0, Math.PI * 2); ctx.stroke(); } ctx.strokeStyle = ['#2f6fb0', '#e8622c'][i]; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(vx - 11, -10); ctx.lineTo(vx - 3, -24); ctx.lineTo(vx + 8, -24); ctx.lineTo(vx + 11, -10); ctx.moveTo(vx - 3, -24); ctx.lineTo(vx + 1, -10); ctx.lineTo(vx - 11, -10); ctx.stroke(); }
  } else {
    for (let i = 0; i < 2; i++) { const sx = x + 34 + i * 54, col = ['#d9412b', '#3f7fbf'][i]; ctx.beginPath(); ctx.moveTo(sx - 16, -14); ctx.quadraticCurveTo(sx - 16, -30, sx - 2, -28); ctx.lineTo(sx + 10, -18); ctx.lineTo(sx + 16, -14); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); outline(ctx, 1); line(ctx, sx + 12, -16, sx + 9, -40, 1.8, '#444'); line(ctx, sx + 5, -41, sx + 14, -40, 1.8, '#444'); for (const wx of [sx - 12, sx + 12]) { ctx.beginPath(); ctx.arc(wx, -8, 7, 0, Math.PI * 2); ctx.fillStyle = '#26282b'; ctx.fill(); } }
  }
}

/** Studio de radio/télévision associatif ou local : micro, console, lampe « à l'antenne », parabole et antenne. */
function studio(ctx, fw, seed) {
  const x = -fw / 2, top = -FRONT_H + 36;
  frame(ctx, fw, '#3a3558');
  const vw = fw - 50;
  box(ctx, x + 8, top, vw, -top - 16, '#e9e3d6', 1.1); glass(ctx, x + 10, top + 2, vw - 4, -top - 20, true);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 10, top + 2, vw - 4, -top - 20); ctx.clip();
  box(ctx, x + 14, -44, vw - 12, 8, '#2b2b30', 0.6); for (let i = 0; i < 8; i++) box(ctx, x + 18 + i * 8, -42, 4, 3, ['#5fe0c0', '#f2c14b', '#e86f4f'][i % 3], 0); // console
  line(ctx, x + 30, -44, x + 30, -66, 1.6, '#2b2b2b'); ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.roundRect(x + 26, -76, 8, 12, 4); ctx.fill(); // micro
  box(ctx, x + vw - 24, -80, 22, 30, '#1d2227', 0.6); ctx.fillStyle = '#7fb0ff'; ctx.fillRect(x + vw - 22, -78, 18, 22); // écran
  ctx.restore();
  box(ctx, x + 12, top - 12, 24, 9, '#e8322c', 1); // voyant « à l'antenne »
  box(ctx, x + 6, -16, vw + 4, 16, shade('#3a3558', -0.2), 1);
  ctx.save(); ctx.translate(x + fw - 22, 0); door(ctx, 0, 28, DOOR - 4, '#3a3558', 'vitree'); ctx.restore();
  parabole(ctx, x + fw + 6, -FRONT_H + 10, 1.4, 1);
}

/** Local du service d'ordre / cabinet : porte blindée, vitres dépolies à stores, caméra, rideau métallique. */
function local(ctx, fw, seed) {
  const x = -fw / 2, top = -FRONT_H + 36;
  frame(ctx, fw, '#4a4f55');
  for (const wx of [x + 10, x + 10 + (fw - 60) / 2 + 2]) {
    const ww = (fw - 60) / 2 - 2;
    box(ctx, wx, top, ww, 58, '#d9dde0', 1.1);
    ctx.strokeStyle = '#b9bec2'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let yy = top + 3; yy < top + 58; yy += 3.5) { ctx.moveTo(wx + 1, yy); ctx.lineTo(wx + ww - 1, yy); } ctx.stroke();
    for (let xx = wx + 3; xx < wx + ww; xx += 6) line(ctx, xx, top, xx, top + 58, 1, '#2b2b2b'); // barreaux
  }
  box(ctx, x + 8, -30, fw - 60, 30, '#9aa1a6', 1); ctx.strokeStyle = '#7d858a'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let yy = -27; yy < 0; yy += 4) { ctx.moveTo(x + 8, yy); ctx.lineTo(x + fw - 52, yy); } ctx.stroke();
  ctx.save(); ctx.translate(x + fw - 24, 0); door(ctx, 0, 32, DOOR - 2, '#3a3f45', 'metal'); ctx.restore();
  box(ctx, x + fw - 34, -DOOR - 16, 12, 7, '#2b2b2b', 0.8); line(ctx, x + fw - 22, -DOOR - 12, x + fw - 16, -DOOR - 12, 1.4, '#2b2b2b'); // caméra
}

/** Institut de sondage : bureaux vitrés, écrans de courbes et d'histogrammes, plante, porte vitrée. */
function institut(ctx, fw, seed) {
  const x = -fw / 2, top = -FRONT_H + 36;
  frame(ctx, fw, '#1f3a4f');
  const vw = fw - 50;
  box(ctx, x + 8, top, vw, -top - 16, '#e9e3d6', 1.1); glass(ctx, x + 10, top + 2, vw - 4, -top - 20, true);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 10, top + 2, vw - 4, -top - 20); ctx.clip();
  ctx.fillStyle = 'rgba(245,248,250,0.55)'; ctx.fillRect(x + 10, top + 2, vw - 4, -top - 20);
  box(ctx, x + 16, top + 8, 40, 30, '#1d2227', 0.6); for (let i = 0; i < 5; i++) { const bh = [10, 18, 14, 22, 8][i]; ctx.fillStyle = ['#d7263d', '#23408e', '#f2c14b', '#2f9f7f', '#8a8f94'][i]; ctx.fillRect(x + 20 + i * 7, top + 34 - bh, 5, bh); }
  box(ctx, x + vw - 40, top + 8, 36, 26, '#1d2227', 0.6); ctx.strokeStyle = '#5fe0c0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + vw - 36, top + 28); ctx.lineTo(x + vw - 28, top + 20); ctx.lineTo(x + vw - 20, top + 24); ctx.lineTo(x + vw - 10, top + 12); ctx.stroke();
  box(ctx, x + 14, -40, vw - 12, 4, '#e8e2d6', 0.6);
  ctx.restore();
  box(ctx, x + 6, -16, vw + 4, 16, shade('#1f3a4f', -0.2), 1);
  ctx.save(); ctx.translate(x + fw - 22, 0); door(ctx, 0, 28, DOOR - 4, '#1f3a4f', 'vitree'); ctx.restore();
}

const FRONTS = { permanence, garage_velo: (c, fw, s) => atelier(c, fw, s, 'velo'), garage_scooter: (c, fw, s) => atelier(c, fw, s, 'scooter'), tour_communication: studio, faction: local, institut_sondage: institut };

/* ---------- Corps de bâtiment ---------- */

function crepiBody(ctx, w, h, color, roof) {
  wall(ctx, -w / 2, -h, w, h, color);
  if (roof) pitchedRoof(ctx, -w / 2, -h, w, roof.h, roof.kind, { overhang: 8, hip: roof.hip ?? 0.2, color: roof.color });
}

/**
 * Bâtiment interactif complet. `p` : { w (px), type (permanence, garage_velo, …), style, floors, color, seed }.
 */
export function siteBuilding(ctx, p) {
  const w = p.w, fw = frontWidth(w), style = p.style, r = rng(p.seed || 1);
  const upper = (n, fh) => FRONT_H + n * fh;
  switch (style) {
    case 'haussmann': haussmann(ctx, { ...p, rdc: 'none', rdcH: FRONT_H, floors: p.floors ?? 2 }); break;
    case 'cossu': haussmann(ctx, { ...p, rdc: 'none', rdcH: FRONT_H, floors: p.floors ?? 3, rich: true, color: p.color || '#f1e8d4' }); break;
    case 'faubourg': faubourg(ctx, { ...p, rdc: 'none', rdcH: FRONT_H, floors: p.floors ?? 2 }); break;
    case 'banlieue': immeubleBanlieue(ctx, { ...p, rdc: 'none', floors: p.floors ?? 3 }); break;
    case 'tour': tourCite(ctx, { ...p }); break;
    case 'residence': residenceMer(ctx, { ...p, rdc: 'none', rdcH: FRONT_H, floors: p.floors ?? 3 }); break;
    case 'brique': {
      const h = upper(p.floors ?? 1, 76), brick = '#b0603f';
      wall(ctx, -w / 2, -h, w, h, brick);
      ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h, w, h); ctx.clip(); ctx.strokeStyle = alpha(shade(brick, -0.35), 0.45); ctx.lineWidth = 0.6; ctx.beginPath(); for (let yy = -4; yy > -h; yy -= 4.5) { ctx.moveTo(-w / 2, yy); ctx.lineTo(w / 2, yy); } ctx.stroke(); ctx.restore();
      for (let f = 0; f < (p.floors ?? 1); f++) for (const t of [0.22, 0.5, 0.78]) windowUnit(ctx, -w / 2 + w * t, -FRONT_H - f * 76 - 14, 24, 46, { frame: '#f4f1e8', sill: '#efe9dc', panes: 2, roller: r() < 0.4 ? 0.4 : 0 }, f * 3 + t * 10);
      if (p.roof === 'plat') box(ctx, -w / 2 - 3, -h - 8, w + 6, 8, '#8f4a33', 1.2); else pitchedRoof(ctx, -w / 2, -h, w, 40, 'ardoise', { overhang: 6, hip: 0.1, color: '#5a6168' });
      break;
    }
    case 'crepi': crepiBody(ctx, w, upper(1, 70), p.color || '#efe2b0', { h: 64, kind: 'ardoise', color: '#4a5158', hip: 0.12 });
      for (const t of [0.25, 0.75]) windowUnit(ctx, -w / 2 + w * t, -FRONT_H - 14, 30, 42, { frame: '#f7f6f1', panes: 2, sill: '#d9d6cc' }, t * 10);
      break;
    case 'blanc': crepiBody(ctx, w, upper(1, 72), p.color || '#f6f1e6', { h: 50, kind: 'tuile', hip: 0.3 });
      for (const t of [0.25, 0.75]) windowUnit(ctx, -w / 2 + w * t, -FRONT_H - 14, 26, 44, { shutters: '#5f86a8', frame: '#ffffff', panes: 3, box: true }, t * 10);
      break;
    case 'village': {
      const h = upper(p.floors ?? 1, 74);
      stoneWall(ctx, -w / 2, -h, w, h, p.color || '#d9c8a2', p.seed || 1);
      if ((p.floors ?? 1) > 0) for (const t of [0.25, 0.75]) windowUnit(ctx, -w / 2 + w * t, -FRONT_H - 14, 24, 44, { shutters: '#7f9fb0', frame: '#f1ebdd', panes: 3, sill: '#e3d6b8' }, t * 10);
      pitchedRoof(ctx, -w / 2, -h, w, 48, 'tuile', { overhang: 9, hip: 0.1 });
      break;
    }
    case 'grange': {
      const h = FRONT_H + 44;
      stoneWall(ctx, -w / 2, -h, w, h, '#cdb88e', p.seed || 2);
      ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(0, -h - 62); ctx.lineTo(w / 2, -h); ctx.closePath(); ctx.fillStyle = '#cdb88e'; ctx.fill(); outline(ctx, 1.3);
      gableRoof(ctx, -w / 2, -h, w, 62, 'tuile', { overhang: 9 });
      box(ctx, -12, -h - 34, 24, 22, '#7a5433', 1.1); // lucarne à foin
      break;
    }
    case 'meuliere': {
      const h = upper(1, 76);
      wall(ctx, -w / 2, -h, w, h, '#c9a577');
      ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h, w, h); ctx.clip(); for (let i = 0; i < w * h / 60; i++) { ctx.fillStyle = r.pick(['#b8905f', '#d4b286', '#a8804f', '#c49a68']); ctx.beginPath(); ctx.roundRect(-w / 2 + r() * w, -h + r() * h, 6 + r() * 5, 4 + r() * 3, 2); ctx.fill(); } ctx.restore();
      ctx.beginPath(); ctx.rect(-w / 2, -h, w, h); outline(ctx, 1.5);
      box(ctx, -w / 2, -FRONT_H - 6, w, 7, '#b5553a', 1);
      for (const t of [0.25, 0.75]) windowUnit(ctx, -w / 2 + w * t, -FRONT_H - 16, 26, 46, { shutters: '#6c8c7a', frame: '#f1ebdc', panes: 3, box: true }, t * 10);
      pitchedRoof(ctx, -w / 2, -h, w, 56, 'tuile', { overhang: 14, hip: 0.22, color: '#9f5238' });
      break;
    }
    case 'rotonde': rotonde(ctx, w); break;
    default: faubourg(ctx, { ...p, rdc: 'none', rdcH: FRONT_H });
  }
  (FRONTS[p.type] || permanence)(ctx, fw, p.seed || 1);
}

/** Maison de la radio (sans nom) : grande rotonde de verre et d'aluminium, tour d'antenne en retrait. */
function rotonde(ctx, w) {
  const floors = 6, fh = 46, base = FRONT_H, top = -(base + floors * fh), x = -w / 2;
  // Tour centrale en retrait
  box(ctx, -w * 0.18, top - 160, w * 0.36, 170, '#c9ced2', 1.3);
  for (let yy = top - 150; yy < top; yy += 14) line(ctx, -w * 0.16, yy, w * 0.16, yy, 1, '#9aa3aa');
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#c8cdd0'); g.addColorStop(0.35, '#f1f3f2'); g.addColorStop(1, '#a9b0b5');
  ctx.beginPath(); ctx.rect(x, top, w, -top); ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.4);
  for (let f = 0; f < floors; f++) {
    const y = -base - f * fh;
    ctx.fillStyle = 'rgba(70,90,110,0.78)'; ctx.fillRect(x + 3, y - fh + 9, w - 6, fh - 18);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 18; i++) { const t = (i + 0.5) / 18, xx = -Math.cos(t * Math.PI) * w / 2; ctx.moveTo(xx, y - fh + 9); ctx.lineTo(xx, y - 9); }
    ctx.stroke();
  }
  box(ctx, x - 2, top - 6, w + 4, 6, '#dfe3e5', 1.1);
  box(ctx, x, -base, w, base, '#d9dde0', 1.2);
}

export { lit };

import { CANVAS, CHARACTER_PX, LAYER_BASELINE, MATERIALS, STREET_BASELINE, signRect } from './spec.js';

/**
 * Maquettes « en formes » du décor v3 : couleurs plates, contours noirs, aucune écriture dans la version propre.
 * La version « légende » ajoute la ligne de sol, la règle en unités, une silhouette à l'échelle et les numéros.
 */
const INK = '#2b2f2e';
export const SIGN_CREAM = '#f3e4c5';
const WINDOW = '#56788a';
const DOOR = '#3c4a52';
const GROUND_FLOOR = 300;

const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

function box(ctx, x, y, w, h, fill, line = 4) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.strokeRect(x, y, w, h); }
}
function poly(ctx, points, fill, line = 4) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (line) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke(); }
}
function windows(ctx, x, top, w, bottom, rows, scale = 1) {
  if (rows <= 0) return;
  const rowH = (bottom - top) / rows, cols = Math.max(1, Math.round(w / (110 * scale)));
  const ww = Math.min(52 * scale, w / cols * 0.5), wh = Math.min(rowH * 0.55, 90 * scale);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    box(ctx, x + (c + 0.5) * w / cols - ww / 2, top + r * rowH + (rowH - wh) * 0.45, ww, wh, WINDOW, 2.5 * scale);
}

/** Un immeuble ou une maison : corps, toit et fenêtres. `base` = ligne de sol. */
export function drawBuilding(ctx, { x, w, h, mat, roof, floors }, base, scale = 1) {
  const [wall, roofColor] = MATERIALS[mat] || MATERIALS.beton;
  const top = base - h, roofH = roof === 'plat' ? 18 * scale : roof === 'shed' ? 90 * scale : h * (roof === 'mansarde' ? 0.17 : 0.22);
  box(ctx, x, top + roofH, w, h - roofH, wall, 4 * scale);
  if (roof === 'mansarde') {
    poly(ctx, [[x - 6, top + roofH], [x + w * 0.08, top], [x + w * 0.92, top], [x + w + 6, top + roofH]], roofColor, 4 * scale);
    for (let i = 1; i < 4; i++) box(ctx, x + w * i / 4 - 18 * scale, top + roofH * 0.3, 36 * scale, roofH * 0.55, WINDOW, 2.5 * scale);
    box(ctx, x + w * 0.2, top - 40 * scale, 30 * scale, 40 * scale, '#b86a4a', 3 * scale);
    box(ctx, x + w * 0.72, top - 40 * scale, 30 * scale, 40 * scale, '#b86a4a', 3 * scale);
  } else if (roof === 'tuiles' || roof === 'pignon') {
    poly(ctx, roof === 'pignon' ? [[x - 8, top + roofH], [x + w / 2, top], [x + w + 8, top + roofH]]
      : [[x - 10, top + roofH], [x + w * 0.18, top], [x + w * 0.82, top], [x + w + 10, top + roofH]], roofColor, 4 * scale);
  } else if (roof === 'shed') {
    const teeth = Math.max(2, Math.round(w / 120));
    for (let i = 0; i < teeth; i++) poly(ctx, [[x + i * w / teeth, top + roofH], [x + (i + 1) * w / teeth, top], [x + (i + 1) * w / teeth, top + roofH]], roofColor, 3 * scale);
  } else box(ctx, x - 4, top, w + 8, roofH, roofColor, 3 * scale);
  windows(ctx, x + 12 * scale, top + roofH + 20 * scale, w - 24 * scale, base - GROUND_FLOOR * scale, floors - 1, scale);
}

function drawTower(ctx, { x, w, floors }, base) {
  const [wall, trim] = MATERIALS.tour;
  box(ctx, x, -20, w, base + 20, wall);
  const rowH = (base - GROUND_FLOOR) / Math.min(floors, 8);
  for (let y = base - GROUND_FLOOR - rowH; y > -rowH; y -= rowH) {
    box(ctx, x + 10, y + rowH * 0.62, w - 20, 14, trim, 3);
    windows(ctx, x + 14, y + 6, w - 28, y + rowH * 0.6, 1);
  }
  box(ctx, x + w * 0.7, 60, 40, 40, '#e8e8e8', 3);
}

function drawSite(ctx, element) {
  const [doorW, doorH] = element.door, frameW = doorW + 150;
  box(ctx, element.x - frameW / 2, STREET_BASELINE - GROUND_FLOOR, frameW, GROUND_FLOOR, '#40607a');
  box(ctx, element.x - frameW / 2 + 16, STREET_BASELINE - doorH + 30, (frameW - doorW) / 2 - 26, doorH - 70, WINDOW, 3);
  box(ctx, element.x + doorW / 2 + 10, STREET_BASELINE - doorH + 30, (frameW - doorW) / 2 - 26, doorH - 70, WINDOW, 3);
  box(ctx, element.x - doorW / 2, STREET_BASELINE - doorH, doorW, doorH, DOOR);
  const [sx, sy, sw, sh] = signRect(element);
  box(ctx, sx, sy, sw, sh, SIGN_CREAM, 5);
}

const shopColors = { cafe: '#6e8a74', concept: '#a9c3a4', bio: '#7f9f58', boulangerie: '#b5502e', tabac: '#b73a36', plage: '#3f8fb0', pharmacie: '#2f8a57', luxe: '#2d2d34' };
function drawShop(ctx, { x, w, h, kind }) {
  box(ctx, x, STREET_BASELINE - h, w, h, shopColors[kind] || '#6f7f86');
  box(ctx, x + 14, STREET_BASELINE - h + 60, w - 28, h - 90, WINDOW, 3);
  poly(ctx, [[x - 8, STREET_BASELINE - h + 10], [x + w + 8, STREET_BASELINE - h + 10], [x + w - 6, STREET_BASELINE - h + 55], [x + 6, STREET_BASELINE - h + 55]], '#d9c9a0', 3);
  // Pictogramme peint (jamais une enseigne crème vierge : celles-ci sont réservées aux bâtiments du jeu).
  ctx.beginPath(); ctx.arc(x + w / 2, STREET_BASELINE - h - 26, 22, 0, Math.PI * 2);
  ctx.fillStyle = shopColors[kind] || '#6f7f86'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
}

const lowColors = { haie: '#5f8f45', muret: '#c9b894', grille: '#39403f', cloture: '#a3825a', ble: '#d9b24c', jardiniere: '#8b6a45', talus: '#86a760', palette: '#b08a58', panneau: '#86a760' };
function drawLow(ctx, { x, w, h, kind }) {
  const top = STREET_BASELINE - h, color = lowColors[kind] || '#8f9b8c';
  if (kind === 'grille' || kind === 'cloture') {
    box(ctx, x, STREET_BASELINE - 26, w, 26, kind === 'grille' ? '#c9b894' : '#86a760', 3);
    for (let px = x + 10; px < x + w; px += kind === 'grille' ? 18 : 60) box(ctx, px, top, kind === 'grille' ? 5 : 12, h - 26, color, 2);
    box(ctx, x, top + 14, w, 8, color, 2);
  } else if (kind === 'haie' || kind === 'ble' || kind === 'talus') {
    ctx.beginPath(); ctx.moveTo(x, STREET_BASELINE);
    for (let px = x; px <= x + w; px += 24) ctx.lineTo(px, top + (kind === 'ble' ? 0 : 10) + hash(px) * 16);
    ctx.lineTo(x + w, STREET_BASELINE); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  } else {
    box(ctx, x, top, w, h, color);
    if (kind === 'panneau') { box(ctx, x + w / 2 - 4, top - 140, 8, 140, '#6d7475', 2); box(ctx, x + w / 2 - 38, top - 150, 76, 40, '#3b6fb5', 3); }
  }
}

const objectColors = { passerelle: '#3e7a5a', escalier: '#cdbb95', marche: '#d8c7a3', city: '#7a8f95', caravane: '#f1ede4', cheminee: '#a8553e', rondpoint: '#7ea55a', sculpture: '#8a5a3a', silo: '#b9c0c2', foin: '#d8b45a', vache: '#f0e6d8', serre: '#cfe6ea', monument: '#d6ccb4', clocher: '#d2bd92', tracteur: '#b93a2c', kiosque: '#3f6b4e', hall: '#8fa9b3' };
function drawObject(ctx, { x, w, h, kind }) {
  const top = STREET_BASELINE - h, color = objectColors[kind] || '#9aa39c';
  switch (kind) {
    case 'passerelle':
      ctx.lineWidth = 16; ctx.strokeStyle = color; ctx.beginPath(); ctx.ellipse(x + w / 2, STREET_BASELINE - 60, w / 2, h - 60, 0, Math.PI, 0); ctx.stroke();
      box(ctx, x, STREET_BASELINE - 80, w, 80, '#4f86a0', 3); box(ctx, x + w * 0.42, STREET_BASELINE - 170, w * 0.16, 170, '#3a3f3d', 3);
      break;
    case 'cheminee': case 'silo': case 'clocher': case 'monument':
      box(ctx, x, top + (kind === 'clocher' ? h * 0.25 : kind === 'monument' ? h * 0.1 : 30), w, h - (kind === 'clocher' ? h * 0.25 : kind === 'monument' ? h * 0.1 : 30), color);
      if (kind === 'clocher') poly(ctx, [[x - 10, top + h * 0.25], [x + w / 2, top], [x + w + 10, top + h * 0.25]], '#5d6b78');
      if (kind === 'silo') { ctx.beginPath(); ctx.ellipse(x + w / 2, top + 30, w / 2, 30, 0, Math.PI, 0); ctx.fillStyle = color; ctx.fill(); ctx.stroke(); }
      if (kind === 'monument') poly(ctx, [[x, top + h * 0.1], [x + w / 2, top], [x + w, top + h * 0.1]], color);
      break;
    case 'rondpoint':
      ctx.beginPath(); ctx.ellipse(x + w / 2, STREET_BASELINE - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#bdb6a6'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      break;
    case 'sculpture':
      box(ctx, x + w * 0.3, STREET_BASELINE - 130, w * 0.4, 70, '#cbbfa6', 3);
      ctx.beginPath(); ctx.arc(x + w / 2, top + w / 2, w / 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      break;
    case 'foin':
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + h / 2 + i * (w - h) / 2, STREET_BASELINE - h / 2, h / 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); }
      break;
    case 'marche': {
      const stalls = Math.max(2, Math.round(w / 110));
      for (let i = 0; i < stalls; i++) {
        const sx = x + i * w / stalls;
        box(ctx, sx + 8, STREET_BASELINE - 90, w / stalls - 16, 90, '#b8834a', 3);
        poly(ctx, [[sx, top + 40], [sx + w / stalls, top + 40], [sx + w / stalls - 10, top], [sx + 10, top]], i % 2 ? '#e7e0cf' : '#3f8a5a', 3);
        box(ctx, sx + 12, top + 40, 6, h - 130, '#6b4b33', 2);
      }
      break;
    }
    case 'serre': {
      const count = Math.max(1, Math.round(w / 220));
      for (let i = 0; i < count; i++) {
        const sx = x + i * w / count + 10, sw = w / count - 20;
        ctx.beginPath(); ctx.moveTo(sx, STREET_BASELINE); ctx.lineTo(sx, top + h * 0.35); ctx.quadraticCurveTo(sx + sw / 2, top - h * 0.1, sx + sw, top + h * 0.35); ctx.lineTo(sx + sw, STREET_BASELINE); ctx.closePath();
        ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      }
      box(ctx, x, STREET_BASELINE - 40, w, 40, '#6f8f45', 3);
      break;
    }
    case 'caravane': case 'tracteur': case 'vache':
      box(ctx, x, top, w, h * 0.78, color);
      for (const wx of [x + w * 0.25, x + w * 0.72]) { ctx.beginPath(); ctx.arc(wx, STREET_BASELINE - h * 0.18, h * 0.18, 0, Math.PI * 2); ctx.fillStyle = kind === 'vache' ? color : '#333'; ctx.fill(); ctx.stroke(); }
      break;
    default: box(ctx, x, top, w, h, color);
  }
}

const reperes = {
  sacre_coeur(ctx, x, w, h, base) {
    box(ctx, x + w * 0.2, base - h * 0.55, w * 0.6, h * 0.55, '#f1ede2');
    for (const [cx, r] of [[0.5, 0.2], [0.28, 0.1], [0.72, 0.1]]) { ctx.beginPath(); ctx.ellipse(x + w * cx, base - h * 0.55, w * r, h * r * 1.4, 0, Math.PI, 0); ctx.fillStyle = '#f7f4ec'; ctx.fill(); ctx.stroke(); }
    box(ctx, x + w * 0.84, base - h, w * 0.08, h * 0.6, '#f1ede2');
  },
  basilique_st_denis(ctx, x, w, h, base) {
    box(ctx, x, base - h * 0.55, w, h * 0.55, '#c9bda2'); box(ctx, x + w * 0.1, base - h, w * 0.26, h * 0.45, '#c9bda2');
    poly(ctx, [[x + w * 0.35, base - h * 0.55], [x + w * 0.65, base - h * 0.75], [x + w, base - h * 0.55]], '#8d9aa3');
    ctx.beginPath(); ctx.arc(x + w * 0.6, base - h * 0.35, w * 0.1, 0, Math.PI * 2); ctx.fillStyle = WINDOW; ctx.fill(); ctx.stroke();
  },
  stade(ctx, x, w, h, base) { ctx.beginPath(); ctx.ellipse(x + w / 2, base - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fillStyle = '#eef0f0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); },
  grues(ctx, x, w, h, base) { for (const gx of [x + w * 0.2, x + w * 0.75]) { box(ctx, gx, base - h, 16, h, '#e0a431', 3); box(ctx, gx - w * 0.25, base - h, w * 0.5, 14, '#e0a431', 3); } },
  neige(ctx, x, w, h, base) { poly(ctx, [[x + w * 0.12, base - h * 0.62], [x + w * 0.485, base - h], [x + w * 0.8, base - h * 0.6], [x + w * 0.62, base - h * 0.66], [x + w * 0.48, base - h * 0.56], [x + w * 0.32, base - h * 0.68]], '#f8fbff'); },
  cheminees(ctx, x, w, h, base) { for (let i = 0; i < 3; i++) box(ctx, x + i * w / 3 + 20, base - h * (0.6 + i * 0.15), 24, h * (0.6 + i * 0.15), '#a8553e', 3); },
  village_clocher(ctx, x, w, h, base) {
    for (let i = 0; i < 5; i++) drawBuilding(ctx, { x: x + i * w / 5, w: w / 5 - 6, h: h * 0.3, mat: 'pierre', roof: 'tuiles', floors: 1 }, base, 0.4);
    box(ctx, x + w * 0.45, base - h * 0.75, w * 0.1, h * 0.75, '#d2bd92', 3); poly(ctx, [[x + w * 0.43, base - h * 0.75], [x + w * 0.5, base - h], [x + w * 0.57, base - h * 0.75]], '#5d6b78', 3);
  },
  eoliennes(ctx, x, w, h, base) {
    for (let i = 0; i < 4; i++) {
      const ex = x + (i + 0.5) * w / 4, top = base - h * (0.75 + 0.25 * hash(i)); box(ctx, ex - 5, top, 10, base - top, '#f4f4f0', 2);
      ctx.lineWidth = 7; ctx.strokeStyle = '#f4f4f0'; for (let b = 0; b < 3; b++) { const a = b * 2.094 + i; ctx.beginPath(); ctx.moveTo(ex, top); ctx.lineTo(ex + Math.cos(a) * h * 0.22, top + Math.sin(a) * h * 0.22); ctx.stroke(); }
    }
  },
  mer(ctx, x, w, h, base) {
    box(ctx, x, base - h, w, h, '#3f8fc4', 0);
    for (let i = 0; i < 3; i++) poly(ctx, [[x + w * (0.2 + i * 0.25), base - h * 0.4], [x + w * (0.2 + i * 0.25) + 30, base - h * 0.4], [x + w * (0.2 + i * 0.25) + 12, base - h * 1.1]], '#ffffff', 2);
    box(ctx, x + w * 0.88, base - h * 1.8, 22, h * 1.4, '#f3f0ea', 3);
  },
  invalides(ctx, x, w, h, base) { box(ctx, x, base - h * 0.4, w, h * 0.4, '#e6dcc4'); ctx.beginPath(); ctx.ellipse(x + w / 2, base - h * 0.4, w * 0.28, h * 0.45, 0, Math.PI, 0); ctx.fillStyle = '#d8b24a'; ctx.fill(); ctx.stroke(); },
  tour_eiffel(ctx, x, w, h, base) {
    poly(ctx, [[x, base], [x + w * 0.42, base - h * 0.95], [x + w * 0.58, base - h * 0.95], [x + w, base], [x + w * 0.72, base], [x + w / 2, base - h * 0.2], [x + w * 0.28, base]], '#7a6a58');
    box(ctx, x + w * 0.49, base - h, w * 0.02, h * 0.06, '#7a6a58', 2);
  },
  defense(ctx, x, w, h, base) {
    for (let i = 0; i < 6; i++) box(ctx, x + i * w / 7, base - h * (0.5 + hash(i, 3) * 0.5), w / 9, h * (0.5 + hash(i, 3) * 0.5), i % 2 ? '#9fbfd0' : '#c3d3dc', 3);
    box(ctx, x + w * 0.83, base - h * 0.45, w * 0.17, h * 0.45, '#eeeeea'); box(ctx, x + w * 0.87, base - h * 0.37, w * 0.09, h * 0.37, 'rgba(0,0,0,0)', 3);
  },
  canal(ctx, x, w, h, base) { box(ctx, x, base - 40, w, 40, '#4f86a0', 3); ctx.lineWidth = 10; ctx.strokeStyle = '#3e7a5a'; ctx.beginPath(); ctx.ellipse(x + w / 2, base - 40, w * 0.25, h - 40, 0, Math.PI, 0); ctx.stroke(); },
  caravanes(ctx, x, w, h, base) { for (let i = 0; i < 2; i++) box(ctx, x + i * w / 2, base - h, w / 2 - 10, h, '#f1ede4', 3); },
  jardins_ouvriers(ctx, x, w, h, base) { for (let i = 0; i < 4; i++) box(ctx, x + i * w / 4, base - h, w / 5, h, i % 2 ? '#7c9a4e' : '#9b7b55', 3); },
  ferme(ctx, x, w, h, base) { drawBuilding(ctx, { x, w: w * 0.55, h, mat: 'pierre', roof: 'tuiles', floors: 1 }, base, 0.5); drawBuilding(ctx, { x: x + w * 0.6, w: w * 0.4, h: h * 0.8, mat: 'bois', roof: 'pignon', floors: 1 }, base, 0.5); },
  plage(ctx, x, w, h, base) { box(ctx, x, base - h, w, h * 0.35, '#3f8fc4', 0); box(ctx, x, base - h * 0.65, w, h * 0.65, '#e8d39a', 3); for (let i = 0; i < 6; i++) box(ctx, x + 20 + i * w / 6, base - h * 0.55, 34, 50, i % 2 ? '#d9534f' : '#ffffff', 2); },
  trocadero(ctx, x, w, h, base) { box(ctx, x, base - 40, w, 40, '#4f86a0', 3); box(ctx, x + w * 0.1, base - h, w * 0.8, h * 0.4, '#e6dcc4'); box(ctx, x + w * 0.2, base - 70, w * 0.6, 30, '#cfc6b0', 3); },
};

function drawGroup(ctx, { x, w, h, mat, count }, base, seed) {
  for (let i = 0; i < count; i++) {
    const bx = x + i * w / count, bw = Math.min(w / count * (0.8 + hash(seed, i) * 0.3), x + w - bx), bh = h * (0.55 + hash(i, seed) * 0.45);
    drawBuilding(ctx, { x: bx, w: bw, h: bh, mat, roof: ['tour', 'beton', 'moderne', 'hangar'].includes(mat) ? 'plat' : mat === 'usine' ? 'shed' : mat === 'haussmann' ? 'mansarde' : 'tuiles', floors: Math.max(1, Math.round(bh / 110)) }, base, 0.45);
  }
}

function legendText(ctx, text, x, y, color = '#12324a') {
  ctx.font = '600 22px system-ui, sans-serif'; ctx.textBaseline = 'top';
  const width = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(x - 4, y - 3, width + 8, 28);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function drawLegendFrame(ctx, baseline, title) {
  ctx.save();
  for (let x = 0; x <= CANVAS.width; x += 64) { ctx.fillStyle = x % 384 ? '#9aa' : '#c33'; ctx.fillRect(x - 1, baseline + 4, 2, x % 384 ? 12 : 26); }
  ctx.setLineDash([14, 8]); ctx.strokeStyle = '#c33'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, baseline); ctx.lineTo(CANVAS.width, baseline); ctx.stroke(); ctx.setLineDash([]);
  legendText(ctx, title, 16, 14);
  ctx.restore();
}

/** Silhouette d'un personnage (200 px) pour juger l'échelle, uniquement dans la légende. */
function drawScaleFigure(ctx, x, baseline) {
  ctx.save(); ctx.globalAlpha = 0.75; ctx.fillStyle = '#c33';
  ctx.beginPath(); ctx.arc(x, baseline - CHARACTER_PX + 32, 32, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 30, baseline - CHARACTER_PX + 66, 60, 80); ctx.fillRect(x - 26, baseline - 56, 20, 56); ctx.fillRect(x + 6, baseline - 56, 20, 56);
  ctx.restore();
}

/** Dessine une rue (image de premier plan) ; `legend` ajoute les repères humains. */
export function drawStreetBlockout(ctx, spec, { legend = false } = {}) {
  ctx.save(); ctx.lineJoin = 'round';
  const order = { bas: 0, tour: 1, bat: 2, objet: 3, vitrine: 4, site: 5, place: 6, arbre: 7 };
  const elements = [...spec.elements].sort((a, b) => order[a.t] - order[b.t] || (a.t === 'objet' && b.t === 'objet' ? b.h - a.h : 0));
  // Les grands objets (passerelle, cheminée, clocher) passent derrière les bâtiments voisins.
  for (const element of elements.filter(e => e.t === 'objet' && ['passerelle', 'cheminee', 'clocher', 'silo'].includes(e.kind))) drawObject(ctx, element);
  for (const element of elements) {
    if (element.t === 'bas') drawLow(ctx, element);
    else if (element.t === 'tour') drawTower(ctx, element, STREET_BASELINE);
    else if (element.t === 'bat') drawBuilding(ctx, element, STREET_BASELINE);
    else if (element.t === 'objet' && !['passerelle', 'cheminee', 'clocher', 'silo'].includes(element.kind)) drawObject(ctx, element);
    else if (element.t === 'vitrine') drawShop(ctx, element);
    else if (element.t === 'site') drawSite(ctx, element);
  }
  if (legend) {
    drawLegendFrame(ctx, STREET_BASELINE, spec.title);
    drawScaleFigure(ctx, 60, STREET_BASELINE);
    elements.forEach((element, index) => {
      const label = `${index + 1}. ${element.t === 'site' ? element.site.replace('site:', '') : element.kind || element.mat || element.t}`;
      if (element.t === 'place') {
        ctx.save(); ctx.setLineDash([12, 8]); ctx.strokeStyle = '#1b6b3a'; ctx.lineWidth = 4;
        ctx.strokeRect(element.x, STREET_BASELINE - 420, element.w, 420); ctx.restore();
        legendText(ctx, `${index + 1}. place libre (meeting au centre)`, element.x + 8, STREET_BASELINE - 410, '#1b6b3a');
      } else if (element.t === 'arbre') {
        ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = '#1b6b3a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(element.x, STREET_BASELINE - element.h * 0.7, element.h * 0.35, element.h * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        legendText(ctx, `${index + 1}. arbre du jeu (ne pas peindre)`, element.x - 120, STREET_BASELINE - element.h * 0.7, '#1b6b3a');
      } else {
        const x = element.t === 'site' ? element.x - 90 : element.x + 6;
        const y = element.t === 'site' ? signRect(element)[1] - 34 : STREET_BASELINE - (element.h || 300) + (element.t === 'bat' ? 60 : -30);
        legendText(ctx, label, Math.max(4, Math.min(CANVAS.width - 260, x)), Math.max(48, y), element.t === 'site' ? '#8a1c1c' : '#12324a');
      }
    });
  }
  ctx.restore();
}

/** Dessine un plan intermédiaire ou lointain. Le sol sous la ligne y = 1000 est dessiné par le jeu, en continu. */
export function drawLayerBlockout(ctx, spec, layer, { legend = false } = {}) {
  ctx.save(); ctx.lineJoin = 'round';
  const base = LAYER_BASELINE;
  spec.elements.forEach((element, index) => {
    if (element.t === 'relief') poly(ctx, element.points, element.color, 4);
    else if (element.t === 'groupe') drawGroup(ctx, element, base, index + 1);
    else if (element.t === 'repere') reperes[element.kind]?.(ctx, element.x, element.w, element.h, base);
  });
  if (legend) {
    drawLegendFrame(ctx, base, spec.title);
    for (let i = 1; i < 3; i++) { ctx.fillStyle = '#c33'; ctx.fillRect(i * CANVAS.width / 3 - 2, 60, 4, base - 60); }
    ['A', 'B', 'C'].forEach((zone, i) => legendText(ctx, `sous-zone ${zone}`, (i + 0.5) * CANVAS.width / 3 - 60, 60, '#8a1c1c'));
    spec.elements.forEach((element, index) => legendText(ctx, `${index + 1}. ${element.kind || element.mat || element.t}`,
      Math.min(CANVAS.width - 240, (element.x ?? element.points[1][0]) + 8), 110 + (index % 4) * 34));
  }
  ctx.restore();
}

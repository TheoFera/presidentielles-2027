import { INK, alpha, box, glass, hash, line, mix, outline, rng, shade } from './kit.js';
import { eglise, eolienne } from './lointain.js';

/**
 * Plans lointains : reliefs continus (définis en fonction de la position dans le monde, donc sans couture),
 * mer, silhouettes de villes et monuments. Les couleurs tirent vers la brume du ciel avec la distance.
 */

/* ---------- Bruit et reliefs ---------- */

const smooth = t => t * t * (3 - 2 * t);
/** Bruit de valeur 1D lissé, périodique sur la longueur du monde. */
export function noise1(x, seed = 0, period = 432) {
  const i = Math.floor(x), f = x - i, a = hash(((i % period) + period) % period, seed), b = hash((((i + 1) % period) + period) % period, seed);
  return a + (b - a) * smooth(f);
}
export function fbm(x, seed = 0, octaves = 4) {
  let v = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { v += amp * noise1(x * freq, seed + o * 17, 432 * freq); norm += amp; amp *= 0.5; freq *= 2; }
  return v / norm;
}
/** Enveloppe douce : 0 hors de [a, d], monte de a à b, plateau jusqu'à c, redescend jusqu'à d. */
export function envelope(x, a, b, c, d) {
  if (x <= a || x >= d) return 0;
  if (x < b) return smooth((x - a) / (b - a));
  if (x > c) return smooth((d - x) / (d - c));
  return 1;
}

/**
 * Relief : `height(x)` en px au-dessus de la ligne de sol du plan, pour une position monde x (unités).
 * Dessiné entre les positions monde x0 et x1, du profil jusqu'au bas de la tuile.
 */
export function drawTerrain(ctx, env, t) {
  const { toPx, x0, x1, bottom } = env, step = 2 / env.pxPerUnit;
  const from = Math.max(x0, t.x0), to = Math.min(x1, t.x1);
  if (from >= to) return;
  const pts = [];
  for (let x = from; x <= to + step; x += step) pts.push([toPx(Math.min(x, to)), -t.height(Math.min(x, to))]);
  ctx.beginPath(); ctx.moveTo(pts[0][0], bottom);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.lineTo(pts[pts.length - 1][0], bottom); ctx.closePath();
  const top = Math.min(...pts.map(p => p[1]));
  const g = ctx.createLinearGradient(0, top, 0, bottom * 0.2);
  g.addColorStop(0, t.top || t.color); g.addColorStop(1, t.color);
  ctx.fillStyle = g; ctx.fill();
  if (t.snow) { // neiges éternelles : au-dessus d'une fraction de la hauteur locale
    ctx.save(); ctx.clip();
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) { const [px, py] = pts[i]; const h = -py, line = h > t.snow ? -(t.snow + (h - t.snow) * 0.45 + 6 * noise1(px * 0.2, 5)) : -h + 1; if (i === 0) ctx.moveTo(px, line); else ctx.lineTo(px, line); }
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] - 2);
    ctx.closePath(); ctx.fillStyle = t.snowColor || '#f3f6f8'; ctx.fill();
    // Faces à l'ombre (côté droit des pentes)
    ctx.fillStyle = 'rgba(70,90,120,0.18)';
    for (let i = 1; i < pts.length; i++) if (pts[i][1] > pts[i - 1][1]) ctx.fillRect(pts[i][0] - 1, pts[i][1], 2.2, bottom - pts[i][1]);
    ctx.restore();
  }
  if (t.line !== false) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); outline(ctx, t.lineWidth || 1.1, t.ink || shade(t.color, -0.35)); }
  if (t.texture === 'bocage' || t.texture === 'champs') fieldsTexture(ctx, pts, bottom, t);
  if (t.texture === 'forest') forestTexture(ctx, pts, bottom, t);
}

function fieldsTexture(ctx, pts, bottom, t) {
  ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0], bottom); pts.forEach(([px, py]) => ctx.lineTo(px, py)); ctx.lineTo(pts[pts.length - 1][0], bottom); ctx.closePath(); ctx.clip();
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0], r = rng(Math.round(x0));
  const colors = t.fields || ['#b9c26a', '#d8c070', '#8fb35a', '#c9b25a', '#a6c16b'];
  for (let band = 0; band < 5; band++) {
    const y = -t.base * 0 + (bottom - 10) * band / 5 - 40 + band * 8;
    for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) {
      const wv = 60 + hash(x, band) * 30;
      ctx.fillStyle = colors[Math.floor(hash(x, band + 3) * colors.length)]; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + wv, y + 4); ctx.lineTo(x + wv, y + 30); ctx.lineTo(x, y + 28); ctx.closePath(); ctx.fill();
      if (t.texture === 'bocage') { ctx.globalAlpha = 0.9; ctx.fillStyle = '#4f6f3a'; for (let k = 0; k < wv; k += 5) { ctx.beginPath(); ctx.arc(x + k, y + 2 + k * 4 / wv, 3 + hash(x + k, 2) * 2, 0, Math.PI * 2); ctx.fill(); } }
    }
  }
  ctx.globalAlpha = 1; ctx.restore(); void r;
}
function forestTexture(ctx, pts, bottom, t) {
  ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0], bottom); pts.forEach(([px, py]) => ctx.lineTo(px, py)); ctx.lineTo(pts[pts.length - 1][0], bottom); ctx.closePath(); ctx.clip();
  for (let i = 0; i < pts.length; i += 3) {
    const [px, py] = pts[i];
    ctx.fillStyle = shade(t.color, hash(px, 1) * 0.2 - 0.1); ctx.beginPath(); ctx.arc(px, py + 5 + hash(px, 2) * 6, 5 + hash(px, 3) * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ---------- Mer ---------- */

/** Mer jusqu'à l'horizon, avec reflets, voiliers et écume. `height` = hauteur de l'horizon au-dessus du sol du plan. */
export function drawSea(ctx, env, s) {
  const { toPx, x0, x1, bottom } = env;
  const from = Math.max(x0, s.x0), to = Math.min(x1, s.x1);
  if (from >= to) return;
  const a = toPx(from), b = toPx(to), horizon = -s.horizon;
  const g = ctx.createLinearGradient(0, horizon, 0, bottom);
  g.addColorStop(0, '#8fb9cf'); g.addColorStop(0.35, '#4f8fb5'); g.addColorStop(1, '#2f6f98');
  ctx.fillStyle = g; ctx.fillRect(a, horizon, b - a, bottom - horizon);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
  for (let y = horizon + 4; y < bottom; y += 5 + (y - horizon) * 0.08) {
    ctx.beginPath();
    for (let x = Math.floor(a / 23) * 23; x < b; x += 23) { const k = hash(x, Math.round(y)); if (k < 0.45) { ctx.moveTo(x, y); ctx.lineTo(x + 6 + k * 10, y); } }
    ctx.stroke();
  }
  ctx.strokeStyle = '#e9f3f7'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a, horizon); ctx.lineTo(b, horizon); ctx.stroke();
}

export function voilier(ctx, p) {
  const s = p.scale || 1; ctx.save(); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(14, -4); ctx.lineTo(10, 2); ctx.lineTo(-10, 2); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); outline(ctx, 0.8 / s);
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -34); ctx.lineTo(12, -6); ctx.closePath(); ctx.fillStyle = '#fbfbf7'; ctx.fill(); outline(ctx, 0.8 / s);
  ctx.beginPath(); ctx.moveTo(-1, -30); ctx.lineTo(-11, -6); ctx.lineTo(-1, -6); ctx.closePath(); ctx.fillStyle = p.color || '#e8622c'; ctx.fill(); outline(ctx, 0.8 / s);
  ctx.restore();
}

export function phare(ctx, p) {
  const s = p.scale || 1; ctx.save(); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-6, -80); ctx.lineTo(6, -80); ctx.lineTo(9, 0); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); outline(ctx, 1 / s);
  ctx.save(); ctx.clip(); ctx.fillStyle = '#c8352b'; for (let y = -12; y > -80; y -= 24) ctx.fillRect(-10, y - 10, 20, 10); ctx.restore();
  box(ctx, -8, -92, 16, 12, '#f5df8a', 1 / s); box(ctx, -10, -82, 20, 3, '#333', 0.8 / s);
  ctx.beginPath(); ctx.moveTo(-8, -92); ctx.lineTo(0, -100); ctx.lineTo(8, -92); ctx.closePath(); ctx.fillStyle = '#c8352b'; ctx.fill(); outline(ctx, 1 / s);
  // Jetée
  box(ctx, -60, -4, 120, 6, '#b9b2a2', 1 / s);
  ctx.restore();
}

/* ---------- Monuments et silhouettes de villes ---------- */

export function tourEiffel(ctx, p) {
  const h = p.h || 220, c = p.color || '#7a6a58';
  // Silhouette en treillis : quatre montants courbes, arches, deux plateformes, flèche ; ajouré (jamais plein).
  const leg = t => h * 0.2 * Math.pow(1 - t, 2.1) + h * 0.012;
  const edge = (side, t0, t1) => { for (let t = t0; t <= t1 + 1e-6; t += 0.02) ctx.lineTo(side * leg(t), -t * h); };
  ctx.save(); ctx.fillStyle = alpha(c, 0.9); ctx.strokeStyle = c; ctx.lineJoin = 'round';
  // Pieds (deux montants de chaque côté avec arche entre eux)
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * leg(0), 0); edge(side, 0, 0.26); ctx.lineTo(side * leg(0.26) * 0.55, -0.26 * h); ctx.quadraticCurveTo(side * leg(0.1) * 0.55, -0.1 * h, side * leg(0) * 0.62, 0); ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(-leg(0.1) * 0.62, -0.02 * h); ctx.quadraticCurveTo(0, -0.24 * h, leg(0.1) * 0.62, -0.02 * h); ctx.lineWidth = h * 0.012; ctx.stroke(); // grande arche
  // Étage intermédiaire et fût
  ctx.beginPath(); ctx.moveTo(-leg(0.26), -0.26 * h); edge(-1, 0.26, 0.5); ctx.lineTo(leg(0.5), -0.5 * h); for (let t = 0.5; t >= 0.26; t -= 0.02) ctx.lineTo(leg(t), -t * h); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-leg(0.5), -0.5 * h); edge(-1, 0.5, 0.95); ctx.lineTo(leg(0.95), -0.95 * h); for (let t = 0.95; t >= 0.5; t -= 0.02) ctx.lineTo(leg(t), -t * h); ctx.closePath(); ctx.fill();
  // Croisillons clairs (effet de treillis)
  ctx.strokeStyle = alpha('#e8e0cf', 0.55); ctx.lineWidth = Math.max(0.6, h * 0.004); ctx.beginPath();
  for (let t = 0.04; t < 0.92; t += 0.045) { const w0 = leg(t), w1 = leg(t + 0.045); ctx.moveTo(-w0 * 0.9, -t * h); ctx.lineTo(w1 * 0.9, -(t + 0.045) * h); ctx.moveTo(w0 * 0.9, -t * h); ctx.lineTo(-w1 * 0.9, -(t + 0.045) * h); }
  ctx.stroke();
  // Plateformes et antenne
  ctx.fillStyle = c; for (const t of [0.26, 0.5]) ctx.fillRect(-leg(t) - h * 0.02, -t * h - h * 0.012, leg(t) * 2 + h * 0.04, h * 0.018);
  ctx.fillRect(-h * 0.008, -h * 1.04, h * 0.016, h * 0.09);
  ctx.restore();
}

export function grandeArche(ctx, p) {
  const s = p.h || 60, c = p.color || '#dfe5ea';
  box(ctx, -s * 0.55, -s, s * 1.1, s, c, 0.9, shade(c, -0.4));
  ctx.fillStyle = mix(c, '#9fb3c6', 0.5); ctx.fillRect(-s * 0.36, -s * 0.8, s * 0.72, s * 0.8);
}

/** Tours de La Défense : verre bleuté, tailles variées. */
export function laDefense(ctx, p) {
  const r = rng(p.seed || 21), w = p.w || 260;
  for (let i = 0; i < 11; i++) {
    const tw = 16 + r() * 22, th = 70 + r() * 150 * (1 - Math.abs(i - 5) / 8), tx = -w / 2 + i * w / 11 + r() * 8;
    const color = r.pick(['#9fb7c9', '#b6c7d3', '#8aa3b8', '#c9d4db', '#a9b8a6']);
    ctx.beginPath();
    if (r() < 0.3) { ctx.moveTo(tx, 0); ctx.lineTo(tx, -th); ctx.lineTo(tx + tw * 0.6, -th - 14); ctx.lineTo(tx + tw, -th + 4); ctx.lineTo(tx + tw, 0); }
    else ctx.rect(tx, -th, tw, th);
    const g = ctx.createLinearGradient(tx, 0, tx + tw, 0); g.addColorStop(0, shade(color, 0.12)); g.addColorStop(1, shade(color, -0.12));
    ctx.fillStyle = g; ctx.fill(); outline(ctx, 0.8, shade(color, -0.45));
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let y = -8; y > -th; y -= 6) { ctx.moveTo(tx + 1, y); ctx.lineTo(tx + tw - 1, y); } ctx.stroke();
  }
  ctx.save(); ctx.translate(p.archeX ?? w * 0.1, 0); grandeArche(ctx, { h: 52 }); ctx.restore();
}

/** Sacré-Cœur sur sa butte. */
export function sacreCoeur(ctx, p) {
  const s = p.scale || 1, c = p.color || '#f1ede3';
  ctx.save(); ctx.scale(s, s);
  // Butte arborée
  ctx.beginPath(); ctx.moveTo(-130, 0); ctx.quadraticCurveTo(-60, -52, 0, -56); ctx.quadraticCurveTo(60, -52, 130, 0); ctx.closePath(); ctx.fillStyle = p.hill || '#6f8f5a'; ctx.fill(); outline(ctx, 1 / s, shade(p.hill || '#6f8f5a', -0.4));
  const body = (x, y, w, h) => box(ctx, x, y, w, h, c, 1 / s, '#8a8574');
  body(-38, -96, 76, 42);
  const dome = (cx, base, r, tall) => { ctx.beginPath(); ctx.moveTo(cx - r, base); ctx.bezierCurveTo(cx - r, base - tall * 0.9, cx - r * 0.2, base - tall, cx, base - tall - 6); ctx.bezierCurveTo(cx + r * 0.2, base - tall, cx + r, base - tall * 0.9, cx + r, base); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); outline(ctx, 1 / s, '#8a8574'); ctx.fillRect(cx - 1, base - tall - 14, 2, 9); };
  body(-18, -128, 36, 32); dome(0, -128, 20, 38);
  for (const dx of [-30, 30]) { body(dx - 7, -112, 14, 16); dome(dx, -112, 8, 16); }
  body(40, -150, 14, 54); dome(47, -150, 7, 16); // campanile
  ctx.restore();
}

/** Basilique de Saint-Denis : façade gothique à tour unique. */
export function basilique(ctx, p) {
  // Basilique de Saint-Denis : façade gothique à trois portails, rose, tour nord à flèche, contreforts, nef derrière.
  const s = p.scale || 1, c = p.color || '#d8ccb2', dk = shade(c, -0.22), lw = 1 / s;
  ctx.save(); ctx.scale(s, s);
  // Nef et toit d'ardoise en arrière
  box(ctx, 34, -86, 90, 86, shade(c, -0.06), lw);
  ctx.beginPath(); ctx.moveTo(30, -86); ctx.lineTo(79, -120); ctx.lineTo(128, -86); ctx.closePath(); ctx.fillStyle = '#6c757c'; ctx.fill(); outline(ctx, lw);
  for (let i = 0; i < 4; i++) { const wx = 46 + i * 20; ctx.beginPath(); ctx.moveTo(wx - 5, -22); ctx.lineTo(wx - 5, -58); ctx.quadraticCurveTo(wx, -68, wx + 5, -58); ctx.lineTo(wx + 5, -22); ctx.closePath(); ctx.fillStyle = '#58687a'; ctx.fill(); }
  for (let i = 0; i < 5; i++) box(ctx, 38 + i * 20, -92, 6, 92, shade(c, 0.05), 0.6 * lw); // arcs-boutants simplifiés
  // Façade occidentale
  box(ctx, -46, -118, 92, 118, c, lw);
  ctx.fillStyle = 'rgba(40,28,18,0.1)'; ctx.fillRect(10, -118, 36, 118);
  for (const bx of [-46, -16, 14, 40]) box(ctx, bx, -122, 6, 122, shade(c, 0.08), 0.7 * lw); // contreforts
  for (const [dx, pw, ph] of [[-31, 18, 40], [0, 22, 48], [29, 18, 40]]) { // portails en arc brisé, voussures
    for (let k = 0; k < 3; k++) { const ww = pw - k * 5, hh = ph - k * 5; ctx.beginPath(); ctx.moveTo(dx - ww / 2, 0); ctx.lineTo(dx - ww / 2, -hh * 0.55); ctx.quadraticCurveTo(dx - ww / 2, -hh, dx, -hh - 4); ctx.quadraticCurveTo(dx + ww / 2, -hh, dx + ww / 2, -hh * 0.55); ctx.lineTo(dx + ww / 2, 0); ctx.closePath(); ctx.fillStyle = k === 2 ? '#4d3c30' : shade(c, -0.08 - k * 0.07); ctx.fill(); outline(ctx, 0.6 * lw); }
  }
  box(ctx, -46, -60, 92, 5, shade(c, 0.1), 0.7 * lw); // galerie
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-41 + i * 10, -60); ctx.lineTo(-41 + i * 10, -70); ctx.quadraticCurveTo(-37 + i * 10, -75, -33 + i * 10, -70); ctx.lineTo(-33 + i * 10, -60); ctx.fillStyle = dk; ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, -92, 15, 0, Math.PI * 2); ctx.fillStyle = '#4f6178'; ctx.fill(); outline(ctx, lw); // rose
  ctx.strokeStyle = shade(c, 0.15); ctx.lineWidth = 1.2 * lw; ctx.beginPath(); for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; ctx.moveTo(0, -92); ctx.lineTo(Math.cos(t) * 14, -92 + Math.sin(t) * 14); } ctx.stroke();
  box(ctx, -48, -124, 96, 6, shade(c, 0.1), lw); // corniche crénelée
  for (let i = 0; i < 12; i++) box(ctx, -46 + i * 8, -130, 4, 6, shade(c, 0.05), 0.5 * lw);
  // Tour nord à baies géminées et flèche
  box(ctx, -46, -200, 40, 82, c, lw); ctx.fillStyle = 'rgba(40,28,18,0.1)'; ctx.fillRect(-20, -200, 14, 82);
  for (const wx of [-36, -18]) { ctx.beginPath(); ctx.moveTo(wx - 5, -130); ctx.lineTo(wx - 5, -176); ctx.quadraticCurveTo(wx, -186, wx + 5, -176); ctx.lineTo(wx + 5, -130); ctx.closePath(); ctx.fillStyle = '#3f4a52'; ctx.fill(); }
  for (const qx of [-46, -10]) { ctx.beginPath(); ctx.moveTo(qx, -200); ctx.lineTo(qx + 2, -214); ctx.lineTo(qx + 4, -200); ctx.fillStyle = c; ctx.fill(); outline(ctx, 0.6 * lw); } // pinacles
  ctx.beginPath(); ctx.moveTo(-44, -200); ctx.lineTo(-26, -262); ctx.lineTo(-8, -200); ctx.closePath(); ctx.fillStyle = shade(c, -0.05); ctx.fill(); outline(ctx, lw);
  ctx.strokeStyle = dk; ctx.lineWidth = 0.7 * lw; ctx.beginPath(); for (let y = -210; y > -255; y -= 9) { const hw = (y + 262) / 62 * 18; ctx.moveTo(-26 - hw, y); ctx.lineTo(-26 + hw, y); } ctx.stroke();
  line(ctx, -26, -262, -26, -272, 1.2 * lw);
  ctx.restore();
}

/** Mosquée contemporaine : dôme, minaret carré, façade claire. */
export function mosquee(ctx, p) {
  const s = p.scale || 1, c = p.color || '#efe8da';
  ctx.save(); ctx.scale(s, s);
  box(ctx, -60, -70, 120, 70, c, 1 / s);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-48 + i * 24, -14); ctx.lineTo(-48 + i * 24, -44); ctx.quadraticCurveTo(-42 + i * 24, -56, -36 + i * 24, -44); ctx.lineTo(-36 + i * 24, -14); ctx.closePath(); ctx.fillStyle = '#6f8fa8'; ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, -70, 30, Math.PI, 0); ctx.fillStyle = '#9fb8c8'; ctx.fill(); outline(ctx, 1 / s);
  ctx.fillStyle = '#d9b84a'; ctx.fillRect(-1, -110, 2, 10);
  box(ctx, 72, -150, 18, 150, c, 1 / s); box(ctx, 70, -156, 22, 8, '#9fb8c8', 1 / s);
  ctx.beginPath(); ctx.moveTo(72, -156); ctx.lineTo(81, -172); ctx.lineTo(90, -156); ctx.fillStyle = '#9fb8c8'; ctx.fill(); outline(ctx, 1 / s);
  ctx.restore();
}

/** Grands Moulins de Pantin (brique et tours pointues, au bord du canal de l'Ourcq). */
export function grandsMoulins(ctx, p) {
  const s = p.scale || 1; ctx.save(); ctx.scale(s, s);
  box(ctx, -70, -90, 140, 90, '#c98a6a', 1 / s);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) box(ctx, -60 + i * 22, -80 + j * 26, 12, 18, '#6f8292', 0.6 / s);
  box(ctx, -20, -150, 40, 60, '#d99a78', 1 / s);
  ctx.beginPath(); ctx.moveTo(-24, -150); ctx.lineTo(0, -196); ctx.lineTo(24, -150); ctx.closePath(); ctx.fillStyle = '#6c7a86'; ctx.fill(); outline(ctx, 1 / s);
  for (const dx of [-60, 60]) { box(ctx, dx - 10, -118, 20, 28, '#d99a78', 0.8 / s); ctx.beginPath(); ctx.moveTo(dx - 12, -118); ctx.lineTo(dx, -140); ctx.lineTo(dx + 12, -118); ctx.closePath(); ctx.fillStyle = '#6c7a86'; ctx.fill(); outline(ctx, 0.8 / s); }
  ctx.restore();
}

/** Invalides / Grand Palais : dômes dorés et verrières. */
export function domeDore(ctx, p) {
  const s = p.scale || 1; ctx.save(); ctx.scale(s, s);
  box(ctx, -40, -46, 80, 46, '#e9e1cf', 1 / s); box(ctx, -18, -78, 36, 32, '#e9e1cf', 1 / s);
  ctx.beginPath(); ctx.moveTo(-18, -78); ctx.bezierCurveTo(-18, -110, 18, -110, 18, -78); ctx.closePath(); ctx.fillStyle = '#d7b24a'; ctx.fill(); outline(ctx, 1 / s);
  ctx.fillStyle = '#d7b24a'; ctx.fillRect(-2, -122, 4, 18);
  ctx.restore();
}
export function grandPalais(ctx, p) {
  const s = p.scale || 1; ctx.save(); ctx.scale(s, s);
  box(ctx, -80, -40, 160, 40, '#ece5d4', 1 / s);
  ctx.beginPath(); ctx.moveTo(-70, -40); ctx.quadraticCurveTo(0, -84, 70, -40); ctx.closePath(); ctx.fillStyle = 'rgba(150,190,200,0.85)'; ctx.fill(); outline(ctx, 1 / s);
  ctx.strokeStyle = 'rgba(90,110,120,0.6)'; ctx.lineWidth = 0.7 / s; ctx.beginPath(); for (let i = -60; i <= 60; i += 10) { ctx.moveTo(i, -40); ctx.lineTo(i * 0.5, -40 - 38 * (1 - (i / 70) ** 2)); } ctx.stroke();
  ctx.fillStyle = '#b7c7cc'; ctx.fillRect(-2, -92, 4, 12); ctx.fillStyle = '#2f5aa0'; ctx.fillRect(2, -92, 8, 5);
  ctx.restore();
}

/** Silhouette de toits et d'immeubles lointains (ville ou banlieue), couleur déjà brumeuse. */
export function skyline(ctx, p) {
  const r = rng(p.seed || 31), w = p.w, c = p.color || '#a9b4bd';
  let x = -w / 2;
  while (x < w / 2) {
    const bw = 18 + r() * 30, kind = p.kind || 'paris';
    const bh = kind === 'cite' ? (r() < 0.35 ? 90 + r() * 70 : 30 + r() * 30) : kind === 'village' ? 16 + r() * 16 : 30 + r() * 26;
    const col = shade(c, r() * 0.12 - 0.06);
    ctx.beginPath(); ctx.rect(x, -bh, bw, bh); ctx.fillStyle = col; ctx.fill();
    if (kind === 'paris') { ctx.beginPath(); ctx.moveTo(x - 1, -bh); ctx.lineTo(x + 4, -bh - 9); ctx.lineTo(x + bw - 4, -bh - 9); ctx.lineTo(x + bw + 1, -bh); ctx.fillStyle = shade(c, -0.12); ctx.fill(); ctx.fillStyle = shade(c, -0.08); for (let k = x + 4; k < x + bw - 4; k += 8) ctx.fillRect(k, -bh - 14, 3, 5); }
    if (kind === 'village') { ctx.beginPath(); ctx.moveTo(x - 2, -bh); ctx.lineTo(x + bw / 2, -bh - 10); ctx.lineTo(x + bw + 2, -bh); ctx.fillStyle = mix('#b0603d', c, 0.5); ctx.fill(); }
    ctx.fillStyle = shade(c, -0.18); ctx.globalAlpha = 0.5;
    for (let yy = -bh + 6; yy < -4; yy += kind === 'cite' ? 6 : 9) for (let k = x + 3; k < x + bw - 3; k += 5) if (hash(k, yy) < 0.7) ctx.fillRect(k, yy, 2, 2.5);
    ctx.globalAlpha = 1;
    x += bw - 1;
  }
}

/** Rangée d'arbres lointains (lisière, parc, bois) : boules de feuillage brumeuses. */
export function treeLine(ctx, p) {
  const r = rng(p.seed || 41), w = p.w, c = p.color || '#6f8f5a', h = p.h || 40;
  for (let x = -w / 2; x < w / 2; x += 7 + r() * 6) {
    const rad = h * (0.35 + r() * 0.35), cy = -rad * (0.9 + r() * 0.4);
    ctx.fillStyle = shade(c, r() * 0.16 - 0.08);
    if (p.cypress && r() < 0.25) { ctx.beginPath(); ctx.ellipse(x, -h * 0.7, 5, h * 0.7, 0, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.arc(x, cy, rad, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = shade(c, -0.1); ctx.fillRect(-w / 2, -h * 0.35, w, h * 0.35);
}

/** Clocher de village au loin, sur sa colline. */
export function villageLointain(ctx, p) {
  const s = p.scale || 0.5, c = p.color || '#cdbb98';
  ctx.save();
  skyline(ctx, { w: 140 * s * 2, kind: 'village', color: c, seed: p.seed });
  ctx.translate(-10 * s, 0); eglise(ctx, { scale: s, color: c, roof: mix('#7a8088', c, 0.3), seed: p.seed });
  ctx.restore();
}

export function eoliennes(ctx, p) {
  const r = rng(p.seed || 51);
  for (let i = 0; i < (p.count || 4); i++) { ctx.save(); ctx.translate(-p.w / 2 + i * p.w / Math.max(1, (p.count || 4) - 1), 0); eolienne(ctx, { h: (p.h || 90) * (0.8 + r() * 0.3), angle: r() * 6, color: '#eef2f4', ink: '#9aabb8', line: 0.6 }); ctx.restore(); }
}

/** Petite ville industrielle de vallée : usines, cheminées fumantes. */
export function villeUsines(ctx, p) {
  const r = rng(p.seed || 61), w = p.w, c = p.color || '#b0a498';
  skyline(ctx, { w, kind: 'village', color: c, seed: p.seed });
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + w * (0.2 + i * 0.3), bw = 40 + r() * 20;
    box(ctx, x - bw / 2, -30, bw, 30, mix('#a9604a', c, 0.5), 0.8, shade(c, -0.4));
    ctx.beginPath(); ctx.moveTo(x - 4, -30); ctx.lineTo(x - 3, -80 - r() * 20); ctx.lineTo(x + 3, -80 - r() * 20); ctx.lineTo(x + 4, -30); ctx.closePath(); ctx.fillStyle = mix('#a9604a', c, 0.4); ctx.fill();
  }
}

/** Périphérique sur son viaduc bas, avec voitures (plan proche du fond). */
export function periph(ctx, p) {
  const w = p.w, h = p.h || 36, r = rng(p.seed || 71);
  box(ctx, -w / 2, -h - 10, w, 10, '#b9b6ae', 1);
  for (let x = -w / 2 + 20; x < w / 2; x += 60) box(ctx, x - 5, -h, 10, h, '#a9a69e', 0.9);
  box(ctx, -w / 2, -h - 22, w, 12, '#d6d3cb', 1); // glissière / mur antibruit
  for (let x = -w / 2 + 10; x < w / 2 - 20; x += 34 + r() * 30) { const col = r.pick(['#d9412b', '#f2f2f2', '#3f6fb0', '#2b2b2b', '#e0b54a']); ctx.beginPath(); ctx.roundRect(x, -h - 34, 22, 10, 3); ctx.fillStyle = col; ctx.fill(); outline(ctx, 0.7); }
}

/** Métro aérien sur viaduc métallique (ligne 2, boulevard de Barbès). */
export function metroAerien(ctx, p) {
  const w = p.w, h = p.h || 90, c = '#5a6a5f';
  for (let x = -w / 2 + 30; x < w / 2; x += 110) {
    ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x - 6, -h); ctx.lineTo(x + 6, -h); ctx.lineTo(x + 10, 0); ctx.closePath(); ctx.fillStyle = '#c9c2b0'; ctx.fill(); outline(ctx, 1);
  }
  box(ctx, -w / 2, -h - 16, w, 16, c, 1.1);
  ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = 1; ctx.beginPath(); for (let x = -w / 2; x < w / 2; x += 10) { ctx.moveTo(x, -h - 16); ctx.lineTo(x + 10, -h); } ctx.stroke();
  if (p.train) { const tx = p.trainX ?? 0; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.roundRect(tx + i * 62 - 90, -h - 44, 60, 28, 5); ctx.fillStyle = '#e6e8e3'; ctx.fill(); outline(ctx, 1); box(ctx, tx + i * 62 - 90, -h - 26, 60, 5, '#2f6fb0', 0.6); for (let k = 0; k < 4; k++) glass(ctx, tx + i * 62 - 86 + k * 14, -h - 40, 10, 10, false, k); } }
}

/** Plan d'eau (canal, lac du bois de Boulogne) au ras du sol du plan. */
export function eau(ctx, p) {
  const w = p.w, h = p.h || 20;
  const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#6f9fb5'); g.addColorStop(1, '#3f6f85');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -h, w, h + 40);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = -h + 4; y < 30; y += 6) for (let x = -w / 2; x < w / 2; x += 18) if (hash(x, y) < 0.4) { ctx.moveTo(x, y); ctx.lineTo(x + 8, y); }
  ctx.stroke();
  if (p.quai) { box(ctx, -w / 2, -h - 8, w, 8, '#cfc5ae', 1); }
}

export { INK };

/* ---------- Chaînes de montagnes ---------- */

/** Bruit « à crêtes » : arêtes vives et vallées arrondies, comme un profil de montagne. */
export function ridged(x, seed = 0, octaves = 4) {
  // profil à crêtes vives
  let v = 0, amp = 0.55, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { const n = 1 - Math.abs(2 * noise1(x * freq, seed + o * 23, 432 * freq) - 1); v += amp * n * n; norm += amp; amp *= 0.5; freq *= 2.1; }
  return v / norm;
}

/**
 * Une chaîne continue (profil défini par `height(x)` en coordonnées du monde) : roche éclairée à gauche,
 * facettes d'ombre à droite de chaque sommet, stries, neige au-dessus d'une ligne dentelée qui descend dans les couloirs,
 * forêt sur les chaînes basses. Jamais de bord coupé : le profil redescend à zéro aux extrémités.
 */
export function drawRange(ctx, env, t) {
  const { toPx, x0, x1, bottom } = env, step = 2 / env.pxPerUnit;
  const from = Math.max(x0, t.x0), to = Math.min(x1, t.x1);
  if (from >= to) return;
  const pts = [];
  for (let x = from; x <= to + step; x += step) { const xx = Math.min(x, to); pts.push([toPx(xx), -Math.max(0, t.height(xx)), xx]); }
  const outlinePath = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], bottom); for (const [px, py] of pts) ctx.lineTo(px, py); ctx.lineTo(pts[pts.length - 1][0], bottom); ctx.closePath(); };
  outlinePath();
  const top = Math.min(...pts.map(q => q[1]));
  const g = ctx.createLinearGradient(0, top, 0, 0); g.addColorStop(0, t.top || t.color); g.addColorStop(1, t.color);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); outlinePath(); ctx.clip();
  // Sommets marquants (proéminence suffisante) et vallées qui les séparent
  const peaks = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const y = pts[i][1]; if (!(y <= pts[i - 1][1] && y < pts[i + 1][1])) continue;
    let l = i, rr = i; while (l > 0 && pts[l - 1][1] >= pts[l][1] - 0.01) l--; while (rr < pts.length - 1 && pts[rr + 1][1] >= pts[rr][1] - 0.01) rr++;
    // Vallée à droite : descendre tant que le profil descend
    let v = i; while (v < pts.length - 1 && pts[v + 1][1] >= pts[v][1]) v++;
    let u = i; while (u > 0 && pts[u - 1][1] >= pts[u][1]) u--;
    const prom = Math.min(pts[v][1], pts[u][1]) - y;
    if (prom > 14) peaks.push({ i, v, u, prom });
  }
  // Facettes d'ombre : versant droit de chaque sommet, jusqu'au pied
  for (const { i, v } of peaks) {
    const [px, py] = pts[i], [vx, vy] = pts[v];
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let j = i; j <= v; j++) ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.lineTo(vx, bottom); ctx.lineTo(px + (vx - px) * 0.2, bottom); ctx.lineTo(px + (vx - px) * 0.05, py + (bottom - py) * 0.45); ctx.closePath();
    ctx.fillStyle = t.dark; ctx.fill();
  }
  // Arêtes et couloirs sous les sommets rocheux
  if (t.rock) {
    ctx.strokeStyle = alpha(t.ink || '#6f8298', 0.4); ctx.lineWidth = 0.9;
    for (const { i, prom } of peaks) { const [px, py] = pts[i], hh = Math.min(prom, bottom - py); for (const k of [-0.5, 0.35]) { ctx.beginPath(); ctx.moveTo(px + k * 4, py + 6); ctx.quadraticCurveTo(px + k * hh * 0.25, py + hh * 0.4, px + k * hh * 0.5, py + hh * 0.9); ctx.stroke(); } }
  }
  // Neige au-dessus d'une ligne douce ; langues de glacier larges sous les plus hauts sommets
  if (t.snow) {
    const high = peaks.filter(q => -pts[q.i][1] > t.snow + 30);
    ctx.beginPath(); ctx.moveTo(pts[0][0], -3000);
    for (const [px, , xx] of pts) {
      let line = t.snow + 10 * (noise1(xx * 0.9, 41) - 0.5);
      for (const q of high) { const d = Math.abs(pts[q.i][0] - px), span = 26 + q.prom * 0.25; if (d < span) line -= (1 - (d / span) ** 2) * Math.min(60, q.prom * 0.45); }
      ctx.lineTo(px, -line);
    }
    ctx.lineTo(pts[pts.length - 1][0], -3000); ctx.closePath();
    ctx.fillStyle = t.snowColor || '#f6f8fb'; ctx.fill();
    // Neige à l'ombre sur le versant droit
    for (const { i, v } of peaks) {
      const [px, py] = pts[i], [vx] = pts[v]; if (-py < t.snow) continue;
      ctx.save(); ctx.beginPath(); ctx.moveTo(px, py); for (let j = i; j <= v; j++) ctx.lineTo(pts[j][0], pts[j][1]); ctx.lineTo(vx, bottom); ctx.lineTo(px + (vx - px) * 0.2, bottom); ctx.lineTo(px + (vx - px) * 0.05, py + (bottom - py) * 0.45); ctx.closePath(); ctx.clip();
      ctx.fillStyle = 'rgba(110,140,185,0.3)'; ctx.fillRect(px - 10, py - 10, vx - px + 20, bottom - py + 20); ctx.restore();
    }
  }
  // Forêt de conifères sur les chaînes basses
  if (t.forest) {
    for (let i = 0; i < pts.length; i += 3) {
      const [px, py, xx] = pts[i], hh = -py; if (hh < 8) continue;
      for (let k = 0; k < Math.floor(hh / 15); k++) {
        const yy = py + 6 + k * 13 + noise1(xx * 13 + k, 5) * 5, s = 3 + noise1(xx * 7 + k, 9) * 2.5;
        if (yy > bottom - 2) break;
        ctx.fillStyle = k % 2 ? t.forest : shade(t.forest, -0.08);
        ctx.beginPath(); ctx.moveTo(px - s, yy + s * 1.6); ctx.lineTo(px, yy - s * 1.2); ctx.lineTo(px + s, yy + s * 1.6); ctx.closePath(); ctx.fill();
      }
    }
  }
  ctx.restore();
  ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); outline(ctx, t.lineWidth || 1, t.ink || '#7b8ea4');
}

/**
 * Un sommet alpin dessiné à la main : flancs irréguliers, arête qui sépare la face éclairée (gauche) de la face à
 * l'ombre (droite), calotte de neige à bord dentelé qui descend dans les couloirs, strates rocheuses.
 * `k` : 'pic' (sommet pointu), 'dome' (Mont-Blanc : large calotte), 'aiguille' (granite, peu de neige).
 */
export function sommet(ctx, cx, h, w, row, k, seed) {
  const r = rng(seed), palettes = [
    { lit: '#b1c0cf', dark: '#8fa2b8', snow: '#f8fafc', snowDark: '#d3dde9', ink: '#8497ad' },
    { lit: '#9aaabb', dark: '#7a8ca3', snow: '#f3f6fa', snowDark: '#c7d3e1', ink: '#6f8198' },
    { lit: '#98a6b6', dark: '#72839a', snow: '#f3f6fa', snowDark: '#c7d3e1', ink: '#66788e' },
  ], c = palettes[k === 'aiguille' ? 2 : row];
  const L = cx - w / 2, R = cx + w / 2, top = -h, sx = cx + (r() - 0.5) * w * 0.12;
  const flank = (x0, y0, x1, y1, n, bulge) => { const pts = []; for (let i = 1; i < n; i++) { const t = i / n, cur = Math.sin(t * Math.PI) * bulge; pts.push([x0 + (x1 - x0) * t + (r() - 0.5) * w * 0.05, y0 + (y1 - y0) * t - cur + (r() - 0.5) * h * 0.05]); } return pts; };
  const left = flank(L, 0, sx, top, 4, k === 'dome' ? h * 0.12 : -h * 0.03), right = flank(sx, top, R, 0, 4, k === 'dome' ? h * 0.1 : -h * 0.04);
  const shape = () => {
    ctx.beginPath(); ctx.moveTo(L, 0); left.forEach(([x, y]) => ctx.lineTo(x, y));
    if (k === 'dome') { ctx.quadraticCurveTo(sx - w * 0.08, top - 6, sx, top); ctx.quadraticCurveTo(sx + w * 0.1, top - 4, right[0][0], right[0][1]); } else ctx.lineTo(sx, top);
    right.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(R, 0); ctx.closePath();
  };
  shape(); ctx.fillStyle = c.lit; ctx.fill();
  ctx.save(); shape(); ctx.clip();
  // Arête principale (limite ombre / lumière) : ligne brisée du sommet vers le pied, décalée à droite
  const ridge = [[sx, top]]; for (let i = 1; i <= 5; i++) ridge.push([sx + w * 0.05 * i + (r() - 0.5) * w * 0.05, top + h * i / 5]);
  ctx.beginPath(); ridge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.lineTo(R + 10, 0); ctx.lineTo(R + 10, top - 10); ctx.closePath(); ctx.fillStyle = c.dark; ctx.fill();
  // Strates et couloirs sur la face éclairée
  ctx.strokeStyle = alpha(c.ink, 0.45); ctx.lineWidth = 0.9;
  for (let i = 0; i < 4; i++) { const y0 = top + h * (0.3 + i * 0.15), x0 = sx - w * (0.08 + i * 0.07); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 - w * 0.12, y0 + h * 0.18); ctx.stroke(); }
  // Neige : calotte dentelée
  const frac = k === 'aiguille' ? 0.14 : k === 'dome' ? 0.62 : row === 0 ? 0.45 : 0.28;
  if (h > (row === 0 ? 70 : 100) || k === 'dome') {
    const base = top + h * frac, n = 9;
    ctx.beginPath(); ctx.moveTo(L - 10, top - 20); ctx.lineTo(L - 10, base - h * 0.2);
    for (let i = 0; i <= n; i++) { const t = i / n, x = L + w * t, edge = Math.abs(t - (sx - L) / w); const d = (i % 2 ? h * 0.1 : -h * 0.03) * (1 - edge) + (r() - 0.5) * h * 0.05; ctx.lineTo(x, base + d - edge * h * 0.25); }
    ctx.lineTo(R + 10, base - h * 0.2); ctx.lineTo(R + 10, top - 20); ctx.closePath();
    ctx.fillStyle = c.snow; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.beginPath(); ridge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.lineTo(R + 10, 0); ctx.lineTo(R + 10, top - 10); ctx.closePath(); ctx.fillStyle = c.snowDark; ctx.fill();
    ctx.restore();
    // Langues de glacier dans les couloirs de la face éclairée
    if (k === 'dome' || (row === 0 && h > 150)) for (const gx of [sx - w * 0.2, sx - w * 0.34]) { ctx.beginPath(); ctx.moveTo(gx - w * 0.04, base); ctx.quadraticCurveTo(gx, base + h * 0.25, gx - w * 0.03, base + h * 0.36); ctx.quadraticCurveTo(gx + w * 0.03, base + h * 0.2, gx + w * 0.05, base); ctx.closePath(); ctx.fillStyle = c.snow; ctx.fill(); }
  }
  ctx.restore();
  shape(); outline(ctx, 1, c.ink);
}

/** Massif alpin (plan de l'horizon) : sommets distincts, du rang du fond au rang de devant. `p.peaks` : [dx, h, w, rang, genre]. */
export function massif(ctx, p, env) {
  const rows = [...p.peaks].sort((a, b) => a[3] - b[3] || a[1] - b[1]);
  rows.forEach(([dx, h, w, row, k], i) => sommet(ctx, dx * env.unitPx, h, w, row, k || 'pic', 17 + i * 7));
}
export function massifPeaks(center) {
  const peaks = [], r = rng(11);
  for (let x = 174; x <= 242; x += 5 + r() * 3.5) {
    const e = envelope(x, 172, 192, 216, 244); if (e < 0.18) continue;
    const h = e * (150 + 70 * r()); peaks.push([x - center, h, h * (1.5 + r() * 0.5), 0, 'pic']);
  }
  for (let x = 168; x <= 248; x += 6 + r() * 4) {
    const e = envelope(x, 166, 184, 226, 250); if (e < 0.2) continue;
    const h = e * (90 + 55 * r()); peaks.push([x - center + 2.5, h, h * (1.7 + r() * 0.5), 1, 'pic']);
  }
  // Mont-Blanc, dôme du Goûter, aiguilles de Chamonix
  peaks.push([204 - center, 272, 440, 0, 'dome'], [198.2 - center, 228, 250, 0, 'pic']);
  peaks.push([208.8 - center, 226, 58, 1, 'aiguille'], [210.9 - center, 204, 50, 1, 'aiguille'], [213.2 - center, 188, 70, 1, 'aiguille']);
  return peaks;
}

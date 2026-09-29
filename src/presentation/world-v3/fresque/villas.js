import { alpha, box, bush, castShadow, chimney, door, glass, grass, hedge, ironRail, line, lit, mansard, outline, pitchedRoof, rng, shade, wall, windowUnit } from './kit.js';

/**
 * Banlieue bourgeoise (Retraités C, type Neuilly, Le Vésinet, Chaville) : chaque villa est unique, isolée dans
 * son jardin arboré, en retrait derrière un muret à grille. Elles sont dessinées plus petites et plus haut que la rue
 * (en retrait) : c'est ce décalage qui donne la profondeur.
 */

const SETBACK = 0.84, LIFT = 14;

/** Mur de meulière : moellons ocre et rouille irréguliers dans un mortier clair. */
function meuliere(ctx, x, y, w, h, seed) {
  box(ctx, x, y, w, h, '#d9c29a', 0);
  const r = rng(seed + 3);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let yy = y + h; yy > y - 8; yy -= 7) for (let xx = x - 6 + r() * 6; xx < x + w; xx += 8 + r() * 6) {
    ctx.fillStyle = r.pick(['#c28a4f', '#b8743f', '#d6a063', '#a9693a', '#cf9a5c']);
    ctx.beginPath(); ctx.roundRect(xx, yy - 6, 7 + r() * 5, 5 + r() * 2, 2); ctx.fill();
  }
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(255,245,225,0.12)'); g.addColorStop(1, 'rgba(40,28,18,0.14)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore(); ctx.beginPath(); ctx.rect(x, y, w, h); outline(ctx, 1.5);
}
/** Chaînage d'angle et linteaux en brique rouge. */
function briqueChaine(ctx, x, y, h) { for (let yy = y + h; yy > y + 3; yy -= 10) box(ctx, x, yy - 5, (yy / 10) % 2 ? 11 : 7, 5, '#b24f36', 0.5); }
/** Frise de carreaux de céramique (bleu, blanc, ocre) sous la corniche. */
function frise(ctx, x, y, w) { const c = ['#3f6fa5', '#f3eee2', '#d9a441', '#f3eee2']; for (let i = 0; i < w / 6; i++) { ctx.fillStyle = c[i % 4]; ctx.fillRect(x + i * 6, y, 6, 6); } ctx.strokeStyle = 'rgba(40,28,18,0.5)'; ctx.lineWidth = 0.6; ctx.strokeRect(x, y, w, 6); }

/** Grand cèdre du Liban : étages de branches horizontales sombres. */
export function cedre(ctx, h = 230, seed = 1) {
  const r = rng(seed);
  line(ctx, 0, 0, 0, -h * 0.9, 6, '#5a4535');
  for (let i = 0; i < 5; i++) {
    const y = -h * (0.28 + i * 0.16), w = h * (0.5 - i * 0.07) * (0.9 + r() * 0.2), dx = (r() - 0.5) * 16;
    ctx.beginPath(); ctx.moveTo(dx - w / 2, y + 6);
    for (let k = 0; k <= 8; k++) { const t = k / 8; ctx.lineTo(dx - w / 2 + t * w, y - Math.sin(t * Math.PI) * h * 0.07 - (k % 2) * 4); }
    ctx.lineTo(dx + w / 2, y + 8); ctx.closePath(); ctx.fillStyle = i % 2 ? '#2f5a3a' : '#355f40'; ctx.fill(); outline(ctx, 1);
    ctx.fillStyle = 'rgba(160,200,150,0.25)'; ctx.fillRect(dx - w * 0.4, y - h * 0.05, w * 0.5, 3);
  }
}

/** Devant d'une villa : pelouse, muret de meulière à grille noire, piliers et portail, massifs d'hortensias. */
function devant(ctx, w, seed, gate) {
  const x = -w / 2;
  ctx.fillStyle = '#7aa653'; ctx.fillRect(x, -LIFT - 4, w, LIFT + 4); grass(ctx, x, w, seed, '#5f8f3f');
  ctx.fillStyle = '#d8ccb0'; ctx.fillRect(gate - 16, -LIFT - 4, 32, LIFT + 4); // allée gravillonnée
  meuliere(ctx, x, -16, w, 16, seed + 1);
  box(ctx, x - 2, -19, w + 4, 4, '#e6dcc6', 1);
  ironRail(ctx, x, -60, w, 41, '#232426');
  ctx.fillStyle = '#232426'; for (let xx = x + 2.5; xx < x + w; xx += 3.5) { ctx.beginPath(); ctx.moveTo(xx - 1.2, -60); ctx.lineTo(xx, -65); ctx.lineTo(xx + 1.2, -60); ctx.fill(); }
  for (const px of [gate - 20, gate + 20]) { meuliere(ctx, px - 7, -78, 14, 78, seed + px); box(ctx, px - 9, -82, 18, 5, '#e6dcc6', 1); }
  box(ctx, gate - 13, -64, 26, 64, 'rgba(35,36,38,0.15)', 0); ironRail(ctx, gate - 13, -62, 26, 60, '#232426');
  for (const dx of [x + w * 0.18, x + w * 0.82]) { bush(ctx, dx, -19, 36, 30, '#476f3a', dx); ctx.fillStyle = '#9fb3e8'; for (let i = 0; i < 7; i++) ctx.fillRect(dx - 13 + i * 4, -40 + (i % 2) * 5, 4, 4); }
}

/**
 * Villa bourgeoise unique. `p.variant` :
 * - 'tourelle' : meulière et brique, tourelle d'angle à toit en poivrière, bow-window, frise de céramique (Villa Régina) ;
 * - 'normande' : enduit blanc, pignon à colombages, grand toit de tuiles débordant, véranda (Le Vésinet) ;
 * - 'brique' : brique et pierre, toit à la Mansard d'ardoise, lucarnes ornées, crête de faîtage en fonte.
 */
export function villaBourgeoise(ctx, p) {
  const w = p.w, r = rng(p.seed || 1), gate = p.gateAt != null ? (p.gateAt - 0.5) * w : -w * 0.12;
  ctx.save(); ctx.translate(0, -LIFT); ctx.scale(SETBACK, SETBACK);
  const W = Math.min(w / SETBACK - 40, 250), X = -W / 2;
  if (p.variant === 'tourelle') {
    const H = 250;
    meuliere(ctx, X, -H, W, H, p.seed || 1); briqueChaine(ctx, X, -H, H); briqueChaine(ctx, X + W - 10, -H, H);
    for (const yy of [-92, -176]) box(ctx, X, yy, W, 7, '#b24f36', 0.8);
    frise(ctx, X + 2, -H + 4, W - 4);
    // Bow-window au rez-de-chaussée, balcon au-dessus
    const bx = X + W * 0.62; box(ctx, bx - 34, -88, 68, 80, '#f2ecde', 1.3); for (const dx of [-22, 0, 22]) glass(ctx, bx + dx - 8, -82, 16, 64, dx === 0);
    box(ctx, bx - 38, -94, 76, 6, '#e6dcc6', 1); ironRail(ctx, bx - 36, -112, 72, 18, '#232426');
    windowUnit(ctx, bx, -104, 30, 62, { frame: '#f2ecde', panes: 3, curtain: '#f3ead6' }, 2);
    windowUnit(ctx, X + W * 0.24, -186, 24, 56, { frame: '#f2ecde', panes: 3, shutters: '#6c8c7a' }, 3);
    windowUnit(ctx, bx, -186, 24, 56, { frame: '#f2ecde', panes: 3, shutters: '#6c8c7a', box: true }, 4);
    ctx.save(); ctx.translate(X + W * 0.24, 0); door(ctx, 0, 30, 94, '#3f5f4f', 'bois'); ctx.restore();
    box(ctx, X + W * 0.24 - 24, -104, 48, 5, '#dbe6ea', 1); for (const dx of [-20, 20]) line(ctx, X + W * 0.24 + dx, -99, X + W * 0.24 + dx * 0.6, -92, 1.2, '#232426'); // marquise
    pitchedRoof(ctx, X, -H, W, 70, 'ardoise', { overhang: 12, hip: 0.18, color: '#566068' });
    // Tourelle d'angle en saillie, toit en poivrière
    const tx = X + W - 8, tw = 50, tH = H + 30;
    meuliere(ctx, tx - tw / 2, -tH, tw, tH - 60, (p.seed || 1) + 9); briqueChaine(ctx, tx - tw / 2, -tH, tH - 60);
    castShadow(ctx, tx - tw / 2, -tH, tw, tH - 60, 0.12);
    windowUnit(ctx, tx, -tH + 64, 16, 40, { frame: '#f2ecde', panes: 2 }, 5);
    ctx.beginPath(); ctx.moveTo(tx - tw / 2 - 6, -tH); ctx.lineTo(tx, -tH - 90); ctx.lineTo(tx + tw / 2 + 6, -tH); ctx.closePath();
    const g = ctx.createLinearGradient(tx - tw / 2, 0, tx + tw / 2, 0); g.addColorStop(0, '#6c7780'); g.addColorStop(1, '#434b52'); ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.4);
    line(ctx, tx, -tH - 90, tx, -tH - 110, 1.6, '#2b2826'); ctx.fillStyle = '#c9a54f'; ctx.fillRect(tx - 5, -tH - 106, 10, 3); // épi et girouette
    chimney(ctx, X + W * 0.3, -H - 56, 18, 30, '#b24f36');
  } else if (p.variant === 'normande') {
    const H = 206, c = '#f4f0e6';
    wall(ctx, X, -H, W, H, c);
    // Pignon à colombages au centre-droit, grand toit débordant
    const gx = X + W * 0.42, gw = W * 0.5;
    pitchedRoof(ctx, X, -H, W, 72, 'tuile', { overhang: 16, hip: 0.3, color: '#9a4c34' });
    ctx.beginPath(); ctx.moveTo(gx - 14, -H + 10); ctx.lineTo(gx + gw / 2, -H - 118); ctx.lineTo(gx + gw + 14, -H + 10); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); outline(ctx, 1.3);
    ctx.save(); ctx.clip(); ctx.strokeStyle = '#6a4630'; ctx.lineWidth = 4; ctx.beginPath();
    for (let xx = gx; xx <= gx + gw; xx += gw / 5) { ctx.moveTo(xx, -H + 10); ctx.lineTo(xx, -H - 118); }
    ctx.moveTo(gx - 14, -H - 30); ctx.lineTo(gx + gw + 14, -H - 30); ctx.moveTo(gx, -H - 30); ctx.lineTo(gx + gw / 5, -H + 10); ctx.moveTo(gx + gw, -H - 30); ctx.lineTo(gx + gw * 4 / 5, -H + 10); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(gx - 20, -H + 14); ctx.lineTo(gx + gw / 2, -H - 124); ctx.lineTo(gx + gw + 20, -H + 14); ctx.lineWidth = 7; ctx.strokeStyle = '#9a4c34'; ctx.stroke(); outline(ctx, 1);
    windowUnit(ctx, gx + gw / 2, -H - 36, 34, 50, { frame: '#ffffff', panes: 3 }, 1);
    for (let yy = -H + 30; yy < -12; yy += 26) line(ctx, gx, yy, gx + gw, yy, 0.8, alpha('#6a4630', 0.25));
    windowUnit(ctx, X + W * 0.2, -112, 26, 54, { frame: '#ffffff', panes: 3, shutters: '#2f6f5a' }, 2);
    windowUnit(ctx, gx + gw * 0.3, -112, 26, 54, { frame: '#ffffff', panes: 3, shutters: '#2f6f5a', box: true }, 3);
    windowUnit(ctx, gx + gw * 0.72, -112, 26, 54, { frame: '#ffffff', panes: 3, shutters: '#2f6f5a', box: true }, 4);
    ctx.save(); ctx.translate(X + W * 0.2, 0); door(ctx, 0, 30, 92, '#2f6f5a', 'bois'); ctx.restore();
    // Véranda vitrée sur le côté
    const vx = X + W * 0.46, vw = W * 0.5; box(ctx, vx, -74, vw, 74, '#e8e4dc', 1.2);
    for (let i = 0; i < 5; i++) glass(ctx, vx + 4 + i * (vw - 8) / 5, -70, (vw - 8) / 5 - 3, 62, i === 2);
    ctx.beginPath(); ctx.moveTo(vx - 4, -74); ctx.lineTo(vx + vw + 4, -74); ctx.lineTo(vx + vw - 6, -92); ctx.lineTo(vx + 6, -92); ctx.closePath(); ctx.fillStyle = 'rgba(190,215,225,0.85)'; ctx.fill(); outline(ctx, 1.2);
    chimney(ctx, X + W * 0.16, -H - 50, 20, 34, '#b5553a');
  } else {
    const H = 206, c = '#b65a40';
    wall(ctx, X, -H, W, H, c);
    ctx.save(); ctx.beginPath(); ctx.rect(X, -H, W, H); ctx.clip(); ctx.strokeStyle = alpha('#7f3a28', 0.5); ctx.lineWidth = 0.6; ctx.beginPath(); for (let yy = -4; yy > -H; yy -= 4.5) { ctx.moveTo(X, yy); ctx.lineTo(X + W, yy); } ctx.stroke(); ctx.restore();
    for (const qx of [X, X + W - 12]) for (let yy = 0; yy > -H + 4; yy -= 12) box(ctx, qx, yy - 11, (yy / 12) % 2 ? 12 : 8, 11, '#ece2cc', 0.5); // chaînes de pierre
    box(ctx, X - 4, -96, W + 8, 7, '#ece2cc', 1);
    for (const [f, yb] of [[0, -18], [1, -110]]) for (let i = 0; i < 3; i++) {
      const cx = X + W * (i + 0.5) / 3; if (f === 0 && i === 1) continue;
      windowUnit(ctx, cx, yb, 26, 66, { frame: '#f4efe4', panes: 3, sill: '#ece2cc', bars: f ? '#232426' : null, curtain: '#f3ead6', lit: r() < 0.2 }, f * 3 + i);
      box(ctx, cx - 17, yb - 72, 34, 6, '#ece2cc', 0.9); // linteau de pierre
    }
    ctx.save(); ctx.translate(0, 0); door(ctx, 0, 36, 98, '#2b3a42', 'cochere'); ctx.restore();
    box(ctx, -28, -110, 56, 5, '#dbe6ea', 1); for (const dx of [-24, 24]) line(ctx, dx, -105, dx * 0.6, -98, 1.2, '#232426');
    box(ctx, -30, -6, 60, 6, '#ece2cc', 1); // perron
    box(ctx, X - 6, -H - 8, W + 12, 8, '#ece2cc', 1.2);
    mansard(ctx, X + 2, -H - 8, W - 4, 58, { dormers: 3, seed: p.seed, color: '#5a646c' });
    ctx.strokeStyle = '#232426'; ctx.lineWidth = 1.2; ctx.beginPath(); const rt = -H - 66;
    for (let xx = X + 24; xx < X + W - 24; xx += 8) { ctx.moveTo(xx, rt); ctx.lineTo(xx, rt - 8); } ctx.moveTo(X + 22, rt - 8); ctx.lineTo(X + W - 22, rt - 8); ctx.stroke(); // crête de faîtage
    chimney(ctx, X + 26, -H - 64, 18, 26, '#b65a40'); chimney(ctx, X + W - 26, -H - 64, 18, 26, '#b65a40');
  }
  ctx.restore();
  devant(ctx, w, p.seed || 1, gate);
}

/** Jardin entre deux villas : pelouse, grand cèdre ou tilleul, muret à grille qui continue. */
export function jardinVilla(ctx, p) {
  const w = p.w, x = -w / 2;
  ctx.fillStyle = '#7aa653'; ctx.fillRect(x, -LIFT - 4, w, LIFT + 4);
  ctx.save(); ctx.translate(0, -LIFT); ctx.scale(SETBACK, SETBACK); cedre(ctx, p.h || 250, p.seed || 1); ctx.restore();
  meuliere(ctx, x, -16, w, 16, (p.seed || 1) + 4); box(ctx, x - 2, -19, w + 4, 4, '#e6dcc6', 1);
  ironRail(ctx, x, -60, w, 41, '#232426');
  ctx.fillStyle = '#232426'; for (let xx = x + 2.5; xx < x + w; xx += 3.5) { ctx.beginPath(); ctx.moveTo(xx - 1.2, -60); ctx.lineTo(xx, -65); ctx.lineTo(xx + 1.2, -60); ctx.fill(); }
  bush(ctx, x + w * 0.5, -19, w * 0.6, 26, '#476f3a', p.seed || 1);
}

export { hedge };

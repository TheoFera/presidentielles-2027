import { ringDelta } from '../../../simulation/world.js';
import { seasonAt } from '../../../simulation/campaign-events.js';
import * as paris from './paris.js';
import * as banlieue from './banlieue.js';
import * as periurbain from './periurbain.js';
import * as campagne from './campagne.js';
import * as littoral from './littoral.js';
import * as beaux from './beaux.js';
import * as lointain from './lointain.js';
import * as paysage from './paysage.js';
import * as perspective from './perspective.js';
import * as villas from './villas.js';
import { arbre, lisiere } from './nature.js';
import { siteBuilding, signRect } from './sites.js';
import { HAZE, PLANES, PLANE_ORDER, fresqueScene } from './scene.js';
import { drawFresqueGround } from './sol.js';

/**
 * Rendu de la fresque : chaque plan est découpé en tuiles (512 px logiques de large), peintes une seule fois
 * à la résolution de l'écran puis réutilisées. Le décor suit la taille des personnages (`u`) : sur un écran
 * plus haut, les personnages sont plus grands, donc portes, étages et collines aussi.
 */
const TILE = 512;
const PAINTERS = { ...paysage, ...lointain, ...paris, ...banlieue, ...periurbain, ...campagne, ...littoral, ...beaux, ...perspective, ...villas, lisiere, site: siteBuilding };

/** Facteur d'échelle du décor : 1 quand un personnage mesure 81 px (écran 16:9 de référence). */
export const decorScale = renderer => renderer.metrics.characterHeight / 81;

/* ---------- Tuiles ---------- */

function paintElement(ctx, e, cx, shift, env, plane) {
  const u = env.u, k = env.k;
  if (e.kind === 'terrain' || e.kind === 'sea' || e.kind === 'chaine') {
    const p = e.p, t = { ...p, height: x => p.height(x) * u, snow: p.snow && p.snow * u, horizon: p.horizon && p.horizon * u };
    const local = { ...env, toPx: x => x * k + shift, x0: (env.left - shift) / k - 1, x1: (env.right - shift) / k + 1 };
    ({ sea: paysage.drawSea, terrain: paysage.drawTerrain, chaine: paysage.drawRange })[e.kind](ctx, local, t);
    return;
  }
  const painter = PAINTERS[e.kind];
  if (!painter) return;
  const s = u * (plane.scale || 1);
  ctx.save(); ctx.translate(cx, (e.p.dy || 0) * u); ctx.scale(s, s);
  const p = { ...e.p, cx: e.x };
  if (e.w) p.w = e.w * k / s;
  painter(ctx, p, { ...env, unitPx: k / s });
  ctx.restore();
}

function elementSpan(e, k, u, plane) {
  if (e.kind === 'terrain' || e.kind === 'sea' || e.kind === 'chaine') return [e.p.x0 * k, e.p.x1 * k];
  const s = u * (plane.scale || 1);
  const half = e.w ? e.w * k / 2 : (e.p.w || 320) * s / 2 + 60 * s;
  return [e.x * k - half - 80 * s, e.x * k + half + 80 * s];
}

function renderTile(renderer, scene, planeId, index, u, R) {
  const plane = PLANES[planeId], k = renderer.metrics.pixelsPerUnit * plane.parallax;
  const Lp = scene.length * k, left = index * TILE, width = Math.min(TILE, Lp - left);
  const top = plane.top * u, bottom = plane.base * u;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * R); canvas.height = Math.ceil((top + bottom) * R);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(R, 0, 0, R, -left * R, top * R);
  const env = { u, k, left, right: left + width, bottom, pxPerUnit: k };
  for (const e of scene.planes[planeId]) {
    for (const shift of [0, -Lp, Lp]) {
      const [a, b] = elementSpan(e, k, u, plane);
      if (b + shift < left || a + shift > left + width) continue;
      paintElement(ctx, e, e.x * k + shift, shift, env, plane);
    }
  }
  // Perspective atmosphérique : une brume uniforme par plan, plus forte au loin.
  if (plane.haze) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = plane.haze;
    ctx.fillStyle = HAZE; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return { canvas, width, top, bottom, complete: true, u, R, time: performance.now() };
}

const TILE_LIMIT = 26;
function tileCache(renderer) {
  if (!renderer.fresqueTiles) renderer.fresqueTiles = new Map();
  return renderer.fresqueTiles;
}
function getTile(renderer, scene, planeId, index, u, R, budget) {
  const cache = tileCache(renderer), key = `${planeId}:${index}`;
  let tile = cache.get(key);
  const stale = tile && (Math.abs(tile.u - u) > 0.015 || tile.R !== R);
  // Une tuile visible absente est toujours peinte ; les tuiles périmées attendent leur tour (budget).
  if (!tile || (stale && budget.left > 0)) {
    if (tile) budget.left--;
    const t0 = performance.now();
    tile = renderTile(renderer, scene, planeId, index, u, R);
    // Statistiques (page de balade) : nombre de tuiles peintes et temps le plus long.
    const stats = renderer.fresqueStats || (renderer.fresqueStats = { tiles: 0, total: 0, worst: {} });
    const ms = performance.now() - t0; stats.tiles++; stats.total += ms; stats.worst[planeId] = Math.max(stats.worst[planeId] || 0, ms);
    cache.set(key, tile);
    if (cache.size > TILE_LIMIT) cache.delete(cache.keys().next().value);
  } else if (tile) { cache.delete(key); cache.set(key, tile); }
  return tile;
}

/** Résolution des tuiles : celle de l'écran (plafonnée pour la mémoire des téléphones). */
function tileResolution(renderer) {
  const zoom = renderer.config.balance.camera.framing_zoom ?? 1;
  return Math.max(1, Math.min(2, Math.round(renderer.canvas.width / renderer.width * zoom * 4) / 4));
}

function drawPlane(renderer, scene, planeId, u, R, budget, tools) {
  const { ctx, metrics: m } = renderer, plane = PLANES[planeId];
  const k = m.pixelsPerUnit * plane.parallax, Lp = scene.length * k, count = Math.ceil(Lp / TILE);
  const view = renderer.visibleWorld || { left: 0, right: renderer.width };
  const originY = m.groundY - plane.base * u;
  for (let i = 0; i < count; i++) {
    const left = i * TILE, width = Math.min(TILE, Lp - left);
    const center = (left + width / 2) / k;
    const screenLeft = m.anchorX + ringDelta(renderer.cameraX, center, scene.length) * k - width / 2;
    if (screenLeft > view.right + 2 || screenLeft + width < view.left - 2) continue;
    const tile = getTile(renderer, scene, planeId, i, u, R, budget);
    ctx.drawImage(tile.canvas, screenLeft, originY - tile.top, width + 0.6, tile.top + tile.bottom);
    // Hiver : neige sur les toits, auvents et murets (calculée une fois par tuile).
    if (tools.snow > 0.02 && planeId !== 'horizon') {
      ctx.globalAlpha = Math.min(1, tools.snow); ctx.drawImage(tools.snowCap(tile.canvas), screenLeft, originY - tile.top, width + 0.6, tile.top + tile.bottom); ctx.globalAlpha = 1;
    }
  }
}

/** Prépare en tâche de fond les tuiles voisines de l'écran, pour ne jamais attendre en traversant la carte. */
function prefetch(renderer, scene, u, R) {
  if (renderer.fresquePrefetch || typeof requestIdleCallback === 'undefined') return;
  renderer.fresquePrefetch = requestIdleCallback(() => {
    renderer.fresquePrefetch = null;
    const m = renderer.metrics;
    for (const planeId of PLANE_ORDER) {
      const k = m.pixelsPerUnit * PLANES[planeId].parallax, count = Math.ceil(scene.length * k / TILE);
      const current = Math.floor((((renderer.cameraX % scene.length) + scene.length) % scene.length) * k / TILE);
      for (const d of [1, -1, 2, -2]) {
        const index = (current + d + count) % count, tile = tileCache(renderer).get(`${planeId}:${index}`);
        if (!tile || Math.abs(tile.u - u) > 0.015 || tile.R !== R) { getTile(renderer, scene, planeId, index, u, R, { left: 1 }); return; }
      }
    }
  }, { timeout: 500 });
}

/* ---------- Éléments vivants (saisons, fumée) ---------- */

function drawTrees(renderer, state, scene, u) {
  const { ctx, metrics: m } = renderer, view = renderer.visibleWorld || { left: 0, right: renderer.width };
  const baseY = m.groundY - PLANES.street.base * u + 2, season = seasonAt(state.campaign_progress_01 || 0);
  for (const tree of scene.trees) {
    const sx = renderer.screenX(tree.x);
    if (sx < view.left - tree.h * u || sx > view.right + tree.h * u) continue;
    ctx.save(); ctx.translate(sx, baseY); ctx.scale(u, u); arbre(ctx, tree.h, tree.kind, season, tree.seed); ctx.restore();
  }
}

function drawSmoke(renderer, state, scene, u) {
  const { ctx, metrics: m } = renderer, baseY = m.groundY - PLANES.street.base * u;
  ctx.save();
  for (const x of scene.barbecues) {
    const sx = renderer.screenX(x);
    if (sx < -100 || sx > renderer.width + 100) continue;
    for (let i = 0; i < 6; i++) {
      const t = ((state.tick / 50 + i / 6) % 1);
      ctx.globalAlpha = 0.45 * (1 - t); ctx.fillStyle = '#ecebe6';
      ctx.beginPath(); ctx.ellipse(sx + (Math.sin(t * 6 + i) * 5 + t * 14) * u, baseY - (32 + t * 70) * u, (4 + t * 9) * u, (3 + t * 6) * u, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/* ---------- Point d'entrée ---------- */

/**
 * Dessine toute la fresque (ciel exclu) : plans du fond, rue, sol, arbres, fumée. `tools` fournit les fonctions
 * de saison du moteur (filtre de couleur, neige) pour ne pas dupliquer leur logique.
 */
export function drawFresque(renderer, state, tools) {
  const scene = fresqueScene(state.world, state.buildings);
  const u = decorScale(renderer), R = tileResolution(renderer);
  const budget = { left: 3 };
  const { ctx } = renderer;
  for (const planeId of PLANE_ORDER) {
    ctx.save(); ctx.filter = tools.seasonFilter(planeId);
    drawPlane(renderer, scene, planeId, u, R, budget, tools);
    ctx.restore();
  }
  drawFresqueGround(renderer, state, u);
  drawTrees(renderer, state, scene, u);
  drawSmoke(renderer, state, scene, u);
  prefetch(renderer, scene, u, R);
  renderer.fresqueScene = scene;
}

/** Rectangle écran du panneau crème d'un bâtiment du jeu (le jeu y écrit son nom), ou null. */
export function fresqueSignFrame(renderer, building) {
  const scene = renderer.fresqueScene, site = scene?.sites[building.site_id];
  if (!site) return null;
  const u = decorScale(renderer), rect = signRect(site.w * renderer.metrics.pixelsPerUnit / u);
  const x = renderer.screenX(building.x), baseY = renderer.metrics.groundY - PLANES.street.base * u;
  return { x: x + rect.x * u, y: baseY + rect.y * u, w: rect.w * u, h: rect.h * u, painted: true };
}

/** La fresque est entièrement dessinée par le code : aucune image à précharger. */
export function fresqueAssetIds() { return []; }

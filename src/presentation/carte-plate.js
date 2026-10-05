import { ringDelta } from '../simulation/world.js';

/**
 * Décor « Carte plate », décor par défaut du jeu : la fresque peinte d'un seul plan, découpée en 18 tuiles.
 * Une tuile = une sous-zone, 1 920 × 1 080 px pour 24 unités (80 px par unité).
 * Les pieds des personnages et le pied des façades sont à y = 1 004 px dans chaque tuile.
 * Les tuiles sont des copies de docs/production/decor-v3/carte-plate/tuiles/ : après une retouche, les recopier ici.
 */
const TILE_W = 1920, TILE_H = 1080, GROUND_Y = 1004;
// Panneau crème peint au-dessus de chaque porte (cahier des charges, chapitre 16).
const SIGN = { top: 764, bottom: 808, width: 220 };
// Panneaux des devantures restaurées : le texte suit l'image et ses proportions naturelles.
// Coordonnées en pixels dans leur tuile, sans modifier la position de gameplay des sites.
const NATURAL_SIGNS = {
  'site:riches_b': { x: 146, y: 610, w: 360, h: 68 },
  'site:riches_c': { x: 203, y: 675, w: 433, h: 64 },
  'site:riches_c:institut_sondage': { x: 871, y: 681, w: 497, h: 68 },
};

const TILE_COUNT = 18;
const tileId = index => `plate-${String(index + 1).padStart(2, '0')}`;
// Chemins écrits en entier : scripts/build-pages.mjs les repère pour l'export.
export const plateAssets = {
  'plate-01': { file: new URL('../../assets/generated/carte-plate/tuile-01-paris-a.png', import.meta.url).href },
  'plate-02': { file: new URL('../../assets/generated/carte-plate/tuile-02-paris-b.png', import.meta.url).href },
  'plate-03': { file: new URL('../../assets/generated/carte-plate/tuile-03-paris-c.png', import.meta.url).href },
  'plate-04': { file: new URL('../../assets/generated/carte-plate/tuile-04-banlieue-a.png', import.meta.url).href },
  'plate-05': { file: new URL('../../assets/generated/carte-plate/tuile-05-banlieue-b.png', import.meta.url).href },
  'plate-06': { file: new URL('../../assets/generated/carte-plate/tuile-06-banlieue-c.png', import.meta.url).href },
  'plate-07': { file: new URL('../../assets/generated/carte-plate/tuile-07-periurbain-a.png', import.meta.url).href },
  'plate-08': { file: new URL('../../assets/generated/carte-plate/tuile-08-periurbain-b.png', import.meta.url).href },
  'plate-09': { file: new URL('../../assets/generated/carte-plate/tuile-09-periurbain-c.png', import.meta.url).href },
  'plate-10': { file: new URL('../../assets/generated/carte-plate/tuile-10-campagne-a.png', import.meta.url).href },
  'plate-11': { file: new URL('../../assets/generated/carte-plate/tuile-11-campagne-b.png', import.meta.url).href },
  'plate-12': { file: new URL('../../assets/generated/carte-plate/tuile-12-campagne-c.png', import.meta.url).href },
  'plate-13': { file: new URL('../../assets/generated/carte-plate/tuile-13-retraites-a.png', import.meta.url).href },
  'plate-14': { file: new URL('../../assets/generated/carte-plate/tuile-14-retraites-b.png', import.meta.url).href },
  'plate-15': { file: new URL('../../assets/generated/carte-plate/tuile-15-retraites-c.png', import.meta.url).href },
  'plate-16': { file: new URL('../../assets/generated/carte-plate/tuile-16-riches-a.png', import.meta.url).href },
  'plate-17': { file: new URL('../../assets/generated/carte-plate/tuile-17-riches-b.png', import.meta.url).href },
  'plate-18': { file: new URL('../../assets/generated/carte-plate/tuile-18-riches-c.png', import.meta.url).href },
};
export const plateAssetIds = () => Object.keys(plateAssets);

/** Échelle écran : une tuile couvre exactement la largeur de sa sous-zone. */
const tileScale = (renderer, zone) => zone.width * renderer.metrics.pixelsPerUnit / TILE_W;

// Teinte de saison préparée à l'avance : un filtre posé sur ctx.filter est recalculé à chaque dessin,
// très coûteux sur téléphone. Chaque tuile visible est donc teintée une seule fois, à sa taille à l'écran,
// puis redessinée sans filtre. La copie n'est refaite que si la teinte (par petits paliers) ou la taille change.
const tintedTiles = new Map();
const MAX_TINTED_TILES = 4; // au plus trois tuiles visibles à la fois, plus celle qui arrive
function tintedTile(index, image, filter, width, height, smoothing) {
  let entry = tintedTiles.get(index);
  if (!entry || entry.image !== image || entry.filter !== filter || entry.canvas.width !== width || entry.canvas.height !== height) {
    const canvas = entry?.canvas || document.createElement('canvas');
    canvas.width = width; canvas.height = height; // efface aussi l'ancienne copie
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = smoothing; c.filter = filter;
    c.drawImage(image, 0, 0, TILE_W, TILE_H, 0, 0, width, height);
    entry = { image, filter, canvas };
  }
  // Les copies les plus anciennes sont oubliées pour limiter la mémoire.
  tintedTiles.delete(index); tintedTiles.set(index, entry);
  if (tintedTiles.size > MAX_TINTED_TILES) tintedTiles.delete(tintedTiles.keys().next().value);
  return entry.canvas;
}

/** Dessine les tuiles visibles, bord à bord à des positions entières. Renvoie false si une tuile visible manque encore. */
export function drawPlateWorld(renderer, state, { seasonFilter } = {}) {
  const { ctx, metrics: m, width, height } = renderer, world = state.world;
  const visible = [];
  for (const zone of world.subzones) {
    const k = tileScale(renderer, zone);
    const left = m.anchorX + (ringDelta(renderer.cameraX, zone.center, world.length) - zone.width / 2) * m.pixelsPerUnit;
    const x0 = Math.round(left), x1 = Math.round(left + zone.width * m.pixelsPerUnit);
    if (x1 < 0 || x0 > width) continue;
    const index = zone.index % TILE_COUNT, image = renderer.assets.get(tileId(index));
    if (!image) return false;
    visible.push({ index, image, x0, x1, k });
  }
  const tint = seasonFilter && seasonFilter !== 'none';
  // Taille de la tuile en pixels réels du canevas (densité de l'écran et cadrage compris).
  const scale = tint ? ctx.getTransform() : null;
  ctx.save();
  for (const { index, image, x0, x1, k } of visible) {
    const top = Math.round(m.groundY - GROUND_Y * k), bottom = Math.round(m.groundY + (TILE_H - GROUND_Y) * k);
    const source = tint ? tintedTile(index, image, seasonFilter, Math.max(1, Math.round(TILE_W * k * scale.a)),
      Math.max(1, Math.round(TILE_H * k * scale.d)), ctx.imageSmoothingEnabled) : image;
    const sw = tint ? source.width : TILE_W, sh = tint ? source.height : TILE_H;
    ctx.drawImage(source, 0, 0, sw, sh, x0, top, x1 - x0, bottom - top);
    // Au-dessus et en dessous de la tuile : on prolonge sa première et sa dernière ligne (ciel, chaussée).
    if (top > 0) ctx.drawImage(source, 0, 0, sw, 1, x0, 0, x1 - x0, top);
    if (bottom < height) ctx.drawImage(source, 0, sh - 1, sw, 1, x0, bottom, x1 - x0, height - bottom);
  }
  ctx.restore();
  return true;
}

/** Panneau crème peint au-dessus de la porte du bâtiment : le jeu n'y ajoute que le texte. */
export function plateSignFrame(renderer, building) {
  const zone = renderer.fixedWorldState?.world.subzones.find(z => z.id === building.subzone_id);
  if (!zone) return null;
  const k = tileScale(renderer, zone), m = renderer.metrics;
  const natural = NATURAL_SIGNS[building.site_id];
  if (natural) return {
    x: renderer.screenX(zone.center - zone.width / 2 + (natural.x + natural.w / 2) / TILE_W * zone.width),
    y: m.groundY - (GROUND_Y - natural.y - natural.h / 2) * k,
    w: natural.w * k, h: natural.h * k, painted: true,
  };
  return {
    x: renderer.screenX(building.x),
    y: m.groundY - (GROUND_Y - (SIGN.top + SIGN.bottom) / 2) * k,
    w: SIGN.width * k, h: (SIGN.bottom - SIGN.top) * k, painted: true,
  };
}

import { ringDelta } from '../../simulation/world.js';

/**
 * Décor « Carte plate », décor par défaut du jeu : la fresque peinte d'un seul plan, découpée en 18 tuiles.
 * Une tuile = une sous-zone, 1 920 × 1 080 px pour 24 unités (80 px par unité).
 * Les pieds des personnages et le pied des façades sont à y = 1 004 px dans chaque tuile.
 * Les originaux et la chaîne de production des tuiles sont dans le dossier voisin « Presidentielles 2027 - fichiers retirés »
 * (docs/production/decor-v3/carte-plate/) : après une retouche, recopier les tuiles ici.
 */
const TILE_W = 1920, TILE_H = 1080, GROUND_Y = 1004;
// Panneau crème peint au-dessus de chaque porte (cahier des charges, chapitre 16).
const SIGN = { top: 764, bottom: 808, width: 220 };
// Panneaux des devantures restaurées : le texte suit l'image et ses proportions naturelles.
// Coordonnées en pixels dans leur tuile, sans modifier la position de gameplay des sites.
const NATURAL_SIGNS = {
  'site:paris_b': { x: 450, y: 710, w: 306, h: 39 },
  'site:banlieue_b': { x: 284, y: 715, w: 267, h: 32 },
  'site:riches_a': { x: 904, y: 683, w: 222, h: 42 },
  'site:riches_b': { x: 151, y: 614, w: 355, h: 52 },
  'site:riches_c': { x: 237, y: 686, w: 386, h: 42 },
  'site:riches_c:institut_sondage': { x: 825, y: 686, w: 441, h: 49 },
};

const TILE_COUNT = 18;
const tileId = index => `plate-${String(index + 1).padStart(2, '0')}`;
// Chemins écrits en entier : scripts/build-pages.mjs les repère pour l'export.
export const plateAssets = {
  'plate-01': { file: new URL('../../../assets/images/carte/tuile-01-paris-a.png', import.meta.url).href },
  'plate-02': { file: new URL('../../../assets/images/carte/tuile-02-paris-b.png', import.meta.url).href },
  'plate-03': { file: new URL('../../../assets/images/carte/tuile-03-paris-c.png', import.meta.url).href },
  'plate-04': { file: new URL('../../../assets/images/carte/tuile-04-banlieue-a.png', import.meta.url).href },
  'plate-05': { file: new URL('../../../assets/images/carte/tuile-05-banlieue-b.png', import.meta.url).href },
  'plate-06': { file: new URL('../../../assets/images/carte/tuile-06-banlieue-c.png', import.meta.url).href },
  'plate-07': { file: new URL('../../../assets/images/carte/tuile-07-periurbain-a.png', import.meta.url).href },
  'plate-08': { file: new URL('../../../assets/images/carte/tuile-08-periurbain-b.png', import.meta.url).href },
  'plate-09': { file: new URL('../../../assets/images/carte/tuile-09-periurbain-c.png', import.meta.url).href },
  'plate-10': { file: new URL('../../../assets/images/carte/tuile-10-campagne-a.png', import.meta.url).href },
  'plate-11': { file: new URL('../../../assets/images/carte/tuile-11-campagne-b.png', import.meta.url).href },
  'plate-12': { file: new URL('../../../assets/images/carte/tuile-12-campagne-c.png', import.meta.url).href },
  'plate-13': { file: new URL('../../../assets/images/carte/tuile-13-retraites-a.png', import.meta.url).href },
  'plate-14': { file: new URL('../../../assets/images/carte/tuile-14-retraites-b.png', import.meta.url).href },
  'plate-15': { file: new URL('../../../assets/images/carte/tuile-15-retraites-c.png', import.meta.url).href },
  'plate-16': { file: new URL('../../../assets/images/carte/tuile-16-riches-a.png', import.meta.url).href },
  'plate-17': { file: new URL('../../../assets/images/carte/tuile-17-riches-b.png', import.meta.url).href },
  'plate-18': { file: new URL('../../../assets/images/carte/tuile-18-riches-c.png', import.meta.url).href },
};
export const plateAssetIds = () => Object.keys(plateAssets);

/** Échelle écran : une tuile couvre exactement la largeur de sa sous-zone. */
const tileScale = (renderer, zone) => zone.width * renderer.metrics.pixelsPerUnit / TILE_W;

// Tuiles décodées à l'avance autour du joueur. Le navigateur peut jeter de sa mémoire une image déjà
// décodée et la décoder de nouveau au moment de la dessiner : plus de 100 ms pour une tuile, un gel visible.
// Cela arrive surtout dans l'application Android (WebView), qui garde beaucoup moins d'images décodées que Chrome.
// Les tuiles visibles et leurs voisines sont donc décodées hors du fil du jeu (createImageBitmap), gardées
// telles quelles, puis libérées quand le joueur s'éloigne. Les 18 tuiles décodées pèseraient environ 150 Mo.
const decodedTiles = new Map();
const NEIGHBOR_TILES = 2; // de chaque côté des tuiles visibles
function keepNearbyTilesDecoded(visibleIndexes) {
  if (typeof createImageBitmap !== 'function' || typeof fetch !== 'function') return;
  const wanted = new Set();
  for (const index of visibleIndexes) for (let d = -NEIGHBOR_TILES; d <= NEIGHBOR_TILES; d++) wanted.add((index + d + TILE_COUNT) % TILE_COUNT);
  for (const [index, entry] of decodedTiles) if (!wanted.has(index)) { entry.dropped = true; entry.bitmap?.close(); decodedTiles.delete(index); }
  for (const index of wanted) {
    if (decodedTiles.has(index)) continue;
    const entry = { bitmap: null, dropped: false };
    decodedTiles.set(index, entry);
    fetch(plateAssets[tileId(index)].file).then(response => response.blob()).then(blob => createImageBitmap(blob))
      .then(bitmap => { if (entry.dropped) bitmap.close(); else entry.bitmap = bitmap; })
      // En cas d'échec, la tuile reste dessinée depuis l'image chargée par le jeu.
      .catch(() => { if (decodedTiles.get(index) === entry) decodedTiles.delete(index); });
  }
}

/** Dessine les tuiles visibles, bord à bord à des positions entières. Renvoie false si une tuile visible manque encore. */
export function drawPlateWorld(renderer, state) {
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
  keepNearbyTilesDecoded(visible.map(tile => tile.index));
  ctx.save();
  for (const { index, image: loaded, x0, x1, k } of visible) {
    // Tuile déjà décodée hors du fil du jeu si possible : rien à préparer au passage d'une sous-zone.
    const source = decodedTiles.get(index)?.bitmap || loaded;
    const top = Math.round(m.groundY - GROUND_Y * k), bottom = Math.round(m.groundY + (TILE_H - GROUND_Y) * k);
    const sw = source.width, sh = source.height;
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

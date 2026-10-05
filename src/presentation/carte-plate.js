import { ringDelta } from '../simulation/world.js';

/**
 * Décor « Carte plate » (profil betatest) : la fresque peinte d'un seul plan, découpée en 18 tuiles.
 * Une tuile = une sous-zone, 1 920 × 1 080 px pour 24 unités (80 px par unité).
 * Les pieds des personnages et le pied des façades sont à y = 1 004 px dans chaque tuile.
 * Les tuiles sont lues directement dans le dossier de production : chaque retouche y apparaît sans autre étape.
 * Ce décor n'est pas embarqué dans les exports (voir map-decor.js).
 */
const TILE_NAMES = [
  'paris-a', 'paris-b', 'paris-c', 'banlieue-a', 'banlieue-b', 'banlieue-c',
  'periurbain-a', 'periurbain-b', 'periurbain-c', 'campagne-a', 'campagne-b', 'campagne-c',
  'retraites-a', 'retraites-b', 'retraites-c', 'riches-a', 'riches-b', 'riches-c',
];
const TILE_W = 1920, TILE_H = 1080, GROUND_Y = 1004;
// Panneau crème peint au-dessus de chaque porte (cahier des charges, chapitre 16).
const SIGN = { top: 764, bottom: 808, width: 220 };

const tileId = index => `plate-${String(index + 1).padStart(2, '0')}`;
export const plateAssets = Object.fromEntries(TILE_NAMES.map((name, index) => [tileId(index), {
  file: new URL(`../../docs/production/decor-v3/carte-plate/tuiles/tuile-${String(index + 1).padStart(2, '0')}-${name}.png`, import.meta.url).href,
}]));
export const plateAssetIds = () => Object.keys(plateAssets);

/** Échelle écran : une tuile couvre exactement la largeur de sa sous-zone. */
const tileScale = (renderer, zone) => zone.width * renderer.metrics.pixelsPerUnit / TILE_W;

/** Dessine les tuiles visibles, bord à bord à des positions entières. Renvoie false si une tuile visible manque encore. */
export function drawPlateWorld(renderer, state, { seasonFilter } = {}) {
  const { ctx, metrics: m, width, height } = renderer, world = state.world;
  const visible = [];
  for (const zone of world.subzones) {
    const k = tileScale(renderer, zone);
    const left = m.anchorX + (ringDelta(renderer.cameraX, zone.center, world.length) - zone.width / 2) * m.pixelsPerUnit;
    const x0 = Math.round(left), x1 = Math.round(left + zone.width * m.pixelsPerUnit);
    if (x1 < 0 || x0 > width) continue;
    const image = renderer.assets.get(tileId(zone.index % TILE_NAMES.length));
    if (!image) return false;
    visible.push({ image, x0, x1, k });
  }
  ctx.save();
  if (seasonFilter) ctx.filter = seasonFilter;
  for (const { image, x0, x1, k } of visible) {
    const top = Math.round(m.groundY - GROUND_Y * k), bottom = Math.round(m.groundY + (TILE_H - GROUND_Y) * k);
    ctx.drawImage(image, 0, 0, TILE_W, TILE_H, x0, top, x1 - x0, bottom - top);
    // Au-dessus et en dessous de la tuile : on prolonge sa première et sa dernière ligne (ciel, chaussée).
    if (top > 0) ctx.drawImage(image, 0, 0, TILE_W, 1, x0, 0, x1 - x0, top);
    if (bottom < height) ctx.drawImage(image, 0, TILE_H - 1, TILE_W, 1, x0, bottom, x1 - x0, height - bottom);
  }
  ctx.restore();
  return true;
}

/** Panneau crème peint au-dessus de la porte du bâtiment : le jeu n'y ajoute que le texte. */
export function plateSignFrame(renderer, building) {
  const zone = renderer.fixedWorldState?.world.subzones.find(z => z.id === building.subzone_id);
  if (!zone) return null;
  const k = tileScale(renderer, zone), m = renderer.metrics;
  return {
    x: renderer.screenX(building.x),
    y: m.groundY - (GROUND_Y - (SIGN.top + SIGN.bottom) / 2) * k,
    w: SIGN.width * k, h: (SIGN.bottom - SIGN.top) * k, painted: true,
  };
}

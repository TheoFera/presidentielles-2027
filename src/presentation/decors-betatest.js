// Décors réservés au profil « betatest » : panoramas world-v2, France peinte, fresque dessinée et ancien décor v3.
// Le reste du jeu n'y accède que par ce fichier. L'export de l'application (node scripts/build-pages.mjs --app)
// le remplace par decors-betatest-appli.js, vide : aucun de ces modules ni de leurs images n'est embarqué.
// Un nom ajouté ici doit aussi l'être dans decors-betatest-appli.js (vérifié par test/pages.test.js).
import { CALIBRATION } from './world-v3/calibration.js';
import { paintedAssets } from './france-peinte-data.js';
import { completePaintedAssets } from './france-peinte-complete-data.js';
import { expandedWorldAssets } from './world-v2-expanded-data.js';

export { BIOME_ART, CANVAS, FARS, LAYERS, MIDDLES, STREETS } from './world-v3/spec.js';
export { CALIBRATION };
export { drawStreetGround, zoneScreenLeft } from './world-v3/ground.js';
export { drawFrontProps } from './world-v3/front.js';
export { drawFresque, fresqueSignFrame } from './world-v3/fresque/render.js';
export { paintedAssetIds } from './france-peinte-data.js';
export { completePaintedAssetIds } from './france-peinte-complete-data.js';
export { drawPaintedWorld, drawPaintedFront, paintedSignFrame, preparePaintedAtlas } from './france-peinte.js';
export { expandedWorldAssetIds } from './world-v2-expanded-data.js';
export { drawExpandedWorld, prepareExpandedAtlas } from './world-v2-expanded.js';

// Les chemins restent écrits en entier : scripts/build-pages.mjs les repère pour l'export web.
const v3 = Object.fromEntries(Object.entries(CALIBRATION).flatMap(([layer, entries]) =>
  Object.entries(entries).map(([id, entry]) => [`v3-${layer}-${id}`, { file: new URL(`../../${entry.file}`, import.meta.url).href }])));

/** Images de ces décors, ajoutées au manifeste visuel. */
export const betatestDecorAssets = {
  ...expandedWorldAssets,
  'panorama-bobo': { file: new URL('../../assets/generated/world-v2/panorama-bobo.png', import.meta.url).href },
  'panorama-banlieue': { file: new URL('../../assets/generated/world-v2/panorama-banlieue.png', import.meta.url).href },
  'panorama-periurbain': { file: new URL('../../assets/generated/world-v2/panorama-periurbain.png', import.meta.url).href },
  'panorama-campagne': { file: new URL('../../assets/generated/world-v2/panorama-campagne.png', import.meta.url).href },
  'panorama-retraites': { file: new URL('../../assets/generated/world-v2/panorama-retraites.png', import.meta.url).href },
  'panorama-riches': { file: new URL('../../assets/generated/world-v2/panorama-riches.png', import.meta.url).href },
  ...v3,
  ...paintedAssets,
  ...completePaintedAssets,
};

import { CALIBRATION } from './world-v3/calibration.js';
import { MINOR_SPRITES } from './minor-sprites.js';
import { MINOR_ANIMATION_FILES, minorAnimationId } from './minor-animation-sprites.js';
import { ULTIMATE_GUARD_FILES } from './ultimate-guard-sprites.js';

// Les chemins restent écrits en entier : scripts/build-pages.mjs les repère pour l'export web.
const v3 = Object.fromEntries(Object.entries(CALIBRATION).flatMap(([layer, entries]) =>
  Object.entries(entries).map(([id, entry]) => [`v3-${layer}-${id}`, { file: new URL(`../../${entry.file}`, import.meta.url).href }])));

export const fixedWorldAssets = {
  'panorama-bobo': { file: new URL('../../assets/generated/world-v2/panorama-bobo.png', import.meta.url).href },
  'panorama-banlieue': { file: new URL('../../assets/generated/world-v2/panorama-banlieue.png', import.meta.url).href },
  'panorama-periurbain': { file: new URL('../../assets/generated/world-v2/panorama-periurbain.png', import.meta.url).href },
  'panorama-campagne': { file: new URL('../../assets/generated/world-v2/panorama-campagne.png', import.meta.url).href },
  'panorama-retraites': { file: new URL('../../assets/generated/world-v2/panorama-retraites.png', import.meta.url).href },
  'panorama-riches': { file: new URL('../../assets/generated/world-v2/panorama-riches.png', import.meta.url).href },
  'riders-melenchon': { file: new URL('../../assets/generated/world-v2/riders-melenchon.png', import.meta.url).href },
  'riders-le_pen': { file: new URL('../../assets/generated/world-v2/riders-le_pen.png', import.meta.url).href },
  'riders-philippe': { file: new URL('../../assets/generated/world-v2/riders-philippe.png', import.meta.url).href },
  'riders-bardella': { file: new URL('../../assets/generated/world-v2/riders-bardella.png', import.meta.url).href },
  'vehicles': { file: new URL('../../assets/generated/world-v2/riders-vehicles.png', import.meta.url).href },
  ...v3,
  ...Object.fromEntries(Object.entries(ULTIMATE_GUARD_FILES).map(([key, file]) => [`character-ultimate-${key}-guard-v2`, { file: new URL(`../../${file}`, import.meta.url).href }])),
  ...Object.fromEntries(Object.entries(MINOR_SPRITES).map(([faction, file]) => [`minor-${faction}`, { file: new URL(`../../${file}`, import.meta.url).href }])),
  ...Object.fromEntries(Object.entries(MINOR_ANIMATION_FILES).flatMap(([faction, sheets]) => Object.entries(sheets).map(([sheet, file]) => [minorAnimationId(faction, sheet), { file: new URL(`../../${file}`, import.meta.url).href }]))),
};

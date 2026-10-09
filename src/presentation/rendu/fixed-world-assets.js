import { MINOR_SPRITES } from '../personnages/minor-sprites.js';
import { MINOR_ANIMATION_FILES, minorAnimationId } from '../personnages/minor-animation-sprites.js';
import { ULTIMATE_GUARD_FILES } from '../effets/ultimate-guard-sprites.js';

// Les chemins restent écrits en entier : scripts/build-pages.mjs les repère pour l'export web.

export const fixedWorldAssets = {
  'riders-melenchon': { file: new URL('../../../assets/images/vehicules/riders-melenchon.png', import.meta.url).href },
  'riders-le_pen': { file: new URL('../../../assets/images/vehicules/riders-le_pen.png', import.meta.url).href },
  'riders-philippe': { file: new URL('../../../assets/images/vehicules/riders-philippe.png', import.meta.url).href },
  'riders-bardella': { file: new URL('../../../assets/images/vehicules/riders-bardella.png', import.meta.url).href },
  'vehicles': { file: new URL('../../../assets/images/vehicules/riders-vehicles.png', import.meta.url).href },
  ...Object.fromEntries(Object.entries(ULTIMATE_GUARD_FILES).map(([key, file]) => [`character-ultimate-${key}-guard-v2`, { file: new URL(`../../../${file}`, import.meta.url).href }])),
  ...Object.fromEntries(Object.entries(MINOR_SPRITES).map(([faction, file]) => [`minor-${faction}`, { file: new URL(`../../../${file}`, import.meta.url).href }])),
  ...Object.fromEntries(Object.entries(MINOR_ANIMATION_FILES).flatMap(([faction, sheets]) => Object.entries(sheets).map(([sheet, file]) => [minorAnimationId(faction, sheet), { file: new URL(`../../../${file}`, import.meta.url).href }]))),
};

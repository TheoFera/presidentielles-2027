import { MINOR_SPRITES } from './minor-sprites.js';
import { MINOR_ANIMATION_FILES, minorAnimationId } from './minor-animation-sprites.js';
import { ULTIMATE_GUARD_FILES } from './ultimate-guard-sprites.js';

// Les chemins restent écrits en entier : scripts/build-pages.mjs les repère pour l'export web.
// Les images des décors betatest sont dans decors-betatest.js.

export const fixedWorldAssets = {
  'riders-melenchon': { file: new URL('../../assets/generated/world-v2/riders-melenchon.png', import.meta.url).href },
  'riders-le_pen': { file: new URL('../../assets/generated/world-v2/riders-le_pen.png', import.meta.url).href },
  'riders-philippe': { file: new URL('../../assets/generated/world-v2/riders-philippe.png', import.meta.url).href },
  'riders-bardella': { file: new URL('../../assets/generated/world-v2/riders-bardella.png', import.meta.url).href },
  'vehicles': { file: new URL('../../assets/generated/world-v2/riders-vehicles.png', import.meta.url).href },
  ...Object.fromEntries(Object.entries(ULTIMATE_GUARD_FILES).map(([key, file]) => [`character-ultimate-${key}-guard-v2`, { file: new URL(`../../${file}`, import.meta.url).href }])),
  ...Object.fromEntries(Object.entries(MINOR_SPRITES).map(([faction, file]) => [`minor-${faction}`, { file: new URL(`../../${file}`, import.meta.url).href }])),
  ...Object.fromEntries(Object.entries(MINOR_ANIMATION_FILES).flatMap(([faction, sheets]) => Object.entries(sheets).map(([sheet, file]) => [minorAnimationId(faction, sheet), { file: new URL(`../../${file}`, import.meta.url).href }]))),
};

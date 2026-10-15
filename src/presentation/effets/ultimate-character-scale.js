import { characterFrameScale, CHARACTER_HEIGHT_RATIO } from '../personnages/character-scale.js';

/** La flamme dépasse la tête : la pose sans accessoire sert d'étalon du corps. */
export function ultimateCharacterScale(atlas, index, height, sheet) {
  return sheet === 'fire' ? height * CHARACTER_HEIGHT_RATIO / atlas.frames[3][3]
    : characterFrameScale(atlas, index, height);
}

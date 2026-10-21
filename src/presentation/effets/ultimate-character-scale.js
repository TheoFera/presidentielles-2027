import { characterFrameScale, CHARACTER_HEIGHT_RATIO } from '../personnages/character-scale.js';

// La planche Vague dessine Marine Le Pen environ 10 % plus petite que ses poses ordinaires
// (largeur de tête mesurée en jeu) : on la ramène à la même taille.
const SHEET_SCALES = { wave: 1.1 };

/** La flamme dépasse la tête : la pose sans accessoire sert d'étalon du corps. */
export function ultimateCharacterScale(atlas, index, height, sheet) {
  return sheet === 'fire' ? height * CHARACTER_HEIGHT_RATIO / atlas.frames[3][3]
    : characterFrameScale(atlas, index, height) * (SHEET_SCALES[sheet] ?? 1);
}

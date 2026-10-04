import { MINOR_ANIMATION_DATA } from './minor-animation-data.js';

// Même ordre de combat et de déplacement que les candidats principaux.
export const MINOR_ANIMATION_FILES = {
  glucksmann: { combat: 'assets/generated/minor-candidates/glucksmann-combat-v3.png', movement: 'assets/generated/minor-candidates/glucksmann-movement-v3.png', actions: 'assets/generated/minor-candidates/glucksmann-actions-v3.png' },
  roussel: { combat: 'assets/generated/minor-candidates/roussel-combat-v8.png', movement: 'assets/generated/minor-candidates/roussel-movement-v8.png', actions: 'assets/generated/minor-candidates/roussel-actions-v7.png' },
  arthaud: { combat: 'assets/generated/minor-candidates/arthaud-combat-v4.png', movement: 'assets/generated/minor-candidates/arthaud-movement-v4.png', actions: 'assets/generated/minor-candidates/arthaud-actions-v4.png' },
  dupont_aignan: { combat: 'assets/generated/minor-candidates/dupont_aignan-combat-v3.png', movement: 'assets/generated/minor-candidates/dupont_aignan-movement-v3.png', actions: 'assets/generated/minor-candidates/dupont_aignan-actions-v3.png' },
  retailleau: { combat: 'assets/generated/minor-candidates/retailleau-combat-v3.png', movement: 'assets/generated/minor-candidates/retailleau-movement-v3.png', actions: 'assets/generated/minor-candidates/retailleau-actions-v3.png' },
  attal: { combat: 'assets/generated/minor-candidates/attal-combat-v4.png', movement: 'assets/generated/minor-candidates/attal-movement-v4.png', actions: 'assets/generated/minor-candidates/attal-actions-v4.png' },
};

/**
 * Corrections de taille, mesurées pose par pose contre Philippe et Le Pen.
 * Les planches générées ne dessinent pas toutes les poses à la même échelle :
 * « all » corrige une planche entière, un numéro corrige une seule frame.
 * Actions 8 à 11 = chute et K.O. au sol, dessinés trop petits par le générateur.
 */
export const MINOR_FRAME_CORRECTIONS = {
  glucksmann: { combat: { all: .95, 13: 1.08 }, actions: { 11: 1.11 } },
  // Trois légers ajustements après réduction des têtes dans les nouvelles images.
  roussel: { combat: { 15: .97 }, movement: { 15: .91 }, actions: { 2: 1.03, 9: .93, 11: 1.1 } },
  arthaud: { movement: { 9: .97 }, actions: { 8: 1.1, 10: 1.1, 11: 1.2 } },
  dupont_aignan: { actions: { 8: 1.13, 10: 1.13, 11: 1.13 } },
  retailleau: { actions: { 10: 1.08 } },
  attal: { combat: { all: .96, 14: 1.07 }, actions: { 8: 1.06, 10: 1.1, 11: 1.15 } },
};

/** Échelle finale de chaque frame : échelle mesurée × correction. */
export function correctedFrameScales(faction, sheet, atlas) {
  const fix = MINOR_FRAME_CORRECTIONS[faction]?.[sheet];
  if (!fix) return atlas.frameScales;
  return atlas.frames.map((_, index) => (atlas.frameScales?.[index] ?? 1) * (fix.all ?? 1) * (fix[index] ?? 1));
}

const minorAtlas = (faction, sheet, atlas) => ({ ...atlas, frameScales: correctedFrameScales(faction, sheet, atlas), sprite: minorAnimationId(faction, sheet), isolated: true });

export const minorAnimationId = (faction, sheet) => `character-minor-${faction}-${sheet}`;
export const minorCombatAtlases = Object.fromEntries(Object.entries(MINOR_ANIMATION_DATA).map(([faction, sheets]) => [faction, { ...minorAtlas(faction, 'combat', sheets.combat), minor: true }]));
export const minorExtraAtlases = Object.fromEntries(Object.entries(MINOR_ANIMATION_DATA).map(([faction, sheets]) => [faction, Object.fromEntries(['movement', 'actions'].map(sheet => [sheet, minorAtlas(faction, sheet, sheets[sheet])]))]));

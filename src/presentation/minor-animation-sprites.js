import { MINOR_ANIMATION_DATA } from './minor-animation-data.js';

// Même ordre de combat et de déplacement que les candidats principaux.
export const MINOR_ANIMATION_FILES = {
  glucksmann: { combat: 'assets/generated/minor-candidates/glucksmann-combat-v3.png', movement: 'assets/generated/minor-candidates/glucksmann-movement-v3.png', actions: 'assets/generated/minor-candidates/glucksmann-actions-v3.png' },
  roussel: { combat: 'assets/generated/minor-candidates/roussel-combat-v7.png', movement: 'assets/generated/minor-candidates/roussel-movement-v7.png', actions: 'assets/generated/minor-candidates/roussel-actions-v6.png' },
  arthaud: { combat: 'assets/generated/minor-candidates/arthaud-combat-v3.png', movement: 'assets/generated/minor-candidates/arthaud-movement-v3.png', actions: 'assets/generated/minor-candidates/arthaud-actions-v3.png' },
  dupont_aignan: { combat: 'assets/generated/minor-candidates/dupont_aignan-combat-v3.png', movement: 'assets/generated/minor-candidates/dupont_aignan-movement-v3.png', actions: 'assets/generated/minor-candidates/dupont_aignan-actions-v3.png' },
  retailleau: { combat: 'assets/generated/minor-candidates/retailleau-combat-v3.png', movement: 'assets/generated/minor-candidates/retailleau-movement-v3.png', actions: 'assets/generated/minor-candidates/retailleau-actions-v3.png' },
  attal: { combat: 'assets/generated/minor-candidates/attal-combat-v3.png', movement: 'assets/generated/minor-candidates/attal-movement-v3.png', actions: 'assets/generated/minor-candidates/attal-actions-v3.png' },
};

export const minorAnimationId = (faction, sheet) => `character-minor-${faction}-${sheet}`;
export const minorCombatAtlases = Object.fromEntries(Object.entries(MINOR_ANIMATION_DATA).map(([faction, sheets]) => [faction, { ...sheets.combat, sprite: minorAnimationId(faction, 'combat'), isolated: true }]));
export const minorExtraAtlases = Object.fromEntries(Object.entries(MINOR_ANIMATION_DATA).map(([faction, sheets]) => [faction, Object.fromEntries(['movement', 'actions'].map(sheet => [sheet, { ...sheets[sheet], sprite: minorAnimationId(faction, sheet), isolated: true }]))]));

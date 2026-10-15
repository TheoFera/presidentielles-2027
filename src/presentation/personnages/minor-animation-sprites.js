import { MINOR_ANIMATION_DATA } from './minor-animation-data.js';
import { minorLocomotionAtlases } from './minor-locomotion-sprites.js';

// Même ordre de combat et de déplacement que les candidats principaux.
export const MINOR_ANIMATION_FILES = {
  glucksmann: { combat: 'assets/images/candidats/glucksmann/glucksmann-combat-v5.png', movement: 'assets/images/candidats/glucksmann/glucksmann-movement-v5.png', actions: 'assets/images/candidats/glucksmann/glucksmann-actions-v5.png' },
  roussel: { combat: 'assets/images/candidats/roussel/roussel-combat-v8.png', movement: 'assets/images/candidats/roussel/roussel-movement-v8.png', actions: 'assets/images/candidats/roussel/roussel-actions-v7.png' },
  arthaud: { combat: 'assets/images/candidats/arthaud/arthaud-combat-v4.png', movement: 'assets/images/candidats/arthaud/arthaud-movement-v4.png', actions: 'assets/images/candidats/arthaud/arthaud-actions-v4.png' },
  dupont_aignan: { combat: 'assets/images/candidats/dupont-aignan/dupont_aignan-combat-v6.png', movement: 'assets/images/candidats/dupont-aignan/dupont_aignan-movement-v6.png', actions: 'assets/images/candidats/dupont-aignan/dupont_aignan-actions-v6.png' },
  retailleau: { combat: 'assets/images/candidats/retailleau/retailleau-combat-v3.png', movement: 'assets/images/candidats/retailleau/retailleau-movement-v3.png', actions: 'assets/images/candidats/retailleau/retailleau-actions-v3.png' },
  attal: { combat: 'assets/images/candidats/attal/attal-combat-v6.png', movement: 'assets/images/candidats/attal/attal-movement-v6.png', actions: 'assets/images/candidats/attal/attal-actions-v6.png' },
};

// Seules les poses debout se calent par la hauteur tête–chaussure au sol.
// Accroupissements, sauts et chutes conservent l'échelle du corps : leur boîte est naturellement plus basse.
const standingFrames = { combat: [0,1,2,3,4,5,6,7,9,10,11], movement: [0,1,2,3,4,5,6,7], actions: [0,1,4,5,6,7] };
const groundCorrections = { arthaud: { 10: 1.2, 11: 1.25 }, retailleau: { 10: 1.3, 11: 1.18 } };
const minorAtlas = (faction, sheet, atlas) => ({
  ...atlas, frameScales: undefined, widthScale: 1, uniformCharacter: true,
  anatomicalScales: atlas.frames.map((frame, index) => standingFrames[sheet].includes(index)
    ? atlas.frames[0][3] / frame[3] : (sheet === 'actions' ? groundCorrections[faction]?.[index] : null) ?? 1),
  sprite: minorAnimationId(faction, sheet), isolated: true,
});

export const minorAnimationId = (faction, sheet) => `character-minor-${faction}-${sheet}`;
export const minorCombatAtlases = Object.fromEntries(Object.entries(MINOR_ANIMATION_DATA).map(([faction, sheets]) => [faction, { ...minorAtlas(faction, 'combat', sheets.combat), minor: true }]));
export const minorExtraAtlases = Object.fromEntries(Object.entries(MINOR_ANIMATION_DATA).map(([faction, sheets]) => [faction, Object.fromEntries(['movement', 'actions'].map(sheet => [sheet, minorAtlas(faction, sheet, sheets[sheet])]))]));
for (const [faction, atlases] of Object.entries(minorLocomotionAtlases)) Object.assign(minorExtraAtlases[faction], atlases);

// Une référence dessinée en plein pas ne doit pas rester figée à l'arrêt.
// Ces poses neutres ont les deux pieds posés ; le déplacement ordinaire conserve le même dessin.
export const minorStandingAtlases = Object.fromEntries(['attal', 'dupont_aignan', 'glucksmann'].map(faction => {
  const actions = minorExtraAtlases[faction].actions;
  return [faction, { sprite: actions.sprite, frames: [actions.frames[6]], isolated: true, uniformCharacter: true }];
}));

export const minorCorrectionAssets = {
  'character-minor-attal-knockout': { file: new URL('../../../assets/images/candidats/attal/attal-chutes-v7.png', import.meta.url).href },
};
// La première figure debout fournit l'étalon anatomique de ces quatre chutes.
minorExtraAtlases.attal.knockout = { sprite: 'character-minor-attal-knockout', isolated: true, uniformCharacter: true,
  frames: [[64,126,187,508,133,634],[330,188,407,428,533,616],[769,274,419,340,978,614],[1207,324,474,270,1443.5,594],[1709,342,444,249,1930.5,591]] };

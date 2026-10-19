import { MINOR_LOCOMOTION_DATA } from './minor-locomotion-data.js';

export const minorLocomotionAssets = {
  'character-minor-attal-locomotion': { file: new URL('../../../assets/images/candidats/attal/attal-garde-v7.png', import.meta.url).href },
  'character-minor-dupont_aignan-locomotion': { file: new URL('../../../assets/images/candidats/dupont-aignan/dupont_aignan-garde-v7.png', import.meta.url).href },
  'character-minor-glucksmann-locomotion': { file: new URL('../../../assets/images/candidats/glucksmann/glucksmann-garde-v6.png', import.meta.url).href },
};

// Aller-retour de 0,7 seconde : relâchée → intermédiaire → resserrée → intermédiaire.
// La pose très accroupie de la planche n'appartient pas à la respiration de garde.
export const MINOR_GUARD_FRAME_SECONDS = .175;
export const minorGuardIdleFrame = (tick, hz) => [0, 1, 2, 1][Math.floor(tick / (hz * MINOR_GUARD_FRAME_SECONDS)) % 4];

export const minorLocomotionAtlases = Object.fromEntries(Object.entries(MINOR_LOCOMOTION_DATA).map(([faction, data]) => {
  // Glucksmann fléchit les jambes : sa garde doit être plus basse que sa pose droite,
  // sans agrandir son visage pour compenser cette différence de posture.
  const standingHeight = data.referenceHeight / (faction === 'glucksmann' ? .92 : 1);
  const base = { sprite: `character-minor-${faction}-locomotion`, isolated: true, uniformCharacter: true, standingHeight };
  return [faction, {
    guardIdle: { ...base, frames: [0, 1, 3].map(i => data.frames[i]) },
    // Quatre appuis bas, chacun tenu sur deux des huit phases de distance du moteur.
    guardWalk: { ...base, frames: [4, 4, 5, 5, 6, 6, 7, 7].map(i => data.frames[i]) },
  }];
}));

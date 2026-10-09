import { ULTIMATE_GUARD_DATA } from './ultimate-guard-data.js';
export const ULTIMATE_GUARD_FILES = {
  europe: 'assets/images/pouvoirs/europe-guard-v2.png',
  bardella: 'assets/images/pouvoirs/bardella-guard-v2.png',
};
export const ultimateGuardAtlases = Object.fromEntries(Object.entries(ULTIMATE_GUARD_DATA).map(([key, data]) => [key+'_guard', { ...data, sprite: `character-ultimate-${key}-guard-v2`, isolated: true }]));

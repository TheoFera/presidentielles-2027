import { ringDelta, wrap } from './world.js';

// Les arènes à chutes mortelles ont des bords ouverts ; la campagne reste circulaire.
export const combatDelta = (state, from, to) => state.debate_bounds ? to - from : ringDelta(from, to, state.world.length);
export function combatPosition(state, x) {
  if (!state.debate_bounds) return wrap(x, state.world.length);
  if (state.fall_death_height != null) return x;
  return Math.max(state.debate_bounds.min, Math.min(state.debate_bounds.max, x));
}

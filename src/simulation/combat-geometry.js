import { ringDelta, wrap } from './world.js';

// Arena edges are solid. World movement continues to use the validated loop.
export const combatDelta = (state, from, to) => state.arena_bounds ? to - from : ringDelta(from, to, state.world.length);
export const combatPosition = (state, x) => state.arena_bounds ? Math.max(state.arena_bounds.min, Math.min(state.arena_bounds.max, x)) : wrap(x, state.world.length);

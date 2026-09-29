import { ringDelta, wrap } from './world.js';

// Debate edges are solid. World movement continues to use the validated loop.
export const combatDelta = (state, from, to) => state.debate_bounds ? to - from : ringDelta(from, to, state.world.length);
export const combatPosition = (state, x) => state.debate_bounds ? Math.max(state.debate_bounds.min, Math.min(state.debate_bounds.max, x)) : wrap(x, state.world.length);

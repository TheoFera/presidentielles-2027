import { ringDelta, wrap } from '../simulation/world.js';

/** Même position visuelle pour le personnage et son repère sur la carte. */
export function interpolatedPlayerX(state, previous, candidate, alpha) {
  const old = previous?.candidates.find(c => c.id === candidate.id);
  const teleported = state.events?.some(event => event.type === 'CandidateTeleported'
    && event.candidate_id === candidate.id && event.tick >= (previous?.tick ?? state.tick)
    && !previous?.events?.some(oldEvent => oldEvent.id === event.id));
  if (!old || teleported || state.seed !== previous.seed || state.tick < previous.tick) return candidate.x;
  return wrap(old.x + ringDelta(old.x, candidate.x, state.world.length) * alpha, state.world.length);
}

import { invisibleToEnemies } from '../../simulation/minor-ultimate-catalog.js';

/** Le propriétaire et ses alliés gardent une silhouette discrète pour se repérer. */
export function candidateOpacity(entity, state, config) {
  const invisible = invisibleToEnemies(entity, state.tick);
  // Cas ordinaire : aucun effet de transparence, donc aucune recherche du joueur.
  if (!invisible && entity.reveal_tick == null) return 1;
  const duration = config.balance.minor_ultimates.invisible.transition_seconds * config.balance.simulation_architecture.fixed_tick_hz;
  if (!invisible && state.tick - entity.reveal_tick >= duration) return 1;
  const viewer = state.candidates.find(c => c.id === state.local_candidate_id);
  const ally = viewer && (viewer.team_id ?? viewer.faction_id) === (entity.team_id ?? entity.faction_id);
  const minimum = ally ? .28 : 0;
  if (invisible) {
    const progress = Math.min(1, Math.max(0, (state.tick - entity.ultimate_effect.started_tick) / duration));
    return 1 - (1 - minimum) * progress;
  }
  if (entity.reveal_tick != null && state.tick - entity.reveal_tick < duration) {
    return minimum + (1 - minimum) * Math.max(0, (state.tick - entity.reveal_tick) / duration);
  }
  return 1;
}

const UNCHANGED_SCALE = Object.freeze({ x: 1, y: 1 });
export function flattenScale(entity, tick) {
  const c = entity.combat;
  if (c?.flatten_tick == null || tick >= c.flatten_until_tick) return UNCHANGED_SCALE;
  const age = (tick - c.flatten_tick) / Math.max(1, c.flatten_until_tick - c.flatten_tick);
  const amount = Math.min(1, age / .08, (1 - age) / .25);
  return { x: 1 + .5 * amount, y: 1 - .72 * amount };
}

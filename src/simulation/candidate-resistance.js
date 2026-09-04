import { combatState } from './combat-state.js';
import { distance } from './territory.js';

export function updateCandidateResistance(sim) {
  const { state, config, hz } = sim; const settings = config.balance.candidate_combat;
  for (const candidate of state.candidates) {
    if (candidate.eliminated) continue;
    if (candidate.is_ko) {
      candidate.axis = 0; candidate.moving = false; candidate.campaign_active = false; candidate.interaction_active = false;
      if (state.tick >= candidate.respawn_tick) {
        const hq = state.buildings.find(b => b.id === candidate.headquarters_site_id && b.headquarters && b.owner_id === candidate.faction_id);
        candidate.x = hq?.x ?? candidate.last_hq_x ?? candidate.start_x;
        candidate.resistance = settings.resistance_max; candidate.is_ko = false; candidate.disappeared = false;
        candidate.combat = combatState(); candidate.campaign_active = true; candidate.interaction_active = true;
        sim.emit('CandidateRespawned', { candidate_id: candidate.id, target_id: hq?.id || null, x: candidate.x });
      } else if (state.tick >= candidate.disappear_tick) candidate.disappeared = true;
      continue;
    }
    const safe = ![...state.candidates, ...state.npcs, ...state.temporary_units].some(other => other.id !== candidate.id && other.faction_id
      && other.faction_id !== candidate.faction_id && distance(state, candidate.x, other.x) <= settings.recovery_safe_distance);
    if (safe && state.tick - candidate.last_damage_tick >= sim.secondsToTicks(settings.recovery_delay_seconds)) {
      candidate.resistance = Math.min(settings.resistance_max, candidate.resistance + settings.recovery_per_second / hz);
    }
  }
}

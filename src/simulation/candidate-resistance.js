import { clearCampaignUltimate } from './campaign-styles.js';
import { combatState } from './combat-state.js';
import { distance } from './territory.js';
import { claimMinorHeadquarters, defeatMinor, minorSiteId } from './minor-candidates.js';
import { neutralizeSite } from './strategic-sites.js';
import { prepareBuildingShutterTransition } from './building-shutters.js';
import { invisibleToEnemies } from './minor-ultimate-catalog.js';

// Un adversaire assez proche pour empêcher la récupération (parcours direct, sans liste temporaire).
// Un simple écart de positions écarte d'abord les personnages loin dans les deux sens du tour de carte.
function threatNear(state, list, candidate, settings) {
  const x = candidate.x, range = settings.recovery_safe_distance, far = range + 1e-6, length = state.world.length;
  for (const other of list) {
    const gap = Math.abs(other.x - x);
    if (gap > far && length - gap > far) continue;
    if (other.id !== candidate.id && other.faction_id && other.faction_id !== candidate.faction_id
      && distance(state, x, other.x) <= range) return true;
  }
  return false;
}

export function updateCandidateResistance(sim) {
  const { state, config, hz } = sim; const settings = config.balance.candidate_combat;
  for (const candidate of state.candidates) {
    if (candidate.eliminated || candidate.campaign_debate_id) continue;
    if (candidate.is_ko) {
      candidate.axis = 0; candidate.moving = false; candidate.campaign_active = false; candidate.interaction_active = false;
      // Candidat secondaire à terre : sa permanence ferme et s'achète. Prise par un autre, il ne revient pas.
      const site = candidate.minor ? state.buildings.find(b => b.id === minorSiteId(config, candidate)) : null;
      if (site?.owner_id === candidate.faction_id) neutralizeSite(sim, site, 'MINOR_KO');
      else if (site?.owner_id) {
        if (state.tick >= candidate.disappear_tick) defeatMinor(sim, candidate);
        continue;
      }
      if (state.tick >= candidate.respawn_tick) {
        // Le rideau de son QG se relève comme après un achat.
        if (site) { prepareBuildingShutterTransition(site, 'ACTIVE', state.tick, hz); claimMinorHeadquarters(sim, candidate, site.id); }
        const hq = state.buildings.find(b => b.id === candidate.headquarters_site_id && b.headquarters && b.owner_id === candidate.faction_id);
        candidate.x = hq?.x ?? candidate.last_hq_x ?? candidate.start_x;
        candidate.resistance = settings.resistance_max; candidate.is_ko = false; candidate.disappeared = false;
        clearCampaignUltimate(sim, candidate, true);
        candidate.combat = combatState(); candidate.campaign_active = true; candidate.interaction_active = true;
        sim.emit('CandidateRespawned', { candidate_id: candidate.id, target_id: hq?.id || null, x: candidate.x });
      } else if (state.tick >= candidate.disappear_tick) candidate.disappeared = true;
      continue;
    }
    const safe = !(threatNear(state, state.candidates, candidate, settings) || threatNear(state, state.npcs, candidate, settings)
      || threatNear(state, state.temporary_units, candidate, settings));
    // Sous les radars : la récupération commence tout de suite, même près d'un adversaire.
    if (invisibleToEnemies(candidate, state.tick) || safe && state.tick - candidate.last_damage_tick >= sim.secondsToTicks(settings.recovery_delay_seconds)) {
      candidate.resistance = Math.min(settings.resistance_max, candidate.resistance + settings.recovery_per_second / hz);
    }
  }
}

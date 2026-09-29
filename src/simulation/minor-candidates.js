import { ALL_FACTIONS, MINOR_FACTIONS, isMinorFaction, ringDelta } from './world.js';
import { aiNoise } from './ai-settings.js';
import { aiCombatCommands } from './ai-combat.js';
import { nearestEnemy } from './combat-state.js';
import { neutralizeSite } from './strategic-sites.js';
import { neutralizeSupporter } from './npc-votes.js';

/**
 * Candidats mineurs (Glucksmann, Roussel, Arthaud, Dupont-Aignan, Retailleau, Attal).
 * - QG = la permanence de leur sous-zone, imprenable tant qu'ils vivent (elle leur donne le contrôle de la zone) ;
 * - ils restent dans leur sous-zone (débordant un peu sur les voisines), convainquent jusqu'à 10 sympathisants
 *   et se battent avec le même système de combat que les autres candidats ;
 * - pas d'économie, pas de conquête ; battus, ils ne reviennent pas : le QG redevient neutre et
 *   leurs sympathisants restent les leurs jusqu'à être battus à leur tour ;
 * - au second tour, ils quittent la campagne et leurs sympathisants redeviennent neutres (report libre).
 */
export const minorSettings = config => config.balance.minor_candidates;
export const isMinorCandidate = c => !!c?.minor;
export const mainCandidates = state => state.candidates.filter(c => !c.minor);

export function minorSympathisantCount(state, faction) {
  return state.npcs.filter(n => n.faction_id === faction && ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(n.role)).length;
}

/** Un mineur a-t-il encore de la place pour un nouveau sympathisant ? */
export const minorCanRecruit = (state, config, c) => !c.minor || minorSympathisantCount(state, c.faction_id) < minorSettings(config).max_sympathisants;

/** Donne son QG au mineur au début de la partie (sans passer par l'achat). */
export function claimMinorHeadquarters(sim, candidate, siteId) {
  const building = sim.state.buildings.find(b => b.id === siteId);
  Object.assign(building, { owner_id: candidate.faction_id, level: 1, state: 'ACTIVE', active: true, neutral: false, headquarters: true, capture_progress: 0, closure_progress: 0 });
  candidate.headquarters_site_id = building.id; candidate.last_hq_x = building.x;
}

/** Territoire d'un mineur : sa sous-zone, plus une petite marge chez les voisins. */
export function minorTerritory(state, config, c) {
  const zone = state.world.subzones.find(z => z.id === c.minor_subzone_id);
  const reach = zone.width / 2 + minorSettings(config).border_units;
  return { zone, inside: x => Math.abs(ringDelta(zone.center, x, state.world.length)) <= reach };
}

/** Battu (K.-O.) : le mineur quitte définitivement la campagne et son QG redevient neutre. */
export function defeatMinor(sim, candidate, reason = 'KO') {
  if (candidate.eliminated) return;
  candidate.eliminated = true; candidate.disappeared = true; candidate.axis = 0; candidate.moving = false;
  candidate.campaign_active = false; candidate.interaction_active = false; candidate.persuasion_target_ids = [];
  for (const npc of sim.state.npcs) if (npc.persuasion?.actor_id === candidate.id) npc.persuasion = null;
  sim.state.attacks = sim.state.attacks.filter(a => a.owner_id !== candidate.id);
  const hq = sim.state.buildings.find(b => b.owner_id === candidate.faction_id);
  if (hq) neutralizeSite(sim, hq, 'MINOR_DEFEATED');
  candidate.headquarters_site_id = null;
  sim.emit('MinorCandidateDefeated', { candidate_id: candidate.id, faction_id: candidate.faction_id, reason });
}

/** Au second tour : les mineurs se retirent, leurs électeurs sont libres. */
export function retireMinorsForSecondRound(sim) {
  for (const candidate of sim.state.candidates.filter(c => c.minor)) defeatMinor(sim, candidate, 'SECOND_ROUND');
  for (const npc of sim.state.npcs.filter(n => isMinorFaction(n.faction_id))) neutralizeSupporter(sim, npc, 'REPORT_LIBRE');
}

/** IA d'un mineur : défendre son territoire, y recruter, s'y promener. */
export function minorAICommands(state, config, c) {
  const settings = minorSettings(config), hz = config.balance.simulation_architecture.fixed_tick_hz;
  const commands = (axis, active = true) => [{ type: 'SetCampaignActive', candidateId: c.id, active: state.ai_enabled && active },
    { type: 'InteractionPresence', candidateId: c.id, active: false }, { type: 'Move', candidateId: c.id, axis }];
  if (!state.ai_enabled || c.is_ko || c.eliminated) return commands(0, false);
  const { zone, inside } = minorTerritory(state, config, c);
  const toward = x => Math.sign(ringDelta(c.x, x, state.world.length));
  // 1. Un adversaire (candidat ou unité de combat) sur son territoire : on se bat.
  const enemy = nearestEnemy(state, c, settings.detection_range_units, target => inside(target.x));
  if (enemy) {
    const result = aiCombatCommands(state, config, c, enemy);
    const move = result.find(r => r.type === 'Move');
    if (move && !inside(c.x + move.axis * 0.5)) move.axis = 0;
    return result;
  }
  // 2. Sorti de son territoire (repoussé, poursuite) : on rentre.
  if (!inside(c.x)) return commands(toward(zone.center));
  // 3. Une conversation en cours : on reste.
  if (state.npcs.some(n => n.persuasion?.actor_id === c.id)) return commands(0);
  // 4. Recruter un passant neutre du territoire tant qu'il reste de la place.
  if (minorCanRecruit(state, config, c)) {
    const neutral = state.npcs.filter(n => n.role === 'NEUTRE' && !n.persuasion && inside(n.x))
      .sort((a, b) => Math.abs(ringDelta(c.x, a.x, state.world.length)) - Math.abs(ringDelta(c.x, b.x, state.world.length)) || a.id.localeCompare(b.id))[0];
    if (neutral) {
      const d = ringDelta(c.x, neutral.x, state.world.length);
      return commands(Math.abs(d) <= config.prototype.persuasion.radius_units * 0.6 ? 0 : Math.sign(d));
    }
  }
  // 5. Flânerie : un point de la sous-zone change toutes les quelques secondes, avec des pauses.
  const period = Math.max(1, Math.round(settings.roam_pause_seconds * 3 * hz)), slot = Math.floor(state.tick / period);
  const target = zone.start + zone.width * (0.15 + 0.7 * aiNoise(state.seed, `${c.id}:roam:${slot}`));
  const resting = aiNoise(state.seed, `${c.id}:rest:${slot}`) < 0.35;
  return commands(resting || Math.abs(ringDelta(c.x, target, state.world.length)) < 0.4 ? 0 : toward(target));
}

export function validateMinorConfig(config) {
  const entries = config.layout.minor_candidates;
  if (!Array.isArray(entries) || entries.map(e => e.faction_id).join() !== MINOR_FACTIONS.join()) throw new Error('Configuration : candidats mineurs incomplets.');
  for (const entry of entries) {
    const slot = config.layout.strategic_site_generation.slots.find(s => s.site_id === entry.site_id);
    if (!entry.name || !slot || slot.type !== 'permanence' || slot.subzone_id !== entry.subzone_id) throw new Error(`Configuration : QG du candidat mineur ${entry.faction_id} invalide.`);
    if (!config.prototype.presentation.factions[entry.faction_id]) throw new Error(`Configuration : couleur du candidat mineur ${entry.faction_id} absente.`);
  }
  if (typeof minorSettings(config).enabled !== 'boolean') throw new Error('Configuration : candidats mineurs enabled invalide.');
  for (const [key, value] of Object.entries(minorSettings(config))) if (key !== 'enabled' && (!Number.isFinite(value) || value <= 0)) throw new Error(`Configuration : candidats mineurs ${key} invalide.`);
  if (ALL_FACTIONS.length !== new Set(ALL_FACTIONS).size) throw new Error('Configuration : camps en double.');
}

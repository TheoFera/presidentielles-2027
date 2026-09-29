import { canCampaign } from './combat-state.js';
import { FACTIONS, ringDelta, zoneAt } from './world.js';

/**
 * Financiers occultes : des PNJ (pas des bâtiments) qui n'apparaissent qu'à un candidat autorisé,
 * fauché et seul dans leur sous-zone. Chacun ne signe qu'un seul contrat par partie.
 */
export function createFundingEncounters(world, config) {
  return config.layout.funding_npcs.map(slot => {
    const zone = world.subzones.find(z => z.id === slot.subzone_id);
    return { id: slot.id, kind: slot.kind, label: slot.label, subzone_id: slot.subzone_id, x_ratio: slot.x_ratio,
      factions: [...slot.factions], x: zone.start + zone.width * slot.x_ratio,
      candidate_id: null, hold_ticks: 0, cooldown_until_tick: 0, signed_candidate_id: null };
  });
}

const distance = (state, a, b) => Math.abs(ringDelta(a, b, state.world.length));
const present = c => !c.eliminated && !c.is_ko && !c.disappeared && !c.campaign_arena_id;
// Seuls les candidats en course pour l'Élysée sont des témoins gênants.
const witness = (state, encounter, candidate, settings) => state.candidates.some(c => c.id !== candidate.id && !c.minor
  && present(c) && distance(state, c.x, encounter.x) <= settings.witness_radius_units);

/** Conditions d'apparition : candidat autorisé, moins de 1 000 €, dans la sous-zone, sans témoin. */
function eligible(state, encounter, candidate, settings) {
  return present(candidate) && encounter.factions.includes(candidate.faction_id)
    && candidate.money * 1000 < settings.threshold_eur
    && zoneAt(state.world, candidate.x).id === encounter.subzone_id
    && distance(state, candidate.x, encounter.x) <= settings.appearance_radius_units
    && !witness(state, encounter, candidate, settings);
}

function hide(sim, encounter, reason) {
  if (encounter.candidate_id) sim.emit('FinancierDisappeared', { financier_id: encounter.id, reason });
  encounter.candidate_id = null; encounter.hold_ticks = 0;
  encounter.cooldown_until_tick = sim.state.tick + sim.secondsToTicks(sim.config.balance.funding_encounters.retry_seconds);
}

/**
 * Une IA ne cherche un financier que pour rattraper un humain nettement dominant (adaptation `boost` élevée),
 * et seulement si elle y a droit, est fauchée et peut s'y rendre sans témoin.
 */
export function aiFinancierTarget(state, config, candidate, adaptation) {
  const settings = config.balance.funding_encounters;
  if ((adaptation?.boost ?? 0) < settings.ai_boost_threshold || candidate.money * 1000 >= settings.threshold_eur) return null;
  return state.funding_encounters.filter(e => !e.signed_candidate_id && e.factions.includes(candidate.faction_id)
      && (e.candidate_id === null || e.candidate_id === candidate.id)
      && distance(state, candidate.x, e.x) <= settings.ai_search_radius_units && !witness(state, e, candidate, settings))
    .sort((a, b) => distance(state, candidate.x, a.x) - distance(state, candidate.x, b.x) || a.id.localeCompare(b.id))[0] || null;
}

/** Le financier visible pour ce candidat, s'il y en a un. */
export function visibleFinancier(state, candidateId) {
  return state.funding_encounters?.find(e => e.candidate_id === candidateId && !e.signed_candidate_id) || null;
}

export function updateFundingEncounters(sim) {
  const { state, config } = sim, settings = config.balance.funding_encounters;
  const activePhase = ['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase);
  for (const encounter of state.funding_encounters) {
    if (encounter.signed_candidate_id) continue;
    if (!activePhase) { if (encounter.candidate_id) hide(sim, encounter, 'PHASE'); continue; }
    let candidate = state.candidates.find(c => c.id === encounter.candidate_id);
    if (candidate && !eligible(state, encounter, candidate, settings)) { hide(sim, encounter, 'DISCRÉTION'); continue; }
    if (!candidate) {
      if (state.tick < encounter.cooldown_until_tick) continue;
      candidate = state.candidates.filter(c => eligible(state, encounter, c, settings))
        .sort((a, b) => distance(state, a.x, encounter.x) - distance(state, b.x, encounter.x) || a.id.localeCompare(b.id))[0];
      if (!candidate) continue;
      encounter.candidate_id = candidate.id;
      sim.emit('FinancierAppeared', { financier_id: encounter.id, candidate_id: candidate.id });
    }
    const signing = candidate.interaction_active && candidate.campaign_active && canCampaign(candidate)
      && !candidate.vehicle && !candidate.axis && !candidate.moving && !candidate.purchase_hold
      && candidate.combat.height === 0 && Math.abs(candidate.combat.knockback_velocity) < 0.02
      && distance(state, candidate.x, encounter.x) <= settings.sign_radius_units;
    if (!signing) { encounter.hold_ticks = 0; continue; }
    if (++encounter.hold_ticks < sim.secondsToTicks(settings.sign_seconds)) continue;
    const amount = settings.amount_eur / 1000;
    candidate.money += amount; candidate.total_earned += amount;
    encounter.signed_candidate_id = candidate.id;
    sim.emit('FundingContractSigned', { financier_id: encounter.id, candidate_id: candidate.id, amount_cents: Math.round(settings.amount_eur * 100) });
    encounter.candidate_id = null; encounter.hold_ticks = 0;
  }
}

export function validateFundingEncounters(state, config, fail) {
  const expected = createFundingEncounters(state.world, config);
  if (!Array.isArray(state.funding_encounters) || state.funding_encounters.length !== expected.length) fail('rendez-vous financiers absents');
  const known = id => state.candidates.some(c => c.id === id);
  state.funding_encounters.forEach((encounter, index) => {
    const slot = expected[index];
    if (!encounter || ['id', 'kind', 'label', 'subzone_id', 'x_ratio', 'x'].some(key => encounter[key] !== slot[key])
      || !Array.isArray(encounter.factions) || encounter.factions.join() !== slot.factions.join()
      || encounter.candidate_id !== null && !known(encounter.candidate_id)
      || encounter.signed_candidate_id !== null && (!known(encounter.signed_candidate_id) || encounter.candidate_id !== null)
      || !Number.isInteger(encounter.hold_ticks) || encounter.hold_ticks < 0
      || encounter.hold_ticks >= Math.ceil(config.balance.funding_encounters.sign_seconds * config.balance.simulation_architecture.fixed_tick_hz)
      || !encounter.candidate_id && encounter.hold_ticks !== 0
      || !Number.isInteger(encounter.cooldown_until_tick) || encounter.cooldown_until_tick < 0) fail('rendez-vous financier invalide');
  });
}

export function validateFundingConfig(config) {
  for (const slot of config.layout.funding_npcs) {
    if (!config.layout.biomes.some(b => b.subzones.some(z => z.id === slot.subzone_id)) || !(slot.x_ratio > 0 && slot.x_ratio < 1)
      || !Array.isArray(slot.factions) || !slot.factions.length || slot.factions.some(f => !FACTIONS.includes(f)))
      throw new Error(`Configuration : financier ${slot.id} invalide.`);
  }
  for (const [key, value] of Object.entries(config.balance.funding_encounters))
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Configuration : financement occulte ${key} invalide.`);
}

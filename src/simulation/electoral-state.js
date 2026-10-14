import { zoneController } from './zone-control.js';
import { ALL_FACTIONS, FACTIONS, zoneAt } from './world.js';

// Les candidats mineurs ont leurs propres voix (scores affichés).
export const SUPPORT_KEYS = [...ALL_FACTIONS, 'neutral', 'pending'];
// Recompté à chaque coup porté : ces fonctions évitent copies et tris (même résultat, bien plus rapide).
const EMPTY_SUPPORT = Object.freeze(Object.fromEntries(SUPPORT_KEYS.map(key => [key, 0])));
export const emptySupport = () => ({ ...EMPTY_SUPPORT });
const VOTING_ROLES = new Set(['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE']);
const VOTING_FACTIONS = new Set(ALL_FACTIONS);

/** Le camp en tête, seulement s’il est seul en tête. */
export function leadership(support) {
  let best = null, top = -Infinity, tied = false;
  for (const faction of ALL_FACTIONS) {
    const value = support[faction];
    if (value > top) { best = faction; top = value; tied = false; }
    else if (value === top) tied = true;
  }
  const leader = tied ? null : best;
  return { leader, controller: leader };
}

/** Chaque entrée locale est un nombre de PNJ, jamais un pourcentage fictif. */
export function aggregateNational(electorate) {
  return nationalShares(nationalCounts(electorate), electorate);
}

function nationalCounts(electorate) {
  const counts = emptySupport();
  for (const zone of electorate) for (const key of SUPPORT_KEYS) counts[key] += zone.support[key];
  return counts;
}

function nationalShares(counts, electorate) {
  let total = 0;
  for (const zone of electorate) total += zone.electoral_weight;
  const shares = {};
  for (const key of SUPPORT_KEYS) shares[key] = total ? counts[key] * 100 / total : 0;
  return shares;
}

export function refreshElectoralState(state) {
  const byZone = new Map(state.electorate.map(zone => [zone.subzone_id, zone]));
  for (const zone of state.electorate) zone.support = emptySupport();
  const born = new Map();
  for (const npc of state.npcs) {
    const zone = byZone.get(zoneAt(state.world, npc.x).id);
    const key = VOTING_ROLES.has(npc.role) && VOTING_FACTIONS.has(npc.faction_id) ? npc.faction_id : 'neutral';
    zone.support[key]++;
    born.set(npc.origin_subzone_id, (born.get(npc.origin_subzone_id) ?? 0) + 1);
  }
  for (const worldZone of state.world.subzones) byZone.get(worldZone.id).support.pending = worldZone.max_npcs_by_origin - (born.get(worldZone.id) ?? 0);
  const controlledCounts = { ...Object.fromEntries(ALL_FACTIONS.map(faction => [faction, 0])), contested: 0 };
  for (const zone of state.electorate) {
    zone.leader = leadership(zone.support).leader;
    zone.controller = zoneController(state, zone.subzone_id);
    controlledCounts[zone.controller || 'contested']++;
  }
  const counts = nationalCounts(state.electorate);
  state.actualGameState = {
    updated_tick: state.tick,
    national_counts: counts,
    national_support: nationalShares(counts, state.electorate),
    controlled_counts: controlledCounts,
    electorate_size: state.world.subzones.reduce((sum, zone) => sum + zone.max_npcs_by_origin, 0),
  };
}

export const createPolls = () => Object.fromEntries(FACTIONS.map(faction => [faction, {
  active: false, next_poll_tick: null, lastPollSnapshot: null,
}]));

export function publishPoll(sim, faction, institute) {
  refreshElectoralState(sim.state);
  const poll = sim.state.polls[faction];
  poll.lastPollSnapshot = {
    measured_tick: sim.state.tick,
    national_support: { ...sim.state.actualGameState.national_support },
    national_counts: { ...sim.state.actualGameState.national_counts },
    zones: sim.state.electorate.map(zone => ({
      subzone_id: zone.subzone_id, controller: zone.controller,
      support: { ...zone.support }, electoral_weight: zone.electoral_weight,
    })),
  };
  poll.active = true;
  poll.next_poll_tick = null;
  institute.last_poll_candidate_id = `candidate:${faction}`;
  institute.last_poll_tick = sim.state.tick;
  sim.emit('PollPurchased', { faction_id: faction, target_id: institute.id });
}

export function updatePolls(sim) {
  for (const poll of Object.values(sim.state.polls)) poll.next_poll_tick = null;
}

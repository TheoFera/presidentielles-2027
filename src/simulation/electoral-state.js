import { FACTIONS, zoneAt } from './world.js';

export const SUPPORT_KEYS = [...FACTIONS, 'neutral', 'pending'];
export const emptySupport = () => Object.fromEntries(SUPPORT_KEYS.map(key => [key, 0]));
const votingRole = role => ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(role);

export function leadership(support) {
  const order = [...FACTIONS].sort((a, b) => support[b] - support[a] || FACTIONS.indexOf(a) - FACTIONS.indexOf(b));
  const leader = support[order[0]] > support[order[1]] ? order[0] : null;
  return { leader, controller: leader };
}

/** Chaque entrée locale est un nombre de PNJ, jamais un pourcentage fictif. */
export function aggregateNational(electorate) {
  const counts = emptySupport();
  const total = electorate.reduce((sum, zone) => sum + zone.electoral_weight, 0);
  for (const zone of electorate) for (const key of SUPPORT_KEYS) counts[key] += zone.support[key];
  return Object.fromEntries(SUPPORT_KEYS.map(key => [key, total ? counts[key] * 100 / total : 0]));
}

export function refreshElectoralState(state) {
  const byZone = new Map(state.electorate.map(zone => [zone.subzone_id, zone]));
  for (const zone of state.electorate) zone.support = emptySupport();
  for (const npc of state.npcs) {
    const zone = byZone.get(zoneAt(state.world, npc.x).id);
    const key = votingRole(npc.role) && FACTIONS.includes(npc.faction_id) ? npc.faction_id : 'neutral';
    zone.support[key]++;
  }
  for (const worldZone of state.world.subzones) {
    const born = state.npcs.filter(npc => npc.origin_subzone_id === worldZone.id).length;
    byZone.get(worldZone.id).support.pending = worldZone.max_npcs_by_origin - born;
  }
  const controlledCounts = { ...Object.fromEntries(FACTIONS.map(faction => [faction, 0])), contested: 0 };
  for (const zone of state.electorate) {
    Object.assign(zone, leadership(zone.support));
    controlledCounts[zone.controller || 'contested']++;
  }
  const nationalCounts = emptySupport();
  for (const zone of state.electorate) for (const key of SUPPORT_KEYS) nationalCounts[key] += zone.support[key];
  state.actualGameState = {
    updated_tick: state.tick,
    national_counts: nationalCounts,
    national_support: aggregateNational(state.electorate),
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

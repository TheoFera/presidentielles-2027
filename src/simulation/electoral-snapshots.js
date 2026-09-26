import { FACTIONS } from './world.js';
import { aggregateNational, leadership, refreshElectoralState, SUPPORT_KEYS } from './electoral-state.js';

export function validateElectoralSnapshot(state, config, fail) {
  const integer = (value, min = 0) => Number.isInteger(value) && value >= min;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const validCounts = support => support && SUPPORT_KEYS.every(key => integer(support[key]));
  const totalCounts = zones => {
    const counts = Object.fromEntries(SUPPORT_KEYS.map(key => [key, 0]));
    for (const zone of zones) for (const key of SUPPORT_KEYS) counts[key] += zone.support[key];
    return counts;
  };
  const expected = structuredClone(state);
  refreshElectoralState(expected);
  if (!same(state.electorate, expected.electorate) || !same(state.actualGameState, expected.actualGameState)) fail('voix différentes des PNJ présents');
  if (Object.values(state.actualGameState.national_counts).reduce((sum, count) => sum + count, 0) !== config.layout.total_electors) fail('total des électeurs invalide');
  for (const faction of FACTIONS) {
    const poll = state.polls?.[faction];
    if (!poll || typeof poll.active !== 'boolean' || poll.next_poll_tick !== null || poll.active !== !!poll.lastPollSnapshot) fail('sondage invalide');
    const snapshot = poll.lastPollSnapshot;
    if (!snapshot) continue;
    if (!integer(snapshot.measured_tick) || snapshot.measured_tick > state.tick || !Array.isArray(snapshot.zones)
      || snapshot.zones.length !== state.electorate.length) fail('date ou sous-zones du sondage invalides');
    for (let i = 0; i < snapshot.zones.length; i++) {
      const zone = snapshot.zones[i];
      if (zone.subzone_id !== state.electorate[i].subzone_id || zone.electoral_weight !== state.electorate[i].electoral_weight
        || !validCounts(zone.support) || zone.controller !== leadership(zone.support).controller) fail('comptage du sondage invalide');
    }
    if (!same(snapshot.national_counts, totalCounts(snapshot.zones))
      || !same(snapshot.national_support, aggregateNational(snapshot.zones))
      || Object.values(snapshot.national_counts).reduce((sum, count) => sum + count, 0) !== config.layout.total_electors) fail('total du sondage incohérent');
  }
  for (const faction of FACTIONS) if (state.buildings.filter(building => building.type === 'tour_communication'
    && building.state === 'ACTIVE' && building.owner_id === faction).length > config.balance.buildings.tour_communication.global_limit) fail('limite de tours dépassée');
  for (const building of state.buildings) {
    if (building.type === 'tour_communication' && !integer(building.next_broadcast_tick)) fail('horloge de communication invalide');
    if (building.type !== 'meeting') continue;
    const candidate = state.candidates.find(item => item.id === building.meeting_candidate_id);
    if (!integer(building.meeting_until_tick) || !integer(building.meeting_started_tick, -1) || building.meeting_started_tick > state.tick
      || !integer(building.meeting_hold_ticks) || !integer(building.meeting_pause_ticks) || !integer(building.meetings_held)
      || !integer(building.meeting_wave_tick, -1) || building.meeting_wave_tick > state.tick
      || !building.meeting_ready_by_faction || !building.meeting_banned_until_by_faction
      || FACTIONS.some(faction => !integer(building.meeting_ready_by_faction[faction]) || !integer(building.meeting_banned_until_by_faction[faction]))
      || (building.meeting_candidate_id ? !candidate || candidate.faction_id !== building.meeting_faction_id
        || building.meeting_hold_ticks >= config.balance.buildings.meeting.hold_seconds * config.balance.simulation_architecture.fixed_tick_hz
        || building.meeting_pause_ticks > config.balance.buildings.meeting.pause_grace_seconds * config.balance.simulation_architecture.fixed_tick_hz
        : building.meeting_faction_id !== null || building.meeting_hold_ticks !== 0 || building.meeting_pause_ticks !== 0)) fail('état du promontoire invalide');
  }
}

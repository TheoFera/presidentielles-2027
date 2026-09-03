import { FACTIONS } from './world.js';
import { aggregateNational, leadership, SUPPORT_KEYS } from './electoral-state.js';
import { createElectorate } from './territory.js';

export function validateElectoralSnapshot(state, config, fail) {
  const integer = (n, min = 0) => Number.isInteger(n) && n >= min;
  const validSupport = s => s && SUPPORT_KEYS.every(f => Number.isFinite(s[f]) && s[f] >= 0 && s[f] <= 100)
    && Math.abs(SUPPORT_KEYS.reduce((sum, f) => sum + s[f], 0) - 100) < 1e-7;
  const sameSupport = (a, b) => validSupport(a) && SUPPORT_KEYS.every(f => Math.abs(a[f] - b[f]) < 1e-7);
  const expected = createElectorate(state.world, config);
  const counts = { melenchon: 0, le_pen: 0, philippe: 0, contested: 0 };
  state.electorate.forEach((e, i) => {
    const control = leadership(e.support, config);
    if (e.leader !== control.leader || e.controller !== control.controller) fail('contrôle électoral incohérent');
    counts[e.controller || 'contested']++;
    for (const key of ['electoral_weight', 'adjacent_subzone_ids', 'adjacent_biome_ids']) if (JSON.stringify(e[key]) !== JSON.stringify(expected[i][key])) fail('poids ou voisinage électoral différent');
    for (const f of FACTIONS) {
      const source = e.influence_sources?.[f];
      if (!source || Object.keys(expected[i].influence_sources[f]).some(k => !Number.isFinite(source[k]) || source[k] < 0)) fail('sources d’influence invalides');
    }
  });
  if (!state.actualGameState || !integer(state.actualGameState.updated_tick) || state.actualGameState.updated_tick > state.tick
    || !sameSupport(state.actualGameState.national_support, aggregateNational(state.electorate))
    || Object.keys(counts).some(f => state.actualGameState.controlled_counts?.[f] !== counts[f])) fail('score national réel incohérent');
  for (const f of FACTIONS) {
    const poll = state.polls?.[f];
    if (!poll || typeof poll.active !== 'boolean' || (poll.next_poll_tick !== null && (!integer(poll.next_poll_tick) || poll.next_poll_tick <= state.tick))) fail('horloge du sondage invalide');
    const instituteActive = state.buildings.some(b => b.type === 'institut_sondage' && b.owner_id === f && b.state === 'ACTIVE');
    if (poll.active !== instituteActive || (!poll.active && poll.next_poll_tick !== null)) fail('activité de l’Institut incohérente');
    if (poll.active && (!poll.lastPollSnapshot || poll.next_poll_tick === null)) fail('Institut actif sans sondage');
    const snapshot = poll.lastPollSnapshot;
    if (!snapshot) continue;
    if (!integer(snapshot.measured_tick) || snapshot.measured_tick > state.tick || !Array.isArray(snapshot.zones) || snapshot.zones.length !== expected.length) fail('sondage invalide');
    snapshot.zones.forEach((z, i) => {
      if (z.subzone_id !== expected[i].subzone_id || z.electoral_weight !== expected[i].electoral_weight || !validSupport(z.support)
        || z.controller !== leadership(z.support, config).controller) fail('territoires du sondage invalides');
    });
    if (!sameSupport(snapshot.national_support, aggregateNational(snapshot.zones))) fail('agrégation du sondage incohérente');
  }
  for (const f of FACTIONS) if (state.buildings.filter(b => b.type === 'tour_communication' && b.state === 'ACTIVE' && b.owner_id === f).length > config.balance.buildings.tour_communication.global_limit) fail('limite de Tours dépassée');
  for (const b of state.buildings.filter(b => b.type === 'meeting')) {
    if (!integer(b.meeting_ready_tick) || !integer(b.meeting_until_tick) || !integer(b.meeting_started_tick, -1) || b.meeting_started_tick > state.tick
      || !integer(b.meeting_level) || b.meeting_level > config.balance.buildings.meeting.max_level || !integer(b.meetings_held)
      || (b.meeting_until_tick > state.tick && (b.state !== 'ACTIVE' || !b.meeting_level || b.meeting_ready_tick < b.meeting_until_tick))) fail('état du Meeting invalide');
  }
}

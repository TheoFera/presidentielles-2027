import { FACTIONS } from './world.js';

export const SUPPORT_KEYS = [...FACTIONS, 'neutral'];
export const emptySupport = () => Object.fromEntries(SUPPORT_KEYS.map(f => [f, 0]));

/** Conserves the electorate, including under extreme debug rates and rounding. */
export function normalizeSupport(support) {
  for (const f of SUPPORT_KEYS) support[f] = Math.max(0, support[f]);
  const sum = SUPPORT_KEYS.reduce((s, f) => s + support[f], 0);
  if (!sum) { support.neutral = 100; return support; }
  if (Math.abs(sum - 100) > 1e-12) for (const f of SUPPORT_KEYS) support[f] *= 100 / sum;
  const largest = SUPPORT_KEYS.reduce((a, b) => support[a] >= support[b] ? a : b);
  support[largest] += 100 - SUPPORT_KEYS.reduce((s, f) => s + support[f], 0);
  return support;
}

export function leadership(support, config) {
  const order = [...FACTIONS].sort((a, b) => support[b] - support[a] || FACTIONS.indexOf(a) - FACTIONS.indexOf(b));
  const lead = support[order[0]] - support[order[1]];
  return { leader: lead > 1e-10 ? order[0] : null,
    controller: support[order[0]] >= config.balance.influence.control_min_leader_percent
      && lead >= config.balance.influence.control_required_lead_points ? order[0] : null };
}

export function aggregateNational(electorate) {
  const result = emptySupport();
  const total = electorate.reduce((s, e) => s + e.electoral_weight, 0);
  for (const e of electorate) for (const f of SUPPORT_KEYS) result[f] += e.support[f] * e.electoral_weight / total;
  return normalizeSupport(result);
}

export function refreshElectoralState(state, config) {
  const counts = { melenchon: 0, le_pen: 0, philippe: 0, contested: 0 };
  for (const e of state.electorate) {
    normalizeSupport(e.support);
    Object.assign(e, leadership(e.support, config));
    counts[e.controller || 'contested']++;
  }
  state.actualGameState = { updated_tick: state.tick, national_support: aggregateNational(state.electorate), controlled_counts: counts };
}

/** All receivers draw from the same pre-transfer values, never from loop order. */
export function convertInfluence(election, budgets, config) {
  const before = { ...election.support };
  const settings = config.balance.influence;
  const resistance = Math.pow(before.neutral / 100, settings.neutral_resistance_curve_power);
  const requested = FACTIONS.map(f => Math.max(0, budgets[f] || 0) * resistance);
  const total = requested.reduce((a, b) => a + b, 0);
  const scale = total ? Math.min(1, before.neutral / total) : 0;
  for (let i = 0; i < FACTIONS.length; i++) {
    election.support[FACTIONS[i]] += requested[i] * scale;
    election.support.neutral -= requested[i] * scale;
  }
  if (before.neutral < settings.allow_opponent_conversion_below_neutral_percent) {
    const transfers = [];
    for (const receiver of FACTIONS) {
      const available = FACTIONS.filter(f => f !== receiver).reduce((s, f) => s + before[f], 0);
      if (!available) continue;
      for (const donor of FACTIONS.filter(f => f !== receiver)) transfers.push({ donor, receiver,
        amount: Math.max(0, budgets[receiver] || 0) * (1 - resistance) * settings.opponent_conversion_multiplier * before[donor] / available });
    }
    for (const donor of FACTIONS) {
      const outgoing = transfers.filter(t => t.donor === donor);
      const demand = outgoing.reduce((s, t) => s + t.amount, 0);
      const ratio = demand ? Math.min(1, before[donor] / demand) : 0;
      for (const t of outgoing) { election.support[donor] -= t.amount * ratio; election.support[t.receiver] += t.amount * ratio; }
    }
  }
  normalizeSupport(election.support);
  return Object.fromEntries(SUPPORT_KEYS.map(f => [f, election.support[f] - before[f]]));
}

export const createPolls = () => Object.fromEntries(FACTIONS.map(f => [f, { active: false, next_poll_tick: null, lastPollSnapshot: null }]));

export function updatePolls(sim) {
  const { state, config } = sim;
  for (const faction of FACTIONS) {
    const poll = state.polls[faction];
    const active = state.buildings.some(b => b.type === 'institut_sondage' && b.owner_id === faction && b.state === 'ACTIVE');
    if (!active) { poll.active = false; poll.next_poll_tick = null; continue; }
    if (!poll.active || !poll.lastPollSnapshot || state.tick >= poll.next_poll_tick) {
      poll.lastPollSnapshot = { measured_tick: state.tick, national_support: { ...state.actualGameState.national_support },
        zones: state.electorate.map(e => ({ subzone_id: e.subzone_id, controller: e.controller, support: { ...e.support }, electoral_weight: e.electoral_weight })) };
      poll.next_poll_tick = state.tick + sim.secondsToTicks(state.phase === 'SECOND_ROUND_SPRINT' ? config.balance.second_round.poll_refresh_seconds : config.balance.buildings.institut_sondage.poll_refresh_seconds);
      sim.emit('PollPublished', { faction_id: faction });
    }
    poll.active = true;
  }
}

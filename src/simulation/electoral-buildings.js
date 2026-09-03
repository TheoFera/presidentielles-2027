import { wrap } from './world.js';
import { convertInfluence, refreshElectoralState } from './electoral-state.js';
import { GamePhase, influenceMultiplier } from './phases.js';
import { paymentStatus } from './campaign-budget.js';

export function meetingOffers(state, config, candidate, building) {
  if (building.owner_id !== candidate.faction_id || building.state !== 'ACTIVE') return [];
  const settings = config.balance.buildings.meeting;
  const quote = (kind, cost, x, radius, reason, label) => ({ target_id: building.id, kind,
    key: `${building.id}:${kind}:${building.level}`, cost, x: wrap(x, state.world.length), radius, label,
    required_ticks: Math.ceil(settings.purchase_hold_seconds * config.balance.simulation_architecture.fixed_tick_hz),
    ...paymentStatus(candidate, config, cost, reason) });
  const offers = [quote('MEETING', settings.activation_cost_by_level[building.level - 1], building.x, settings.interaction_radius,
    state.tick < building.meeting_ready_tick ? 'COOLDOWN' : null, 'MEETING')];
  if (building.level < settings.max_level) offers.push(quote('UPGRADE', settings.upgrade_costs[building.level - 1], building.x + settings.upgrade_offset, settings.upgrade_radius, null, 'AMÉLIORER'));
  return offers;
}

export function triggerMeeting(sim, building) {
  const { state, config } = sim;
  const settings = config.balance.buildings.meeting;
  const election = state.electorate.find(e => e.subzone_id === building.subzone_id);
  const before = { ...election.support };
  const budget = settings.influence_burst_by_level[building.level - 1] * (building.owner_id === 'le_pen' ? config.balance.influence.le_pen_gain_multiplier : 1) * influenceMultiplier(state, config);
  convertInfluence(election, { [building.owner_id]: budget }, config);
  building.meeting_started_tick = state.tick;
  building.meeting_level = building.level;
  building.meeting_until_tick = state.tick + sim.secondsToTicks(settings.duration_seconds_by_level[building.level - 1]);
  building.meeting_ready_tick = state.tick + sim.secondsToTicks(state.phase === GamePhase.SECOND_ROUND_SPRINT ? Math.max(settings.duration_seconds_by_level[building.level - 1], config.balance.second_round.meeting_cooldown_seconds) : settings.internal_cooldown_seconds_by_level[building.level - 1]);
  building.meetings_held++;
  refreshElectoralState(state, config);
  sim.emit('MeetingStarted', { target_id: building.id, faction_id: building.owner_id, influence_budget: budget, before, after: { ...election.support } });
}

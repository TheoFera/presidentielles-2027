import { wrap } from './world.js';
import { convertInfluence, refreshElectoralState } from './electoral-state.js';
import { GamePhase, influenceMultiplier } from './phases.js';
import { paymentStatus } from './campaign-budget.js';
import { localPoliticalPresence } from './strategic-sites.js';

export function meetingOffers(state, config, candidate, building) {
  if (building.ownership_model !== 'neutral_service' || building.state !== 'ACTIVE') return [];
  const settings = config.balance.buildings.meeting;
  const quote = (kind, cost, x, radius, reason, label) => ({ target_id: building.id, kind,
    key: `${building.id}:${kind}:${candidate.faction_id}`, cost, x: wrap(x, state.world.length), radius, label,
    required_ticks: Math.ceil(settings.purchase_hold_seconds * config.balance.simulation_architecture.fixed_tick_hz),
    ...paymentStatus(candidate, config, cost, reason) });
  const reason = state.tick < building.meeting_banned_until_by_faction[candidate.faction_id] ? 'ADMINISTRATIVE_BAN'
    : state.tick < building.meeting_ready_by_faction[candidate.faction_id] ? 'COOLDOWN'
    : localPoliticalPresence(state, building.subzone_id, candidate.faction_id) < settings.required_presence_N1 ? 'INSUFFICIENT_PRESENCE' : null;
  return [quote('MEETING', settings.activation_cost_by_level[0], building.x, settings.interaction_radius, reason, 'MEETING')];
}

export function triggerMeeting(sim, building, faction = building.owner_id) {
  const { state, config } = sim;
  const settings = config.balance.buildings.meeting;
  const election = state.electorate.find(e => e.subzone_id === building.subzone_id);
  const before = { ...election.support };
  const budget = settings.influence_burst_by_level[0] * (faction === 'le_pen' ? config.balance.influence.le_pen_gain_multiplier : 1) * influenceMultiplier(state, config);
  convertInfluence(election, { [faction]: budget }, config);
  building.meeting_started_tick = state.tick;
  building.meeting_level = 1; building.meeting_faction_id = faction;
  building.meeting_until_tick = state.tick + sim.secondsToTicks(settings.duration_seconds_by_level[0]);
  building.meeting_ready_by_faction[faction] = state.tick + sim.secondsToTicks(state.phase === GamePhase.SECOND_ROUND_SPRINT ? Math.max(settings.duration_seconds_by_level[0], config.balance.second_round.meeting_cooldown_seconds) : settings.internal_cooldown_seconds_by_level[0]);
  building.meetings_held++;
  refreshElectoralState(state, config);
  sim.emit('MeetingStarted', { target_id: building.id, faction_id: faction, influence_budget: budget, before, after: { ...election.support } });
}

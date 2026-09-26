import { ringDelta, wrap, zoneAt } from './world.js';
import { convertNeutral, neutralizeSupporter, pickNpc } from './npc-votes.js';
import { refreshElectoralState } from './electoral-state.js';
import { paymentStatus } from './campaign-budget.js';
import { localPoliticalPresence } from './strategic-sites.js';

export function meetingOffers(state, config, candidate, building) {
  if (building.ownership_model !== 'neutral_service' || building.state !== 'ACTIVE') return [];
  const settings = config.balance.buildings.meeting;
  const reason = building.meeting_candidate_id ? 'COOLDOWN'
    : state.tick < building.meeting_banned_until_by_faction[candidate.faction_id] ? 'ADMINISTRATIVE_BAN'
      : state.tick < building.meeting_ready_by_faction[candidate.faction_id] ? 'COOLDOWN'
        : localPoliticalPresence(state, building.subzone_id, candidate.faction_id) < settings.required_presence_N1 ? 'INSUFFICIENT_PRESENCE' : null;
  const cost = settings.activation_cost;
  return [{ target_id: building.id, kind: 'MEETING', key: `${building.id}:MEETING:${candidate.faction_id}`,
    cost, x: wrap(building.x, state.world.length), radius: settings.interaction_radius, label: 'LANCER LE MEETING',
    required_ticks: Math.ceil(settings.purchase_hold_seconds * config.balance.simulation_architecture.fixed_tick_hz),
    ...paymentStatus(candidate, config, cost, reason) }];
}

export function triggerMeeting(sim, building, faction, candidateId = `candidate:${faction}`) {
  if (building.meeting_candidate_id || building.state !== 'ACTIVE') return false;
  const candidate = sim.state.candidates.find(c => c.id === candidateId && c.faction_id === faction && !c.eliminated);
  if (!candidate) return false;
  building.meeting_candidate_id = candidate.id;
  building.meeting_faction_id = faction;
  building.meeting_started_tick = sim.state.tick;
  building.meeting_hold_ticks = 0;
  building.meeting_pause_ticks = 0;
  building.meeting_until_tick = sim.state.tick + sim.secondsToTicks(sim.config.balance.buildings.meeting.hold_seconds + sim.config.balance.buildings.meeting.pause_grace_seconds);
  for (const npc of sim.state.npcs) {
    if (['NEUTRE', 'SYMPATHISANT'].includes(npc.role) && zoneAt(sim.state.world, npc.x).biome_id === building.biome_id) {
      npc.meeting_target_id = building.id;
    }
  }
  sim.emit('MeetingStarted', { target_id: building.id, faction_id: faction, candidate_id: candidate.id });
  return true;
}

export function meetingAttendeeStep(sim, npc) {
  const building = sim.state.buildings.find(b => b.id === npc.meeting_target_id && b.meeting_candidate_id);
  if (!building || !['NEUTRE', 'SYMPATHISANT'].includes(npc.role)) {
    npc.meeting_target_id = null;
    return false;
  }
  const settings = sim.config.balance.buildings.meeting;
  const idNumber = Number(npc.id.slice(4));
  const offset = ((idNumber % 9) - 4) * settings.gather_spacing;
  const destination = wrap(building.x + offset, sim.state.world.length);
  const delta = ringDelta(npc.x, destination, sim.state.world.length);
  const step = settings.gather_speed / sim.hz;
  npc.moving = Math.abs(delta) > step;
  if (npc.moving) npc.facing = Math.sign(delta);
  npc.x = wrap(npc.x + Math.sign(delta) * Math.min(Math.abs(delta), step), sim.state.world.length);
  return true;
}

function finishMeeting(sim, building, valid) {
  const { state, config } = sim;
  const faction = building.meeting_faction_id;
  const candidateId = building.meeting_candidate_id;
  let converted = 0, neutralized = 0;
  if (valid) {
    const attendees = state.npcs.filter(npc => zoneAt(state.world, npc.x).id === building.subzone_id);
    const neutral = attendees.filter(npc => npc.role === 'NEUTRE');
    const adversaries = attendees.filter(npc => npc.role === 'SYMPATHISANT' && npc.faction_id !== faction);
    for (const npc of neutral) if (convertNeutral(sim, npc, faction, 'MEETING')) converted++;
    for (const npc of adversaries) if (neutralizeSupporter(sim, npc, 'MEETING')) neutralized++;
    building.meetings_held++;
    building.meeting_wave_tick = state.tick;
  }
  building.meeting_ready_by_faction[faction] = state.tick + sim.secondsToTicks(config.balance.buildings.meeting.cooldown_seconds);
  building.meeting_candidate_id = null;
  building.meeting_faction_id = null;
  building.meeting_until_tick = 0;
  building.meeting_hold_ticks = 0;
  building.meeting_pause_ticks = 0;
  for (const npc of state.npcs) if (npc.meeting_target_id === building.id) npc.meeting_target_id = null;
  refreshElectoralState(state);
  sim.emit(valid ? 'MeetingValidated' : 'MeetingCancelled', {
    target_id: building.id, faction_id: faction, candidate_id: candidateId, converted, neutralized,
  });
}

export function cancelMeeting(sim, building) {
  if (building.meeting_candidate_id) finishMeeting(sim, building, false);
}

export function updateElectoralBuildings(sim) {
  const { state, config } = sim;
  const meeting = config.balance.buildings.meeting;
  const tower = config.balance.buildings.tour_communication;
  for (const building of state.buildings) {
    if (building.type === 'meeting' && building.meeting_candidate_id) {
      const candidate = state.candidates.find(c => c.id === building.meeting_candidate_id);
      const holding = candidate && !candidate.is_ko && !candidate.eliminated && !candidate.combat.stun_ticks
        && candidate.podium_site_id === building.id
        && candidate.combat.height >= meeting.podium_height
        && Math.abs(ringDelta(candidate.x, building.x, state.world.length)) <= meeting.podium_half_width;
      if (holding) {
        building.meeting_hold_ticks++;
        building.meeting_pause_ticks = 0;
      } else building.meeting_pause_ticks++;
      const remaining = Math.max(0, sim.secondsToTicks(meeting.hold_seconds) - building.meeting_hold_ticks);
      building.meeting_until_tick = state.tick + remaining + sim.secondsToTicks(meeting.pause_grace_seconds) - building.meeting_pause_ticks;
      if (building.meeting_hold_ticks >= sim.secondsToTicks(meeting.hold_seconds)) finishMeeting(sim, building, true);
      else if (building.meeting_pause_ticks > sim.secondsToTicks(meeting.pause_grace_seconds)) finishMeeting(sim, building, false);
    }
    if (building.type !== 'tour_communication') continue;
    if (building.state !== 'ACTIVE' || !building.owner_id) { building.next_broadcast_tick = 0; continue; }
    if (!building.next_broadcast_tick) building.next_broadcast_tick = state.tick + sim.secondsToTicks(tower.broadcast_interval_seconds);
    if (state.tick < building.next_broadcast_tick) continue;
    const eligible = state.npcs.filter(npc => npc.role === 'NEUTRE'
      || npc.role === 'SYMPATHISANT' && npc.faction_id !== building.owner_id);
    const npc = pickNpc(sim, eligible);
    if (npc) {
      if (npc.role === 'NEUTRE') convertNeutral(sim, npc, building.owner_id, 'COMMUNICATION');
      else neutralizeSupporter(sim, npc, 'COMMUNICATION');
      sim.emit('CommunicationBroadcast', { target_id: building.id, npc_id: npc.id, faction_id: building.owner_id });
    }
    building.next_broadcast_tick = state.tick + sim.secondsToTicks(tower.broadcast_interval_seconds);
  }
}

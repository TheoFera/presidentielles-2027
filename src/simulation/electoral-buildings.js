import { ringDelta, wrap, zoneAt } from './world.js';
import { convertNeutral, neutralizeSupporter, pickNpc } from './npc-votes.js';
import { refreshElectoralState } from './electoral-state.js';
import { paymentStatus } from './campaign-budget.js';
import { localPoliticalPresence } from './strategic-sites.js';

export function candidateOnMeetingStage(state, config, candidate, building) {
  return !!building && candidate?.podium_site_id === building.id
    && candidate.combat.height >= config.balance.buildings.meeting.podium_height
    && Math.abs(ringDelta(candidate.x, building.x, state.world.length)) <= config.balance.buildings.meeting.podium_half_width;
}

export function meetingOffers(state, config, candidate, building) {
  if (building.ownership_model !== 'neutral_service' || building.state !== 'ACTIVE') return [];
  const settings = config.balance.buildings.meeting;
  const reason = building.meeting_candidate_id ? 'COOLDOWN'
    : state.tick < building.meeting_banned_until_by_faction[candidate.faction_id] ? 'ADMINISTRATIVE_BAN'
      : state.tick < building.meeting_ready_by_faction[candidate.faction_id] ? 'COOLDOWN'
        : localPoliticalPresence(state, building.subzone_id, candidate.faction_id) < settings.required_presence_N1 ? 'INSUFFICIENT_PRESENCE'
          : !candidateOnMeetingStage(state, config, candidate, building) ? 'NOT_ON_STAGE' : null;
  const cost = settings.activation_cost;
  return [{ target_id: building.id, kind: 'MEETING', key: `${building.id}:MEETING:${candidate.faction_id}`,
    cost, x: wrap(building.x, state.world.length), radius: settings.podium_half_width, label: 'LANCER LE MEETING',
    required_ticks: Math.ceil(settings.purchase_hold_seconds * config.balance.simulation_architecture.fixed_tick_hz),
    ...paymentStatus(candidate, config, cost, reason) }];
}

export function triggerMeeting(sim, building, faction, candidateId = `candidate:${faction}`) {
  if (building.meeting_candidate_id || building.state !== 'ACTIVE') return false;
  const candidate = sim.state.candidates.find(c => c.id === candidateId && c.faction_id === faction && !c.eliminated);
  if (!candidate || !candidateOnMeetingStage(sim.state, sim.config, candidate, building)) return false;
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
  const idNumber = Number(npc.id.slice(4)) || 0;
  const destination = wrap(building.x + meetingCrowdOffset(idNumber, settings), sim.state.world.length);
  const delta = ringDelta(npc.x, destination, sim.state.world.length);
  // Chacun marche à son rythme : la foule arrive par vagues au lieu d'un bloc synchronisé.
  const step = settings.gather_speed * (0.75 + 0.5 * ((idNumber * 0.381966) % 1)) / sim.hz;
  npc.moving = Math.abs(delta) > step;
  if (npc.moving) npc.facing = Math.sign(delta);
  else npc.facing = Math.sign(ringDelta(npc.x, building.x, sim.state.world.length)) || npc.facing;
  npc.x = wrap(npc.x + Math.sign(delta) * Math.min(Math.abs(delta), step), sim.state.world.length);
  return true;
}

/** Place stable dans la foule : les flancs de la scène se remplissent, le centre reste dégagé pour voir l'orateur. */
export function meetingCrowdOffset(idNumber, settings) {
  const side = idNumber % 2 ? 1 : -1;
  const spread = (idNumber * 0.6180339887) % 1;
  const inner = settings.podium_half_width * 0.45;
  return side * (inner + spread * (settings.podium_half_width * 0.55 + settings.gather_spacing * 5));
}

/** Rayon de l'onde de fin de meeting, en unités du monde. Partagé par la simulation et l'affichage. */
export function meetingWaveRadius(state, config, building, elapsedTicks) {
  const zone = state.world.subzones.find(item => item.id === building.subzone_id);
  const reach = zone ? Math.max(building.x - zone.start, zone.end - building.x) : 0;
  const duration = config.balance.buildings.meeting.wave_visual_seconds * config.balance.simulation_architecture.fixed_tick_hz;
  const progress = Math.max(0, Math.min(1, elapsedTicks / duration));
  return reach * Math.sin(progress * Math.PI / 2);
}

// L'onde convertit chaque PNJ marqué au moment exact où le cercle l'atteint.
function propagateMeetingWave(sim, building) {
  const { state, config } = sim;
  const faction = building.meeting_wave_faction_id;
  const elapsed = state.tick - building.meeting_wave_tick;
  const finished = elapsed >= sim.secondsToTicks(config.balance.buildings.meeting.wave_visual_seconds);
  const radius = meetingWaveRadius(state, config, building, elapsed);
  let changed = false;
  for (const npc of state.npcs) {
    if (npc.meeting_wave_id !== building.id) continue;
    if (!finished && Math.abs(ringDelta(npc.x, building.x, state.world.length)) > radius) continue;
    npc.meeting_wave_id = null;
    if (npc.role === 'NEUTRE') changed = convertNeutral(sim, npc, faction, 'MEETING') || changed;
    else if (npc.role === 'SYMPATHISANT' && npc.faction_id !== faction) changed = neutralizeSupporter(sim, npc, 'MEETING') || changed;
  }
  if (finished) building.meeting_wave_faction_id = null;
  if (changed) refreshElectoralState(state);
}

function finishMeeting(sim, building, valid) {
  const { state, config } = sim;
  const faction = building.meeting_faction_id;
  const candidateId = building.meeting_candidate_id;
  let reached = 0;
  if (valid) {
    // Les PNJ présents sont marqués maintenant ; l'onde les fait basculer un à un en s'étendant.
    for (const npc of state.npcs) {
      if (zoneAt(state.world, npc.x).id !== building.subzone_id) continue;
      if (npc.role === 'NEUTRE' || npc.role === 'SYMPATHISANT' && npc.faction_id !== faction) { npc.meeting_wave_id = building.id; reached++; }
    }
    building.meetings_held++;
    building.meeting_wave_tick = state.tick;
    building.meeting_wave_faction_id = faction;
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
    target_id: building.id, faction_id: faction, candidate_id: candidateId, reached,
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
        && candidateOnMeetingStage(state, config, candidate, building);
      if (holding) {
        building.meeting_hold_ticks++;
        building.meeting_pause_ticks = 0;
      } else building.meeting_pause_ticks++;
      const remaining = Math.max(0, sim.secondsToTicks(meeting.hold_seconds) - building.meeting_hold_ticks);
      building.meeting_until_tick = state.tick + remaining + sim.secondsToTicks(meeting.pause_grace_seconds) - building.meeting_pause_ticks;
      if (building.meeting_hold_ticks >= sim.secondsToTicks(meeting.hold_seconds)) finishMeeting(sim, building, true);
      else if (building.meeting_pause_ticks > sim.secondsToTicks(meeting.pause_grace_seconds)) finishMeeting(sim, building, false);
    }
    if (building.type === 'meeting' && building.meeting_wave_faction_id) propagateMeetingWave(sim, building);
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

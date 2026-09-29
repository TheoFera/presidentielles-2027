import { canCampaign, interrupted } from './combat-state.js';
import { convertNeutral, neutralizeSupporter } from './npc-votes.js';
import { random, ringDelta, wrap, zoneAt } from './world.js';
import { stableIdOrder } from './territory.js';

const position = (sim, npc, target, speed) => {
  const delta = ringDelta(npc.x, target, sim.state.world.length);
  const step = Math.min(Math.abs(delta), speed / sim.hz);
  npc.moving = step > 0.005;
  if (npc.moving) npc.facing = Math.sign(delta);
  npc.x = wrap(npc.x + Math.sign(delta) * step, sim.state.world.length);
  return Math.abs(delta) <= speed / sim.hz;
};

export function startRally(sim, event) {
  const { state } = sim;
  const zones = state.world.subzones.filter(z => z.biome_id === event.target_biome_id);
  const direction = random(state.campaign_director) < 0.5 ? 1 : -1;
  const start = zones[direction > 0 ? 0 : 2].center, end = zones[direction > 0 ? 2 : 0].center;
  const eligible = state.npcs.filter(n => zoneAt(state.world, n.x).biome_id === event.target_biome_id
    && n.role !== 'DEMOBILISE' && !n.rally_event_id).sort(stableIdOrder);
  // Un mélange déterministe évite de choisir toujours les mêmes identités.
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(random(state.campaign_director) * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const participants = eligible.slice(0, Math.ceil(eligible.length * event.parameters.participation_ratio));
  const participantIds = new Set(participants.map(n => n.id));
  event.march = { phase: 'GATHERING', direction, start_x: start, end_x: end, center_x: start,
    phase_tick: state.tick, participant_ids: participants.map(n => n.id) };
  const maxDistance = participants.reduce((max, n) => Math.max(max, Math.abs(ringDelta(n.x, start, state.world.length))), 0);
  event.march.gather_until_tick = state.tick + sim.secondsToTicks(Math.max(event.parameters.gather_seconds, maxDistance / event.parameters.gather_speed + 2));
  event.end_tick = event.march.gather_until_tick + sim.secondsToTicks(Math.abs(end - start) / event.parameters.march_speed + 3);
  participants.forEach((npc, index) => {
    for (const b of state.buildings) for (const order of b.queue) if (order.assigned_npc_id === npc.id) order.assigned_npc_id = null;
    npc.task = null; npc.meeting_target_id = null; npc.persuasion = null; npc.persuasion_target_ids = [];
    npc.pressure_target_id = null; npc.raid = null;
    npc.rally_event_id = event.id; npc.rally_index = index; npc.rally_return_x = null;
    npc.rally_conversion = null; npc.rally_immune_until_tick = 0;
  });
  for (const actor of [...state.candidates, ...state.npcs]) {
    actor.persuasion_target_ids = actor.persuasion_target_ids.filter(id => !participantIds.has(id));
    if (participantIds.has(actor.persuasion?.actor_id)) actor.persuasion = null;
  }
}

// Chaque marcheur a sa propre place dans le cortège : côte à côte, jamais empilés.
// Les voisins alternent de rang (avant, milieu, arrière) pour donner de la profondeur au groupe.
function crowdTarget(event, npc) {
  const count = event.march.participant_ids.length;
  return event.march.center_x + (npc.rally_index - (count - 1) / 2) * event.parameters.crowd_spacing
    + Math.sin(npc.rally_index * 2.4) * 0.04;
}

export function finishRally(sim, event) {
  if (!event.march) return;
  event.march.phase = 'DISPERSING';
  for (const npc of sim.state.npcs.filter(n => n.rally_event_id === event.id)) {
    const origin = sim.state.world.socialPoints.find(p => p.id === npc.origin_social_point_id);
    const zone = sim.state.world.subzones.find(z => z.id === npc.origin_subzone_id);
    npc.rally_event_id = null; npc.rally_conversion = null; npc.task = null;
    npc.rally_return_x = Math.max(zone.start + 1, Math.min(zone.end - 1, origin.x + Math.sin(npc.rally_index * 2.4) * 3));
    npc.roam_target_x = npc.rally_return_x;
  }
}

export function updateRally(sim, event) {
  const { state } = sim, march = event.march, settings = event.parameters;
  if (!march) return false;
  if (march.phase === 'GATHERING' && state.tick >= march.gather_until_tick) {
    march.phase = 'MARCHING'; march.phase_tick = state.tick;
  }
  if (march.phase === 'MARCHING') {
    const delta = march.end_x - march.center_x;
    march.center_x += Math.sign(delta) * Math.min(Math.abs(delta), settings.march_speed / sim.hz);
    if (Math.abs(delta) <= settings.march_speed / sim.hz) return true;
  }
  // Ici, marcher reste compatible avec la persuasion. Un PNJ ne change qu'une fois de camp par tick.
  const actors = state.candidates.filter(c => !c.minor && !c.eliminated && c.campaign_active && canCampaign(c));
  for (const npc of state.npcs.filter(n => n.rally_event_id === event.id)) {
    if (!['NEUTRE', 'SYMPATHISANT'].includes(npc.role) || interrupted(npc) || state.tick < npc.rally_immune_until_tick) continue;
    const actor = actors.filter(c => c.faction_id !== npc.faction_id
      && Math.abs(ringDelta(c.x, npc.x, state.world.length)) <= sim.config.prototype.persuasion.radius_units)
      .sort((a, b) => Math.abs(ringDelta(a.x, npc.x, state.world.length)) - Math.abs(ringDelta(b.x, npc.x, state.world.length)) || stableIdOrder(a, b))[0];
    if (!actor) { npc.rally_conversion = null; continue; }
    if (npc.rally_conversion?.actor_id !== actor.id) npc.rally_conversion = { actor_id: actor.id, ticks: 0 };
    if (++npc.rally_conversion.ticks < sim.secondsToTicks(settings.conversion_seconds)) continue;
    if (npc.role === 'SYMPATHISANT') neutralizeSupporter(sim, npc, 'RASSEMBLEMENT');
    convertNeutral(sim, npc, actor.faction_id, 'RASSEMBLEMENT');
    npc.rally_conversion = null;
    npc.rally_immune_until_tick = state.tick + sim.secondsToTicks(settings.conversion_immunity_seconds);
  }
  return false;
}

/** Prioritaire sur les dons, la promenade et la prospection, mais respecte les interruptions de combat. */
export function rallyNpcStep(sim, npc) {
  if (!npc.rally_event_id && npc.rally_return_x == null) return false;
  if (interrupted(npc)) { npc.moving = false; return true; }
  if (npc.role === 'DEMOBILISE') { npc.rally_event_id = null; npc.rally_return_x = null; return false; }
  const event = sim.state.campaign_events.find(e => e.id === npc.rally_event_id && e.status === 'ACTIVE');
  if (event) {
    const settings = event.parameters;
    const target = crowdTarget(event, npc);
    const lag = Math.abs(ringDelta(npc.x, target, sim.state.world.length));
    const speed = event.march.phase === 'GATHERING' ? settings.gather_speed : settings.march_speed * (lag > 0.7 ? 1.35 : 1.05);
    position(sim, npc, target, speed * (0.96 + (npc.rally_index % 5) * 0.02));
    return true;
  }
  if (npc.rally_return_x != null) {
    const speed = sim.config.balance.campaign_events.families.RASSEMBLEMENT.gather_speed * 0.6;
    if (position(sim, npc, npc.rally_return_x, speed)) {
      npc.rally_return_x = null; npc.rally_index = null; npc.moving = false; npc.roam_wait_ticks = sim.waitTicks();
      sim.emit('RallyParticipantReturned', { npc_id: npc.id, subzone_id: npc.origin_subzone_id });
    }
    return true;
  }
  npc.rally_event_id = null;
  return false;
}

export function validateRallies(state, fail) {
  const validX = x => Number.isFinite(x) && x >= 0 && x < state.world.length;
  for (const event of state.campaign_events.filter(e => e.family === 'RASSEMBLEMENT')) {
    const m = event.march;
    const zones = state.world.subzones.filter(z => z.biome_id === event.target_biome_id);
    const p = event.parameters;
    if (zones.length !== 3 || ['gather_seconds', 'gather_speed', 'march_speed', 'conversion_seconds', 'conversion_immunity_seconds', 'crowd_spacing', 'participation_ratio']
      .some(key => !Number.isFinite(p[key]) || p[key] <= 0) || p.participation_ratio > 1) fail('paramètres du cortège invalides');
    if (!m || !['GATHERING', 'MARCHING', 'DISPERSING'].includes(m.phase) || ![-1, 1].includes(m.direction)
      || ![m.start_x, m.end_x, m.center_x].every(validX) || !Number.isInteger(m.phase_tick)
      || !Number.isInteger(m.gather_until_tick) || !Array.isArray(m.participant_ids)
      || new Set(m.participant_ids).size !== m.participant_ids.length
      || m.participant_ids.some(id => !state.npcs.some(n => n.id === id))) fail('cortège invalide');
    if (m.start_x !== zones[m.direction > 0 ? 0 : 2].center || m.end_x !== zones[m.direction > 0 ? 2 : 0].center
      || m.center_x < zones[0].center || m.center_x > zones[2].center) fail('itinéraire du cortège invalide');
  }
  for (const npc of state.npcs) {
    if (npc.rally_event_id && !state.campaign_events.some(e => e.id === npc.rally_event_id && e.status === 'ACTIVE'
      && e.march?.participant_ids[npc.rally_index] === npc.id)) fail('participant sans rassemblement');
    if (npc.rally_return_x != null && !validX(npc.rally_return_x)) fail('retour de cortège invalide');
    if (npc.rally_conversion && (!state.candidates.some(c => c.id === npc.rally_conversion.actor_id)
      || !Number.isInteger(npc.rally_conversion.ticks) || npc.rally_conversion.ticks < 0)) fail('conversion de cortège invalide');
  }
}

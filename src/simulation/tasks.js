import { combatDelta, combatPosition } from './combat-geometry.js';
import { ringDelta, subzoneGap, wrap, zoneAt } from './world.js';
import { distance, stableIdOrder } from './territory.js';
import { releaseDonation } from './money.js';

export function moveNpcTowards(simulation, npc, destination, speed) {
  if (npc.role === 'MILITANT') speed = Math.min(speed, simulation.config.prototype.movement.candidate_speed_units_per_second * Math.min(2, simulation.config.balance.physical_units.militant.max_player_speed_multiplier));
  const delta = combatDelta(simulation.state, npc.x, destination);
  const step = speed / simulation.hz;
  if (Math.abs(delta) <= step) {
    npc.x = combatPosition(simulation.state, destination);
    npc.moving = Math.abs(delta) > simulation.config.prototype.world.arrival_epsilon_units;
    return true;
  }
  npc.facing = Math.sign(delta); npc.moving = true;
  npc.x = combatPosition(simulation.state, npc.x + npc.facing * step);
  return false;
}

export function updateCollector(simulation, npc) {
  const { state, config } = simulation;
  const task = npc.task;
  const service = state.buildings.find(b => b.id === task.service_id);
  const order = service?.queue.find(o => o.id === task.order_id && o.assigned_npc_id === npc.id);
  if (!order) { npc.task = null; return; }
  if (!moveNpcTowards(simulation, npc, service.x, config.balance.physical_units.sympathisant.task_move_speed)) {
    task.phase = 'TRAVEL'; return;
  }
  npc.moving = false;
  if (order.state !== 'READY') { task.phase = 'WAIT_PRINT'; return; }
  task.phase = 'PICKUP'; task.elapsed_ticks++;
  if (task.elapsed_ticks < simulation.secondsToTicks(config.balance.buildings.imprimerie.pickup_seconds)) return;
  releaseDonation(simulation, npc);
  npc.role = 'MILITANT';
  npc.hidden_durability = config.balance.physical_units.militant.hidden_durability;
  npc.promoted_tick = state.tick;
  npc.task = null;
  npc.persuasion_target_ids = [];
  npc.home_site_id = service.type === 'permanence' ? service.id : null;
  npc.expedition = null;
  service.queue.splice(service.queue.indexOf(order), 1);
  service.delivered_count++;
  simulation.emit('MilitantEquipped', { npc_id: npc.id, service_id: service.id, order_id: order.id, faction_id: npc.faction_id });
}

const freeNeutral = (npc, reserved) => n => n.role === 'NEUTRE' && !n.rally_event_id
  && (!n.persuasion || n.persuasion.actor_id === npc.id) && !reserved.has(n.id);

function reservedTargets(state, npc) {
  return new Set(state.npcs.filter(other => other.id !== npc.id && other.role === 'MILITANT').map(other => other.task?.target_id));
}

const ownSite = (building, factionId) => building.state === 'ACTIVE' && building.owner_id === factionId;

/** Permanence de rattachement : celle où le tract a été retiré, sinon la permanence alliée la plus proche. */
export function militantHome(state, npc) {
  let home = state.buildings.find(b => b.id === npc.home_site_id && ownSite(b, npc.faction_id));
  if (!home) {
    const byDistance = list => list.sort((a, b) => distance(state, npc.x, a.x) - distance(state, npc.x, b.x) || stableIdOrder(a, b))[0];
    const sites = state.buildings.filter(b => ownSite(b, npc.faction_id));
    home = byDistance(sites.filter(b => b.type === 'permanence')) || byDistance(sites) || null;
    npc.home_site_id = home?.id ?? null;
  }
  return home;
}

function expandTask(simulation, target, destinationX) {
  const { state, config } = simulation;
  return { kind: 'EXPAND', phase: 'TRAVEL', target_id: target?.id || null,
    destination_x: wrap(destinationX, state.world.length), destination_subzone_id: zoneAt(state.world, destinationX).id,
    next_decision_tick: state.tick + simulation.secondsToTicks(config.balance.physical_units.militant.reconsider_seconds) };
}

/** Seul, un militant garde son territoire : la sous-zone de sa permanence et les sous-zones voisines. */
function chooseLocalTask(simulation, npc, home) {
  const { state, config } = simulation;
  const anchorX = home?.x ?? npc.x;
  const homeZone = zoneAt(state.world, anchorX);
  const target = state.npcs.filter(freeNeutral(npc, reservedTargets(state, npc)))
    .filter(n => subzoneGap(state.world, zoneAt(state.world, n.x), homeZone) <= config.balance.physical_units.militant.nearby_zone_radius)
    .sort((a, b) => distance(state, npc.x, a.x) - distance(state, npc.x, b.x) || stableIdOrder(a, b))[0];
  return expandTask(simulation, target, target?.x ?? anchorX);
}

/** Au moins trois militants qui patientent sans rien à faire chez eux partent ensemble en expédition. */
function tryFormExpedition(simulation, npc, home) {
  const { state, config } = simulation;
  const settings = config.balance.physical_units.militant;
  if (!home) return;
  const waiting = state.npcs.filter(n => n.role === 'MILITANT' && n.faction_id === npc.faction_id && !n.expedition && n.home_site_id === home.id
    && n.task?.kind === 'EXPAND' && n.task.phase === 'WAIT' && !n.task.target_id && !n.rally_event_id && n.rally_return_x == null && !n.combat?.engaged)
    .sort(stableIdOrder);
  if (waiting.length < settings.expedition_min_group_size || !waiting.includes(npc)) return;
  const homeZone = zoneAt(state.world, home.x);
  // Le groupe part du côté du neutre le plus proche hors du territoire ; s'il n'y en a aucun, il continue d'attendre.
  const nearest = state.npcs.filter(freeNeutral(npc, new Set()))
    .filter(n => subzoneGap(state.world, zoneAt(state.world, n.x), homeZone) > settings.nearby_zone_radius)
    .sort((a, b) => distance(state, home.x, a.x) - distance(state, home.x, b.x) || stableIdOrder(a, b))[0];
  if (!nearest) return;
  const expedition = { id: `expedition:${npc.faction_id}:${state.tick}`, direction: ringDelta(home.x, nearest.x, state.world.length) < 0 ? -1 : 1,
    home_site_id: home.id, formed_tick: state.tick };
  for (const member of waiting) { member.expedition = { ...expedition }; member.task = null; }
  simulation.emit('MilitantGroupFormed', { faction_id: npc.faction_id, npc_ids: waiting.map(n => n.id), direction: expedition.direction });
}

function expeditionMembers(state, npc) {
  return state.npcs.filter(n => n.role === 'MILITANT' && n.faction_id === npc.faction_id && n.expedition?.id === npc.expedition.id).sort(stableIdOrder);
}

/** Le groupe avance dans sa direction sans faire demi-tour et convainc les neutres qu'il croise. */
function updateExpedition(simulation, npc, members) {
  const { state, config } = simulation;
  const settings = config.balance.physical_units.militant;
  const length = state.world.length;
  const radius = config.prototype.persuasion.radius_units;
  const direction = npc.expedition.direction;
  const lead = members[0];
  const center = wrap(lead.x + members.reduce((sum, m) => sum + ringDelta(lead.x, m.x, length), 0) / members.length, length);
  const reach = state.world.subzones[0].width;
  const target = state.npcs.filter(freeNeutral(npc, reservedTargets(state, npc)))
    .filter(n => { const ahead = ringDelta(center, n.x, length) * direction; return ahead >= -radius && ahead <= reach; })
    .sort((a, b) => distance(state, npc.x, a.x) - distance(state, npc.x, b.x) || stableIdOrder(a, b))[0];
  // Sans cible, chacun garde sa place dans la file, juste devant le centre du groupe :
  // les membres marchent ensemble, côte à côte, sans jamais se superposer.
  const slot = (members.indexOf(npc) - (members.length - 1) / 2) * settings.expedition_spacing_units;
  npc.task = expandTask(simulation, target, target?.x ?? center + direction * radius + slot);
  if (target && distance(state, npc.x, target.x) <= radius * settings.stop_distance_radius_ratio) {
    npc.moving = false; npc.task.phase = 'RECRUIT'; return;
  }
  // Celui qui a dépassé sa place ralentit un peu ; les autres le rattrapent et la file se forme d'elle-même.
  const ahead = target ? 0 : ringDelta(center + slot, npc.x, length) * direction;
  const pace = Math.max(0.3, Math.min(1, 1 - ahead / settings.expedition_spacing_units));
  moveNpcTowards(simulation, npc, npc.task.destination_x, settings.move_speed * pace);
}

export function updateMilitant(simulation, npc) {
  const { state, config } = simulation;
  const settings = config.balance.physical_units.militant;
  if (npc.expedition) {
    const members = expeditionMembers(state, npc);
    // Un groupe trop réduit se dissout : chacun rentre à sa permanence.
    if (members.length < settings.expedition_min_group_size) {
      for (const member of members) { member.expedition = null; member.task = null; }
      simulation.emit('MilitantGroupDisbanded', { faction_id: npc.faction_id, npc_ids: members.map(n => n.id) });
    }
  }
  const talking = state.npcs.find(n => n.persuasion?.actor_id === npc.id);
  if (talking) {
    npc.task = { kind: 'EXPAND', phase: 'RECRUIT', target_id: talking.id, destination_x: talking.x,
      destination_subzone_id: zoneAt(state.world, talking.x).id,
      next_decision_tick: state.tick + simulation.secondsToTicks(settings.reconsider_seconds) };
    npc.moving = false; return;
  }
  if (npc.expedition) { updateExpedition(simulation, npc, expeditionMembers(state, npc)); return; }
  const home = militantHome(state, npc);
  const target = state.npcs.find(n => n.id === npc.task?.target_id);
  const lostTarget = npc.task?.target_id && (target?.role !== 'NEUTRE' || (target.persuasion && target.persuasion.actor_id !== npc.id));
  if (!npc.task || lostTarget || state.tick >= npc.task.next_decision_tick) npc.task = chooseLocalTask(simulation, npc, home);
  const nextTarget = state.npcs.find(n => n.id === npc.task.target_id);
  if (nextTarget) npc.task.destination_x = nextTarget.x;
  if (nextTarget && distance(state, npc.x, nextTarget.x) <= config.prototype.persuasion.radius_units * settings.stop_distance_radius_ratio) {
    npc.moving = false; npc.task.phase = 'RECRUIT'; return;
  }
  const arrived = moveNpcTowards(simulation, npc, npc.task.destination_x, settings.move_speed);
  npc.task.phase = arrived ? 'WAIT' : 'TRAVEL';
  if (arrived && !npc.task.target_id) tryFormExpedition(simulation, npc, home);
}

import { combatDelta, combatPosition } from './combat-geometry.js';
import { zoneAt } from './world.js';
import { distance, localUnits, stableIdOrder } from './territory.js';

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
  npc.role = 'MILITANT';
  npc.hidden_durability = config.balance.physical_units.militant.hidden_durability;
  npc.promoted_tick = state.tick;
  npc.task = null;
  npc.persuasion_target_ids = [];
  service.queue.splice(service.queue.indexOf(order), 1);
  service.delivered_count++;
  simulation.emit('MilitantEquipped', { npc_id: npc.id, service_id: service.id, order_id: order.id, faction_id: npc.faction_id });
}

function chooseMilitantTask(simulation, npc) {
  const { state, config } = simulation;
  const settings = config.balance.physical_units.militant;
  const current = zoneAt(state.world, npc.x);
  const zones = state.world.subzones;
  const reserved = new Set(state.npcs.filter(other => other.id !== npc.id && other.role === 'MILITANT').map(other => other.task?.target_id));
  const options = [];
  for (const zone of zones) {
    const indexDistance = Math.abs(zone.index - current.index);
    if (Math.min(indexDistance, zones.length - indexDistance) > settings.nearby_zone_radius) continue;
    const units = localUnits(state, zone.id);
    const allies = units.filter(n => n.id !== npc.id && n.faction_id === npc.faction_id);
    const targets = units.filter(n => n.role === 'NEUTRE' && (!n.persuasion || n.persuasion.actor_id === npc.id) && !reserved.has(n.id))
      .sort((a, b) => distance(state, npc.x, a.x) - distance(state, npc.x, b.x) || stableIdOrder(a, b));
    const owned = state.buildings.filter(b => b.type === 'permanence' && b.subzone_id === zone.id && b.owner_id === npc.faction_id && b.state === 'ACTIVE').length;
    const strength = allies.filter(n => n.role === 'SYMPATHISANT').length
      + allies.filter(n => n.role === 'MILITANT').length * settings.assignment_militant_weight
      + owned * settings.assignment_permanence_weight;
    options.push({ zone, target: targets[0] || null, strength });
  }
  options.sort((a, b) => Number(!!b.target) - Number(!!a.target) || a.strength - b.strength
    || distance(state, npc.x, a.target?.x ?? a.zone.center) - distance(state, npc.x, b.target?.x ?? b.zone.center) || stableIdOrder(a.zone, b.zone));
  const choice = options[0];
  return { kind: 'EXPAND', phase: 'TRAVEL', target_id: choice.target?.id || null,
    destination_x: choice.target?.x ?? choice.zone.center, destination_subzone_id: choice.zone.id,
    next_decision_tick: state.tick + simulation.secondsToTicks(settings.reconsider_seconds) };
}

export function updateMilitant(simulation, npc) {
  const { state, config } = simulation;
  const settings = config.balance.physical_units.militant;
  const talking = state.npcs.find(n => n.persuasion?.actor_id === npc.id);
  if (talking) {
    npc.task = { kind: 'EXPAND', phase: 'RECRUIT', target_id: talking.id, destination_x: talking.x,
      destination_subzone_id: zoneAt(state.world, talking.x).id,
      next_decision_tick: state.tick + simulation.secondsToTicks(settings.reconsider_seconds) };
    npc.moving = false; return;
  }
  const target = state.npcs.find(n => n.id === npc.task?.target_id);
  const lostTarget = npc.task?.target_id && (target?.role !== 'NEUTRE' || (target.persuasion && target.persuasion.actor_id !== npc.id));
  if (!npc.task || lostTarget || state.tick >= npc.task.next_decision_tick) npc.task = chooseMilitantTask(simulation, npc);
  const nextTarget = state.npcs.find(n => n.id === npc.task.target_id);
  if (nextTarget) npc.task.destination_x = nextTarget.x;
  if (nextTarget && distance(state, npc.x, nextTarget.x) <= config.prototype.persuasion.radius_units * settings.stop_distance_radius_ratio) {
    npc.moving = false; npc.task.phase = 'RECRUIT'; return;
  }
  const arrived = moveNpcTowards(simulation, npc, npc.task.destination_x, settings.move_speed);
  npc.task.phase = arrived ? 'WAIT' : 'TRAVEL';
}

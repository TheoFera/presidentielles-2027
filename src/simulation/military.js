import { ringDelta, wrap, zoneAt } from './world.js';
import { moveNpcTowards } from './tasks.js';
import { distance, stableIdOrder } from './territory.js';
import { availableMilitants } from './faction-buildings.js';
import { buildingSettings } from './building-rules.js';
import { interrupted, nearestEnemy } from './combat-state.js';
import { startNpcAttack } from './combat.js';

export function updateEquipmentProduction(sim) {
  const { state } = sim;
  for (const building of state.buildings.filter(b => b.variant === 'service_ordre' && b.state === 'ACTIVE').sort(stableIdOrder)) {
    for (const order of building.queue) {
      const previous = state.npcs.find(n => n.id === order.assigned_npc_id);
      if (!previous || previous.role !== 'MILITANT' || previous.task?.order_id !== order.id || previous.faction_id !== order.faction_id) order.assigned_npc_id = null;
      if (order.assigned_npc_id) continue;
      const npc = availableMilitants(state, building.biome_id, order.faction_id)
        .sort((a, b) => distance(state, a.x, building.x) - distance(state, b.x, building.x) || stableIdOrder(a, b))[0];
      if (!npc) continue;
      order.assigned_npc_id = npc.id;
      npc.task = { kind: 'COLLECT_EQUIPMENT', order_id: order.id, service_id: building.id, target_id: building.id,
        destination_x: building.x, destination_subzone_id: building.subzone_id, phase: 'TRAVEL', elapsed_ticks: 0 };
      for (const neutral of state.npcs) if (neutral.persuasion?.actor_id === npc.id) neutral.persuasion = null;
      npc.persuasion_target_ids = [];
      sim.emit('EquipmentWorkerAssigned', { npc_id: npc.id, order_id: order.id });
    }
    const next = building.queue.find(o => o.state !== 'READY');
    if (!next) continue;
    next.state = 'PRINTING'; next.production_elapsed_ticks++;
    if (next.production_elapsed_ticks >= next.production_required_ticks) { next.state = 'READY'; sim.emit('EquipmentReady', { order_id: next.id }); }
  }
}

export function updateEquipmentCollector(sim, npc) {
  const task = npc.task;
  const building = sim.state.buildings.find(b => b.id === task.service_id && b.state === 'ACTIVE');
  const order = building?.queue.find(o => o.id === task.order_id && o.assigned_npc_id === npc.id);
  if (!order) { npc.task = null; return; }
  if (!moveNpcTowards(sim, npc, building.x, sim.config.balance.physical_units.militant.move_speed)) { task.phase = 'TRAVEL'; return; }
  npc.moving = false;
  if (order.state !== 'READY') { task.phase = 'WAIT_PRINT'; return; }
  task.phase = 'PICKUP'; task.elapsed_ticks++;
  if (task.elapsed_ticks < sim.secondsToTicks(buildingSettings(sim.config, building).pickup_seconds)) return;
  npc.role = 'SERVICE_D_ORDRE'; npc.hidden_durability = sim.config.balance.physical_units.service_ordre.hidden_durability;
  npc.guard_biome_id = building.biome_id; npc.guard_anchor_x = building.x; npc.raid = null;
  npc.task = null; npc.promoted_tick = sim.state.tick; npc.persuasion_target_ids = [];
  building.queue.splice(building.queue.indexOf(order), 1); building.delivered_count++;
  sim.emit('GuardEquipped', { npc_id: npc.id, target_id: building.id });
}

export function updateGuard(sim, npc) {
  const { state, config } = sim;
  const s = config.balance.physical_units.service_ordre;
  if (npc.raid && state.tick >= npc.raid.expires_tick) npc.raid.phase = 'RETURN';
  const home = state.world.subzones.filter(z => z.biome_id === npc.guard_biome_id);
  const outside = zoneAt(state.world, npc.x).biome_id !== npc.guard_biome_id;
  const returning = npc.raid?.phase === 'RETURN' || (!npc.raid && outside);
  let target = null;
  if (!returning) target = nearestEnemy(state, npc, npc.raid ? s.home_biome_guard_radius_screens * config.prototype.world.units_per_screen : state.world.length,
    t => npc.raid ? ringDelta(npc.x, t.x, state.world.length) * npc.raid.direction >= -s.attack_range
      : zoneAt(state.world, t.x).biome_id === npc.guard_biome_id && t.role !== 'SYMPATHISANT');
  npc.combat.target_id = target?.id || null;
  npc.combat.engaged = !!target;
  if (interrupted(npc)) return;
  let destination = npc.guard_anchor_x; let phase = 'PATROL';
  if (returning) {
    phase = 'RETURN';
    if (moveNpcTowards(sim, npc, destination, s.move_speed)) { npc.raid = null; sim.emit('GuardReturnedHome', { npc_id: npc.id }); }
  } else if (target) {
    destination = target.x; phase = 'DEFEND';
    const d = ringDelta(npc.x, target.x, state.world.length); npc.facing = Math.sign(d) || npc.facing;
    if (Math.abs(d) > s.attack_range) moveNpcTowards(sim, npc, target.x, s.move_speed);
    else startNpcAttack(sim, npc, 'GUARD', { range: s.attack_range, damage: s.attack_damage, knockback: s.knockback,
      electoral_damage: s.electoral_damage, cooldown_seconds: s.attack_cooldown_seconds });
  } else if (npc.raid) {
    phase = 'RAID'; destination = wrap(npc.x + npc.raid.direction * s.move_speed, state.world.length);
    moveNpcTowards(sim, npc, destination, s.move_speed);
  } else {
    const side = Math.floor(state.tick / (sim.hz * 4)) % 2 ? 1 : -1;
    destination = Math.max(home[0].start + 0.1, Math.min(home.at(-1).end - 0.1, npc.guard_anchor_x + side * s.patrol_radius));
    moveNpcTowards(sim, npc, destination, s.move_speed);
  }
  npc.task = { kind: 'GUARD', phase, target_id: target?.id || null, destination_x: wrap(destination, state.world.length), destination_subzone_id: zoneAt(state.world, destination).id };
}

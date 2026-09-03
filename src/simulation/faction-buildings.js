import { wrap, zoneAt } from './world.js';
import { distance, localSympathisants, stableIdOrder } from './territory.js';
import { buildingSettings, factionVariant } from './building-rules.js';
import { paymentStatus } from './campaign-budget.js';

export function availableMilitants(state, biome, faction) {
  return state.npcs.filter(n => n.role === 'MILITANT' && n.faction_id === faction && zoneAt(state.world, n.x).biome_id === biome
    && (!n.task || n.task.kind === 'EXPAND') && !n.combat?.engaged && !n.combat?.attack_id && !n.combat?.stun_ticks);
}
export const availableGuards = (state, biome, faction) => state.npcs.filter(n => n.role === 'SERVICE_D_ORDRE' && n.faction_id === faction
  && n.guard_biome_id === biome && zoneAt(state.world, n.x).biome_id === biome && !n.raid && !n.combat?.engaged);

export function cabinetTarget(state, config, cabinet, direction) {
  return state.buildings.filter(b => b.state === 'ACTIVE' && b.owner_id && b.owner_id !== cabinet.owner_id
    && config.buildings.building_types[b.type === 'faction' ? b.variant : b.type]?.can_be_targeted_by_philippe)
    .map(b => ({ b, distance: wrap((b.x - cabinet.x) * direction, state.world.length) }))
    .filter(item => item.distance > 0).sort((a, b) => a.distance - b.distance || stableIdOrder(a.b, b.b))[0]?.b || null;
}

function quote(state, config, candidate, building, kind, cost, x, radius, reason = null, extra = {}) {
  const settings = buildingSettings(config, building, candidate.faction_id);
  return { target_id: building.id, kind, key: `${building.id}:${kind}:${building.level}:${extra.direction || 0}:${extra.victim_id || ''}`,
    cost, x: wrap(x, state.world.length), radius, required_ticks: Math.ceil(settings.purchase_hold_seconds * config.balance.simulation_architecture.fixed_tick_hz),
    ...paymentStatus(candidate, config, cost, reason), ...extra };
}

/** Distinct ground positions choose the action, without a menu or buy button. */
export function factionOffers(state, config, candidate, building) {
  const s = buildingSettings(config, building, candidate.faction_id);
  const p = config.balance.faction_interactions;
  if (building.state === 'EMPTY') {
    if (localSympathisants(state, building.subzone_id, candidate.faction_id).length < s.required_local_sympathisants) return [];
    return [quote(state, config, candidate, building, 'BUILD', s.build_cost, building.x, p.center_radius)];
  }
  if (building.owner_id !== candidate.faction_id) return [];
  if (building.state === 'CLOSED') return [quote(state, config, candidate, building, 'REBUILD', s.build_cost, building.x, p.center_radius)];
  const offers = [];
  if (building.level < s.max_level) offers.push(quote(state, config, candidate, building, 'UPGRADE', s.upgrade_costs[building.level - 1], building.x + p.upgrade_offset, p.upgrade_radius, null, { label: 'AMÉLIORER' }));
  if (building.variant === 'service_ordre') {
    const reason = building.queue.length >= s.max_queue_length ? 'QUEUE_FULL'
      : !availableMilitants(state, building.biome_id, candidate.faction_id).length ? 'NO_MILITANT' : null;
    offers.push(quote(state, config, candidate, building, 'EQUIP', s.baton_cost_by_level[building.level - 1], building.x, p.center_radius, reason, { label: 'ÉQUIPEMENT' }));
    for (const direction of [-1, 1]) {
      const blocked = state.tick < building.raid_ready_tick ? 'COOLDOWN' : !availableGuards(state, building.biome_id, candidate.faction_id).length ? 'NO_GUARD' : null;
      offers.push(quote(state, config, candidate, building, 'RAID', config.balance.physical_units.service_ordre.raid_cost, building.x + direction * p.side_offset, p.side_radius, blocked, { direction, label: direction < 0 ? '← RAID' : 'RAID →' }));
    }
  } else {
    for (const direction of [-1, 1]) {
      const victim = cabinetTarget(state, config, building, direction);
      const reason = state.tick < building.closure_ready_tick ? 'COOLDOWN' : !victim ? 'NO_BUILDING' : null;
      offers.push(quote(state, config, candidate, building, 'CLOSE', s.close_enemy_building_cost_by_level[building.level - 1], building.x + direction * p.side_offset, p.side_radius, reason,
        { direction, victim_id: victim?.id || null, label: direction < 0 ? '← FERMER' : 'FERMER →' }));
    }
  }
  return offers;
}

export function commitFactionAction(sim, candidate, building, offer) {
  const { state, config } = sim;
  if (offer.kind === 'BUILD' && building.type === 'faction') building.variant = factionVariant(candidate.faction_id);
  if (offer.kind === 'EQUIP') {
    const settings = buildingSettings(config, building);
    const order = { id: `order:${state.next_order_id++}`, service_id: building.id, faction_id: candidate.faction_id, purchased_tick: state.tick,
      cost: offer.cost, assigned_npc_id: null, state: 'QUEUED', production_elapsed_ticks: 0, production_required_ticks: sim.secondsToTicks(settings.equipment_seconds_by_level[building.level - 1]) };
    building.queue.push(order);
    sim.emit('EquipmentOrdered', { order_id: order.id, target_id: building.id });
    return true;
  }
  if (offer.kind === 'RAID') {
    const id = `raid:${state.next_raid_id++}`;
    const guards = availableGuards(state, building.biome_id, candidate.faction_id);
    for (const guard of guards) guard.raid = { id, building_id: building.id, direction: offer.direction, started_tick: state.tick,
      expires_tick: state.tick + sim.secondsToTicks(config.balance.physical_units.service_ordre.raid_duration_seconds), phase: 'OUTBOUND' };
    building.raid_ready_tick = state.tick + sim.secondsToTicks(config.balance.physical_units.service_ordre.raid_cooldown_seconds);
    sim.emit('RaidStarted', { raid_id: id, target_id: building.id, direction: offer.direction, npc_ids: guards.map(n => n.id) });
    return true;
  }
  if (offer.kind === 'CLOSE') {
    const victim = state.buildings.find(b => b.id === offer.victim_id);
    victim.state = 'CLOSED'; victim.level = 0; victim.last_action_tick = state.tick;
    if (victim.type === 'meeting') { victim.meeting_until_tick = 0; victim.meeting_level = 0; }
    for (const order of victim.queue) {
      const worker = state.npcs.find(n => n.id === order.assigned_npc_id);
      if (worker) worker.task = null;
      // Undelivered equipment is refunded; the closed building keeps no active queue.
      const payer = state.candidates.find(c => c.faction_id === order.faction_id);
      payer.money += order.cost; payer.refunds_received += order.cost;
      sim.emit('EquipmentRefunded', { order_id: order.id, candidate_id: payer.id, amount: order.cost });
    }
    victim.queue = [];
    for (const c of state.candidates) if (c.purchase_hold?.target_id === victim.id) c.purchase_hold = null;
    building.closure_ready_tick = state.tick + sim.secondsToTicks(buildingSettings(config, building).closure_cooldown_seconds);
    sim.emit('BuildingClosed', { target_id: victim.id, cabinet_id: building.id, owner_id: victim.owner_id });
    return true;
  }
  return false;
}

export function nearestFactionOffer(state, config, candidate, building) {
  return factionOffers(state, config, candidate, building).sort((a, b) => distance(state, candidate.x, a.x) - distance(state, candidate.x, b.x))[0] || null;
}

import { zoneAt } from './world.js';
import { biomeSympathisants, distance, incomePerSecond, localSympathisants, stableIdOrder } from './territory.js';
import { buildingSettings } from './building-rules.js';
import { commitFactionAction, factionOffers, nearestFactionOffer } from './faction-buildings.js';
import { canCampaign } from './combat-state.js';

export function createInfrastructure(world, config) {
  const buildings = [];
  const slots = [];
  for (const zone of world.subzones) {
    for (const type of ['permanence', 'financement', 'faction']) {
      const slotId = `slot:${zone.id}:${type}`;
      const buildingId = `building:${zone.id}:${type}`;
      const x = zone.start + zone.width * config.layout.infrastructure_layout[`${type}_x_ratio`];
      slots.push({ id: slotId, type, building_id: buildingId, x, subzone_id: zone.id, biome_id: zone.biome_id });
      buildings.push({ id: buildingId, type, slot_id: slotId, x, subzone_id: zone.id, biome_id: zone.biome_id,
        ownership_model: 'faction_owned', owner_id: null, level: 0, state: 'EMPTY', queue: [], last_action_tick: -1, delivered_count: 0,
        variant: null, raid_ready_tick: 0, closure_ready_tick: 0 });
    }
    if (zone.local_index === Math.floor(world.subzones.filter(z => z.biome_id === zone.biome_id).length / 2)) {
      buildings.push({ id: `service:${zone.biome_id}:imprimerie`, type: 'imprimerie', slot_id: null,
        x: zone.start + zone.width * config.layout.infrastructure_layout.imprimerie_x_ratio,
        subzone_id: zone.id, biome_id: zone.biome_id, ownership_model: 'neutral_service', owner_id: null,
        level: 1, state: 'ACTIVE', queue: [], last_action_tick: -1, delivered_count: 0 });
    }
  }
  return { buildings, slots };
}

/** Authoritative quote. The renderer only displays this result and the saved timer. */
export function buildingOffer(state, config, candidate, building) {
  if (building.type === 'faction') return nearestFactionOffer(state, config, candidate, building);
  const settings = buildingSettings(config, building, candidate.faction_id);
  let kind; let cost; let available = true; let reason = null;
  if (building.type === 'imprimerie') {
    kind = 'PRINT'; cost = settings.tract_cost_by_level[building.level - 1];
    if (building.queue.length >= settings.max_queue_length) { available = false; reason = 'QUEUE_FULL'; }
    else if (biomeSympathisants(state, building.biome_id, candidate.faction_id).length < settings.required_local_sympathisants_to_use) {
      available = false; reason = 'NO_SYMPATHISANT';
    }
  } else if (building.state === 'CLOSED') {
    if (building.owner_id !== candidate.faction_id) return null;
    kind = 'REBUILD'; cost = settings.build_cost;
  } else if (building.state === 'EMPTY') {
    if (localSympathisants(state, building.subzone_id, candidate.faction_id).length < settings.required_local_sympathisants) return null;
    kind = 'BUILD'; cost = settings.build_cost;
  } else if (building.owner_id === candidate.faction_id && building.level < settings.max_level) {
    kind = 'UPGRADE'; cost = settings.upgrade_costs[building.level - 1];
  } else return null;
  const affordable = candidate.money + 1e-9 >= cost;
  if (!affordable) reason = 'INSUFFICIENT_FUNDS';
  return { target_id: building.id, key: `${building.id}:${kind}:${building.level}`, kind, cost,
    required_ticks: Math.ceil((settings.purchase_hold_seconds ?? config.balance.interaction.default_hold_seconds) * config.balance.simulation_architecture.fixed_tick_hz),
    available, affordable, reason, enabled: available && affordable };
}

export function nearestOffer(state, config, candidate) {
  const radius = config.balance.interaction.radius_units;
  const offers = state.buildings.filter(b => b.id !== candidate.purchase_latch_target_id).flatMap(b => b.type === 'faction'
    ? factionOffers(state, config, candidate, b) : [buildingOffer(state, config, candidate, b)].filter(Boolean).map(o => ({ ...o, x: b.x, radius })));
  return offers.filter(o => distance(state, candidate.x, o.x) <= o.radius)
    .sort((a, b) => distance(state, candidate.x, a.x) - distance(state, candidate.x, b.x) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))[0] || null;
}

function transact(simulation, candidate, offer) {
  const { state, config } = simulation;
  const building = state.buildings.find(b => b.id === offer.target_id);
  const fresh = building.type === 'faction' ? factionOffers(state, config, candidate, building).find(o => o.key === offer.key) : buildingOffer(state, config, candidate, building);
  if (!fresh?.enabled || fresh.key !== offer.key || distance(state, candidate.x, fresh.x ?? building.x) > (fresh.radius ?? config.balance.interaction.radius_units)) return false;
  const transaction = { id: `transaction:${state.next_transaction_id++}`, tick: state.tick, candidate_id: candidate.id,
    faction_id: candidate.faction_id, target_id: building.id, kind: fresh.kind, cost: fresh.cost };
  // One synchronous commit: ownership/queue validation and money are never split by a UI callback.
  candidate.money = Math.max(0, candidate.money - fresh.cost);
  candidate.total_spent += fresh.cost;
  candidate.spending[fresh.kind] = (candidate.spending[fresh.kind] || 0) + fresh.cost;
  state.transactions.push(transaction);
  if (state.transactions.length > config.balance.debug.transaction_history_limit) state.transactions.shift();
  const handled = commitFactionAction(simulation, candidate, building, fresh);
  if (handled) {
    // Raid, equipment and closure are committed through the same transaction path.
  } else if (fresh.kind === 'PRINT') {
    const order = { id: `order:${state.next_order_id++}`, service_id: building.id, faction_id: candidate.faction_id,
      purchased_tick: state.tick, cost: fresh.cost, assigned_npc_id: null, state: 'QUEUED', production_elapsed_ticks: 0 };
    building.queue.push(order);
    simulation.emit('TractOrdered', { ...transaction, order_id: order.id });
  } else {
    building.owner_id = candidate.faction_id;
    building.state = 'ACTIVE';
    building.level++;
    simulation.emit(fresh.kind === 'REBUILD' ? 'BuildingRebuilt' : fresh.kind === 'BUILD' ? 'BuildingConstructed' : 'BuildingUpgraded', { ...transaction, level: building.level });
  }
  building.last_action_tick = state.tick;
  if (!['PRINT', 'EQUIP'].includes(fresh.kind) ? config.balance.interaction.owned_purchase_requires_reentry : !config.balance.interaction.printer_repeat_purchase) {
    candidate.purchase_latch_target_id = building.id;
  }
  candidate.purchase_hold = null;
  return true;
}

export function updateEconomy(simulation) {
  const { state, config, hz } = simulation;
  for (const candidate of [...state.candidates].sort(stableIdOrder)) {
    const income = incomePerSecond(state, config, candidate.faction_id);
    candidate.income_per_second = income;
    candidate.money += income / hz;
    candidate.total_earned += income / hz;
    const latched = state.buildings.find(b => b.id === candidate.purchase_latch_target_id);
    if (latched && distance(state, candidate.x, latched.x) > config.balance.interaction.radius_units) candidate.purchase_latch_target_id = null;
    if (!candidate.campaign_active || !candidate.interaction_active || !canCampaign(candidate)) { candidate.purchase_hold = null; continue; }
    const offer = nearestOffer(state, config, candidate);
    if (!offer?.enabled) { candidate.purchase_hold = null; continue; }
    if (candidate.purchase_hold?.key !== offer.key) candidate.purchase_hold = { ...offer, elapsed_ticks: 0 };
    candidate.purchase_hold.elapsed_ticks++;
    if (candidate.purchase_hold.elapsed_ticks >= offer.required_ticks) {
      transact(simulation, candidate, offer);
      candidate.purchase_hold = null;
    }
  }
  // A rival may have claimed the same slot in this tick. Remove any obsolete hold immediately.
  for (const candidate of state.candidates) {
    if (candidate.purchase_hold && nearestOffer(state, config, candidate)?.key !== candidate.purchase_hold.key) candidate.purchase_hold = null;
    candidate.income_per_second = incomePerSecond(state, config, candidate.faction_id);
  }
}

export function updateProduction(simulation) {
  const { state, config } = simulation;
  const settings = config.balance.buildings.imprimerie;
  for (const service of state.buildings.filter(b => b.type === 'imprimerie').sort(stableIdOrder)) {
    for (const order of service.queue) {
      const worker = state.npcs.find(n => n.id === order.assigned_npc_id);
      if (worker && (worker.role !== 'SYMPATHISANT' || worker.task?.order_id !== order.id || worker.faction_id !== order.faction_id)) order.assigned_npc_id = null;
      if (!worker) order.assigned_npc_id = null;
      if (order.assigned_npc_id) continue;
      const eligible = biomeSympathisants(state, service.biome_id, order.faction_id, true)
        .sort((a, b) => distance(state, a.x, service.x) - distance(state, b.x, service.x) || stableIdOrder(a, b));
      if (eligible.length) {
        const npc = eligible[0];
        order.assigned_npc_id = npc.id;
        npc.task = { kind: 'COLLECT_TRACT', order_id: order.id, service_id: service.id, target_id: service.id,
          destination_x: service.x, destination_subzone_id: service.subzone_id, phase: 'TRAVEL', elapsed_ticks: 0 };
        simulation.emit('TractWorkerAssigned', { npc_id: npc.id, order_id: order.id, service_id: service.id });
      }
    }
    const next = service.queue.find(order => order.state !== 'READY');
    if (!next) continue;
    next.state = 'PRINTING';
    next.production_elapsed_ticks++;
    if (next.production_elapsed_ticks >= simulation.secondsToTicks(settings.equipment_seconds_by_level[service.level - 1])) {
      next.state = 'READY';
      simulation.emit('TractReady', { order_id: next.id, service_id: service.id });
    }
  }
}

/** AI uses the same quotes as the simulation, and only emits movement/presence intentions. */
export function aiEconomicTarget(state, config, candidate) {
  const settings = config.balance.ai_economy;
  if (!settings.enabled) return null;
  const biome = zoneAt(state.world, candidate.x).biome_id;
  const options = [];
  for (const building of state.buildings.filter(b => b.biome_id === biome && b.id !== candidate.purchase_latch_target_id)) {
    const offer = buildingOffer(state, config, candidate, building);
    if (!offer?.enabled || candidate.money - offer.cost < settings.minimum_cash_reserve) continue;
    if (offer.kind === 'PRINT') {
      const sympathisants = biomeSympathisants(state, biome, candidate.faction_id, true);
      const militants = state.npcs.filter(n => n.faction_id === candidate.faction_id && n.role === 'MILITANT' && zoneAt(state.world, n.x).biome_id === biome).length;
      const queued = building.queue.filter(o => o.faction_id === candidate.faction_id).length;
      if (sympathisants.length <= settings.reserve_sympathisants_per_biome || militants + queued >= settings.militant_goal_per_biome) continue;
    }
    options.push({ building: { ...building, x: offer.x ?? building.x }, priority: offer.kind === 'BUILD' ? (building.type === 'financement' ? 0 : 1) : offer.kind === 'PRINT' ? 2 : 3 });
  }
  return options.sort((a, b) => a.priority - b.priority || distance(state, candidate.x, a.building.x) - distance(state, candidate.x, b.building.x) || stableIdOrder(a.building, b.building))[0]?.building || null;
}

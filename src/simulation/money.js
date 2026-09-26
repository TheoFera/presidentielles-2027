import { random, ringDelta, wrap, zoneAt } from './world.js';
import { moveNpcTowards } from './tasks.js';

const cents = moneyInThousands => Math.round(moneyInThousands * 100000);
const thousands = amountCents => amountCents / 100000;
const ordered = (a, b) => a.id.localeCompare(b.id);

export function addMoneyPickup(sim, x, height_ratio, amount_cents) {
  if (amount_cents <= 0) return null;
  const pickup = { id: `money:${sim.state.next_money_pickup_id++}`, x: wrap(x, sim.state.world.length), height_ratio, amount_cents };
  sim.state.money_pickups.push(pickup);
  return pickup;
}

export function scatterMoney(sim, x, amountCents, count = sim.config.balance.money.max_drop_pickups) {
  if (!amountCents) return;
  const number = Math.min(count, amountCents);
  const spread = sim.config.balance.money.drop_spread_units;
  for (let i = 0; i < number; i++) {
    const amount = Math.floor(amountCents / number) + (i < amountCents % number ? 1 : 0);
    addMoneyPickup(sim, x + (number === 1 ? 0 : (i / (number - 1) - 0.5) * spread * 2), 0, amount);
  }
}

export function initializeMoney(sim) {
  const settings = sim.config.balance.money;
  for (const candidate of sim.state.candidates) {
    const rich = candidate.faction_id === 'philippe';
    const count = rich ? settings.starting_pickups.philippe_count : settings.starting_pickups.default_count;
    const totalUnits = (rich ? settings.starting_pickups.philippe_total_eur : settings.starting_pickups.default_total_eur) / 50;
    const units = Array(count).fill(1);
    units[1] = 10; // Les deux premiers montants montrent immédiatement deux silhouettes distinctes.
    let remaining = totalUnits - units.reduce((a, b) => a + b, 0);
    const weights = units.map(() => 0.3 + random(sim.state) * 1.4);
    const sum = weights.slice(2).reduce((a, b) => a + b, 0);
    for (let i = 2; i < count; i++) { const extra = i === count - 1 ? remaining : Math.min(remaining, Math.floor((totalUnits - count - 9) * weights[i] / sum)); units[i] += extra; remaining -= extra; }
    const biome = zoneAt(sim.state.world, candidate.start_x).biome_id;
    const zones = sim.state.world.subzones.filter(z => z.biome_id === biome);
    for (let i = 0; i < count; i++) {
      const zone = zones[i % zones.length];
      const lane = Math.floor(i / zones.length);
      const lanes = Math.ceil((count - (i % zones.length)) / zones.length);
      const ratio = 0.15 + 0.7 * (lane + 0.5) / lanes;
      const jitter = (random(sim.state) - 0.5) * zone.width * 0.035;
      const height = settings.starting_pickups.height_min_ratio + random(sim.state) * (settings.starting_pickups.height_max_ratio - settings.starting_pickups.height_min_ratio);
      addMoneyPickup(sim, zone.start + zone.width * ratio + jitter, height, units[i] * 5000);
    }
  }
}

export function donationCents(config, npc) {
  return Math.round(config.balance.money.donation.base_eur * config.balance.money.donation.biome_multipliers[npc.origin_biome_id] * 100);
}

export function scheduleNextDonation(sim, npc) {
  const d = sim.config.balance.money.donation;
  npc.next_donation_tick = sim.state.tick + sim.secondsToTicks(d.cooldown_min_seconds + random(sim.state) * (d.cooldown_max_seconds - d.cooldown_min_seconds));
}

export function releaseDonation(sim, npc) {
  if (npc.donation_cents > 0) scatterMoney(sim, npc.x, npc.donation_cents, 1);
  npc.donation_cents = 0;
  npc.next_donation_tick = null;
  if (npc.task?.kind === 'DELIVER_DONATION' || npc.task?.kind === 'RETURN_DONATION') npc.task = null;
}

const usableFunding = (state, npc) => state.buildings.filter(b => b.type === 'financement' && b.state === 'ACTIVE'
  && b.owner_id === npc.faction_id && b.biome_id === zoneAt(state.world, npc.x).biome_id).sort((a, b) =>
    Math.abs(ringDelta(npc.x, a.x, state.world.length)) - Math.abs(ringDelta(npc.x, b.x, state.world.length)) || ordered(a, b));

export function prepareDonations(sim) {
  for (const npc of sim.state.npcs) {
    if (npc.role !== 'SYMPATHISANT') continue;
    if (!npc.donation_cents && sim.state.tick >= npc.next_donation_tick) {
      npc.donation_cents = donationCents(sim.config, npc);
      sim.emit('DonationReady', { npc_id: npc.id, amount_cents: npc.donation_cents });
    }
    if (npc.donation_cents && !npc.task && !npc.meeting_target_id && !npc.combat.engaged) {
      const building = usableFunding(sim.state, npc)[0];
      if (building) npc.task = { kind: 'DELIVER_DONATION', service_id: building.id, phase: 'TRAVEL',
        destination_x: building.x, destination_subzone_id: building.subzone_id };
    }
  }
}

export function updateDonationCourier(sim, npc) {
  const task = npc.task;
  if (task.kind === 'RETURN_DONATION') {
    const point = sim.state.world.socialPoints.find(p => p.id === npc.origin_social_point_id);
    if (moveNpcTowards(sim, npc, point.x, sim.config.balance.physical_units.sympathisant.task_move_speed)) {
      npc.task = null; npc.roam_target_x = point.x; npc.roam_wait_ticks = sim.waitTicks(); npc.moving = false;
    }
    return;
  }
  const building = sim.state.buildings.find(b => b.id === task.service_id);
  if (!npc.donation_cents || !building || building.state !== 'ACTIVE' || building.owner_id !== npc.faction_id
    || building.biome_id !== zoneAt(sim.state.world, npc.x).biome_id) { npc.task = null; return; }
  const radius = sim.config.balance.money.donation.deposit_radius_units;
  if (Math.abs(ringDelta(npc.x, building.x, sim.state.world.length)) > radius) {
    moveNpcTowards(sim, npc, building.x, sim.config.balance.physical_units.sympathisant.task_move_speed); return;
  }
  building.stored_money_cents += npc.donation_cents;
  sim.emit('DonationDeposited', { npc_id: npc.id, target_id: building.id, amount_cents: npc.donation_cents });
  npc.donation_cents = 0; scheduleNextDonation(sim, npc);
  npc.task = { kind: 'RETURN_DONATION', phase: 'TRAVEL', destination_x: npc.roam_target_x,
    destination_subzone_id: npc.origin_subzone_id };
  npc.moving = false;
}

export function settleMoney(sim) {
  const { state, config } = sim;
  for (const npc of state.npcs) {
    if (npc.role !== 'SYMPATHISANT' || !npc.donation_cents || usableFunding(state, npc).length) continue;
    const candidate = state.candidates.find(c => c.faction_id === npc.faction_id && !c.eliminated && !c.is_ko && !c.campaign_arena_id
      && Math.abs(ringDelta(c.x, npc.x, state.world.length)) <= config.balance.money.donation.handoff_radius_units);
    if (!candidate) continue;
    candidate.money += thousands(npc.donation_cents); candidate.total_earned += thousands(npc.donation_cents);
    sim.emit('DonationHandedOver', { npc_id: npc.id, candidate_id: candidate.id, amount_cents: npc.donation_cents });
    npc.donation_cents = 0;
    if (npc.task?.kind === 'DELIVER_DONATION') npc.task = null;
    scheduleNextDonation(sim, npc);
  }
  for (const candidate of state.candidates) {
    if (candidate.eliminated || candidate.is_ko || candidate.campaign_arena_id) continue;
    for (const building of state.buildings) {
      if (building.type !== 'financement' || building.state !== 'ACTIVE' || building.owner_id !== candidate.faction_id
        || !building.stored_money_cents || Math.abs(ringDelta(candidate.x, building.x, state.world.length)) > config.balance.money.donation.collection_radius_units) continue;
      candidate.money += thousands(building.stored_money_cents); candidate.total_earned += thousands(building.stored_money_cents);
      sim.emit('FundingCollected', { candidate_id: candidate.id, target_id: building.id, amount_cents: building.stored_money_cents });
      building.last_collection_cents = building.stored_money_cents; building.last_collection_tick = state.tick;
      building.stored_money_cents = 0;
    }
  }
  for (let i = state.money_pickups.length - 1; i >= 0; i--) {
    const pickup = state.money_pickups[i];
    const candidate = state.candidates.find(c => !c.eliminated && !c.is_ko && !c.campaign_arena_id
      && Math.abs(ringDelta(c.x, pickup.x, state.world.length)) <= config.balance.money.pickup_radius_units
      && Math.abs(c.combat.height - pickup.height_ratio * config.balance.candidate_combat.jump_height_ratio)
        <= config.balance.money.pickup_height_tolerance_ratio * config.balance.candidate_combat.jump_height_ratio);
    if (!candidate) continue;
    candidate.money += thousands(pickup.amount_cents); candidate.total_earned += thousands(pickup.amount_cents);
    sim.emit('MoneyPickedUp', { candidate_id: candidate.id, pickup_id: pickup.id, amount_cents: pickup.amount_cents });
    state.money_pickups.splice(i, 1);
  }
}

export function dropCandidateMoney(sim, candidate) {
  const before = cents(candidate.money);
  const lost = Math.round(before * sim.config.balance.candidate_combat.ko_money_drop_ratio);
  candidate.money = thousands(before - lost);
  scatterMoney(sim, candidate.x, lost);
  return lost;
}

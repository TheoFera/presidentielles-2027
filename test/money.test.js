import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { captureSite, neutralizeSite } from '../src/simulation/strategic-sites.js';
import { convertNeutral, neutralizeSupporter } from '../src/simulation/npc-votes.js';
import { hit } from '../src/simulation/combat-state.js';
import { updateCollector } from '../src/simulation/tasks.js';
import { chooseAIObjective, strategicAICommands } from '../src/simulation/ai-strategy.js';
import { moneyTier } from '../src/presentation/money.js';
import { zoneAt } from '../src/simulation/world.js';

const root = new URL('../Présidentielles 2027/', import.meta.url);
const load = async name => JSON.parse(await readFile(new URL(`${name}.json`, root), 'utf8'));
const [balance, layout, buildings, prototype, campaignCatalog] = await Promise.all(
  ['game_balance', 'world_layout', 'building_catalog', 'prototype_config', 'campaign_events'].map(load));
const config = validateConfig({ balance, layout, buildings, prototype, campaignCatalog });
const make = () => { const sim = new GameSimulation(config, 17); sim.state.ai_enabled = false; return sim; };

test('départ à zéro, totaux physiques exacts et billets accessibles au saut', () => {
  const sim = make();
  assert.deepEqual(sim.state.candidates.map(c => c.money), [0, 0, 0]);
  for (const [faction, expected] of [['melenchon', 12000], ['le_pen', 12000], ['philippe', 30000]]) {
    const start = sim.state.candidates.find(c => c.faction_id === faction);
    const money = sim.state.money_pickups.filter(p => zoneAt(sim.state.world, p.x).biome_id === zoneAt(sim.state.world, start.start_x).biome_id);
    assert.equal(money.reduce((sum, p) => sum + p.amount_cents, 0) / 100, expected);
    assert.ok(money.every(p => p.height_ratio > config.balance.money.pickup_height_tolerance_ratio));
  }
  assert.notEqual(moneyTier(config, 5000), moneyTier(config, 50000));
  const candidate = sim.state.candidates[0], pickup = sim.state.money_pickups.find(p => p.amount_cents === 5000);
  candidate.x = pickup.x;
  sim.step(); assert.ok(sim.state.money_pickups.includes(pickup));
  sim.step([{ type: 'Jump', candidateId: candidate.id }]);
  for (let i = 0; i < sim.secondsToTicks(config.balance.candidate_combat.jump_duration_seconds) + 2; i++) sim.step();
  assert.ok(!sim.state.money_pickups.includes(pickup));
  assert.ok(candidate.money > 0);
});

test('seul un sympathisant donne ; remise directe puis trajet et dépôt au financement', () => {
  const sim = make(), candidate = sim.state.candidates[0];
  const npc = sim.state.npcs.find(n => n.origin_biome_id === 'banlieue');
  convertNeutral(sim, npc, candidate.faction_id);
  npc.x = candidate.x; npc.roam_target_x = npc.x; npc.next_donation_tick = sim.state.tick;
  sim.step();
  assert.equal(candidate.money, 0.05); assert.equal(npc.donation_cents, 0);
  assert.ok(npc.next_donation_tick > sim.state.tick);
  const building = sim.state.buildings.find(b => b.type === 'financement');
  captureSite(sim, building, candidate);
  const zone = sim.state.world.subzones.find(z => z.biome_id === building.biome_id);
  const courier = sim.spawn(zone, building.x - 1);
  convertNeutral(sim, courier, candidate.faction_id);
  courier.next_donation_tick = sim.state.tick;
  candidate.x = zoneAt(sim.state.world, candidate.x).biome_id === building.biome_id ? building.x + 10 : candidate.x;
  for (let i = 0; i < sim.secondsToTicks(2); i++) sim.step();
  assert.equal(courier.donation_cents, 0);
  assert.ok(building.stored_money_cents > 0);
  const stored = building.stored_money_cents;
  candidate.x = building.x;
  sim.step();
  assert.equal(building.stored_money_cents, 0);
  assert.ok(candidate.money >= stored / 100000);
});

test('KO : 30 % au sol, cagnotte intacte et attente de 3 à 15 secondes', () => {
  for (const [progress, seconds] of [[0, 3], [1, 15]]) {
    const sim = make(), candidate = sim.state.candidates[0], attacker = sim.state.candidates[1];
    const building = sim.state.buildings.find(b => b.type === 'financement');
    captureSite(sim, building, candidate); building.stored_money_cents = 12300;
    candidate.x = attacker.x; candidate.money = 100; sim.state.campaign_progress_01 = progress;
    hit(sim, attacker, candidate, { kind: 'CANDIDATE', step: 3, damage: 100, knockback: 0, electoral_damage: 0 }, 'test');
    assert.equal(candidate.money, 70);
    assert.equal(sim.state.money_pickups.filter(p => p.height_ratio === 0).reduce((sum, p) => sum + p.amount_cents, 0), 3000000);
    assert.equal(building.stored_money_cents, 12300);
    assert.equal(candidate.respawn_tick - sim.state.tick, sim.secondsToTicks(seconds));
    sim.state.tick = candidate.respawn_tick;
    sim.state.candidates[1].x = candidate.x + 20;
    sim.step();
    assert.equal(candidate.is_ko, false);
  }
});

test('les nouveaux états survivent à une sauvegarde', () => {
  const sim = make(); sim.step();
  const copy = make(); copy.importSnapshot(sim.exportSnapshot());
  assert.deepEqual(copy.getState(), sim.getState());
  const old = JSON.parse(sim.exportSnapshot()); old.snapshot_version = 10;
  assert.throws(() => copy.importSnapshot(old), /ancienne sauvegarde incompatible/);
});

test('un bâtiment neutralisé rend sa cagnotte au sol et un don en trajet reste au PNJ', () => {
  const sim = make(), owner = sim.state.candidates[0];
  const building = sim.state.buildings.find(b => b.type === 'financement'); captureSite(sim, building, owner);
  const zone = sim.state.world.subzones.find(z => z.biome_id === building.biome_id);
  const npc = sim.spawn(zone, building.x - 2); convertNeutral(sim, npc, owner.faction_id);
  npc.donation_cents = 10000; npc.next_donation_tick += sim.hz;
  sim.step(); assert.equal(npc.task?.kind, 'DELIVER_DONATION');
  building.stored_money_cents = 25000;
  neutralizeSite(sim, building, 'TEST');
  assert.equal(building.stored_money_cents, 0);
  assert.equal(sim.state.money_pickups.filter(p => p.height_ratio === 0).reduce((sum, p) => sum + p.amount_cents, 0), 25000);
  sim.step(); assert.equal(npc.donation_cents, 10000); assert.equal(npc.task, null);
});

test('un don déjà préparé tombe au sol lors de la promotion ou de la neutralisation', () => {
  const sim = make(), owner = sim.state.candidates[0];
  const printer = sim.state.buildings.find(b => b.type === 'imprimerie');
  const zone = sim.state.world.subzones.find(z => z.id === printer.subzone_id);
  const npc = sim.spawn(zone, printer.x); convertNeutral(sim, npc, owner.faction_id);
  npc.donation_cents = 10000;
  const order = { id: 'order:test', assigned_npc_id: npc.id, state: 'READY' };
  printer.queue.push(order);
  npc.task = { kind: 'COLLECT_TRACT', service_id: printer.id, order_id: order.id, elapsed_ticks: 0 };
  for (let i = 0; i < sim.secondsToTicks(sim.config.balance.buildings.imprimerie.pickup_seconds); i++) updateCollector(sim, npc);
  assert.equal(npc.role, 'MILITANT'); assert.equal(npc.donation_cents, 0);
  assert.ok(sim.state.money_pickups.some(p => p.amount_cents === 10000 && p.height_ratio === 0));
  const other = sim.spawn(zone, printer.x + 1); convertNeutral(sim, other, owner.faction_id); other.donation_cents = 5000;
  neutralizeSupporter(sim, other, 'TEST');
  assert.equal(other.role, 'NEUTRE'); assert.ok(sim.state.money_pickups.some(p => p.amount_cents === 5000 && p.height_ratio === 0));
});

test('l’IA saute vers un billet élevé quand elle a besoin du premier QG', () => {
  const sim = make(), candidate = sim.state.candidates[1]; sim.state.ai_enabled = true;
  const pickup = sim.state.money_pickups.find(p => p.amount_cents === 5000 && zoneAt(sim.state.world, p.x).biome_id === zoneAt(sim.state.world, candidate.start_x).biome_id);
  candidate.x = pickup.x;
  const commands = strategicAICommands(sim.state, sim.config, candidate);
  assert.ok(commands.some(c => c.type === 'Jump'));
});

test('l’IA va chercher un don prêt et revient vider une cagnotte', () => {
  const sim = make(), candidate = sim.state.candidates[1]; sim.state.ai_enabled = true;
  sim.state.money_pickups = sim.state.money_pickups.filter(p => zoneAt(sim.state.world, p.x).biome_id !== zoneAt(sim.state.world, candidate.start_x).biome_id);
  const zone = zoneAt(sim.state.world, candidate.x);
  const donor = sim.spawn(zone, candidate.x + 3); convertNeutral(sim, donor, candidate.faction_id); donor.donation_cents = 10000;
  assert.equal(strategicAICommands(sim.state, sim.config, candidate).find(c => c.type === 'Move').axis, 1);
  const hq = sim.state.buildings.find(b => b.type === 'permanence'); captureSite(sim, hq, candidate);
  const funding = sim.state.buildings.find(b => b.type === 'financement'); captureSite(sim, funding, candidate);
  funding.stored_money_cents = 50000; candidate.x = funding.x - 3;
  assert.equal(strategicAICommands(sim.state, sim.config, candidate).find(c => c.type === 'Move').axis, 1);
});

test('l’IA garde le premier QG comme objectif tant qu’elle ne l’a pas capturé', () => {
  const sim = make(), candidate = sim.state.candidates[1];
  sim.state.tick = sim.secondsToTicks(200);
  assert.equal(chooseAIObjective(sim.state, sim.config, candidate).purpose, 'SETUP');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { captureSite, neutralizeSite, plannedHeadquartersSuccessor, updateStrategicSites } from '../src/simulation/strategic-sites.js';
import { buildingOffers } from '../src/simulation/economy.js';
import { hit } from '../src/simulation/combat-state.js';
import { zoneAt } from '../src/simulation/world.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json']
  .map(async file => JSON.parse(await readFile(new URL(file, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype });
const advance = (sim, ticks) => { for (let i = 0; i < ticks; i++) sim.step(); };
const candidate = (sim, faction = 'melenchon') => sim.state.candidates.find(c => c.faction_id === faction);

function unit(sim, role, faction, x) {
  const npc = sim.spawn(zoneAt(sim.state.world, x), x, false);
  npc.role = role; npc.faction_id = faction;
  npc.hidden_durability = sim.config.balance.physical_units[role === 'SERVICE_D_ORDRE' ? 'service_ordre' : role.toLowerCase()].hidden_durability;
  if (role === 'SERVICE_D_ORDRE') { npc.guard_biome_id = zoneAt(sim.state.world, x).biome_id; npc.guard_anchor_x = x; }
  return npc;
}

test('30 sites préexistants : tirage seedé, caps et services garantis par biome', () => {
  const a = new GameSimulation(config, 2027); const b = new GameSimulation(config, 2027); const c = new GameSimulation(config, 99);
  assert.deepEqual(a.state.buildings, b.state.buildings);
  assert.notDeepEqual(a.state.buildings.map(s => s.type), c.state.buildings.map(s => s.type));
  assert.equal(a.state.buildings.length, 30); assert.equal(new Set(a.state.buildings.map(s => s.subzone_id)).size, 18);
  for (const [type, count] of Object.entries(config.layout.strategic_site_generation.site_counts)) assert.equal(a.state.buildings.filter(s => s.type === type).length, count);
  for (const biome of config.layout.biomes) {
    const sites = a.state.buildings.filter(s => s.biome_id === biome.id); assert.equal(sites.length, 5);
    assert.equal(sites.filter(s => s.type === 'permanence').length, 1);
    assert.equal(sites.filter(s => s.type === 'meeting').length, 1);
    assert.ok([1, 2].includes(sites.filter(s => s.type === 'imprimerie').length));
    for (const type of new Set(sites.map(s => s.type))) assert.ok(sites.filter(s => s.type === type).length <= (type === 'faction'
      ? config.balance.buildings.faction_slot_melenchon_lepen_service_ordre.max_per_biome : config.balance.buildings[type].max_per_biome));
  }
  assert.ok(a.state.buildings.filter(s => ['imprimerie', 'meeting', 'institut_sondage'].includes(s.type)).every(s => s.owner_id === null && s.active && s.neutral));
  assert.ok(a.state.buildings.filter(s => !['imprimerie', 'meeting', 'institut_sondage'].includes(s.type)).every(s => s.state === 'NEUTRAL' && !s.active));
});

test('Premier Local capturé = QG, second = Permanence, succession circulaire déterministe', () => {
  const sim = new GameSimulation(config); const actor = candidate(sim); actor.money = 5000;
  const locals = sim.state.buildings.filter(s => s.type === 'permanence');
  captureSite(sim, locals[0], actor); captureSite(sim, locals[2], actor); captureSite(sim, locals[4], actor);
  assert.equal(locals[0].headquarters, true); assert.equal(actor.headquarters_site_id, locals[0].id);
  assert.equal(locals[2].headquarters, false);
  const expected = plannedHeadquartersSuccessor(sim.state, actor.faction_id, locals[0].x);
  neutralizeSite(sim, locals[0], 'TEST');
  assert.equal(actor.headquarters_site_id, expected.id); assert.equal(expected.headquarters, true);
});

test('Capture et améliorations continues : coût, présence et arrêt au niveau autorisé', () => {
  const sim = new GameSimulation(config); sim.state.ai_enabled = false; const actor = candidate(sim); actor.money = 1000;
  const local = sim.state.buildings.find(s => s.type === 'permanence'); actor.x = local.x;
  for (let i = 0; i < 4; i++) unit(sim, 'SYMPATHISANT', actor.faction_id, local.x + i * 0.05);
  advance(sim, sim.secondsToTicks(2)); assert.equal(local.level, 1); assert.equal(local.headquarters, true);
  advance(sim, sim.secondsToTicks(0.4 + 2)); assert.equal(local.level, 2);
  advance(sim, sim.secondsToTicks(3)); assert.equal(local.level, 2); assert.equal(buildingOffers(sim.state, sim.config, actor, local)[0].reason, 'INSUFFICIENT_PRESENCE');
  for (let i = 0; i < 2; i++) unit(sim, 'MILITANT', actor.faction_id, local.x - i * 0.05);
  advance(sim, sim.secondsToTicks(2)); assert.equal(local.level, 3);
  assert.equal(actor.spending.CAPTURE, 35); assert.equal(actor.spending.UPGRADE, 145);
});

test('Fermeture : S et M comptent, SO non ; pression hostile réduit la présence effective', () => {
  const sim = new GameSimulation(config); const actor = candidate(sim); const site = sim.state.buildings.find(s => s.type === 'financement');
  captureSite(sim, site, actor); const allies = [unit(sim, 'SYMPATHISANT', actor.faction_id, site.x), unit(sim, 'MILITANT', actor.faction_id, site.x)];
  const guards = [unit(sim, 'SERVICE_D_ORDRE', 'le_pen', site.x), unit(sim, 'SERVICE_D_ORDRE', 'le_pen', site.x)];
  for (let i = 0; i < sim.secondsToTicks(8); i++) { for (const guard of guards) guard.pressure_target_id = site.id; updateStrategicSites(sim); sim.state.tick++; }
  assert.equal(site.state, 'NEUTRAL'); assert.equal(site.owner_id, null); assert.equal(site.level, 0);
  assert.equal(allies.length, 2);
});

test('Local SO : caps 2/5/illimité et Raid seulement au niveau 3', () => {
  const sim = new GameSimulation(config); const actor = candidate(sim); const site = sim.state.buildings.find(s => s.type === 'faction'); captureSite(sim, site, actor);
  unit(sim, 'MILITANT', actor.faction_id, site.x);
  assert.equal(buildingOffers(sim.state, sim.config, actor, site).find(o => o.kind === 'RAID').reason, 'LEVEL_REQUIRED');
  for (let i = 0; i < 2; i++) { const guard = unit(sim, 'SERVICE_D_ORDRE', actor.faction_id, site.x); guard.source_site_id = site.id; }
  assert.equal(buildingOffers(sim.state, sim.config, actor, site).find(o => o.kind === 'EQUIP').reason, 'SO_LIMIT');
  site.level = 2; assert.equal(buildingOffers(sim.state, sim.config, actor, site).find(o => o.kind === 'EQUIP').enabled, true);
  site.level = 3; assert.equal(buildingOffers(sim.state, sim.config, actor, site).find(o => o.kind === 'RAID').enabled, true);
});

test('Financement par cycle : aucun revenu continu et versement seedé uniquement à la fin', () => {
  const sim = new GameSimulation(config, 31415); const actor = candidate(sim); const site = sim.state.buildings.find(s => s.type === 'financement'); captureSite(sim, site, actor); site.level = 3;
  for (let i = 0; i < 4; i++) unit(sim, 'SYMPATHISANT', actor.faction_id, site.x + i * 0.04);
  sim.config.balance.money.base_passive_income_per_second = 0; for (const key of Object.keys(sim.config.balance.money.supporter_income_per_second_by_origin_biome)) sim.config.balance.money.supporter_income_per_second_by_origin_biome[key] = 0;
  actor.x = site.x; actor.money = 100; advance(sim, sim.secondsToTicks(2)); assert.equal(site.funding_state, 'RUNNING');
  const before = actor.money; advance(sim, site.funding_duration_ticks - 1); assert.equal(actor.money, before);
  sim.step(); assert.equal(site.funding_state, 'COMPLETED'); assert.ok(Math.abs(actor.money - before - site.funding_expected_payout) < 1e-8);
  const copy = new GameSimulation(config, 31415); const copyActor = candidate(copy); const copySite = copy.state.buildings.find(s => s.id === site.id); captureSite(copy, copySite, copyActor); copySite.level = 3;
  assert.equal(copy.state.seed, sim.state.seed);
});

test('Institut et Salle neutres : paiement à l’usage, snapshot figé et Meeting chez l’adversaire', () => {
  const sim = new GameSimulation(config); const actor = candidate(sim); actor.money = 1000;
  const institute = sim.state.buildings.find(s => s.type === 'institut_sondage'); actor.x = institute.x; advance(sim, sim.secondsToTicks(2));
  const snapshot = structuredClone(sim.state.polls.melenchon.lastPollSnapshot); assert.ok(snapshot); assert.equal(institute.owner_id, null);
  advance(sim, 120); assert.deepEqual(sim.state.polls.melenchon.lastPollSnapshot, snapshot);
  actor.purchase_latch_target_id = null; const hall = sim.state.buildings.find(s => s.type === 'meeting'); actor.x = hall.x;
  unit(sim, 'SYMPATHISANT', actor.faction_id, hall.x); const before = sim.state.electorate.find(e => e.subzone_id === hall.subzone_id).support.melenchon;
  advance(sim, sim.secondsToTicks(2)); assert.equal(hall.owner_id, null); assert.equal(hall.meeting_faction_id, actor.faction_id);
  assert.ok(sim.state.electorate.find(e => e.subzone_id === hall.subzone_id).support.melenchon > before);
});

test('Résistance cachée : récupération, KO, perte électorale et respawn au QG', () => {
  const sim = new GameSimulation(config); const target = candidate(sim); const attacker = candidate(sim, 'le_pen');
  const hq = sim.state.buildings.find(s => s.type === 'permanence'); captureSite(sim, hq, target);
  target.x = hq.x + 10; attacker.x = target.x; const election = sim.state.electorate.find(e => e.subzone_id === zoneAt(sim.state.world, target.x).id);
  election.support = { melenchon: 60, le_pen: 15, philippe: 10, neutral: 15 };
  hit(sim, attacker, target, { damage: 30, electoral_damage: 0.03, knockback: 0 }, 'test:1'); assert.equal(target.resistance, 70);
  attacker.x += 20; advance(sim, sim.secondsToTicks(4 + 2)); assert.ok(target.resistance > 70);
  attacker.x = target.x; for (let i = 0; i < 4 && !target.is_ko; i++) hit(sim, attacker, target, { damage: 40, electoral_damage: 0.03, knockback: 0 }, `test:${i + 2}`);
  assert.equal(target.is_ko, true); assert.ok(target.electoral_damage_received >= config.balance.candidate_combat.ko_electoral_damage_percent_points);
  advance(sim, sim.secondsToTicks(3)); assert.equal(target.is_ko, false); assert.equal(target.resistance, 100); assert.equal(target.x, hq.x);
});

test('Snapshot v6 : topologie aléatoire et nouveaux états reprennent à l’identique', () => {
  const sim = new GameSimulation(config, 73); advance(sim, 50); const restored = new GameSimulation(config, 73); restored.importSnapshot(sim.exportSnapshot());
  advance(sim, 80); advance(restored, 80); assert.deepEqual(restored.state, sim.state);
});

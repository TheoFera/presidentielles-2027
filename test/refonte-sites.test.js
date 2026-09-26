import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { captureSite, neutralizeSite, plannedHeadquartersSuccessor, updateStrategicSites } from '../src/simulation/strategic-sites.js';
import { buildingOffers } from '../src/simulation/economy.js';
import { hit } from '../src/simulation/combat-state.js';
import { zoneAt } from '../src/simulation/world.js';
import { completePopulation } from '../src/simulation/spawns.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json']
  .map(async file => JSON.parse(await readFile(new URL(file, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype });
const advance = (sim, ticks) => { for (let i = 0; i < ticks; i++) sim.step(); };
const candidate = (sim, faction = 'melenchon') => sim.state.candidates.find(c => c.faction_id === faction);

function unit(sim, role, faction, x) {
  const npc = sim.spawn(zoneAt(sim.state.world, x), x, false);
  npc.role = role; npc.faction_id = faction;
  if (role === 'SYMPATHISANT') npc.next_donation_tick = sim.state.tick + sim.secondsToTicks(30);
  npc.hidden_durability = sim.config.balance.physical_units[role === 'SERVICE_D_ORDRE' ? 'service_ordre' : role.toLowerCase()].hidden_durability;
  if (role === 'SERVICE_D_ORDRE') { npc.guard_biome_id = zoneAt(sim.state.world, x).biome_id; npc.guard_anchor_x = x; }
  return npc;
}

test('36 sites préexistants : règles géographiques, tirage seedé, caps et services garantis', () => {
  const a = new GameSimulation(config, 2027); const b = new GameSimulation(config, 2027); const c = new GameSimulation(config, 99);
  assert.deepEqual(a.state.buildings, b.state.buildings);
  assert.notDeepEqual(a.state.buildings.map(s => s.type), c.state.buildings.map(s => s.type));
  assert.equal(a.state.buildings.length, 36); assert.equal(new Set(a.state.buildings.map(s => s.subzone_id)).size, 18);
  for (const [type, count] of Object.entries(config.layout.strategic_site_generation.site_counts)) assert.equal(a.state.buildings.filter(s => s.type === type).length, count);
  for (const biome of config.layout.biomes) {
    const sites = a.state.buildings.filter(s => s.biome_id === biome.id); assert.equal(sites.length, 6);
    const permanence = sites.filter(s => s.type === 'permanence'); assert.equal(permanence.length, 1); assert.equal(permanence[0].subzone_id, biome.subzones[1].id);
    const faction = sites.filter(s => s.type === 'faction'); assert.equal(faction.length, 1); assert.notEqual(faction[0].subzone_id, biome.subzones[1].id);
    assert.equal(sites.filter(s => s.type === 'meeting').length, 1);
    assert.ok([1, 2].includes(sites.filter(s => s.type === 'imprimerie').length));
    for (const type of new Set(sites.map(s => s.type))) assert.ok(sites.filter(s => s.type === type).length <= (type === 'faction'
      ? config.balance.buildings.faction_slot_melenchon_lepen_service_ordre.max_per_biome : config.balance.buildings[type].max_per_biome));
  }
  assert.deepEqual(new Set(a.state.buildings.filter(s => s.type === 'institut_sondage').map(s => s.biome_id)),
    new Set(['paris_19e', 'periurbain_usine', 'retraites', 'quartiers_riches']));
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

test('Capture unique : niveau 1 et aucune amélioration proposée', () => {
  const sim = new GameSimulation(config); sim.state.ai_enabled = false; const actor = candidate(sim); actor.money = 1000;
  const local = sim.state.buildings.find(s => s.type === 'permanence'); actor.x = local.x;
  for (let i = 0; i < 4; i++) unit(sim, 'SYMPATHISANT', actor.faction_id, local.x + i * 0.05);
  advance(sim, sim.secondsToTicks(2)); assert.equal(local.level, 1); assert.equal(local.headquarters, true);
  sim.applyCommand({ type: 'SelectCampaignStyle', candidateId: actor.id, styleId: 'melenchon_universaliste' });
  advance(sim, sim.secondsToTicks(0.4 + 2)); assert.equal(local.level, 1);
  advance(sim, sim.secondsToTicks(3)); assert.equal(local.level, 1);
  for (let i = 0; i < 2; i++) unit(sim, 'MILITANT', actor.faction_id, local.x - i * 0.05);
  advance(sim, sim.secondsToTicks(2)); assert.equal(local.level, 1);
  assert.ok(!buildingOffers(sim.state, sim.config, actor, local).some(o => o.kind === 'UPGRADE'));
  assert.equal(actor.spending.CAPTURE, 15); assert.equal(actor.spending.UPGRADE, 0);
});

test('Fermeture : S et M comptent, SO non ; pression hostile réduit la présence effective', () => {
  const sim = new GameSimulation(config); const actor = candidate(sim); const site = sim.state.buildings.find(s => s.type === 'financement');
  captureSite(sim, site, actor); const allies = [unit(sim, 'SYMPATHISANT', actor.faction_id, site.x), unit(sim, 'MILITANT', actor.faction_id, site.x)];
  const guards = [unit(sim, 'SERVICE_D_ORDRE', 'le_pen', site.x), unit(sim, 'SERVICE_D_ORDRE', 'le_pen', site.x)];
  for (let i = 0; i < sim.secondsToTicks(8); i++) { for (const guard of guards) guard.pressure_target_id = site.id; updateStrategicSites(sim); sim.state.tick++; }
  assert.equal(site.state, 'NEUTRAL'); assert.equal(site.owner_id, null); assert.equal(site.level, 0);
  assert.equal(allies.length, 2);
});

test('Local SO : effectif libre et Raid disponible dès le niveau unique', () => {
  const sim = new GameSimulation(config); const actor = candidate(sim); actor.money = 1000; const site = sim.state.buildings.find(s => s.type === 'faction'); captureSite(sim, site, actor);
  unit(sim, 'MILITANT', actor.faction_id, site.x);
  assert.equal(buildingOffers(sim.state, sim.config, actor, site).find(o => o.kind === 'RAID').reason, 'NO_GUARD');
  for (let i = 0; i < 2; i++) { const guard = unit(sim, 'SERVICE_D_ORDRE', actor.faction_id, site.x); guard.source_site_id = site.id; }
  assert.equal(buildingOffers(sim.state, sim.config, actor, site).find(o => o.kind === 'EQUIP').enabled, true);
  assert.equal(buildingOffers(sim.state, sim.config, actor, site).find(o => o.kind === 'RAID').enabled, true);
});

test('Financement : aucun lancement payant et cagnotte reçue au passage', () => {
  const sim = new GameSimulation(config, 31415); sim.state.ai_enabled = false;
  const actor = candidate(sim); const site = sim.state.buildings.find(s => s.type === 'financement'); captureSite(sim, site, actor);
  const supporters = [unit(sim, 'SYMPATHISANT', actor.faction_id, site.x + 1), unit(sim, 'SYMPATHISANT', actor.faction_id, site.x + 1.2)];
  actor.x = site.x + 10; actor.money = 100;
  const offers = buildingOffers(sim.state, sim.config, actor, site);
  assert.ok(!offers.some(o => o.kind === 'FUNDRAISE'));
  supporters.forEach(n => { n.donation_cents = 10000; n.next_donation_tick = sim.state.tick + sim.secondsToTicks(30); });
  advance(sim, sim.secondsToTicks(2));
  assert.equal(site.stored_money_cents, 20000); assert.equal(actor.money, 100);
  actor.x = site.x; sim.step();
  assert.equal(site.stored_money_cents, 0); assert.equal(actor.money, 100.2);
});

test('Institut et promontoire neutres : sondage figé et meeting de quinze secondes', () => {
  const sim = new GameSimulation(config); const actor = candidate(sim); actor.money = 1000;
  const institute = sim.state.buildings.find(s => s.type === 'institut_sondage'); actor.x = institute.x; advance(sim, sim.secondsToTicks(2));
  const snapshot = structuredClone(sim.state.polls.melenchon.lastPollSnapshot); assert.ok(snapshot); assert.equal(institute.owner_id, null);
  advance(sim, 120); assert.deepEqual(sim.state.polls.melenchon.lastPollSnapshot, snapshot);
  actor.purchase_latch_target_id = null; const hall = sim.state.buildings.find(s => s.type === 'meeting'); actor.x = hall.x;
  unit(sim, 'SYMPATHISANT', actor.faction_id, hall.x); const before = sim.state.electorate.find(e => e.subzone_id === hall.subzone_id).support.melenchon;
  advance(sim, sim.secondsToTicks(2)); assert.equal(hall.owner_id, null); assert.equal(hall.meeting_faction_id, actor.faction_id);
  actor.podium_site_id = hall.id; actor.combat.height = config.balance.buildings.meeting.podium_height;
  advance(sim, sim.secondsToTicks(15)); assert.equal(hall.meetings_held, 1); assert.equal(actor.spending.MEETING, config.balance.buildings.meeting.activation_cost);
  assert.ok(sim.state.electorate.find(e => e.subzone_id === hall.subzone_id).support.melenchon > before);
});

test('Imprimerie neutre : tracts à 2 k€ achetés à la chaîne sans quitter le bâtiment', () => {
  const sim = new GameSimulation(config); sim.state.ai_enabled = false; const actor = candidate(sim); actor.money = 100;
  const printer = sim.state.buildings.find(s => s.type === 'imprimerie'); actor.x = printer.x;
  unit(sim, 'SYMPATHISANT', actor.faction_id, printer.x);
  advance(sim, sim.secondsToTicks(4));
  assert.equal(actor.spending.PRINT, 4); assert.equal(sim.state.transactions.filter(t => t.candidate_id === actor.id && t.kind === 'PRINT').length, 2);
  assert.equal(actor.purchase_latch_target_id, null);
});

test('Résistance cachée : récupération, KO, perte électorale et respawn au QG', () => {
  const sim = new GameSimulation(config); const target = candidate(sim); const attacker = candidate(sim, 'le_pen');
  const hq = sim.state.buildings.find(s => s.type === 'permanence'); captureSite(sim, hq, target);
  sim.applyCommand({ type: 'SelectCampaignStyle', candidateId: target.id, styleId: 'melenchon_universaliste' });
  target.x = hq.x + 10; attacker.x = target.x; const election = sim.state.electorate.find(e => e.subzone_id === zoneAt(sim.state.world, target.x).id);
  completePopulation(sim);
  sim.state.npcs.slice(0,10).forEach(n => { n.role = 'SYMPATHISANT'; n.faction_id = target.faction_id; });
  const beforeVotes = sim.state.npcs.filter(n => n.faction_id === target.faction_id).length;
  hit(sim, attacker, target, { damage: 30, electoral_damage: 0.03, knockback: 0 }, 'test:1'); assert.equal(target.resistance, 70);
  attacker.x += 20; advance(sim, sim.secondsToTicks(4 + 2)); assert.ok(target.resistance > 70);
  attacker.x = target.x; for (let i = 0; i < 4 && !target.is_ko; i++) hit(sim, attacker, target, { damage: 40, electoral_damage: 0.03, knockback: 0 }, `test:${i + 2}`);
  assert.equal(target.is_ko, true); assert.ok(target.electoral_damage_received >= config.balance.candidate_combat.ko_electoral_damage_percent_points);
  assert.ok(sim.state.npcs.filter(n => n.faction_id === target.faction_id).length < beforeVotes);
  advance(sim, target.respawn_tick - sim.state.tick); assert.equal(target.is_ko, false); assert.equal(target.resistance, 100); assert.equal(target.x, hq.x);
});

test('Snapshot v11 : topologie et trajet d’un don reprennent à l’identique', () => {
  const sim = new GameSimulation(config, 73); advance(sim, 50);
  const actor = candidate(sim); const funding = sim.state.buildings.find(s => s.type === 'financement'); captureSite(sim, funding, actor);
  const donor = unit(sim, 'SYMPATHISANT', actor.faction_id, funding.x - 3);
  donor.donation_cents = 10000; advance(sim, 3);
  const restored = new GameSimulation(config, 73); restored.importSnapshot(sim.exportSnapshot());
  advance(sim, 80); advance(restored, 80); assert.deepEqual(restored.state, sim.state);
});

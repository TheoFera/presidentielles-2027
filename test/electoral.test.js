import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { validateConfig } from '../src/config.js';
import { FACTIONS, zoneAt } from '../src/simulation/world.js';
import { aggregateNational, convertInfluence, leadership, normalizeSupport, refreshElectoralState, updatePolls } from '../src/simulation/electoral-state.js';
import { refreshInfluenceSources } from '../src/simulation/territory.js';
import { buildingOffer, nearestOffer } from '../src/simulation/economy.js';
import { triggerMeeting } from '../src/simulation/electoral-buildings.js';
import { hit } from '../src/simulation/combat-state.js';
import { AIController } from '../src/simulation/controllers.js';
import { FixedClock } from '../src/simulation/fixed-clock.js';
import { buildElectoral, controlZone, addInfluence, neutral50, debugMeeting } from '../src/simulation/commands.js';
import { roundedPollScores } from '../src/presentation/electoral.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'].map(async f => JSON.parse(await readFile(new URL(f, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype });
const close = (a, b, message = '') => assert.ok(Math.abs(a - b) < 1e-8, `${message}: ${a} ≠ ${b}`);
const advance = (sim, ticks) => { for (let i = 0; i < ticks; i++) sim.step(); };
const building = (sim, type, zone = 'banlieue_b') => sim.state.buildings.find(b => b.type === type && b.subzone_id === zone);
function own(sim, type, faction = 'melenchon', level = 1, zone = 'banlieue_b') {
  const b = building(sim, type, zone); Object.assign(b, { owner_id: faction, state: 'ACTIVE', level });
  if (type === 'faction') b.variant = faction === 'philippe' ? 'cabinet_administratif' : 'service_ordre';
  return b;
}
function unit(sim, role, faction, x, origin = null) {
  const z = origin || zoneAt(sim.state.world, x); const n = sim.spawn(z, x, false);
  Object.assign(n, { role, faction_id: faction, hidden_durability: role === 'SERVICE_D_ORDRE' ? 90 : 30, roam_wait_ticks: 100000, roam_target_x: x });
  if (role === 'MILITANT') n.task = { kind: 'EXPAND', phase: 'WAIT', target_id: null, destination_x: x, destination_subzone_id: z.id, next_decision_tick: 100000 };
  if (role === 'SERVICE_D_ORDRE') { n.guard_biome_id = z.biome_id; n.guard_anchor_x = x; }
  return n;
}
function scenario(faction = 'melenchon', localCount = 6) {
  const cfg = structuredClone(config);
  for (const b of cfg.layout.biomes) for (const z of b.subzones) z.mean_spawn_days = 10000;
  const sim = new GameSimulation(cfg); sim.state.npcs = []; sim.state.ai_enabled = false;
  for (const [i, c] of sim.state.candidates.entries()) { c.x = 250 + i * 50; c.campaign_active = false; c.interaction_active = false; c.money = 2000; }
  const actor = sim.state.candidates.find(c => c.faction_id === faction); actor.x = 108; actor.campaign_active = true; actor.interaction_active = true;
  sim.state.local_candidate_id = actor.id;
  for (let i = 0; i < localCount; i++) unit(sim, 'SYMPATHISANT', faction, 104 + i * 0.5);
  refreshElectoralState(sim.state, sim.config); refreshInfluenceSources(sim.state, sim.config);
  return { sim, actor };
}
function visit(sim, actor, x, ticks = 60) {
  actor.x = 108; actor.interaction_active = false; sim.step();
  actor.x = x; actor.interaction_active = true; advance(sim, ticks);
}
function assertMath(state) {
  for (const e of state.electorate) { close(Object.values(e.support).reduce((a, b) => a + b), 100); assert.ok(Object.values(e.support).every(v => v >= 0 && v <= 100)); }
  close(Object.values(state.actualGameState.national_support).reduce((a, b) => a + b), 100);
  assert.equal(Object.values(state.actualGameState.controlled_counts).reduce((a, b) => a + b), 18);
}

test('Électorat distinct des PNJ : départs, poids et voisins dans les deux sens de la boucle', () => {
  const state = new GameSimulation(config).state;
  assert.equal(state.npcs.length, 25); assert.ok(state.npcs.every(n => n.role === 'NEUTRE'));
  assert.equal(state.electorate.find(e => e.subzone_id === 'campagne_b').support.le_pen, 31);
  assert.equal(state.electorate.find(e => e.subzone_id === 'banlieue_b').support.melenchon, 23);
  assert.equal(state.electorate.find(e => e.subzone_id === 'riches_b').support.philippe, 23);
  assert.deepEqual(state.electorate[0].adjacent_subzone_ids, ['riches_c', 'paris_b']);
  assert.deepEqual(state.electorate.at(-1).adjacent_subzone_ids, ['riches_b', 'paris_a']);
  assert.deepEqual(state.electorate[0].adjacent_biome_ids, ['quartiers_riches', 'banlieue']);
  assert.ok(state.electorate.every(e => e.electoral_weight === 1 && e.controller === null));
  assertMath(state);
});

test('Scores nationaux pondérés, avec un poids configurable distinct pour une sous-zone', () => {
  const cfg = structuredClone(config); cfg.layout.electoral_weights.by_subzone.campagne_b = 3;
  const state = new GameSimulation(validateConfig(cfg)).state;
  for (const f of [...FACTIONS, 'neutral']) close(state.actualGameState.national_support[f], state.electorate.reduce((s, e) => s + e.support[f] * e.electoral_weight, 0) / 20);
  assert.ok(state.actualGameState.national_support.le_pen > new GameSimulation(config).state.actualGameState.national_support.le_pen);
});

test('Arrondis du dernier sondage : l’affichage reste à 100 %, sans altérer la mesure', () => {
  const support = { melenchon: 19.77786, le_pen: 18.55593, philippe: 18.11155, neutral: 43.55466 };
  const copy = structuredClone(support); const display = roundedPollScores(support);
  close(Object.values(display).reduce((s, v) => s + v), 100);
  for (const faction of Object.keys(support)) assert.ok(Math.abs(display[faction] - support[faction]) < 0.1);
  assert.deepEqual(support, copy);
});

test('Contrôle : minimum 35 et avance 4 inclusifs, égalités contestées et basculement des trois camps', () => {
  assert.equal(leadership({ melenchon: 35, le_pen: 31, philippe: 20, neutral: 14 }, config).controller, 'melenchon');
  assert.equal(leadership({ melenchon: 34.99, le_pen: 20, philippe: 20, neutral: 25.01 }, config).controller, null);
  assert.equal(leadership({ melenchon: 35, le_pen: 31.01, philippe: 20, neutral: 13.99 }, config).controller, null);
  assert.deepEqual(leadership({ melenchon: 40, le_pen: 40, philippe: 20, neutral: 0 }, config), { leader: null, controller: null });
  const sim = new GameSimulation(config);
  const election = sim.state.electorate[0]; election.support = { melenchon: 32, le_pen: 31, philippe: 31, neutral: 6 };
  for (const faction of FACTIONS) {
    for (let i = 0; i < 90; i++) convertInfluence(election, { [faction]: 3 }, config);
    refreshElectoralState(sim.state, config); assert.equal(election.controller, faction); assertMath(sim.state);
  }
});

test('Conversion : rendement décroissant, retournement direct seulement sous 12 %, sommes stables sous forte pression', () => {
  const abundant = { support: { melenchon: 10, le_pen: 10, philippe: 10, neutral: 70 } };
  const scarce = { support: { melenchon: 30, le_pen: 25, philippe: 25, neutral: 20 } };
  const a = convertInfluence(abundant, { melenchon: 1 }, config); const b = convertInfluence(scarce, { melenchon: 1 }, config);
  assert.ok(a.melenchon > b.melenchon * 5); assert.equal(a.le_pen, 0); assert.equal(b.philippe, 0);
  const low = { support: { melenchon: 35, le_pen: 30, philippe: 30, neutral: 5 } };
  const delta = convertInfluence(low, { melenchon: 1 }, config); assert.ok(delta.le_pen < 0 && delta.philippe < 0 && delta.melenchon > 0);
  for (let i = 0; i < 1000; i++) {
    convertInfluence(low, { melenchon: (i % 3) * 1000, le_pen: (i % 5) * 999, philippe: (i % 7) * 500 }, config);
    close(Object.values(low.support).reduce((a, b) => a + b), 100); assert.ok(Object.values(low.support).every(v => v >= 0 && v <= 100));
  }
  assert.equal(normalizeSupport({ melenchon: 0, le_pen: 0, philippe: 0, neutral: 0 }).neutral, 100);
});

test('Sources : S, M, Permanence et petite présence ; SO et Cabinet ne produisent pas de voix', () => {
  const { sim, actor } = scenario('philippe', 1);
  unit(sim, 'MILITANT', 'philippe', 110); own(sim, 'permanence', 'philippe', 2); own(sim, 'faction', 'philippe');
  refreshInfluenceSources(sim.state, sim.config);
  const e = sim.state.electorate.find(e => e.subzone_id === 'banlieue_b');
  close(e.influence_per_second.philippe, 0.008 + 0.035 + 0.02 + 0.002);
  unit(sim, 'SERVICE_D_ORDRE', 'melenchon', 110); refreshInfluenceSources(sim.state, sim.config); assert.equal(e.influence_per_second.melenchon, 0);
  actor.campaign_active = false; refreshInfluenceSources(sim.state, sim.config); assert.equal(e.influence_sources.philippe.candidate, 0);
  const lp = scenario('le_pen', 1); refreshInfluenceSources(lp.sim.state, lp.sim.config);
  close(lp.sim.state.electorate.find(e => e.subzone_id === 'banlieue_b').influence_per_second.le_pen, (0.008 + 0.002) * 1.25);
});

test('Tour : implantation 6, paiement complet, annulation, niveaux 1–3 et une seule active par camp', () => {
  for (const faction of FACTIONS) {
    const { sim, actor } = scenario(faction, 5); const tower = building(sim, 'tour_communication');
    assert.equal(buildingOffer(sim.state, sim.config, actor, tower), null);
    unit(sim, 'SYMPATHISANT', faction, 110);
    actor.x = tower.x; advance(sim, 30); assert.equal(actor.total_spent, 0);
    actor.x = 108; sim.step(); actor.x = tower.x; advance(sim, 59); assert.equal(tower.level, 0);
    sim.step(); assert.equal(tower.level, 1); assert.equal(actor.total_spent, 75);
    advance(sim, 90); assert.equal(tower.level, 1);
    visit(sim, actor, tower.x); assert.equal(tower.level, 2);
    visit(sim, actor, tower.x); assert.equal(tower.level, 3); assert.equal(actor.total_spent, 75 + 110 + 160);
    assert.equal(sim.state.npcs.length, 6);
    for (let i = 0; i < 6; i++) unit(sim, 'SYMPATHISANT', faction, 128 + i);
    const other = building(sim, 'tour_communication', 'banlieue_c');
    assert.equal(buildingOffer(sim.state, sim.config, actor, other).reason, 'GLOBAL_LIMIT');
    other.owner_id = faction; other.state = 'CLOSED'; assert.equal(buildingOffer(sim.state, sim.config, actor, other).reason, 'GLOBAL_LIMIT');
    sim.config.balance.buildings.tour_communication.global_limit = 2;
    assert.equal(buildingOffer(sim.state, sim.config, actor, other).enabled, true);
  }
});

test('Tour : ×2 contrôlée, ×1,5 adjacente y compris boucle, ×1 distante ; faible face au Militant', () => {
  const { sim } = scenario(); own(sim, 'tour_communication', 'melenchon', 3);
  sim.state.electorate[0].support = { melenchon: 50, le_pen: 15, philippe: 15, neutral: 20 };
  refreshElectoralState(sim.state, sim.config); refreshInfluenceSources(sim.state, sim.config);
  const source = i => sim.state.electorate[i].influence_sources.melenchon;
  close(source(0).tower, 0.0055 * 2); close(source(1).tower, 0.0055 * 1.5); close(source(17).tower, 0.0055 * 1.5); close(source(2).tower, 0.0055);
  assert.ok(source(0).tower < config.balance.physical_units.militant.influence_per_second / 3);
  building(sim, 'tour_communication').state = 'CLOSED'; building(sim, 'tour_communication').level = 0;
  refreshInfluenceSources(sim.state, sim.config); assert.ok(sim.state.electorate.every(e => e.influence_sources.melenchon.tower === 0));
});

test('Institut : aucun sondage initial, achat 90, mesure immédiate puis toutes les 240 étapes et séparation par camp', () => {
  const { sim, actor } = scenario(); assert.ok(Object.values(sim.state.polls).every(p => p.lastPollSnapshot === null));
  const institute = building(sim, 'institut_sondage'); actor.x = institute.x; advance(sim, 59);
  assert.equal(sim.state.polls.melenchon.lastPollSnapshot, null); sim.step();
  assert.equal(actor.total_spent, 90); assert.equal(institute.level, 1);
  const old = structuredClone(sim.state.polls.melenchon.lastPollSnapshot); assert.equal(old.measured_tick, 60);
  sim.step([controlZone(actor.id)]); assert.notDeepEqual(sim.state.actualGameState.national_support, old.national_support);
  advance(sim, 238); assert.deepEqual(sim.state.polls.melenchon.lastPollSnapshot, old);
  sim.step(); assert.equal(sim.state.polls.melenchon.lastPollSnapshot.measured_tick, 300);
  assert.equal(sim.state.polls.melenchon.lastPollSnapshot.zones[4].controller, 'melenchon');
  assert.equal(sim.state.polls.le_pen.lastPollSnapshot, null); assertMath(sim.state);
});

test('Cabinet : fermer Tour, Institut et Meeting coupe les effets ; dernière mesure figée puis reprise après reconstruction', () => {
  for (const type of ['tour_communication', 'institut_sondage', 'meeting']) {
    const { sim, actor } = scenario('philippe');
    const cabinet = own(sim, 'faction', 'philippe'); const target = own(sim, type, 'melenchon');
    if (type === 'meeting') triggerMeeting(sim, target);
    refreshElectoralState(sim.state, sim.config); updatePolls(sim);
    const old = structuredClone(sim.state.polls.melenchon.lastPollSnapshot);
    actor.x = cabinet.x + (target.x > cabinet.x ? 1 : -1) * sim.config.balance.faction_interactions.side_offset;
    assert.equal(nearestOffer(sim.state, sim.config, actor).victim_id, target.id);
    advance(sim, 60); assert.equal(target.state, 'CLOSED'); assert.equal(target.level, 0); assert.equal(actor.spending.CLOSE, 120);
    actor.interaction_active = false; advance(sim, 260);
    assert.equal(sim.state.polls.melenchon.active, false); assert.deepEqual(sim.state.polls.melenchon.lastPollSnapshot, old);
    assert.ok(sim.state.electorate.every(e => e.influence_sources.melenchon.tower === 0 && e.influence_sources.melenchon.meeting === 0));
    if (type === 'meeting') assert.equal(target.meeting_until_tick, 0);
    const owner = sim.state.candidates[0]; owner.x = target.x; owner.campaign_active = true; owner.interaction_active = true;
    advance(sim, 60); assert.equal(target.state, 'ACTIVE'); assert.equal(target.level, 1); assert.equal(owner.spending.REBUILD, config.balance.buildings[type].build_cost);
    if (type === 'institut_sondage') { assert.ok(sim.state.polls.melenchon.active); assert.ok(sim.state.polls.melenchon.lastPollSnapshot.measured_tick > old.measured_tick); }
    assertMath(sim.state);
  }
});

test('Meeting : construction 65, candidat sur place, événement 30, basculement local et bonus uniquement S/M', () => {
  const { sim, actor } = scenario(); const podium = building(sim, 'meeting');
  const local = sim.state.electorate.find(e => e.subzone_id === podium.subzone_id);
  visit(sim, actor, podium.x); assert.equal(actor.spending.BUILD, 65); assert.equal(podium.meetings_held, 0);
  unit(sim, 'MILITANT', 'melenchon', 109); own(sim, 'permanence'); own(sim, 'tour_communication');
  local.support = { melenchon: 34.8, le_pen: 22, philippe: 13.2, neutral: 30 };
  refreshElectoralState(sim.state, sim.config); assert.equal(local.controller, null);
  const elsewhere = sim.state.electorate[0].support.melenchon;
  visit(sim, actor, podium.x, 59); assert.equal(podium.meetings_held, 0); const before = local.support.melenchon;
  sim.step(); assert.equal(podium.meetings_held, 1); assert.equal(actor.spending.MEETING, 30); assert.equal(local.controller, 'melenchon');
  assert.ok(local.support.melenchon - before > 1.3); assert.ok(sim.state.electorate[0].support.melenchon - elsewhere < 0.01);
  const source = local.influence_sources.melenchon;
  close(source.meeting, (6 * 0.008 + 0.035) * 0.3); close(source.permanence, 0.012); close(source.candidate, 0.002);
  const until = podium.meeting_until_tick;
  visit(sim, actor, podium.x); assert.equal(podium.meetings_held, 1); assert.equal(nearestOffer(sim.state, sim.config, actor).reason, 'COOLDOWN');
  actor.interaction_active = false; advance(sim, until - sim.state.tick); assert.equal(local.influence_sources.melenchon.meeting, 0);
  assertMath(sim.state);
});

test('Meeting : les niveaux modifient coûts, impulsions, délais et bonus ; pas de double paiement ni activation à distance', () => {
  for (const faction of FACTIONS) {
    const { sim, actor } = scenario(faction); const podium = own(sim, 'meeting', faction);
    actor.x = podium.x + 1.8; advance(sim, 70); assert.equal(podium.meetings_held, 0);
    for (let level = 1; level <= 3; level++) {
      if (level > 1) { visit(sim, actor, podium.x + config.balance.buildings.meeting.upgrade_offset); assert.equal(podium.level, level); }
      podium.meeting_ready_tick = 0; visit(sim, actor, podium.x);
      assert.equal(podium.meetings_held, level);
      close(podium.meeting_ready_tick - podium.meeting_started_tick, config.balance.buildings.meeting.internal_cooldown_seconds_by_level[level - 1] * sim.hz);
      const event = sim.state.events.findLast(e => e.type === 'MeetingStarted');
      close(event.influence_budget, config.balance.buildings.meeting.influence_burst_by_level[level - 1] * (faction === 'le_pen' ? 1.25 : 1));
    }
    assert.equal(actor.spending.MEETING, 105); assert.equal(actor.spending.UPGRADE, 235);
  }
});

test('Coups : contrôle perdu immédiatement, pertes seulement aux Neutres, cercle modifié au prochain sondage', () => {
  const { sim, actor } = scenario('melenchon', 0); actor.campaign_active = false; actor.interaction_active = false;
  const e = sim.state.electorate.find(e => e.subzone_id === 'banlieue_b'); e.support = { melenchon: 35.01, le_pen: 30, philippe: 20, neutral: 14.99 };
  own(sim, 'institut_sondage'); refreshElectoralState(sim.state, sim.config); updatePolls(sim);
  const old = structuredClone(sim.state.polls.melenchon.lastPollSnapshot);
  const source = sim.state.candidates[1]; const result = hit(sim, source, actor, { electoral_damage: 0.03, knockback: 0, damage: 0 }, 'test');
  close(e.support.melenchon, 34.98); close(e.support.neutral, 15.02); assert.equal(e.controller, null);
  assert.equal(result.electoral_changes[0].controller_before, 'melenchon'); assert.equal(result.electoral_changes[0].controller_after, null);
  assert.deepEqual(sim.state.polls.melenchon.lastPollSnapshot, old); advance(sim, 240);
  assert.equal(sim.state.polls.melenchon.lastPollSnapshot.zones[4].controller, null); assertMath(sim.state);
});

test('Snapshot : sondage ancien, Meeting actif et reprise déterministe, y compris à plusieurs FPS', () => {
  const run = fps => {
    const { sim, actor } = scenario(); actor.interaction_active = false;
    own(sim, 'institut_sondage'); own(sim, 'tour_communication'); triggerMeeting(sim, own(sim, 'meeting'));
    const clock = new FixedClock(30);
    for (let i = 0; i < fps * 9; i++) clock.advance(1 / fps, () => sim.step());
    return sim;
  };
  const expected = run(30);
  for (const fps of [1, 20, 60, 144]) assert.deepEqual(run(fps).state, expected.state);
  const loaded = new GameSimulation(expected.config); loaded.importSnapshot(expected.exportSnapshot());
  advance(expected, 250); advance(loaded, 250); assert.deepEqual(loaded.state, expected.state);
});

test('Snapshot : supports, poids, contrôles, sondage, agrégation et horloges falsifiés sont refusés atomiquement', () => {
  const { sim } = scenario(); own(sim, 'institut_sondage'); sim.step(); const snapshot = sim.exportSnapshot();
  for (const mutate of [
    s => { s.electorate[0].support.melenchon = -1; }, s => { s.electorate[0].controller = 'philippe'; },
    s => { s.electorate[0].electoral_weight = 2; }, s => { s.electorate[0].adjacent_subzone_ids = []; },
    s => { s.actualGameState.national_support.melenchon++; }, s => { s.polls.melenchon.lastPollSnapshot.measured_tick = 100000; },
    s => { s.polls.melenchon.lastPollSnapshot.national_support.neutral = 0; },
    s => { s.polls.melenchon.lastPollSnapshot.zones[0].controller = 'le_pen'; },
    s => { s.polls.melenchon.next_poll_tick = 0; }, s => { s.buildings.find(b => b.type === 'meeting').meeting_until_tick = -1; },
  ]) {
    const broken = JSON.parse(snapshot); mutate(broken); assert.throws(() => sim.importSnapshot(broken), /État JSON incompatible/); assert.equal(sim.exportSnapshot(), snapshot);
  }
});

test('IA : chaque camp construit les trois lieux, utilise le Meeting et améliore sa Tour avec des transactions ordinaires', () => {
  const { sim } = scenario('melenchon', 0); sim.state.ai_enabled = true;
  const ai = new AIController(sim.config);
  const highestTower = Object.fromEntries(FACTIONS.map(f => [f, 0]));
  for (const c of sim.state.candidates) {
    const z = sim.state.world.subzones.find(z => z.id === sim.config.layout.starting_positions[c.faction_id]);
    c.x = z.center; c.campaign_active = true; c.interaction_active = true;
    // The extra local supporters were born next door; migration does not enlarge the home cap.
    const neighbor = sim.state.world.subzones.find(other => other.biome_id === z.biome_id && other.id !== z.id);
    for (let i = 0; i < 8; i++) unit(sim, 'SYMPATHISANT', c.faction_id, z.start + 9 + i * 0.4, i < z.max_npcs_by_origin ? z : neighbor);
  }
  for (let i = 0; i < 30 * 160; i++) {
    sim.step(sim.state.candidates.flatMap(c => ai.commands(sim.state, c.id)));
    for (const b of sim.state.buildings.filter(b => b.type === 'tour_communication' && b.owner_id)) highestTower[b.owner_id] = Math.max(highestTower[b.owner_id], b.level);
  }
  for (const faction of FACTIONS) {
    const owned = sim.state.buildings.filter(b => b.owner_id === faction);
    for (const type of ['tour_communication', 'institut_sondage', 'meeting']) assert.ok(owned.some(b => b.type === type), `${faction} ${type}`);
    assert.ok(owned.find(b => b.type === 'meeting').meetings_held > 0, `${faction} meeting`);
    assert.equal(highestTower[faction], 3, faction);
    assert.ok(sim.state.candidates.find(c => c.faction_id === faction).spending.MEETING > 0);
  }
  assertMath(sim.state);
});

test('IA : convaincre près de l’Imprimerie ne déclenche aucune dépense non choisie', () => {
  const { sim, actor } = scenario('le_pen'); sim.state.ai_enabled = true;
  const printer = building(sim, 'imprimerie'); actor.x = printer.x;
  const npc = sim.spawn(zoneAt(sim.state.world, actor.x), actor.x + 0.5, false);
  npc.persuasion = { actor_id: actor.id, elapsed_ticks: 1, required_ticks: 90 };
  actor.persuasion_target_ids = [npc.id];
  const ai = new AIController(sim.config);
  for (let i = 0; i < 75; i++) sim.step(ai.commands(sim.state, actor.id));
  assert.equal(actor.total_spent, 0); assert.equal(printer.queue.length, 0);
  assert.ok(npc.persuasion?.elapsed_ticks > 60);
});

test('Commandes de débogage : influence, contrôle, Neutres à 50 %, constructions et Meeting sérialisables', () => {
  const { sim, actor } = scenario();
  sim.step([addInfluence(actor.id, 'le_pen'), neutral50(actor.id), controlZone(actor.id), buildElectoral(actor.id, 'tour_communication'), buildElectoral(actor.id, 'institut_sondage'), buildElectoral(actor.id, 'meeting'), debugMeeting(actor.id)]);
  assert.equal(actor.total_spent, 0); assert.ok(sim.state.polls.melenchon.lastPollSnapshot);
  const restored = new GameSimulation(sim.config); restored.importSnapshot(sim.exportSnapshot()); assert.deepEqual(restored.state, sim.state);
  assertMath(sim.state);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { validateConfig } from '../src/config.js';
import { FACTIONS, zoneAt } from '../src/simulation/world.js';
import { buildingOffer, nearestOffer } from '../src/simulation/economy.js';
import { incomeBreakdown, incomePerSecond, localSympathisants, waitingAtPoint } from '../src/simulation/territory.js';
import { demobilizeUnit } from '../src/simulation/combat-state.js';
import { teleportTarget, teleport, setCampaignActive, interactionPresence } from '../src/simulation/commands.js';
import { AIController, LocalHumanController, collectCommands } from '../src/simulation/controllers.js';
import { FixedClock } from '../src/simulation/fixed-clock.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'].map(async f => JSON.parse(await readFile(new URL(f, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype });
const advance = (sim, ticks, commands = []) => { for (let i = 0; i < ticks; i++) sim.step(commands); };
const candidateId = 'candidate:melenchon';
const permanenceId = 'building:banlieue_b:permanence';
const financeId = 'building:banlieue_b:financement';
const printerId = 'service:banlieue:imprimerie';

// A small controllable world fixture: full topology, real transactions, no incidental spawns.
function scenario(count = 2, { faction = 'melenchon', money = 300 } = {}) {
  const cfg = structuredClone(config);
  for (const biome of cfg.layout.biomes) for (const zone of biome.subzones) zone.mean_spawn_days = 1000;
  cfg.prototype.world.roam_speed_units_per_second = 0;
  const sim = new GameSimulation(cfg);
  const state = sim.getState();
  const template = state.npcs.find(n => n.origin_subzone_id === 'banlieue_b');
  state.npcs = [];
  for (let i = 0; i < count; i++) {
    const npc = structuredClone(template);
    npc.id = `npc:${state.next_npc_id++}`;
    npc.x = 102 + i * 0.5; npc.roam_target_x = npc.x; npc.roam_wait_ticks = 100000;
    npc.role = 'SYMPATHISANT'; npc.faction_id = faction; npc.hidden_durability = cfg.balance.physical_units.sympathisant.hidden_durability;
    state.npcs.push(npc);
  }
  for (const c of state.candidates) { c.campaign_active = false; c.interaction_active = false; c.money = money; }
  const actor = state.candidates.find(c => c.faction_id === faction);
  actor.x = state.buildings.find(b => b.id === permanenceId).x;
  actor.campaign_active = true; actor.interaction_active = true;
  state.local_candidate_id = actor.id;
  state.ai_enabled = false;
  sim.importSnapshot(state);
  return { sim, cfg, actorId: actor.id };
}

test('Rareté initiale : 4 à 5 Neutres par biome, aucune unité offerte', () => {
  const state = new GameSimulation(config).getState();
  assert.equal(state.npcs.length, 25);
  for (const biome of config.layout.biomes) {
    const count = state.npcs.filter(n => n.origin_biome_id === biome.id).length;
    assert.ok(count >= 4 && count <= 5, biome.id);
  }
  assert.ok(state.npcs.every(n => n.role === 'NEUTRE' && n.faction_id === null));
  for (const biome of config.layout.biomes) for (const zone of biome.subzones) {
    assert.deepEqual(Object.keys(zone).filter(k => /initial|spawn|waiting/.test(k)).sort(), ['initial_neutral_count', 'max_neutrals_waiting', 'mean_spawn_days', 'spawn_randomness'].sort());
  }
});

test('Les délais sont en jours, dans l’intervalle aléatoire demandé et changent à chaque tentative', () => {
  const cfg = structuredClone(config);
  cfg.balance.time.real_seconds_per_game_day = 2;
  const sim = new GameSimulation(cfg);
  const before = sim.getState();
  const seen = new Map(before.spawn_timers.map(t => [t.social_point_id, new Set([t.interval_ticks])]));
  for (let i = 0; i < 600; i++) {
    sim.step(FACTIONS.map(f => setCampaignActive(`candidate:${f}`, false)));
    for (const timer of sim.state.spawn_timers) {
      const zone = sim.state.world.subzones.find(z => z.id === timer.subzone_id);
      const meanTicks = zone.mean_spawn_days * 2 * 30;
      assert.ok(timer.interval_ticks >= Math.ceil(meanTicks * 0.75 - 1e-9));
      assert.ok(timer.interval_ticks <= Math.ceil(meanTicks * 1.25));
      seen.get(timer.social_point_id).add(timer.interval_ticks);
    }
  }
  assert.ok([...seen.values()].every(values => values.size > 1));
  assert.ok(config.layout.biomes.find(b => b.id === 'banlieue').subzones.every(z => z.mean_spawn_days === 1));
  assert.ok(config.layout.biomes.find(b => b.id === 'campagne').subzones.every(z => z.mean_spawn_days === 1.5));
  assert.ok(config.layout.biomes.find(b => b.id === 'quartiers_riches').subzones.every(z => z.mean_spawn_days === 2));
});

test('Un point plein ne cumule pas de réapparitions et libérer une place ne crée pas de rafale', () => {
  const cfg = structuredClone(config);
  cfg.balance.time.real_seconds_per_game_day = 1;
  const sim = new GameSimulation(cfg);
  advance(sim, 300, FACTIONS.map(f => setCampaignActive(`candidate:${f}`, false)));
  for (const point of sim.state.world.socialPoints) assert.equal(waitingAtPoint(sim.state, point.id), 2);
  const state = sim.getState();
  const npc = state.npcs[0]; npc.role = 'SYMPATHISANT'; npc.faction_id = 'melenchon';
  const timer = state.spawn_timers.find(t => t.social_point_id === npc.origin_social_point_id);
  const remaining = timer.interval_ticks - timer.elapsed_ticks;
  sim.importSnapshot(state);
  advance(sim, remaining - 1);
  assert.equal(waitingAtPoint(sim.state, npc.origin_social_point_id), 1);
  sim.step();
  assert.equal(waitingAtPoint(sim.state, npc.origin_social_point_id), 2);
  assert.ok(sim.state.spawn_timers.find(t => t.social_point_id === npc.origin_social_point_id).interval_ticks >= 1);
});

test('La capacité est bien par point social, même avec plusieurs points dans une sous-zone', () => {
  const cfg = structuredClone(config); cfg.layout.social_points_per_subzone = 2; cfg.balance.time.real_seconds_per_game_day = 1;
  const sim = new GameSimulation(cfg);
  advance(sim, 300, FACTIONS.map(f => setCampaignActive(`candidate:${f}`, false)));
  assert.equal(sim.state.spawn_timers.length, 36);
  for (const point of sim.state.world.socialPoints) assert.equal(waitingAtPoint(sim.state, point.id), 2);
  assert.equal(sim.state.npcs.length, 72);
});

test('Permanence verrouillée sous le seuil, même avec de l’argent ; seuil non consommé', () => {
  const { sim } = scenario(1);
  const building = sim.state.buildings.find(b => b.id === permanenceId);
  assert.equal(nearestOffer(sim.getState(), sim.config, sim.state.candidates[0]), null);
  advance(sim, 120);
  assert.equal(building.level, 0); assert.equal(sim.state.candidates[0].total_spent, 0);
  const state = sim.getState();
  const second = structuredClone(state.npcs[0]); second.id = `npc:${state.next_npc_id++}`; state.npcs.push(second);
  sim.importSnapshot(state);
  advance(sim, 59);
  assert.equal(sim.state.buildings.find(b => b.id === permanenceId).level, 0);
  sim.step();
  assert.equal(sim.state.buildings.find(b => b.id === permanenceId).level, 1);
  assert.equal(localSympathisants(sim.state, 'banlieue_b', 'melenchon').length, 2);
  assert.equal(sim.state.candidates[0].total_spent, 35);
});

test('Fonds insuffisants : billet désactivé et aucune progression ni dépense', () => {
  const { sim } = scenario(2, { money: 1 });
  const offer = nearestOffer(sim.state, sim.config, sim.state.candidates[0]);
  assert.equal(offer.cost, 35); assert.equal(offer.reason, 'INSUFFICIENT_FUNDS');
  advance(sim, 90);
  assert.equal(sim.state.candidates[0].purchase_hold, null);
  assert.equal(sim.state.candidates[0].total_spent, 0);
});

test('Sortir annule le paiement, revenir impose une nouvelle présence complète', () => {
  const { sim } = scenario();
  advance(sim, 35);
  assert.equal(sim.state.candidates[0].purchase_hold.elapsed_ticks, 35);
  sim.step([teleport(candidateId, 'banlieue_a')]);
  assert.equal(sim.state.candidates[0].purchase_hold, null);
  sim.step([teleportTarget(candidateId, permanenceId)]);
  advance(sim, 58);
  assert.equal(sim.state.buildings.find(b => b.id === permanenceId).level, 0);
  sim.step();
  assert.equal(sim.state.buildings.find(b => b.id === permanenceId).level, 1);
});

test('Présence sans intention active : la simulation refuse tout achat', () => {
  const { sim } = scenario();
  advance(sim, 120, [interactionPresence(candidateId, false)]);
  assert.equal(sim.state.candidates[0].total_spent, 0);
  advance(sim, 60, [interactionPresence(candidateId)]);
  assert.equal(sim.state.candidates[0].total_spent, 35);
});

test('Améliorations complètes de Permanence, un achat par visite, niveau maximal respecté', () => {
  const { sim } = scenario();
  advance(sim, 180);
  assert.equal(sim.state.buildings.find(b => b.id === permanenceId).level, 1);
  for (const expected of [2, 3]) {
    sim.step([teleport(candidateId, 'banlieue_a')]);
    sim.step([teleportTarget(candidateId, permanenceId)]); advance(sim, 59);
    assert.equal(sim.state.buildings.find(b => b.id === permanenceId).level, expected);
  }
  assert.equal(sim.state.candidates[0].total_spent, 35 + 55 + 90);
  assert.equal(localSympathisants(sim.state, 'banlieue_b', 'melenchon').length, 2);
  assert.equal(buildingOffer(sim.state, sim.config, sim.state.candidates[0], sim.state.buildings.find(b => b.id === permanenceId)), null);
});

test('Concurrence : une seule propriété et un seul débit, indépendants de l’ordre des commandes', () => {
  const setup = () => {
    const { sim } = scenario(6);
    const state = sim.getState();
    state.npcs.forEach((n, i) => { n.faction_id = FACTIONS[Math.floor(i / 2)]; });
    state.candidates.forEach(c => { c.campaign_active = true; c.interaction_active = true; c.x = state.candidates[0].x; });
    sim.importSnapshot(state); return sim;
  };
  const a = setup(); const b = setup();
  const intents = FACTIONS.map(f => interactionPresence(`candidate:${f}`));
  advance(a, 60, intents); advance(b, 60, [...intents].reverse());
  assert.deepEqual(a.getState(), b.getState());
  assert.equal(a.state.transactions.length, 1);
  assert.equal(a.state.buildings.find(b => b.id === permanenceId).owner_id, 'le_pen');
  assert.equal(a.state.candidates.filter(c => c.total_spent === 35).length, 1);
  assert.ok(a.state.candidates.every(c => c.purchase_hold === null));
});

test('Partisans : chaque biome de naissance contribue, même après un déplacement', () => {
  const { sim } = scenario(0);
  // Different rates make an accidental use of the current biome observable.
  for (const [index, biome] of sim.config.layout.biomes.entries()) {
    sim.config.balance.money.supporter_income_per_second_by_origin_biome[biome.id] = index + 1;
    const zone = sim.state.world.subzones.find(z => z.biome_id === biome.id);
    const npc = sim.spawn(zone, sim.state.world.subzones[0].center, false);
    npc.role = 'SYMPATHISANT'; npc.faction_id = 'melenchon';
  }
  const income = incomeBreakdown(sim.state, sim.config, 'melenchon');
  assert.equal(income.supporters, 21);
  assert.equal(income.total, 21.12);
  assert.ok(Object.values(income.byBiome).every(source => source.count === 1));
  sim.state.npcs.forEach(n => { n.x = sim.state.world.subzones.at(-1).center; });
  assert.deepEqual(incomeBreakdown(sim.state, sim.config, 'melenchon'), income);
  assert.equal(incomePerSecond(sim.state, sim.config, 'le_pen'), 0.12);
  sim.state.npcs.reverse();
  assert.deepEqual(incomeBreakdown(sim.state, sim.config, 'melenchon'), income);
});

test('Partisans : promotions conservées, démobilisation arrêtée, nouveau camp bénéficiaire', () => {
  const { sim } = scenario(1);
  const npc = sim.state.npcs[0];
  for (const role of ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE']) {
    npc.role = role;
    assert.equal(incomePerSecond(sim.state, sim.config, 'melenchon'), 0.52);
  }
  demobilizeUnit(sim, npc);
  assert.equal(incomePerSecond(sim.state, sim.config, 'melenchon'), 0.12);
  npc.role = 'NEUTRE';
  assert.equal(incomePerSecond(sim.state, sim.config, 'melenchon'), 0.12);
  npc.role = 'SYMPATHISANT'; npc.faction_id = 'philippe';
  assert.equal(incomePerSecond(sim.state, sim.config, 'melenchon'), 0.12);
  assert.equal(incomePerSecond(sim.state, sim.config, 'philippe'), 0.52 * 1.3);
  sim.state.eliminated_faction = 'philippe';
  assert.equal(incomePerSecond(sim.state, sim.config, 'philippe'), 0);
});

test('Partisans : revenu versé chaque seconde et sauvegarde conservée', () => {
  const { sim, cfg } = scenario(5);
  sim.state.candidates.forEach(c => { c.campaign_active = false; c.interaction_active = false; });
  const candidate = sim.state.candidates[0];
  const before = candidate.money;
  const resumed = new GameSimulation(cfg); resumed.importSnapshot(sim.exportSnapshot());
  advance(sim, sim.hz * 10); advance(resumed, resumed.hz * 10);
  assert.ok(Math.abs(candidate.money - before - 21.2) < 1e-9);
  assert.ok(Math.abs(candidate.total_earned - 21.2) < 1e-9);
  assert.equal(candidate.income_per_second, 2.12);
  assert.deepEqual(resumed.getState(), sim.getState());
});

test('Financement : seuil de 4, revenus par niveau, bonus Philippe sur tous les revenus', () => {
  for (const faction of ['melenchon', 'philippe']) {
    const { sim, actorId } = scenario(4, { faction, money: 500 });
    sim.step([teleportTarget(actorId, financeId)]); advance(sim, 59);
    const building = sim.state.buildings.find(b => b.id === financeId);
    assert.equal(building.level, 1); assert.equal(building.owner_id, faction);
    const candidate = sim.state.candidates.find(c => c.id === actorId);
    const before = candidate.money;
    advance(sim, 30);
    const supporters = 4 * config.balance.money.supporter_income_per_second_by_origin_biome.banlieue;
    const expected = (0.12 + supporters + 0.3) * (faction === 'philippe' ? 1.3 : 1);
    assert.ok(Math.abs(candidate.money - before - expected) < 1e-9);
    for (const level of [2, 3]) {
      sim.step([teleport(actorId, 'banlieue_a')]); sim.step([teleportTarget(actorId, financeId)]); advance(sim, 59);
      assert.equal(building.level, level);
    }
    assert.ok(Math.abs(incomePerSecond(sim.state, sim.config, faction) - (0.12 + supporters + 0.82) * (faction === 'philippe' ? 1.3 : 1)) < 1e-12);
  }
  const { sim } = scenario(3);
  sim.step([teleportTarget(candidateId, financeId)]); advance(sim, 90);
  assert.equal(sim.state.buildings.find(b => b.id === financeId).state, 'EMPTY');
});

test('Imprimerie neutre : paiement séparé par camp, file partagée, attribution exclusive', () => {
  const { sim } = scenario(3);
  const state = sim.getState();
  const printer = state.buildings.find(b => b.id === printerId);
  state.npcs.forEach((npc, i) => { npc.faction_id = FACTIONS[i]; });
  state.candidates.forEach(c => { c.x = printer.x; c.campaign_active = true; c.interaction_active = true; });
  sim.importSnapshot(state); advance(sim, 60);
  const service = sim.state.buildings.find(b => b.id === printerId);
  assert.equal(service.owner_id, null); assert.equal(service.level, 1);
  assert.equal(service.queue.length, 3);
  assert.equal(new Set(service.queue.map(o => o.assigned_npc_id)).size, 3);
  assert.ok(sim.state.candidates.every(c => c.total_spent === 12));
  assert.ok(service.queue.every(o => sim.state.npcs.find(n => n.id === o.assigned_npc_id).faction_id === o.faction_id));
});

test('L’Imprimerie choisit le disponible le plus proche du biome, puis son ID en cas d’égalité', () => {
  const { sim } = scenario(3);
  const state = sim.getState();
  const printer = state.buildings.find(b => b.id === printerId);
  state.npcs[0].x = printer.x - 5; state.npcs[1].x = printer.x + 5; state.npcs[2].x = printer.x + 8;
  sim.importSnapshot(state);
  sim.step([teleportTarget(candidateId, printerId)]); advance(sim, 59);
  const first = sim.state.buildings.find(b => b.id === printerId).queue[0];
  assert.equal(first.assigned_npc_id, [state.npcs[0].id, state.npcs[1].id].sort()[0]);
  advance(sim, 60);
  const orders = sim.state.buildings.find(b => b.id === printerId).queue;
  assert.equal(orders.length, 2);
  assert.notEqual(orders[0].assigned_npc_id, orders[1].assigned_npc_id);
  assert.ok(sim.state.npcs.filter(n => n.task).every(n => n.task.kind === 'COLLECT_TRACT'));
});

test('La file est bornée ; un tract non affecté attend une main-d’œuvre future', () => {
  const { sim } = scenario(1);
  const state = sim.getState(); state.npcs[0].x = 76; state.npcs[0].roam_target_x = 76;
  sim.importSnapshot(state);
  sim.step([teleportTarget(candidateId, printerId)]); advance(sim, 269);
  const printer = sim.state.buildings.find(b => b.id === printerId);
  assert.equal(printer.queue.length, 4);
  assert.equal(sim.state.candidates[0].total_spent, 48);
  assert.equal(printer.queue.filter(o => o.assigned_npc_id === null).length, 3);
  assert.equal(nearestOffer(sim.state, sim.config, sim.state.candidates[0]).reason, 'QUEUE_FULL');
  assert.ok(printer.queue[0].state === 'READY');
});

test('Collecte visible puis Militant autonome : marche, attente, équipement, conversion d’un Neutre', () => {
  const { sim } = scenario(1);
  const state = sim.getState();
  const workerId = state.npcs[0].id;
  const origin = { biome: state.npcs[0].origin_biome_id, zone: state.npcs[0].origin_subzone_id, point: state.npcs[0].origin_social_point_id };
  const neutral = structuredClone(state.npcs[0]);
  neutral.id = `npc:${state.next_npc_id++}`; neutral.role = 'NEUTRE'; neutral.faction_id = null; neutral.hidden_durability = 0;
  neutral.x = 91; neutral.roam_target_x = 91; neutral.origin_subzone_id = 'banlieue_a'; neutral.origin_social_point_id = 'social:banlieue_a:0';
  state.npcs.push(neutral); sim.importSnapshot(state);
  sim.step([teleportTarget(candidateId, printerId)]); advance(sim, 59);
  const assigned = sim.state.npcs.find(n => n.id === workerId);
  assert.equal(assigned.role, 'SYMPATHISANT'); assert.equal(assigned.task.phase, 'TRAVEL');
  assert.ok(assigned.moving);
  const phases = new Set(); let conversationByMilitant = false;
  for (let i = 0; i < 1000; i++) {
    sim.step([interactionPresence(candidateId, false), setCampaignActive(candidateId, false)]);
    const worker = sim.state.npcs.find(n => n.id === workerId);
    if (worker.task) phases.add(worker.task.phase);
    if (sim.state.npcs.find(n => n.id === neutral.id).persuasion?.actor_id === workerId) conversationByMilitant = true;
    if (sim.state.npcs.find(n => n.id === neutral.id).role === 'SYMPATHISANT') break;
  }
  const worker = sim.state.npcs.find(n => n.id === workerId);
  assert.ok(phases.has('PICKUP')); assert.ok(phases.has('RECRUIT')); assert.ok(conversationByMilitant);
  assert.equal(worker.role, 'MILITANT');
  assert.equal(sim.state.npcs.find(n => n.id === neutral.id).faction_id, 'melenchon');
  assert.deepEqual({ biome: worker.origin_biome_id, zone: worker.origin_subzone_id, point: worker.origin_social_point_id }, origin);
  assert.equal(sim.state.buildings.find(b => b.id === printerId).delivered_count, 1);
  assert.equal(sim.state.candidates[0].total_spent, 12);
});

test('Le Militant convainc en 5 s sans hériter du bonus personnel de Mélenchon', () => {
  const { sim } = scenario(1);
  const state = sim.getState();
  const militant = state.npcs[0]; militant.role = 'MILITANT'; militant.task = null;
  const neutral = structuredClone(militant); neutral.id = `npc:${state.next_npc_id++}`; neutral.role = 'NEUTRE'; neutral.faction_id = null; neutral.x = militant.x + 1;
  state.npcs.push(neutral); state.candidates[0].campaign_active = false; sim.importSnapshot(state);
  advance(sim, 149);
  assert.equal(sim.state.npcs[1].role, 'NEUTRE');
  assert.equal(sim.state.npcs[1].persuasion.required_ticks, 150);
  sim.step(); assert.equal(sim.state.npcs[1].role, 'SYMPATHISANT');
});

test('Influence abstraite indépendante : sources locales et conservation de 100 %', () => {
  const { sim } = scenario(2);
  sim.step([interactionPresence(candidateId, false)]);
  const election = sim.state.electorate.find(e => e.subzone_id === 'banlieue_b');
  assert.ok(Math.abs(election.influence_per_second.melenchon - (0.016 + config.balance.influence.candidate_presence_per_second)) < 1e-12);
  const before = election.support.melenchon;
  advance(sim, 60, [interactionPresence(candidateId)]);
  assert.ok(election.support.melenchon > before);
  assert.ok(Math.abs(election.influence_per_second.melenchon - (0.028 + config.balance.influence.candidate_presence_per_second)) < 1e-12);
  for (const record of sim.state.electorate) assert.ok(Math.abs(Object.values(record.support).reduce((a, b) => a + b, 0) - 100) < 1e-9);
  const state = sim.getState(); state.npcs[0].role = 'MILITANT'; sim.importSnapshot(state); sim.step();
  const changed = sim.state.electorate.find(e => e.subzone_id === 'banlieue_b');
  assert.ok(Math.abs(changed.influence_per_second.melenchon - (0.035 + 0.008 + 0.012 + config.balance.influence.candidate_presence_per_second)) < 1e-12);
  assert.ok(sim.persuasionTicks(sim.state.candidates[0]) < 50);
});

test('Snapshot durant un paiement, puis durant la production : reprise strictement identique', () => {
  const { sim, cfg } = scenario(3);
  advance(sim, 30);
  const restored = new GameSimulation(cfg, 77); restored.importSnapshot(sim.exportSnapshot());
  advance(sim, 30); advance(restored, 30);
  assert.deepEqual(sim.getState(), restored.getState());
  sim.step([teleportTarget(candidateId, printerId)]); advance(sim, 149);
  assert.ok(sim.state.buildings.find(b => b.id === printerId).queue.length >= 2);
  restored.importSnapshot(sim.exportSnapshot());
  for (let i = 0; i < 900; i++) {
    sim.step([interactionPresence(candidateId, false)]); restored.step([interactionPresence(candidateId, false)]);
  }
  assert.deepEqual(sim.getState(), restored.getState());
});

test('Snapshot corrompu : double affectation, propriété d’un service ou timer falsifié refusés', () => {
  const { sim } = scenario(3);
  sim.step([teleportTarget(candidateId, printerId)]); advance(sim, 119);
  const before = sim.exportSnapshot();
  for (const mutate of [
    state => { const queue = state.buildings.find(b => b.id === printerId).queue; queue[1].assigned_npc_id = queue[0].assigned_npc_id; },
    state => { state.buildings.find(b => b.id === printerId).owner_id = 'philippe'; },
    state => { state.spawn_timers[0].interval_ticks = 1; },
    state => { state.electorate[0].support.neutral += 1; },
  ]) {
    const broken = JSON.parse(before); mutate(broken);
    assert.throws(() => sim.importSnapshot(broken), /État JSON incompatible/);
    assert.equal(sim.exportSnapshot(), before);
  }
});

test('Économie, production et influence donnent le même résultat à différents FPS', () => {
  const run = fps => {
    const { sim } = scenario(3);
    const clock = new FixedClock(30);
    for (let frame = 0; frame < fps * 15; frame++) clock.advance(1 / fps, () => {
      const commands = sim.state.tick === 90 ? [teleportTarget(candidateId, printerId)] : [];
      sim.step(commands);
    });
    return sim.getState();
  };
  const expected = run(30);
  for (const fps of [1, 20, 60, 144]) assert.deepEqual(run(fps), expected);
  assert.ok(expected.transactions.length >= 2);
  assert.ok(expected.npcs.some(n => n.role === 'MILITANT'));
});

test('Les IA utilisent réellement les infrastructures avec les mêmes commandes que le joueur', () => {
  const sim = new GameSimulation(config);
  const human = new LocalHumanController(); const ai = new AIController(config);
  // Electoral development now preserves six local workers before printing spare tracts.
  for (let i = 0; i < 30 * 240; i++) sim.step(collectCommands(sim.getState(), human, ai));
  assert.ok(sim.state.buildings.some(b => b.owner_id === 'le_pen'));
  assert.ok(sim.state.buildings.some(b => b.owner_id === 'philippe'));
  assert.ok(sim.state.candidates.find(c => c.faction_id === 'le_pen').total_spent > 0);
  assert.ok(sim.state.candidates.find(c => c.faction_id === 'philippe').total_spent > 0);
  assert.ok(sim.state.npcs.some(n => n.role === 'MILITANT' && ['le_pen', 'philippe'].includes(n.faction_id)));
  const restored = new GameSimulation(config); restored.importSnapshot(sim.exportSnapshot());
  assert.deepEqual(restored.getState(), sim.getState());
});

test('Les nouveaux réglages invalides sont refusés explicitement', () => {
  for (const mutate of [
    cfg => { cfg.layout.biomes[0].subzones[0].spawn_randomness.min_factor = 2; },
    cfg => { cfg.layout.biomes[0].subzones[0].max_neutrals_waiting = 0; },
    cfg => { cfg.balance.buildings.imprimerie.max_queue_length = 0; },
    cfg => { cfg.balance.buildings.financement.income_per_second_by_level = []; },
    cfg => { delete cfg.balance.money.supporter_income_per_second_by_origin_biome; },
    cfg => { delete cfg.balance.money.supporter_income_per_second_by_origin_biome.banlieue; },
    cfg => { cfg.balance.money.supporter_income_per_second_by_origin_biome.banlieue = -1; },
    cfg => { cfg.balance.money.supporter_income_per_second_by_origin_biome.banlieue = '0.4'; },
    cfg => { cfg.balance.money.supporter_income_per_second_by_origin_biome.banlieue = Infinity; },
    cfg => { cfg.balance.money.supporter_income_per_second_by_origin_biome.inconnu = 1; },
  ]) { const cfg = structuredClone(config); mutate(cfg); assert.throws(() => validateConfig(cfg)); }
  const cfg = structuredClone(config);
  cfg.balance.money.supporter_income_per_second_by_origin_biome.banlieue = 0;
  assert.doesNotThrow(() => validateConfig(cfg));
});

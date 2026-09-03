import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { FixedClock } from '../src/simulation/fixed-clock.js';
import { AIController, LocalHumanController, collectCommands } from '../src/simulation/controllers.js';
import { move, setCampaignActive, setAIEnabled, selectCandidate, teleport, demobilize, interactionPresence, teleportTarget } from '../src/simulation/commands.js';
import { FACTIONS, ringDelta, wrap } from '../src/simulation/world.js';
import { compositionMetrics } from '../src/presentation/renderer.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const load = async file => JSON.parse(await readFile(new URL(file, base), 'utf8'));
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'].map(load));
const config = validateConfig({ balance, layout, buildings, prototype });
const copyConfig = () => structuredClone(config);
const tick = (sim, ticks, command = []) => { for (let i = 0; i < ticks; i++) sim.step(command); };

function isolated(faction = 'melenchon') {
  const cfg = copyConfig();
  cfg.prototype.world.roam_speed_units_per_second = 0;
  const sim = new GameSimulation(cfg);
  const state = sim.getState();
  state.local_candidate_id = `candidate:${faction}`;
  state.ai_enabled = false;
  const candidate = state.candidates.find(c => c.faction_id === faction);
  const origin = state.world.socialPoints.find(p => p.subzone_id === cfg.layout.starting_positions[faction]);
  const npc = state.npcs.find(n => n.origin_social_point_id === origin.id);
  state.npcs = [npc];
  npc.x = candidate.x + 1;
  npc.roam_target_x = npc.x;
  sim.importSnapshot(state);
  return { sim, cfg, candidateId: candidate.id, npcId: npc.id };
}

test('Le monde contient 6 × 3 sous-zones, les populations exactes et des IDs uniques', () => {
  const state = new GameSimulation(config).getState();
  assert.equal(config.layout.biomes.length, 6);
  assert.equal(state.world.subzones.length, 18);
  assert.equal(state.world.length, 18 * config.prototype.world.units_per_screen);
  for (const zone of state.world.subzones) assert.equal(state.npcs.filter(n => n.origin_subzone_id === zone.id).length, zone.initial_neutral_count);
  assert.equal(state.npcs.filter(n => n.role !== 'NEUTRE').length, 0);
  const entities = [...state.npcs, ...state.candidates, ...state.world.socialPoints, ...state.world.subzones, ...state.world.scenery, ...state.buildings, ...state.building_slots];
  assert.equal(new Set(entities.map(e => e.id)).size, entities.length);
  assert.equal(state.buildings.filter(b => b.type === 'imprimerie').length, 6);
  assert.equal(state.buildings.filter(b => b.type !== 'imprimerie' && b.state === 'EMPTY').length, 108);
  assert.equal(state.electorate.length, 18);
});

test('Argent initial, départs et vitesse de marche proviennent des JSON', () => {
  const sim = new GameSimulation(config);
  const before = sim.getState();
  for (const faction of FACTIONS) {
    const c = before.candidates.find(c => c.faction_id === faction);
    const zone = before.world.subzones.find(z => z.id === config.layout.starting_positions[faction]);
    assert.equal(c.x, zone.center);
    assert.equal(c.money, config.balance.money.base_starting_money * (faction === 'philippe' ? config.balance.money.philippe_starting_money_multiplier : 1));
  }
  tick(sim, 30, [move(before.local_candidate_id, 1)]);
  assert.ok(Math.abs(sim.getState().candidates[0].x - before.candidates[0].x - config.prototype.movement.candidate_speed_units_per_second) < 1e-9);
  sim.step([move(before.local_candidate_id, 0)]);
  assert.equal(sim.getState().candidates[0].axis, 0);
});

test('Boucle du monde : franchissement continu dans les deux sens', () => {
  const sim = new GameSimulation(config);
  let state = sim.getState();
  state.candidates[0].x = state.world.length - 0.05;
  sim.importSnapshot(state);
  sim.step([move(state.local_candidate_id, 1)]);
  const afterRight = sim.getState().candidates[0].x;
  assert.ok(afterRight < 0.1);
  sim.step([move(state.local_candidate_id, -1)]);
  assert.ok(sim.getState().candidates[0].x > state.world.length - 0.1);
  assert.ok(Math.abs(ringDelta(state.world.length - 0.05, afterRight, state.world.length) - 0.12) < 1e-9);
});

test('Spawns par sous-zone, sans dépendre de la caméra ni de la présence du joueur', () => {
  const cfg = copyConfig(); cfg.balance.time.real_seconds_per_game_day = 1;
  const sim = new GameSimulation(cfg);
  const seconds = 20;
  tick(sim, seconds * 30, FACTIONS.map(f => setCampaignActive(`candidate:${f}`, false)));
  const state = sim.getState();
  for (const zone of state.world.subzones) {
    assert.equal(state.npcs.filter(n => n.origin_subzone_id === zone.id && n.role === 'NEUTRE').length, zone.max_npcs_by_origin, zone.id);
    const timer = state.spawn_timers.find(t => t.subzone_id === zone.id);
    assert.ok(timer.elapsed_ticks < timer.interval_ticks);
    assert.ok(timer.skipped_count > 0);
  }
});

test('Conversion sans commande ni dépense : 50 ticks pour Mélenchon, 90 pour les autres', () => {
  for (const faction of FACTIONS) {
    const { sim, candidateId } = isolated(faction);
    const before = sim.getState().candidates.find(c => c.id === candidateId);
    const expected = faction === 'melenchon' ? 50 : 90;
    tick(sim, expected - 1);
    assert.equal(sim.getState().npcs[0].role, 'NEUTRE');
    sim.step();
    const state = sim.getState();
    assert.equal(state.npcs[0].role, 'SYMPATHISANT');
    assert.equal(state.npcs[0].faction_id, faction);
    const income = config.balance.money.base_passive_income_per_second * (faction === 'philippe' ? config.balance.money.philippe_income_multiplier : 1);
    const partisanIncome = config.balance.money.supporter_income_per_second_by_origin_biome[state.npcs[0].origin_biome_id]
      * (faction === 'philippe' ? config.balance.money.philippe_income_multiplier : 1);
    // The recruit contributes from the tick on which persuasion completes.
    const candidate = state.candidates.find(c => c.id === candidateId);
    assert.ok(Math.abs(candidate.money - before.money - expected / 30 * income - partisanIncome / 30) < 1e-9);
    assert.ok(Math.abs(candidate.income_per_second - income - partisanIncome) < 1e-9);
    assert.equal(state.events.filter(e => e.type === 'NpcConverted').length, 1);
  }
});

test('Quitter la zone de persuasion annule la progression et conserve l’origine', () => {
  const { sim, npcId, candidateId } = isolated();
  const before = sim.getState().npcs[0];
  tick(sim, 25);
  assert.equal(sim.getState().npcs[0].persuasion.elapsed_ticks, 25);
  sim.step([teleport(candidateId, 'paris_a')]);
  assert.equal(sim.getState().npcs[0].persuasion, null);
  sim.step([teleport(candidateId, 'banlieue_b')]);
  assert.equal(sim.getState().npcs[0].persuasion.elapsed_ticks, 1);
  tick(sim, 49);
  const after = sim.getState().npcs.find(n => n.id === npcId);
  assert.equal(after.role, 'SYMPATHISANT');
  for (const key of ['origin_biome_id', 'origin_subzone_id', 'origin_social_point_id']) assert.equal(after[key], before[key]);
});

test('Un acteur ne persuade qu’un PNJ à la fois, puis passe au suivant', () => {
  const { sim } = isolated();
  const state = sim.getState();
  const second = structuredClone(state.npcs[0]);
  second.id = `npc:${state.next_npc_id++}`; second.x += 0.1;
  state.npcs.push(second); sim.importSnapshot(state);
  sim.step();
  assert.equal(sim.getState().npcs.filter(n => n.persuasion).length, 1);
  tick(sim, 49);
  assert.equal(sim.getState().npcs.filter(n => n.role === 'SYMPATHISANT').length, 1);
  tick(sim, 50);
  assert.equal(sim.getState().npcs.filter(n => n.role === 'SYMPATHISANT').length, 2);
});

test('Une persuasion déjà commencée garde sa cible jusqu’à la sortie de portée', () => {
  const { sim } = isolated();
  sim.step();
  const state = sim.getState();
  state.ai_enabled = true;
  state.candidates[1].x = state.npcs[0].x;
  sim.importSnapshot(state);
  sim.step();
  assert.equal(sim.getState().npcs[0].persuasion.actor_id, 'candidate:melenchon');
});

test('Conflit de proximité : une seule conversion, résultat déterministe', () => {
  const { sim } = isolated();
  const state = sim.getState();
  state.ai_enabled = true;
  for (const candidate of state.candidates) candidate.x = state.npcs[0].x - 0.5;
  sim.importSnapshot(state);
  sim.step();
  const chosen = sim.getState().npcs[0].persuasion.actor_id;
  assert.equal(chosen, 'candidate:le_pen');
  tick(sim, 89);
  assert.equal(sim.getState().npcs[0].faction_id, 'le_pen');
  assert.equal(sim.getState().events.filter(e => e.type === 'NpcConverted').length, 1);
});

test('La persuasion fonctionne également à travers la jonction de la boucle', () => {
  const { sim } = isolated();
  const state = sim.getState();
  state.candidates[0].x = 0.2;
  state.npcs[0].x = state.world.length - 0.2;
  sim.importSnapshot(state);
  tick(sim, 50);
  assert.equal(sim.getState().npcs[0].role, 'SYMPATHISANT');
});

test('Démobilisation de débogage : retour physique au point d’origine avant neutralité', () => {
  const { sim, npcId, candidateId } = isolated();
  tick(sim, 50);
  const originBefore = sim.getState().npcs[0].origin_social_point_id;
  sim.step([teleport(candidateId, 'paris_a'), demobilize(npcId)]);
  assert.equal(sim.getState().npcs[0].role, 'DEMOBILISE');
  tick(sim, 30);
  const state = sim.getState();
  const npc = state.npcs[0];
  assert.equal(npc.role, 'NEUTRE');
  assert.equal(npc.origin_social_point_id, originBefore);
  assert.equal(npc.x, state.world.socialPoints.find(p => p.id === originBefore).x);
  assert.equal(npc.faction_id, null);
});

test('Humain et IA produisent la même commande ; les IA agissent hors écran', () => {
  const sim = new GameSimulation(config);
  const human = new LocalHumanController();
  const ai = new AIController(config);
  human.setAxis(1);
  assert.deepEqual(human.commands(sim.getState(), 'candidate:melenchon'), [setCampaignActive('candidate:melenchon', true), interactionPresence('candidate:melenchon'), move('candidate:melenchon', 1)]);
  for (let i = 0; i < 600; i++) sim.step(collectCommands(sim.getState(), human, ai));
  const state = sim.getState();
  assert.ok(state.npcs.some(n => n.faction_id === 'le_pen'));
  assert.ok(state.npcs.some(n => n.faction_id === 'philippe'));
  sim.step([selectCandidate('candidate:philippe'), setAIEnabled(false)]);
  assert.equal(sim.getState().local_candidate_id, 'candidate:philippe');
  const frozen = sim.getState().candidates[1].x;
  tick(sim, 30, collectCommands(sim.getState(), human, ai));
  assert.equal(sim.getState().candidates[1].x, frozen);
});

test('Des humains peuvent piloter les trois candidats sans modifier la simulation', () => {
  const sim = new GameSimulation(config);
  const before = sim.getState();
  const controllers = FACTIONS.map(() => new LocalHumanController());
  controllers.forEach(c => c.setAxis(-1));
  sim.step(controllers.flatMap((c, i) => c.commands(before, before.candidates[i].id)));
  sim.getState().candidates.forEach((c, i) => assert.ok(c.x < before.candidates[i].x));
});

test('Les règles de persuasion ignorent le candidat local et la nature des contrôleurs', () => {
  const { sim } = isolated('le_pen');
  const state = sim.getState();
  state.local_candidate_id = 'candidate:melenchon';
  state.ai_enabled = false;
  sim.importSnapshot(state);
  tick(sim, 10, [setCampaignActive('candidate:le_pen', false)]);
  assert.equal(sim.getState().npcs[0].persuasion, null);
  tick(sim, 90, [setCampaignActive('candidate:le_pen', true)]);
  assert.equal(sim.getState().npcs[0].role, 'SYMPATHISANT');
  assert.equal(sim.getState().npcs[0].faction_id, 'le_pen');
});

test('Snapshot pendant la persuasion : rechargement puis évolution identique, IA et RNG compris', () => {
  const original = new GameSimulation(config);
  const ai = new AIController(config);
  const human = new LocalHumanController();
  original.step([teleportTarget('candidate:melenchon', original.getState().npcs.find(n => n.origin_subzone_id === 'banlieue_b').id)]);
  for (let i = 0; i < 22; i++) original.step(collectCommands(original.getState(), human, ai));
  const snapshot = original.exportSnapshot();
  assert.ok(original.getState().npcs.some(n => n.persuasion));
  const restored = new GameSimulation(config, 42);
  restored.importSnapshot(snapshot);
  assert.equal(restored.exportSnapshot(), snapshot);
  for (let i = 0; i < 1200; i++) {
    original.step(collectCommands(original.getState(), human, ai));
    restored.step(collectCommands(restored.getState(), human, ai));
  }
  assert.deepEqual(restored.getState(), original.getState());
});

test('Snapshot invalide refusé atomiquement, sans modifier la partie', () => {
  const sim = new GameSimulation(config);
  const before = sim.exportSnapshot();
  for (const mutate of [
    s => { s.npcs[0].origin_social_point_id = 'absent'; },
    s => { s.npcs[0].id = s.npcs[1].id; },
    s => { s.candidates[0].x = null; },
    s => { s.config_fingerprint = 'autre'; },
    s => { s.rng_state = 0; },
    s => { s.spawn_timers = []; },
  ]) {
    const broken = JSON.parse(before); mutate(broken);
    assert.throws(() => sim.importSnapshot(broken), /État JSON incompatible/);
    assert.equal(sim.exportSnapshot(), before);
  }
});

test('La graine est reproductible, une autre graine change les promenades', () => {
  const a = new GameSimulation(config, 2027);
  const b = new GameSimulation(config, 2027);
  const c = new GameSimulation(config, 1024);
  tick(a, 200); tick(b, 200); tick(c, 200);
  assert.deepEqual(a.getState(), b.getState());
  assert.notDeepEqual(a.getState().npcs, c.getState().npcs);
});

test('Commandes invalides ignorées ; l’input ne peut pas injecter de position ou d’argent', () => {
  const sim = new GameSimulation(config);
  const before = sim.getState();
  sim.step([move('absent', 1), move(before.local_candidate_id, Infinity), { type: 'SetMoney', value: 999999 }, { type: 'Attack' }, null]);
  assert.equal(sim.getState().candidates[0].x, before.candidates[0].x);
  assert.ok(sim.getState().candidates[0].money < 101);
  const cfg = copyConfig(); cfg.prototype.debug.commands_enabled = false;
  const locked = new GameSimulation(cfg);
  locked.step([teleport('candidate:melenchon', 'paris_a')]);
  assert.equal(locked.getState().candidates[0].x, before.candidates[0].x);
});

test('La vue reçoit une copie : aucune mutation indirecte de l’état', () => {
  const sim = new GameSimulation(config);
  const read = sim.getState(); read.npcs.length = 0; read.candidates[0].money = -1;
  assert.ok(sim.getState().npcs.length > 0);
  assert.equal(sim.getState().candidates[0].money, 100);
});

test('Même simulation à 1, 20, 30, 60, 144 FPS et avec des frames irrégulières', () => {
  const run = frameTimes => {
    const sim = new GameSimulation(config);
    const clock = new FixedClock(30);
    for (const dt of frameTimes) clock.advance(dt, () => sim.step([move('candidate:melenchon', sim.getState().tick < 120 ? 1 : -1)]));
    return sim.getState();
  };
  const reference = run(Array(300).fill(1 / 30));
  for (const fps of [1, 20, 60, 144]) assert.deepEqual(run(Array(10 * fps).fill(1 / fps)), reference);
  assert.deepEqual(run(Array.from({ length: 100 }, () => [0.013, 0.087]).flat()), reference);
  assert.equal(reference.tick, 300);
});

test('Un appui relâché entre deux ticks produit un pas, puis un arrêt ; perte de focus vide l’input', () => {
  const human = new LocalHumanController();
  human.setAxis(1); human.setAxis(0);
  assert.deepEqual(human.commands({}, 'candidate:melenchon'), [setCampaignActive('candidate:melenchon', true), interactionPresence('candidate:melenchon'), move('candidate:melenchon', 1)]);
  assert.deepEqual(human.commands({}, 'candidate:melenchon'), [setCampaignActive('candidate:melenchon', true), interactionPresence('candidate:melenchon'), move('candidate:melenchon', 0)]);
  human.setAxis(-1); human.reset();
  assert.deepEqual(human.commands({}, 'candidate:melenchon'), [setCampaignActive('candidate:melenchon', true), interactionPresence('candidate:melenchon'), move('candidate:melenchon', 0)]);
});

test('Jours : J-1 est suivi de J0 et du plateau médiatique', () => {
  const sim = new GameSimulation(config);
  const state = sim.getState();
  state.tick = 30 * 20 * 29 - 1;
  state.days_remaining = 2;
  sim.importSnapshot(state);
  sim.step();
  assert.equal(sim.getState().days_remaining, 1);
  tick(sim, 601);
  assert.equal(sim.getState().days_remaining, 0);
  assert.equal(sim.getState().phase, 'FIRST_ROUND_ARENA');
});

test('Composition proportionnelle : sol à 93 %, épaisseur 2,5 %, personnage 15 %', () => {
  for (const [width, height] of [[1920, 1080], [960, 540], [640, 360], [390, 219.375]]) {
    const m = compositionMetrics(config, width, height);
    assert.equal(width / height, 16 / 9);
    assert.equal(m.groundY / height, 0.93);
    assert.ok(Math.abs(m.characterHeight / height - 0.15) < 1e-12);
    assert.equal(m.groundThickness / height, 0.025);
    assert.equal(m.anchorX, width / 2);
  }
});

test('Configuration altérée : les réglages influencent réellement le gameplay', () => {
  const cfg = copyConfig();
  cfg.missing = undefined;
  cfg.balance.simulation_architecture.fixed_tick_hz = 60;
  cfg.prototype.movement.candidate_speed_units_per_second = 6;
  const sim = new GameSimulation(cfg);
  const before = sim.getState().candidates[0].x;
  tick(sim, 60, [move('candidate:melenchon', 1)]);
  assert.ok(Math.abs(sim.getState().candidates[0].x - before - 6) < 1e-9);
  cfg.balance.simulation_architecture.fixed_tick_hz = 0;
  assert.throws(() => validateConfig(cfg), /Configuration/);
});

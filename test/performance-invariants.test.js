import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { ALL_FACTIONS, FACTIONS } from '../src/simulation/world.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { completePopulation } from '../src/simulation/spawns.js';
import { incomePerSecond, incomeBreakdown, stableIdOrder } from '../src/simulation/territory.js';
import { formatNumber } from '../src/presentation/interface/number-format.js';
import { combatActors, findCombatActor, nearestEnemy, enemies } from '../src/simulation/combat-state.js';
import { combatDelta } from '../src/simulation/combat-geometry.js';
import { withNpcProximity, nearbyNpcs, updateNpcProximity } from '../src/simulation/npc-proximity.js';
import { CrowdSpacing, crowdTargets } from '../src/presentation/rendu/crowd-spacing.js';

test('Les voix restent celles des PNJ après mutations au même tick', () => {
  const config = campaignConfig(), sim = new GameSimulation(config);
  completePopulation(sim);
  const { state } = sim;
  for (let variant = 0; variant < 36; variant++) {
    // Même tick : le recomptage ne doit dépendre d'aucun cache temporel.
    state.npcs.forEach((npc, index) => {
      npc.x = (index * 67 + variant * 11) % state.world.length;
      npc.role = ['NEUTRE', 'SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'][index % 4];
      npc.faction_id = npc.role === 'NEUTRE' ? null : FACTIONS[(index + variant) % 3];
    });
    refreshElectoralState(state);
    const expected = { ...Object.fromEntries(ALL_FACTIONS.map(f => [f, 0])), neutral: 0, pending: 0 };
    for (const npc of state.npcs) expected[npc.role === 'NEUTRE' ? 'neutral' : npc.faction_id]++;
    assert.deepEqual(state.actualGameState.national_counts, expected);
    assert.equal(Object.values(expected).reduce((sum, count) => sum + count, 0), 200);
    for (const faction of FACTIONS) {
      assert.equal(state.actualGameState.national_support[faction], expected[faction] / 2);
      assert.equal(incomePerSecond(state, config, faction), 0);
      assert.equal(Object.values(incomeBreakdown(state, config, faction).byBiome).reduce((sum, biome) => sum + biome.count, 0),
        state.npcs.filter(npc => npc.role === 'SYMPATHISANT' && npc.faction_id === faction).length);
    }
  }
});

test('Les formatages réutilisés conservent tous les nombres français affichés', () => {
  for (const precision of [0, 1, 2, 3]) for (const value of [0, -0, .049, .05, .099, 3.14159, 1234567.895, -42.25]) {
    for (const minimum of [0, precision]) assert.equal(formatNumber(value, precision, minimum),
      value.toLocaleString('fr-FR', { maximumFractionDigits: precision, minimumFractionDigits: minimum }));
  }
});

test('L’affichage lit l’état vivant et ne garde que les positions du pas précédent', () => {
  const sim = new GameSimulation(campaignConfig());
  completePopulation(sim);
  for (let i = 0; i < 90; i++) sim.step([]);
  const before = sim.motionSnapshot();
  const xs = new Map([...sim.state.npcs, ...sim.state.candidates].map(entity => [entity.id, entity.x]));
  assert.equal(before.tick, sim.state.tick);
  assert.equal(before.npcs.length, sim.state.npcs.length);
  for (const entity of [...before.npcs, ...before.candidates]) assert.deepEqual(Object.keys(entity), ['id', 'x']);
  for (let i = 0; i < 30; i++) sim.step([]);
  // La copie des positions ne bouge plus quand la simulation avance.
  for (const entity of [...before.npcs, ...before.candidates]) assert.equal(entity.x, xs.get(entity.id));
  assert.ok(sim.state.tick > before.tick);
  const view = sim.presentationView();
  // Vue sans copie : mêmes objets que l'état vivant, haut de l'état et événements figés.
  assert.equal(view.npcs, sim.state.npcs);
  assert.equal(view.tick, sim.state.tick);
  assert.notEqual(view.events, sim.state.events);
  assert.deepEqual(view.events, sim.state.events);
  assert.equal(view.campaign_snapshot, null);
  assert.ok(Object.isFrozen(view.world));
});

test('La recherche directe d’un combattant respecte les exclusions et les mutations au même tick', () => {
  const sim = new GameSimulation(campaignConfig());
  completePopulation(sim);
  const state = sim.state, candidate = state.candidates[0];
  state.temporary_units.push({ id: 'temporary:performance', role: 'HOLOGRAMME' });
  const ids = [...combatActors(state).map(a => a.id), 'absent'];
  const check = () => {
    for (const id of ids) assert.equal(findCombatActor(state, id), combatActors(state).find(a => a.id === id));
  };
  check(); candidate.eliminated = true; check();
  candidate.eliminated = false; candidate.campaign_debate_id = 'debate:test'; check();
  candidate.campaign_debate_id = null; state.npcs.shift(); state.temporary_units.pop(); check();
});

test('Les recherches par secteur gardent les cibles, les égalités et le raccord circulaire', () => {
  const sim = new GameSimulation(campaignConfig()); completePopulation(sim);
  const state = sim.state, actor = state.candidates[0];
  state.npcs.forEach((npc, i) => {
    npc.x = i * state.world.length / state.npcs.length;
    npc.role = 'MILITANT'; npc.faction_id = i % 2 ? 'le_pen' : actor.faction_id;
  });
  const reference = (range, predicate) => combatActors(state)
    .filter(target => enemies(actor, target) && Math.abs(combatDelta(state, actor.x, target.x)) <= range && predicate(target))
    .sort((a, b) => Math.abs(combatDelta(state, actor.x, a.x)) - Math.abs(combatDelta(state, actor.x, b.x)) || stableIdOrder(a, b))[0] || null;
  for (const debate of [false, true]) {
    if (debate) state.debate_bounds = { min: 0, max: state.world.length };
    withNpcProximity(state, () => {
      for (const x of [0, .001, 8, state.world.length / 2, state.world.length - .001]) {
        actor.x = x;
        for (const range of [0, .5, 4, 17, state.world.length / 2, Infinity]) {
          const predicate = target => !target.id.endsWith('3');
          assert.equal(nearestEnemy(state, actor, range, predicate), reference(range, predicate));
        }
      }
    });
  }
});

test('Un déplacement suivi, une conversion et un nouveau traitement restent visibles au même tick', () => {
  const sim = new GameSimulation(campaignConfig()); completePopulation(sim);
  const state = sim.state, actor = state.candidates[0], npc = state.npcs[0];
  actor.x = 0; state.candidates.slice(1).forEach(candidate => { candidate.x = 100; });
  state.npcs.forEach((npc, i) => { npc.x = 100 + i; });
  npc.role = 'MILITANT'; npc.faction_id = 'le_pen';
  withNpcProximity(state, () => {
    for (let i = 0; i < 4; i++) nearestEnemy(state, actor, 2);
    assert.ok(nearbyNpcs(state, 0, 2).length < state.npcs.length / 2);
    npc.x = state.world.length - 1; updateNpcProximity(state, npc);
    assert.equal(nearestEnemy(state, actor, 2), npc);
    npc.faction_id = actor.faction_id;
    assert.equal(nearestEnemy(state, actor, 2), null);
    npc.faction_id = 'le_pen'; npc.x = 30; updateNpcProximity(state, npc);
    assert.equal(nearestEnemy(state, actor, 2), null);
  });
  npc.x = 1; // Hors du traitement indexé, les appels directs lisent immédiatement l'état vivant.
  assert.equal(nearestEnemy(state, actor, 2), npc);
  withNpcProximity(state, () => { for (let i = 0; i < 4; i++) assert.equal(nearestEnemy(state, actor, 2), npc); });
  const replacement = { ...npc, id: 'npc:replacement' }; state.npcs[0] = replacement;
  withNpcProximity(state, () => { for (let i = 0; i < 4; i++) assert.equal(nearestEnemy(state, actor, 2), replacement); });
  assert.throws(() => withNpcProximity(state, () => { nearbyNpcs(state, 0, 2); throw new Error('Interruption'); }));
  assert.equal(nearbyNpcs(state, 0, 2), state.npcs);
});

test('La foule réutilise son placement et garde les mêmes pas de côté à chaque image', () => {
  const crowd = new CrowdSpacing(), state = { npcs: Array.from({ length: 80 }, (_, i) => ({ id: `npc:${i}`, x: Math.floor(i / 4) * 2, moving: false })) };
  let expected = new Map(), lastTime = null;
  const target = crowd.targetsFor(state, .5);
  assert.equal(crowd.targetsFor(structuredClone(state), .5), target);
  for (let frame = 0; frame < 240; frame++) {
    if (frame === 60) state.npcs[0].x += .2;
    if (frame === 90) state.npcs[1].moving = true;
    if (frame === 120) state.npcs[2].meeting_target_id = 'meeting';
    if (frame === 150) state.npcs[3].rally_event_id = 'rally';
    if (frame === 180) state.npcs.splice(4, 1);
    const gap = frame < 210 ? .5 : .7, now = frame * 1000 / 60;
    const dt = lastTime === null ? 0 : Math.min(.1, (now - lastTime) / 1000); lastTime = now;
    const targets = crowdTargets(state, gap), offsets = new Map(), steps = new Map();
    for (const npc of state.npcs) {
      const current = expected.get(npc.id) || 0, goal = targets.get(npc.id) || 0;
      const limit = (npc.moving ? .35 : .9) * dt, change = Math.max(-limit, Math.min(limit, goal - current));
      const value = current + change;
      if (goal || Math.abs(value) > .001) offsets.set(npc.id, value);
      if (!npc.moving && dt > 0 && Math.abs(change) / dt > .12) steps.set(npc.id, Math.sign(change));
    }
    expected = offsets;
    crowd.update(state, gap, now);
    assert.deepEqual(crowd.offsets, expected);
    assert.deepEqual(crowd.steps, steps);
  }
});

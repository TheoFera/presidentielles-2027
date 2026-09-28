import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { startArena, finishSprint, rankFirstRound } from '../src/simulation/match-lifecycle.js';
import { convertNeutral } from '../src/simulation/npc-votes.js';
import { expressedScores, electionModel } from '../src/presentation/election-results.js';
import { homeContent } from '../src/presentation/arcade-content.js';
import { demoElectionState, DEMO_SCENARIOS } from './election-demo.js';
import { sanitizeCommands } from '../src/network/shared-commands.js';
import { encodePresentationState, encodeStateDelta, applyStateDelta } from '../src/network/state-stream.js';
const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype, campaignCatalog] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json', 'campaign_events.json'].map(async f => JSON.parse(await readFile(new URL(f, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype, campaignCatalog });
function firstRound() {
  const sim = new GameSimulation(config, 12);
  sim.state.ai_enabled = false;
  for (let i = 0; i < 15; i++) convertNeutral(sim, sim.state.npcs[i], i < 8 ? 'melenchon' : i < 13 ? 'le_pen' : 'philippe');
  startArena(sim); return sim;
}
test('Premier tour : classement réel, monde figé et aucune arène', () => {
  const sim = firstRound();
  assert.equal(sim.state.phase, 'FIRST_ROUND_RESULTS');
  assert.equal(sim.state.arena, null);
  assert.deepEqual(sim.state.first_round_result.ranking, ['melenchon', 'le_pen', 'philippe']);
  const frozen = sim.exportSnapshot();
  for (let i = 0; i < 60; i++) sim.step([{ type: 'Move', candidateId: sim.state.local_candidate_id, axis: 1 }, { type: 'PressAttack', candidateId: sim.state.local_candidate_id }]);
  assert.equal(sim.exportSnapshot(), frozen);
  const copy = new GameSimulation(config); copy.importSnapshot(frozen);
  assert.equal(copy.exportSnapshot(), frozen);
  const votes = structuredClone(sim.state.first_round_result);
  sim.step([{ type: 'ContinueToSecondRound' }]);
  assert.equal(sim.state.phase, 'SECOND_ROUND_SPRINT');
  assert.equal(sim.state.eliminated_faction, 'philippe');
  assert.ok(sim.state.candidates.find(c => c.faction_id === 'philippe').eliminated);
  assert.ok(!sim.state.npcs.some(n => n.faction_id === 'philippe'));
  assert.deepEqual(sim.state.first_round_result, votes);
  copy.importSnapshot(sim.exportSnapshot());
  sim.state.sprint_remaining_ticks = 0; finishSprint(sim);
  assert.equal(sim.state.result.winner, 'melenchon');
  copy.importSnapshot(sim.exportSnapshot());
  assert.deepEqual(sim.state.first_round_result, votes);
});
test('Égalités reproductibles, classement et absence de voix', () => {
  const scores = { melenchon: 10, le_pen: 10, philippe: 10, neutral: 70, pending: 0 };
  for (let seed = 1; seed < 10; seed++) {
    assert.deepEqual(rankFirstRound(scores, seed), rankFirstRound(scores, seed));
    assert.equal(rankFirstRound(scores, seed).tie_break, true);
    assert.equal(new Set(rankFirstRound(scores, seed).ranking).size, 3);
  }
  assert.notDeepEqual(rankFirstRound(scores, 1).ranking, rankFirstRound(scores, 2).ranking);
  assert.equal(expressedScores({ a: 0, b: 0 }, ['a', 'b']), null);
  assert.deepEqual(expressedScores({ a: 1, b: 1, c: 1 }, ['a', 'b', 'c']), { a: 33.34, b: 33.33, c: 33.33 });
  assert.deepEqual(expressedScores({ a: 50.688, b: 37.312, neutral: 12 }, ['a', 'b']), { a: 57.6, b: 42.4 });
});
test('Sauvegardes : classement altéré et anciennes versions refusés', () => {
  const sim = firstRound(); const saved = JSON.parse(sim.exportSnapshot());
  const target = new GameSimulation(config);
  saved.first_round_result.ranking.reverse();
  assert.throws(() => target.importSnapshot(JSON.stringify(saved)), /classement/);
  saved.snapshot_version = 11;
  assert.throws(() => target.importSnapshot(JSON.stringify(saved)), /nouvelle carte/);
});
test('Réseau : résultat partagé, victoire personnelle et reprise interdite aux invités', () => {
  const sim = firstRound();
  const encoded = encodePresentationState(sim.getState());
  const received = applyStateDelta(null, JSON.parse(encodeStateDelta(encoded)));
  assert.equal(received.phase, 'FIRST_ROUND_RESULTS');
  assert.deepEqual(received.first_round_result, sim.state.first_round_result);
  assert.equal(electionModel({ ...received, local_candidate_id: 'candidate:melenchon' }).success, true);
  assert.equal(electionModel({ ...received, local_candidate_id: 'candidate:philippe' }).success, false);
  assert.throws(() => sanitizeCommands([{ type: 'ContinueToSecondRound' }], 'melenchon'), /interdite/);
});
for (const candidate of ['melenchon', 'le_pen', 'philippe']) test(`Annonce : les quatre situations pour ${candidate}`, () => {
  for (const scenario of DEMO_SCENARIOS) {
    const model = electionModel(demoElectionState(candidate, scenario));
    assert.equal(model.success, ['qualification', 'victoire'].includes(scenario));
    assert.equal(model.first, ['qualification', 'elimination'].includes(scenario));
    assert.equal(Math.round(Object.values(model.scores).reduce((a, b) => a + b, 0) * 100), 10000);
    if (!model.first) assert.deepEqual(model.firstRound.ranking, demoElectionState(candidate, scenario).first_round_result.ranking);
  }
});
test('L’aperçu de développement reste hors du jeu et de l’export', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(homeContent(), /aperçu|preview/i);
  assert.doesNotMatch(main, /apercu|openResultsPreview/);
  const build = await readFile(new URL('../scripts/build-pages.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(build, /['"]test\//);
});

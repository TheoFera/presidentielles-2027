import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { convertNeutral } from '../src/simulation/npc-votes.js';
import { summaryModel, summaryMarkup, niceMax } from '../src/presentation/match-summary.js';
import { recordMatchResult, normalizeStats, cleanNickname, favoriteCandidate, profileContent } from '../src/presentation/player-profile.js';
import { MoneyCounter } from '../src/presentation/money-counter.js';
import { soundCues, parseMelody, midi } from '../src/presentation/audio.js';
import { formatCarriedMoney } from '../src/presentation/money.js';

const root = new URL('../Présidentielles 2027/', import.meta.url);
const load = async name => JSON.parse(await readFile(new URL(`${name}.json`, root), 'utf8'));
const [balance, layout, buildings, prototype, campaignCatalog] = await Promise.all(
  ['game_balance', 'world_layout', 'building_catalog', 'prototype_config', 'campaign_events'].map(load));
const config = validateConfig({ balance, layout, buildings, prototype, campaignCatalog });

test('l’historique de partie relève le score et les électeurs de chaque camp au départ puis à intervalle régulier', () => {
  const sim = new GameSimulation(config, 17); sim.state.ai_enabled = false;
  assert.equal(sim.state.match_history.length, 1);
  const first = sim.state.match_history[0];
  for (const f of ['melenchon', 'le_pen', 'philippe']) {
    assert.equal(first.voters[f], sim.state.actualGameState.national_counts[f]);
    assert.equal(first.support[f], Math.round(sim.state.actualGameState.national_support[f] * 10) / 10);
  }
  const neutral = sim.state.npcs.find(n => n.faction_id === 'neutral' || n.role === 'NEUTRE');
  if (neutral) convertNeutral(sim, neutral, 'philippe');
  const interval = sim.secondsToTicks(config.balance.time.starting_days_before_first_round * config.balance.time.real_seconds_per_game_day / 80);
  for (let i = 0; i < interval; i++) sim.step([]);
  assert.equal(sim.state.match_history.length, 2);
  assert.equal(sim.state.match_history[1].tick, interval);
  assert.equal(sim.state.match_history[1].sprint, false);
  // L'historique survit à l'export et une ancienne sauvegarde sans historique reste importable.
  const reload = new GameSimulation(config); reload.importSnapshot(sim.exportSnapshot());
  assert.deepEqual(reload.state.match_history, sim.state.match_history);
  const old = JSON.parse(sim.exportSnapshot()); delete old.match_history;
  assert.doesNotThrow(() => new GameSimulation(config).importSnapshot(old));
});

const finished = () => ({
  local_candidate_id: 'candidate:philippe', eliminated_faction: 'le_pen',
  result: { winner: 'philippe', second: 'melenchon', scores: { philippe: 30, melenchon: 20, le_pen: 0, neutral: 50, pending: 0 } },
  candidates: ['melenchon', 'le_pen', 'philippe'].map(f => ({ id: `candidate:${f}`, faction_id: f, total_earned: 12.5, total_spent: 8 })),
  match_history: [
    { tick: 0, sprint: false, days_remaining: 30, support: { melenchon: 0, le_pen: 0, philippe: 0 }, voters: { melenchon: 0, le_pen: 0, philippe: 0 } },
    { tick: 300, sprint: false, days_remaining: 15, support: { melenchon: 4, le_pen: 6, philippe: 2.5 }, voters: { melenchon: 8, le_pen: 12, philippe: 5 } },
    { tick: 600, sprint: false, days_remaining: 0, support: { melenchon: 5, le_pen: 4.5, philippe: 7 }, voters: { melenchon: 10, le_pen: 9, philippe: 14 } },
    { tick: 601, sprint: true, days_remaining: 0, support: { melenchon: 5, le_pen: 0, philippe: 7 }, voters: { melenchon: 10, le_pen: 0, philippe: 14 } },
    { tick: 660, sprint: true, days_remaining: 0, support: { melenchon: 5.5, le_pen: 0, philippe: 10.5 }, voters: { melenchon: 11, le_pen: 0, philippe: 21 } },
  ],
});

test('le bilan classe les camps, trace le sprint à part et arrête la courbe du camp éliminé', () => {
  const model = summaryModel(finished());
  assert.deepEqual(model.camps.map(c => c.faction), ['philippe', 'melenchon', 'le_pen']);
  assert.equal(model.camps[0].local, true);
  assert.equal(model.camps[0].status, 'Élu');
  assert.equal(model.camps[2].status, 'Éliminé au 1er tour');
  assert.equal(model.camps[0].peak, 10.5);
  assert.equal(model.camps[0].peakVoters, 21);
  assert.equal(model.camps[2].peak, 6);
  assert.equal(model.camps[2].peakMoment, 'à J-15');
  assert.equal(model.max, 15);
  assert.equal(model.sprintStart, 0.8);
  const lePen = model.series.find(s => s.faction === 'le_pen');
  assert.equal(lePen.points.length, 4);
  assert.equal(lePen.points.at(-1).value, 0);
  assert.equal(model.series.find(s => s.faction === 'philippe').points.at(-1).x, 1);
  assert.deepEqual(model.ticks.map(t => t.label), ['J-30', 'J-20', 'J-10', '1er tour', 'Fin']);
  const html = summaryMarkup(model);
  assert.match(html, /Bilan de la partie/);
  assert.match(html, /<svg class="summary-chart"/);
  assert.match(html, /10,5 % \(21\)/);
  assert.match(html, /Électeurs de chaque camp/);
  assert.equal([1, 5, 12, 126, 150, 151].map(niceMax).join(), '1,5,15,150,150,200');
  assert.equal(summaryModel({ ...finished(), match_history: undefined }).empty, true);
});

test('le profil compte victoires, qualifications, meilleur score et record d’électeurs', () => {
  let profile = { nickname: 'Théo', unlocked_campaign_styles: {} };
  profile = recordMatchResult(profile, finished());
  const lost = { ...finished(), local_candidate_id: 'candidate:le_pen' };
  profile = recordMatchResult(profile, lost, { multiplayer: true });
  const stats = normalizeStats(profile.stats);
  assert.equal(stats.games, 2); assert.equal(stats.wins, 1); assert.equal(stats.qualified, 1); assert.equal(stats.multiplayer_games, 1);
  assert.equal(stats.best_score, 60);
  assert.equal(stats.best_voters, 21);
  assert.deepEqual(stats.by_candidate.philippe, { games: 1, wins: 1, qualified: 1 });
  assert.deepEqual(stats.by_candidate.le_pen, { games: 1, wins: 0, qualified: 0 });
  assert.equal(profile.nickname, 'Théo');
  assert.equal(favoriteCandidate(stats), 'philippe');
  assert.match(profileContent(profile), /Candidat préféré/);
  // Données abîmées ou absentes : valeurs neutres, jamais d'erreur.
  assert.equal(normalizeStats({ games: -3, wins: 'x', best_score: 'NaN' }).games, 0);
  assert.equal(cleanNickname('  <b>Super   Joueur</b>  '), 'bSuper Joueur/b');
  assert.equal(cleanNickname(''), 'Joueur');
  assert.equal(cleanNickname('x'.repeat(40)).length, 16);
});

test('le compteur d’argent défile vers la valeur et regroupe les gains rapprochés', () => {
  const made = [];
  globalThis.document = { createElement: () => { const e = { style: {}, classList: new Set(), setAttribute() {}, remove() { e.removed = true; } }; made.push(e); return e; } };
  const classes = new Set();
  const output = { textContent: '', offsetWidth: 0, parentElement: { append() {} }, classList: { add: c => classes.add(c), remove: (...c) => c.forEach(x => classes.delete(x)) } };
  const counter = new MoneyCounter(output, formatCarriedMoney);
  counter.update(10, 'a', 0.016);
  assert.equal(output.textContent, '10 k €');
  assert.equal(made.length, 0);
  counter.update(12, 'a', 0.1);
  assert.ok(counter.shown > 10 && counter.shown < 12);
  assert.equal(made[0].textContent, '+2 k €');
  counter.update(13, 'a', 0.1);
  assert.equal(made.length, 1);
  assert.equal(made[0].textContent, '+3 k €');
  for (let i = 0; i < 60; i++) counter.update(13, 'a', 0.1);
  assert.equal(output.textContent, '13 k €');
  counter.update(9.5, 'a', 0.016);
  assert.equal(made[1].textContent, '−3,5 k €');
  assert.ok(classes.has('money-loss'));
  counter.update(40, 'b', 0.016);
  assert.equal(output.textContent, '40 k €');
  assert.equal(made.length, 2);
  delete globalThis.document;
});

test('les bruitages ne concernent que le joueur local et les nouveaux événements', () => {
  const events = [
    { id: 'event:1', type: 'MoneyPickedUp', candidate_id: 'candidate:philippe' },
    { id: 'event:2', type: 'MoneyPickedUp', candidate_id: 'candidate:le_pen' },
    { id: 'event:3', type: 'NpcConverted', faction_id: 'philippe' },
    { id: 'event:4', type: 'HitResolved', source_id: 'candidate:le_pen', target_id: 'candidate:philippe' },
    { id: 'event:5', type: 'DayChanged', days_remaining: 12 },
    { id: 'event:6', type: 'DayChanged', days_remaining: 3 },
  ];
  assert.deepEqual(soundCues(events, 0, 'candidate:philippe', 'philippe'), { cues: ['coin', 'recruit', 'hurt', 'tick'], last: 6 });
  assert.deepEqual(soundCues(events, 3, 'candidate:philippe', 'philippe').cues, ['hurt', 'tick']);
  assert.equal(midi('A4'), 69); assert.equal(midi('C#5'), 73); assert.equal(midi('Bb4'), 70);
  assert.deepEqual(parseMelody('C5 - . E5 | G5'), [{ step: 0, note: 72, length: 2 }, { step: 3, note: 76, length: 1 }, { step: 4, note: 79, length: 1 }]);
});

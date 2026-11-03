import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { AIController } from '../src/simulation/controllers.js';
import { canSaveCampaign, clearSavedCampaign, loadSavedCampaign, saveCampaign, savedCampaignSummary,
  SAVED_CAMPAIGN_KEY, SAVED_CAMPAIGN_SUMMARY_KEY } from '../src/presentation/menus/saved-campaign.js';
import { resumeChoiceContent } from '../src/presentation/menus/arcade-content.js';

/** Stockage en mémoire, comme localStorage. `limit` : taille maximale d'une valeur (quota dépassé au-delà). */
function memoryStorage(limit = Infinity) {
  const values = new Map();
  return {
    values,
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => { if (String(value).length > limit) throw new Error('QuotaExceededError'); values.set(key, String(value)); },
    removeItem: key => values.delete(key),
  };
}
const play = (sim, ai, ticks) => { for (let i = 0; i < ticks; i++) { const s = sim.state; sim.step(s.candidates.flatMap(c => ai.commands(s, c.id))); } };

test('la sauvegarde ne concerne que la campagne en cours, après la scène d’ouverture et tant que le joueur est en lice', () => {
  const config = campaignConfig();
  const intro = new GameSimulation(config, 7, 'candidate:philippe', {}, { campaignIntro: true });
  assert.equal(canSaveCampaign(intro.state), false, 'scène d’ouverture');
  const sim = new GameSimulation(config, 7, 'candidate:philippe', {});
  assert.equal(canSaveCampaign(sim.state), true);
  assert.equal(canSaveCampaign({ ...sim.state, phase: 'RESULTS' }), false);
  assert.equal(canSaveCampaign({ ...sim.state, phase: 'FIRST_ROUND_DEBATE' }), false);
  assert.equal(canSaveCampaign({ ...sim.state, phase: 'SECOND_ROUND_SPRINT' }), true);
  const eliminated = sim.state.candidates.map(c => c.id === sim.state.local_candidate_id ? { ...c, eliminated: true } : c);
  assert.equal(canSaveCampaign({ ...sim.state, candidates: eliminated }), false);
  const storage = memoryStorage();
  assert.equal(saveCampaign(intro, { storage }), false);
  assert.equal(storage.values.size, 0);
});

test('une partie reprise continue exactement comme si elle n’avait jamais été quittée', () => {
  const config = campaignConfig();
  const ai = new AIController(config);
  const sim = new GameSimulation(config, 42, 'candidate:le_pen', {});
  play(sim, ai, 900);
  const storage = memoryStorage();
  const run = { id: 'r_123', startedAt: 1000, tainted: false };
  assert.equal(saveCampaign(sim, { run, now: 5000, storage }), true);
  const summary = savedCampaignSummary(config, storage);
  assert.deepEqual({ candidate: summary.candidate_id, phase: summary.phase, days: summary.days_remaining, tick: summary.tick, saved: summary.saved_at, run: summary.run },
    { candidate: 'candidate:le_pen', phase: 'CAMPAIGN', days: sim.state.days_remaining, tick: 900, saved: 5000, run });
  // Sauvegarde compacte : pas d'indentation, une petite fraction du stockage du navigateur (5 Mo).
  assert.ok(!storage.getItem(SAVED_CAMPAIGN_KEY).includes('\n'));
  assert.ok(storage.getItem(SAVED_CAMPAIGN_KEY).length < 1_000_000);

  const resumed = new GameSimulation(config, config.prototype.seed, summary.candidate_id, {});
  resumed.importSnapshot(loadSavedCampaign(config, storage).json);
  play(sim, ai, 600); play(resumed, ai, 600);
  assert.equal(resumed.exportSnapshot(0), sim.exportSnapshot(0));
});

test('une sauvegarde d’une autre version de la carte n’est pas proposée', () => {
  const config = campaignConfig();
  const storage = memoryStorage();
  saveCampaign(new GameSimulation(config, 3, 'candidate:melenchon', {}), { storage });
  assert.ok(savedCampaignSummary(config, storage));
  const changed = campaignConfig(); changed.balance.time.real_seconds_per_game_day += 1;
  assert.equal(savedCampaignSummary(changed, storage), null);
  assert.throws(() => loadSavedCampaign(changed, storage), /Aucune partie sauvegardée/);
  storage.setItem(SAVED_CAMPAIGN_SUMMARY_KEY, '{abîmé');
  assert.equal(savedCampaignSummary(config, storage), null);
});

test('stockage plein : la sauvegarde échoue sans laisser de copie à moitié écrite, et l’effacement retire tout', () => {
  const config = campaignConfig();
  const sim = new GameSimulation(config, 3, 'candidate:melenchon', {});
  const full = memoryStorage(10_000);
  full.setItem(SAVED_CAMPAIGN_SUMMARY_KEY, JSON.stringify({ ancienne: true }));
  assert.equal(saveCampaign(sim, { storage: full }), false);
  assert.equal(full.values.size, 0);
  const storage = memoryStorage();
  saveCampaign(sim, { storage });
  clearSavedCampaign(storage);
  assert.equal(storage.values.size, 0);
  assert.equal(savedCampaignSummary(config, storage), null);
});

test('Campagne → Solo avec une sauvegarde : choix « Reprendre » (candidat et jour) ou « Nouvelle partie »', () => {
  const html = resumeChoiceContent({ candidate_id: 'candidate:le_pen', phase: 'CAMPAIGN', days_remaining: 212 });
  assert.match(html, /id="resume"/); assert.match(html, /id="new-game"/); assert.match(html, /Nouvelle partie/); assert.match(html, /Le Pen · J-212/);
  assert.match(resumeChoiceContent({ candidate_id: 'candidate:philippe', phase: 'SECOND_ROUND_SPRINT', days_remaining: 5 }), /Philippe · 2nd tour · J-5/);
});

test('la sauvegarde n’est jamais écrite pendant le jeu : seulement à la pause, au retour au menu et en arrière-plan (qui met en pause)', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.equal(main.match(/saveCampaign\(/g).length, 1, 'un seul point d’écriture (saveGame)');
  const calls = main.split('\n').filter(line => /saveGame\(\)/.test(line) && !/const saveGame/.test(line));
  assert.equal(calls.length, 4);
  assert.ok(calls.some(line => /mapPause\.show\(\{ saved: saveGame\(\) \}\)/.test(line)), 'ouverture de la pause');
  assert.ok(calls.some(line => /home: \(\) =>/.test(line)), 'retour au menu');
  assert.ok(calls.some(line => /document\.hidden\) \{ if \(!session && canMapPause\(\)\) mapPause\.request\(true\); else saveGame\(\)/.test(line)), 'arrière-plan : pause (qui sauvegarde) ou sauvegarde seule');
  assert.ok(calls.some(line => /pagehide/.test(line)), 'fermeture de la page');
  const frame = main.slice(main.indexOf('function frame(now)'));
  assert.doesNotMatch(frame, /saveGame\(|saveCampaign\(/);
});

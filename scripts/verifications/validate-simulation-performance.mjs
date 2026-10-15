import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { campaignConfig } from '../validate-campaign.mjs';
import { GameSimulation } from '../../src/simulation/game-simulation.js';
import { AIController } from '../../src/simulation/controllers.js';

// Exécuter avant puis après une optimisation : le temps est indicatif, les états doivent être identiques.
const referencePath = process.argv[2];
const reference = referencePath ? JSON.parse(await readFile(referencePath, 'utf8')) : null;
const output = process.env.CAMPAIGN_TEST_ARTIFACTS || 'artifacts/performance-simulation';
const fingerprint = sim => createHash('sha256').update(sim.exportSnapshot()).digest('hex');
const results = [];
for (const seed of [17, 42, 109]) {
  const config = campaignConfig();
  config.balance.time.real_seconds_per_game_day = .6;
  const sim = new GameSimulation(config, seed), ai = new AIController(config), hashes = [];
  const start = performance.now();
  for (let n = 0; n < 6000 && sim.state.phase === 'CAMPAIGN'; n++) {
    const state = sim.state;
    sim.step(state.candidates.flatMap(c => ai.commands(state, c.id)));
    if (n % 300 === 299) hashes.push(fingerprint(sim));
  }
  const result = { seed, ms: performance.now() - start, tick: sim.state.tick, hashes, final: fingerprint(sim) };
  if (reference) {
    const before = reference.find(r => r.seed === seed);
    assert.ok(before, `Référence présente pour la graine ${seed}`);
    assert.equal(result.tick, before.tick);
    assert.deepEqual(result.hashes, before.hashes, `Tous les états intermédiaires sont identiques, graine ${seed}`);
    assert.equal(result.final, before.final, `État final identique, graine ${seed}`);
  }
  results.push(result);
  console.log(`Graine ${seed} : ${result.tick} étapes, ${Math.round(result.ms)} ms${reference ? ', états strictement identiques' : ''}.`);
}
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'simulation.json'), JSON.stringify(results, null, 2));

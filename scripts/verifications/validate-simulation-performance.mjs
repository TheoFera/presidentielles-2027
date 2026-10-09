// Mesure, sous Node, le coût des calculs refaits à chaque mise à jour de la simulation :
// les votes physiques de chaque sous-zone (refreshElectoralState) et l'argent de chaque camp (incomeBreakdown).
// Ce n'est pas une mesure de FPS. Rapport : artifacts/performance-mobile/simulation-benchmark.json.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { GameSimulation } from '../../src/simulation/game-simulation.js';
import { campaignConfig } from '../validate-campaign.mjs';
import { FACTIONS } from '../../src/simulation/world.js';
import { completePopulation } from '../../src/simulation/spawns.js';
import { refreshElectoralState } from '../../src/simulation/electoral-state.js';
import { incomeBreakdown } from '../../src/simulation/territory.js';

const config = campaignConfig(), sim = new GameSimulation(config, 42), state = sim.state;
// Monde plein (tous les habitants nés), répartis entre les camps comme en fin de campagne.
completePopulation(sim);
state.npcs.forEach((npc, i) => {
  npc.role = ['NEUTRE', 'SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'][i % 4];
  npc.faction_id = npc.role === 'NEUTRE' ? null : FACTIONS[i % FACTIONS.length];
});

// Le calcul doit être stable : deux passages donnent exactement le même état.
refreshElectoralState(state);
const once = structuredClone(state.electorate);
refreshElectoralState(state);
assert.deepEqual(state.electorate, once, 'Deux calculs des votes de suite doivent donner le même résultat.');
const voters = state.electorate.reduce((sum, zone) => sum + Object.entries(zone.support)
  .filter(([key]) => key !== 'pending').reduce((total, [, count]) => total + count, 0), 0);
assert.equal(voters, state.npcs.length, 'Chaque habitant compte une fois dans sa sous-zone.');

const cases = {
  votes: () => refreshElectoralState(state),
  argent: () => FACTIONS.map(faction => incomeBreakdown(state, config, faction)),
};
const report = { population: state.npcs.length, iterations: 3000, measurements: {} };
const median = values => { const sorted = [...values].sort((a, b) => a - b); return (sorted[2] + sorted[3]) / 2; };
for (const [name, run] of Object.entries(cases)) {
  for (let i = 0; i < 500; i++) run(); // échauffement
  const rounds = [];
  for (let round = 0; round < 6; round++) {
    const start = performance.now();
    for (let i = 0; i < report.iterations; i++) run();
    rounds.push(performance.now() - start);
  }
  report.measurements[name] = { medianMs: median(rounds), perCallMicroseconds: median(rounds) / report.iterations * 1000, roundsMs: rounds };
}
await mkdir('artifacts/performance-mobile', { recursive: true });
await writeFile('artifacts/performance-mobile/simulation-benchmark.json', JSON.stringify(report, null, 2));
for (const [name, { perCallMicroseconds }] of Object.entries(report.measurements))
  console.log(`${name} : ${perCallMicroseconds.toFixed(1)} µs par calcul (${report.population} habitants)`);

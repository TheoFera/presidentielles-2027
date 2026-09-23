import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { campaignConfig } from './validate-campaign.mjs';
import { FACTIONS } from '../src/simulation/world.js';
import { refreshInfluenceSources, incomePerSecond, incomeBreakdown } from '../src/simulation/territory.js';
import { refreshInfluenceReference } from '../test/fixtures/influence-reference.js';

const config = campaignConfig(), state = new GameSimulation(config, 42).getState();
state.npcs = Array.from({ length: 201 }, (_, i) => ({ id: `n:${i}`, x: i * 67 % state.world.length,
  faction_id: FACTIONS[i % 3], role: ['NEUTRE', 'SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'][i % 4],
  origin_biome_id: config.layout.biomes[i % 6].id }));
state.buildings.forEach((b, i) => { b.state = 'ACTIVE'; b.owner_id = FACTIONS[i % 3]; b.level = 1;
  b.meeting_faction_id = b.owner_id; b.meeting_level = 1; b.meeting_until_tick = state.tick + 30; });
const reference = structuredClone(state);
refreshInfluenceReference(reference, config); refreshInfluenceSources(state, config);
assert.deepEqual(state, reference);
for (const faction of FACTIONS) assert.equal(incomePerSecond(state, config, faction), incomeBreakdown(state, config, faction).total);
const cases = {
  influence: [() => refreshInfluenceReference(reference, config), () => refreshInfluenceSources(state, config)],
  revenus: [() => FACTIONS.map(f => incomeBreakdown(state, config, f).total), () => FACTIONS.map(f => incomePerSecond(state, config, f))],
};
const report = { population: state.npcs.length, iterations: 3000, measurements: {} };
for (const [name, functions] of Object.entries(cases)) {
  for (let i = 0; i < 1000; i++) for (const fn of functions) fn();
  const times = [[], []];
  for (let round = 0; round < 6; round++) for (const index of round % 2 ? [1, 0] : [0, 1]) {
    const start = performance.now();
    for (let i = 0; i < report.iterations; i++) functions[index]();
    times[index].push(performance.now() - start);
  }
  const median = values => { const sorted = [...values].sort((a, b) => a - b); return (sorted[2] + sorted[3]) / 2; };
  report.measurements[name] = { beforeMs: median(times[0]), afterMs: median(times[1]), roundsMs: times };
}
await mkdir('artifacts/performance-mobile', { recursive: true });
await writeFile('artifacts/performance-mobile/simulation-benchmark.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

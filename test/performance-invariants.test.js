import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { FACTIONS } from '../src/simulation/world.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { completePopulation } from '../src/simulation/spawns.js';
import { incomePerSecond, incomeBreakdown } from '../src/simulation/territory.js';
import { formatNumber } from '../src/presentation/number-format.js';
import { sceneryVisible } from '../src/presentation/illustrated-world.js';

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
    const expected = { melenchon: 0, le_pen: 0, philippe: 0, neutral: 0, pending: 0 };
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

test('Le cadrage conserve les décors qui touchent le bord et rejette seulement ceux entièrement hors écran', () => {
  const renderer = { width: 960, visibleWorld: { left: 95, right: 865 } };
  assert.equal(sceneryVisible(renderer, 0, 95), true);
  assert.equal(sceneryVisible(renderer, 865, 20), true);
  assert.equal(sceneryVisible(renderer, 0, 94), false);
  assert.equal(sceneryVisible(renderer, 866, 20), false);
  assert.equal(sceneryVisible({ width: 960 }, 0, 960), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { FACTIONS } from '../src/simulation/world.js';
import { CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';
import { refreshInfluenceSources, incomePerSecond, incomeBreakdown } from '../src/simulation/territory.js';
import { refreshInfluenceReference } from './fixtures/influence-reference.js';
import { formatNumber } from '../src/presentation/number-format.js';
import { sceneryVisible } from '../src/presentation/illustrated-world.js';

test('Les calculs indexés restent identiques à la référence après mutations au même tick', () => {
  const config = campaignConfig(), state = new GameSimulation(config).getState();
  for (let variant = 0; variant < 36; variant++) {
    // Deliberately keep the tick unchanged: a tick-based memo would be stale.
    state.phase = variant % 2 ? 'CAMPAIGN' : 'SECOND_ROUND_SPRINT';
    state.eliminated_faction = variant % 4 === 0 ? 'philippe' : null;
    state.npcs = Array.from({ length: 201 }, (_, i) => ({ id: `n:${i}`, x: (i * 67 + variant * 11) % state.world.length,
      faction_id: FACTIONS[(i + variant) % 3], role: ['NEUTRE', 'SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'][i % 4],
      origin_biome_id: config.layout.biomes[(i + variant) % 6].id }));
    state.buildings.forEach((b, i) => {
      b.state = (i + variant) % 5 === 0 ? 'CLOSED' : 'ACTIVE'; b.owner_id = FACTIONS[(i + variant) % 3];
      b.level = 1 + (i + variant) % 3; b.headquarters = i % 7 === 0;
      b.meeting_faction_id = FACTIONS[i % 3]; b.meeting_level = 1 + i % config.balance.buildings.meeting.ally_influence_multiplier_by_level.length;
      b.meeting_until_tick = state.tick + (i % 3 - 1);
    });
    state.electorate.forEach((e, i) => { e.controller = [...FACTIONS, null][(i + variant) % 4]; });
    state.candidates.forEach((c, i) => {
      c.current_campaign_style = CAMPAIGN_STYLES[c.faction_id][variant % 3].id;
      c.x = variant % 2 ? state.world.length - .01 : i * 41;
      c.eliminated = c.faction_id === state.eliminated_faction; c.is_ko = (variant + i) % 5 === 0;
      c.combat.engaged = (variant + i) % 7 === 0; c.campaign_arena_id = variant % 11 === 0 ? 'arena:test' : null;
      c.combat.attack_id = variant % 13 === 0 ? 'attack:test' : null;
    });
    const expected = structuredClone(state);
    refreshInfluenceReference(expected, config); refreshInfluenceSources(state, config);
    assert.deepEqual(state, expected, `Variante ${variant} : aucune différence de règle ou d’arrondi`);
    for (const faction of FACTIONS) assert.equal(incomePerSecond(state, config, faction), incomeBreakdown(state, config, faction).total);
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

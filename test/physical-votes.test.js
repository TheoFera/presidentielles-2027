import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { convertNeutral, neutralizeSupporter } from '../src/simulation/npc-votes.js';
import { triggerMeeting, updateElectoralBuildings } from '../src/simulation/electoral-buildings.js';
import { startArena, finishArena } from '../src/simulation/match-lifecycle.js';
import { buildingOffers } from '../src/simulation/economy.js';
import { strategicAICommands } from '../src/simulation/ai-strategy.js';
import { zoneAt } from '../src/simulation/world.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype, campaignCatalog] = await Promise.all(
  ['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json', 'campaign_events.json']
    .map(async name => JSON.parse(await readFile(new URL(name, base), 'utf8'))),
);
const config = validateConfig({ balance, layout, buildings, prototype, campaignCatalog });
const make = () => {
  const sim = new GameSimulation(config);
  sim.state.ai_enabled = false;
  for (const candidate of sim.state.candidates) candidate.campaign_active = false;
  return sim;
};
const advance = (sim, ticks) => { for (let tick = 0; tick < ticks; tick++) sim.step(); };

test('200 électeurs exacts au premier tour, aucun PNJ ajouté au second', () => {
  const sim = make();
  assert.equal(sim.state.npcs.length, 25);
  assert.deepEqual(config.layout.biomes.map(biome => biome.subzones.reduce((sum, zone) => sum + zone.max_npcs_by_origin, 0)), [34, 34, 34, 34, 34, 30]);
  startArena(sim);
  assert.equal(sim.state.npcs.length, 200);
  assert.equal(sim.state.actualGameState.national_counts.pending, 0);
  finishArena(sim, 'philippe');
  advance(sim, 90);
  assert.equal(sim.state.npcs.length, 200);
  assert.equal(sim.spawn(sim.state.world.subzones[0]), null);
});

test('une conversion vaut exactement une voix, une promotion ne crée pas de voix', () => {
  const sim = make();
  const npc = sim.state.npcs[0];
  convertNeutral(sim, npc, 'melenchon');
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  assert.equal(sim.state.actualGameState.national_support.melenchon, 0.5);
  npc.role = 'MILITANT';
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  npc.role = 'SERVICE_D_ORDRE';
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  npc.role = 'SYMPATHISANT';
  neutralizeSupporter(sim, npc, 'TEST');
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 0);
  assert.equal(sim.state.actualGameState.national_counts.neutral, 25);
});

test('la tour change un seul PNJ admissible toutes les quinze secondes', () => {
  const sim = make();
  const tower = sim.state.buildings.find(building => building.type === 'tour_communication');
  Object.assign(tower, { owner_id: 'melenchon', state: 'ACTIVE', active: true, neutral: false, level: 1 });
  // La diffusion est testée seule : la fermeture pour manque de présence est une autre règle.
  for (let tick = 1; tick <= 450; tick++) { sim.state.tick = tick; updateElectoralBuildings(sim); }
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 0);
  sim.state.tick++; updateElectoralBuildings(sim); refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  for (let tick = 0; tick < 449; tick++) { sim.state.tick++; updateElectoralBuildings(sim); }
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  sim.state.tick++; updateElectoralBuildings(sim); refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 2);
});

test('le meeting exige le promontoire et son onde reste dans la sous-zone', () => {
  const sim = make();
  const podium = sim.state.buildings.find(building => building.type === 'meeting');
  const candidate = sim.state.candidates[0];
  candidate.x = podium.x;
  const local = sim.state.npcs.filter(npc => zoneAt(sim.state.world, npc.x).id === podium.subzone_id);
  assert.ok(local.length >= 1);
  local[0].role = 'SYMPATHISANT'; local[0].faction_id = 'le_pen';
  const outside = sim.state.npcs.find(npc => zoneAt(sim.state.world, npc.x).id !== podium.subzone_id);
  outside.role = 'SYMPATHISANT'; outside.faction_id = 'le_pen';
  assert.equal(triggerMeeting(sim, podium, 'melenchon', candidate.id), true);
  candidate.podium_site_id = podium.id; candidate.combat.height = config.balance.buildings.meeting.podium_height;
  advance(sim, sim.secondsToTicks(15));
  assert.equal(podium.meetings_held, 1);
  assert.equal(local[0].role, 'NEUTRE');
  assert.equal(outside.faction_id, 'le_pen');
  assert.equal(sim.state.npcs.filter(npc => zoneAt(sim.state.world, npc.x).id === podium.subzone_id && npc.role === 'NEUTRE').length, 1);
});

test('le meeting garde sa progression cinq secondes puis s’annule', () => {
  const sim = make();
  const podium = sim.state.buildings.find(building => building.type === 'meeting');
  const candidate = sim.state.candidates[0];
  candidate.x = podium.x;
  triggerMeeting(sim, podium, 'melenchon', candidate.id);
  candidate.podium_site_id = podium.id; candidate.combat.height = config.balance.buildings.meeting.podium_height;
  advance(sim, 60);
  assert.equal(podium.meeting_hold_ticks, 60);
  candidate.podium_site_id = null; candidate.combat.height = 0;
  advance(sim, 120);
  assert.equal(podium.meeting_hold_ticks, 60);
  candidate.podium_site_id = podium.id; candidate.combat.height = config.balance.buildings.meeting.podium_height;
  sim.step();
  assert.equal(podium.meeting_hold_ticks, 61);
  candidate.podium_site_id = null; candidate.combat.height = 0;
  advance(sim, 151);
  assert.equal(podium.meeting_candidate_id, null);
  assert.equal(podium.meetings_held, 0);
});

test('l’IA saute sur le promontoire du meeting qu’elle vient de lancer', () => {
  const sim = make();
  const podium = sim.state.buildings.find(building => building.type === 'meeting');
  const candidate = sim.state.candidates.find(item => item.faction_id === 'le_pen');
  candidate.x = podium.x;
  sim.state.ai_enabled = true;
  assert.equal(triggerMeeting(sim, podium, candidate.faction_id, candidate.id), true);
  assert.ok(strategicAICommands(sim.state, config, candidate).some(command => command.type === 'Jump'));
});

test('les bâtiments n’offrent plus d’amélioration', () => {
  const sim = make();
  for (const settings of Object.values(config.balance.buildings)) {
    assert.equal(settings.max_level, 1);
    assert.deepEqual(settings.upgrade_costs, []);
  }
  for (const building of sim.state.buildings.filter(item => item.ownership_model === 'capturable')) {
    const candidate = sim.state.candidates[0];
    Object.assign(building, { owner_id: candidate.faction_id, level: 1, state: 'ACTIVE', active: true, neutral: false });
    if (building.type === 'faction') building.variant = 'service_ordre';
    assert.ok(buildingOffers(sim.state, config, candidate, building).every(offer => offer.kind !== 'UPGRADE'));
  }
});

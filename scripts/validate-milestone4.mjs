import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { FACTIONS, zoneAt } from '../src/simulation/world.js';
import { AIController } from '../src/simulation/controllers.js';
import { refreshElectoralState, updatePolls } from '../src/simulation/electoral-state.js';
import { refreshInfluenceSources } from '../src/simulation/territory.js';
import { validateConfig } from '../src/config.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'].map(async f => JSON.parse(await readFile(new URL(f, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype });
const advance = (sim, ticks) => { for (let i = 0; i < ticks; i++) sim.step(); };
const sync = sim => { refreshElectoralState(sim.state, sim.config); refreshInfluenceSources(sim.state, sim.config); updatePolls(sim); };
const save = async (sim, name) => {
  sync(sim); const copy = new GameSimulation(sim.config); copy.importSnapshot(sim.exportSnapshot()); assert.deepEqual(copy.state, sim.state);
  await writeFile(new URL(`../artifacts/${name}.json`, import.meta.url), sim.exportSnapshot());
  console.log(`${name} : état valide au tick ${sim.state.tick}`);
};
function unit(sim, faction, zone, x) {
  const npc = sim.spawn(zone, x, false);
  Object.assign(npc, { role: 'SYMPATHISANT', faction_id: faction, hidden_durability: 30, roam_wait_ticks: 100000, roam_target_x: x });
}
function context(faction) {
  const sim = new GameSimulation(config); sim.state.ai_enabled = false;
  for (const c of sim.state.candidates) { c.campaign_active = false; c.interaction_active = false; c.money = 1500; }
  const actor = sim.state.candidates.find(c => c.faction_id === faction);
  const zone = sim.state.world.subzones.find(z => z.id === config.layout.starting_positions[faction]);
  actor.campaign_active = true; actor.interaction_active = true; sim.state.local_candidate_id = actor.id;
  // Explicitly prepared sandbox: funds and six local workers. Purchases below are real holds.
  for (let i = 0; i < 6; i++) unit(sim, faction, zone, zone.start + 15 + i * 0.5);
  const get = type => sim.state.buildings.find(b => b.subzone_id === zone.id && b.type === type);
  const visit = (type, ticks = 60, offset = 0) => {
    actor.interaction_active = false; actor.x = zone.center; sim.step();
    actor.x = get(type).x + offset; actor.interaction_active = true; advance(sim, ticks);
  };
  return { sim, actor, zone, get, visit };
}
const prepared = [];
for (const faction of FACTIONS) {
  const c = context(faction); const { sim, actor, zone, get, visit } = c;
  visit('tour_communication'); assert.equal(get('tour_communication').level, 1);
  visit('tour_communication'); visit('tour_communication'); assert.equal(get('tour_communication').level, 3);
  if (faction === 'melenchon') await save(sim, 'jalon4-tour-niveau-3');
  visit('meeting'); assert.equal(get('meeting').level, 1);
  visit('institut_sondage', 30);
  if (faction === 'melenchon') await save(sim, 'jalon4-avant-institut');
  advance(sim, 30); assert.equal(get('institut_sondage').level, 1);
  // Distinct territorial colours, including Philippe's white/grey, for ring QA.
  for (const e of sim.state.electorate) {
    const index = sim.state.world.subzones.findIndex(z => z.id === e.subzone_id);
    if (index % 4 !== 3) e.support = { melenchon: 15, le_pen: 15, philippe: 15, neutral: 20, [FACTIONS[index % 3]]: 50 };
  }
  const e = sim.state.electorate.find(e => e.subzone_id === zone.id);
  e.support = { melenchon: 17.6, le_pen: 17.6, philippe: 17.6, neutral: 30, [faction]: 34.8 };
  actor.interaction_active = false; advance(sim, 240); sync(sim);
  await save(sim, `jalon4-sondage-${faction}`);
  visit('meeting'); assert.equal(get('meeting').meetings_held, 1); assert.equal(e.controller, faction);
  await save(sim, `jalon4-meeting-${faction}`);
  prepared.push({ faction, spending: actor.spending, local_support: e.support, snapshot_tick: sim.state.polls[faction].lastPollSnapshot.measured_tick });
  if (faction === 'melenchon') {
    const institute = get('institut_sondage'); const old = structuredClone(sim.state.polls.melenchon.lastPollSnapshot);
    const cabinet = get('faction'); Object.assign(cabinet, { owner_id: 'philippe', variant: 'cabinet_administratif', state: 'ACTIVE', level: 1 });
    const philippe = sim.state.candidates.find(c => c.faction_id === 'philippe');
    actor.campaign_active = false; actor.interaction_active = false;
    philippe.x = cabinet.x + config.balance.faction_interactions.side_offset; philippe.campaign_active = true; philippe.interaction_active = true;
    advance(sim, 60); assert.equal(institute.state, 'CLOSED');
    philippe.campaign_active = false; philippe.interaction_active = false; advance(sim, 260);
    assert.deepEqual(sim.state.polls.melenchon.lastPollSnapshot, old); actor.x = institute.x - 1.5;
    await save(sim, 'jalon4-institut-ferme');
  }
}

const runs = [];
for (const seed of [2027, 73, 31415]) {
  // Historical campaign-only benchmark: isolate its 900 seconds from the new J0 transition.
  const campaignConfig = structuredClone(config); campaignConfig.balance.time.starting_days_before_first_round = 100;
  const sim = new GameSimulation(campaignConfig, seed); const ai = new AIController(campaignConfig); let maxError = 0;
  const milestones = Object.fromEntries(FACTIONS.map(f => [f, { buildings: {}, meetings: 0 }]));
  // Three interchangeable AI controllers, normal starting funds/population/spawns.
  for (let tick = 0; tick < 900 * sim.hz; tick++) {
    sim.step(sim.state.candidates.flatMap(c => ai.commands(sim.state, c.id)));
    for (const b of sim.state.buildings.filter(b => b.owner_id && b.state === 'ACTIVE')) {
      if (milestones[b.owner_id].buildings[b.type] === undefined) milestones[b.owner_id].buildings[b.type] = sim.state.tick / sim.hz;
      if (b.type === 'meeting') milestones[b.owner_id].meetings = Math.max(milestones[b.owner_id].meetings, b.meetings_held);
    }
    for (const e of sim.state.electorate) {
      const values = Object.values(e.support); const error = Math.abs(values.reduce((a, b) => a + b) - 100);
      maxError = Math.max(maxError, error); assert.ok(error < 1e-9 && values.every(v => v >= 0 && v <= 100));
    }
    if ((tick + 1) % (300 * sim.hz) === 0) console.log(`Graine ${seed} : ${(tick + 1) / sim.hz} secondes simulées, sommes vérifiées ; ${sim.state.buildings.filter(b => b.owner_id).map(b => `${b.owner_id}:${b.type}:${b.level}`).join(', ')}.`);
  }
  const record = { seed, seconds: sim.state.tick / sim.hz, milestones, max_sum_error: maxError, national: sim.state.actualGameState.national_support,
    controlled: sim.state.actualGameState.controlled_counts, factions: sim.state.candidates.map(c => ({ faction: c.faction_id, money: c.money, spending: c.spending,
      buildings: sim.state.buildings.filter(b => b.owner_id === c.faction_id).map(b => ({ type: b.type, level: b.level, state: b.state, meetings: b.meetings_held })),
      position: c.x, hold: c.purchase_hold?.kind || null })) };
  runs.push(record); console.log(JSON.stringify(record)); await save(sim, `jalon4-simulation-${seed}`);
}
await writeFile(new URL('../artifacts/validation-jalon4.json', import.meta.url), JSON.stringify({ prepared, runs }, null, 2));

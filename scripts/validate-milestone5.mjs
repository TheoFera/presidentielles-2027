import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { config } from './game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { AIController } from '../src/simulation/controllers.js';
import { GamePhase as P } from '../src/simulation/phases.js';
import { startArena, finishArena } from '../src/simulation/match-lifecycle.js';
import { refreshElectoralState, updatePolls } from '../src/simulation/electoral-state.js';
import { completePopulation } from '../src/simulation/spawns.js';

const report = { version: 6, defaults: { campaign_seconds: config.balance.time.starting_days_before_first_round * config.balance.time.real_seconds_per_game_day,
  sprint_seconds: config.balance.time.second_round_sprint_seconds, electors: config.layout.total_electors,
  tower_broadcast_seconds: config.balance.buildings.tour_communication.broadcast_interval_seconds, poll_seconds: config.balance.second_round.poll_refresh_seconds }, full_matches: [], arena_balance: [] };
const refresh = sim => { refreshElectoralState(sim.state); updatePolls(sim); };
const save = async (sim, name) => {
  const reload = new GameSimulation(config); reload.importSnapshot(sim.exportSnapshot()); assert.deepEqual(reload.getState(), sim.getState());
  await writeFile(`artifacts/${name}.json`, sim.exportSnapshot());
};

for (const seed of [2027, 73, 31415]) {
  console.log(`Partie complète, graine ${seed} : campagne de ${report.defaults.campaign_seconds} secondes…`);
  const sim = new GameSimulation(config, seed); const ai = new AIController(config);
  let lastPhase = sim.state.phase; let maxElectorError = 0; let ticks = 0; const phases = [lastPhase];
  for (; ticks < (report.defaults.campaign_seconds + 180) * sim.hz && sim.state.phase !== P.RESULTS; ticks++) {
    sim.step(sim.state.candidates.filter(c => !c.eliminated).flatMap(c => ai.commands(sim.state, c.id)));
    if (sim.state.phase !== lastPhase) {
      phases.push(sim.state.phase); lastPhase = sim.state.phase;
      console.log(`  → ${lastPhase} · ${sim.state.match_tick / sim.hz} s`);
      if (seed === 2027) await save(sim, sim.state.phase === P.FIRST_ROUND_ARENA ? 'jalon5-j0' : sim.state.phase === P.SECOND_ROUND_SPRINT ? 'jalon5-sprint' : 'jalon5-resultat');
    }
    if (ticks % sim.hz === 0) maxElectorError = Math.max(maxElectorError, Math.abs(Object.values(sim.state.actualGameState.national_counts).reduce((a, b) => a + b, 0) - config.layout.total_electors));
  }
  assert.equal(sim.state.phase, P.RESULTS); assert.deepEqual(phases, [P.CAMPAIGN, P.FIRST_ROUND_ARENA, P.SECOND_ROUND_SPRINT, P.RESULTS]);
  assert.equal(maxElectorError, 0); assert.equal(sim.state.sprint_elapsed_ticks, config.balance.time.second_round_sprint_seconds * sim.hz);
  assert.equal(sim.state.npcs.length, config.layout.total_electors);
  const t = sim.state.telemetry;
  const formerCount = sim.state.npcs.filter(n => n.former_eliminated_faction).length;
  if (formerCount) assert.ok(t.reconverted_npc_ids.length < formerCount, 'pas de conversion automatique de toute la réserve');
  report.full_matches.push({ seed, duration_seconds: ticks / sim.hz, phases, max_elector_error: maxElectorError, former_npcs: formerCount,
    active_buildings: sim.state.buildings.filter(b => b.owner_id && b.state === 'ACTIVE').length,
    ...structuredClone(t), changed_subzone_count: t.changed_subzone_ids.length, reconverted_npc_count: t.reconverted_npc_ids.length });
}

for (let seed = 1; seed <= 30; seed++) {
  const sim = new GameSimulation(config, seed);
  completePopulation(sim);
  sim.state.npcs.slice(0,68).forEach(n => { n.role = 'SYMPATHISANT'; n.faction_id = 'melenchon'; });
  sim.state.npcs.slice(68,128).forEach(n => { n.role = 'SYMPATHISANT'; n.faction_id = 'le_pen'; });
  sim.state.npcs.slice(128,180).forEach(n => { n.role = 'SYMPATHISANT'; n.faction_id = 'philippe'; });
  refresh(sim); startArena(sim); const ai = new AIController(config);
  for (let i = 0; i < 90 * sim.hz && sim.state.phase === P.FIRST_ROUND_ARENA; i++) sim.step(sim.state.candidates.flatMap(c => ai.commands(sim.state, c.id)));
  assert.equal(sim.state.phase, P.SECOND_ROUND_SPRINT);
  report.arena_balance.push({ seed, eliminated: sim.state.eliminated_faction, duration_seconds: sim.state.telemetry.arena_duration_seconds, hits: sim.state.telemetry.arena_candidate_hits });
}
assert.ok(report.arena_balance.some(r => r.eliminated !== 'philippe'));

// Reviewable visual fixture: an established third camp near the player's camera, with immutable homes elsewhere.
const fixture = new GameSimulation(config); fixture.state.ai_enabled = false; fixture.state.npcs = [];
for (const c of fixture.state.candidates) { c.interaction_active = false; c.campaign_active = false; c.special_charge = 10; }
fixture.state.candidates[0].x = 108;
for (const b of fixture.state.buildings.filter(b => b.subzone_id === 'banlieue_b' && b.type !== 'imprimerie')) {
  b.owner_id = 'le_pen'; b.level = 1; b.state = 'ACTIVE'; if (b.type === 'faction') b.variant = 'service_ordre';
}
for (let i = 0; i < 12; i++) {
  const origin = fixture.state.world.subzones.find(z => z.id === (i % 2 ? 'banlieue_b' : 'banlieue_a'));
  const n = fixture.spawn(origin, 100 + i * 1.2, false);
  n.role = ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'][i % 3]; n.faction_id = 'le_pen'; n.hidden_durability = n.role === 'SERVICE_D_ORDRE' ? 90 : 30;
  n.roam_wait_ticks = 99999; if (n.role === 'SERVICE_D_ORDRE') { n.guard_biome_id = 'banlieue'; n.guard_anchor_x = n.x; }
}
refresh(fixture); startArena(fixture); await save(fixture, 'jalon5-arene-visuelle');
finishArena(fixture, 'le_pen'); await save(fixture, 'jalon5-effondrement');

await writeFile('artifacts/validation-jalon5.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ full_matches: report.full_matches, arena_eliminations: Object.fromEntries(['melenchon', 'le_pen', 'philippe'].map(f => [f, report.arena_balance.filter(r => r.eliminated === f).length])) }, null, 2));
console.log('Validation du cinquième jalon réussie.');

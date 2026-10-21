import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { spawnPressTeam, updatePressTeam } from '../src/simulation/press-team.js';
import { filmed, pressMember } from '../src/simulation/press-rules.js';
import { AIController } from '../src/simulation/controllers.js';
import { CampaignStyleSystem, CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';

// Une IA filmée sort du champ puis abat le cadreur : le reportage s'arrête.
function run(reaction) {
  const config = campaignConfig(); config.balance.minor_candidates.enabled = false;
  config.balance.ai_tactics.press_reaction = reaction;
  const sim = new GameSimulation(config, 42); sim.state.npcs = [];
  sim.state.candidates.forEach((c, i) => { c.x = 103 + i * 50; c.axis = 0; });
  const c = sim.state.candidates[0];
  CampaignStyleSystem.select(sim, c, CAMPAIGN_STYLES[c.faction_id][0].id, true);
  spawnPressTeam(sim, c);
  const camera = pressMember(sim.state, 'PRESS_CAMERA'), reporter = pressMember(sim.state, 'PRESS_REPORTER');
  sim.state.tick = camera.ready_tick; camera.x = 100; reporter.x = 101.5;
  updatePressTeam(sim);
  sim.state.ai_enabled = true; const ai = new AIController(config);
  let filmedTicks = 0, ticks = 0;
  for (; ticks < sim.secondsToTicks(10) && sim.state.press_team?.phase !== 'LEAVING'; ticks++) {
    sim.step(ai.commands(sim.state, c.id));
    if (filmed(sim.state, config, c)) filmedTicks++;
  }
  return { sim, camera, filmedTicks, ticks };
}

test('IA filmée : elle sort du champ et met le cadreur K.-O. en quelques secondes', () => {
  const { sim, camera, filmedTicks, ticks } = run(true);
  assert.equal(sim.state.press_team?.phase, 'LEAVING', 'le reportage doit prendre fin');
  assert.ok(camera.hidden_durability <= 0, 'le cadreur est abattu');
  assert.ok(ticks <= sim.secondsToTicks(5), `trop lent : ${(ticks / sim.hz).toFixed(1)} s`);
  assert.ok(filmedTicks <= sim.secondsToTicks(1.5), `trop longtemps filmée : ${(filmedTicks / sim.hz).toFixed(1)} s`);
});

test('Sans la réaction, l’IA reste filmée bien plus longtemps', () => {
  const on = run(true), off = run(false);
  assert.ok(off.filmedTicks > on.filmedTicks, `${off.filmedTicks} contre ${on.filmedTicks}`);
});

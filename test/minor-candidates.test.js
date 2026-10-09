import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { AIController } from '../src/simulation/controllers.js';
import { buildingOffers } from '../src/simulation/economy.js';
import { hit } from '../src/simulation/combat-state.js';
import { convertNeutral } from '../src/simulation/npc-votes.js';
import { completePopulation } from '../src/simulation/spawns.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { startDebate, finishDebate } from '../src/simulation/match-lifecycle.js';
import { minorTerritory, minorSympathisantCount } from '../src/simulation/minor-candidates.js';
import { MINOR_FACTIONS, zoneAt } from '../src/simulation/world.js';
import { electionModel } from '../src/presentation/menus/election-results.js';

const make = (seed = 42) => { const config = campaignConfig(); config.balance.campaign_events.event_enabled = false; return new GameSimulation(config, seed); };
const minor = (sim, faction) => sim.state.candidates.find(c => c.faction_id === faction);
const knockOut = (sim, target) => {
  const attacker = sim.state.candidates.find(c => c.faction_id === 'le_pen'); attacker.x = target.x;
  for (let i = 0; i < 10 && !target.is_ko; i++) hit(sim, attacker, target, { damage: 40, electoral_damage: 0, knockback: 0 }, `test:ko:${i}`);
  assert.equal(target.is_ko, true);
};

test('Six candidats mineurs : QG imprenable, contrôle de leur sous-zone, ni argent ni style', () => {
  const sim = make(), config = sim.config;
  assert.deepEqual(sim.state.candidates.filter(c => c.minor).map(c => c.faction_id), MINOR_FACTIONS);
  for (const entry of config.layout.minor_candidates) {
    const c = minor(sim, entry.faction_id), hq = sim.state.buildings.find(b => b.id === entry.site_id);
    assert.equal(hq.owner_id, c.faction_id); assert.ok(hq.headquarters && hq.controls_zone); assert.equal(c.headquarters_site_id, hq.id);
    assert.equal(zoneAt(sim.state.world, c.x).id, entry.subzone_id);
    assert.equal(sim.state.electorate.find(z => z.subzone_id === entry.subzone_id).controller, c.faction_id);
    const rival = sim.state.candidates[0]; rival.x = hq.x; rival.money = 100;
    assert.deepEqual(buildingOffers(sim.state, config, rival, hq), [], 'QG d’un mineur imprenable');
  }
  for (let i = 0; i < sim.secondsToTicks(5); i++) sim.step();
  assert.ok(sim.state.candidates.filter(c => c.minor).every(c => c.money === 0 && c.current_campaign_style === null));
});

test('L’IA d’un mineur reste sur son territoire et plafonne à 10 sympathisants', () => {
  const sim = make(7), ai = new AIController(sim.config);
  completePopulation(sim);
  for (let i = 0; i < sim.secondsToTicks(90); i++) {
    sim.step(sim.state.candidates.filter(c => c.minor).flatMap(c => ai.commands(sim.state, c.id)));
    for (const c of sim.state.candidates.filter(c => c.minor && !c.eliminated)) {
      assert.ok(minorTerritory(sim.state, sim.config, c).inside(c.x), `${c.faction_id} hors de son territoire`);
      assert.ok(minorSympathisantCount(sim.state, c.faction_id) <= sim.config.balance.minor_candidates.max_sympathisants);
    }
  }
  assert.ok(sim.state.candidates.filter(c => c.minor).some(c => minorSympathisantCount(sim.state, c.faction_id) > 0), 'les mineurs recrutent');
});

test('Battu, un mineur ne revient pas : QG neutre, sympathisants conservés, sauvegarde fidèle', () => {
  const sim = make(), c = minor(sim, 'glucksmann'), hq = sim.state.buildings.find(b => b.owner_id === 'glucksmann');
  completePopulation(sim);
  const fans = sim.state.npcs.filter(n => n.role === 'NEUTRE').slice(0, 3); fans.forEach(n => convertNeutral(sim, n, 'glucksmann'));
  knockOut(sim, c);
  for (let i = 0; i < sim.secondsToTicks(8); i++) sim.step();
  assert.equal(c.eliminated, true); assert.equal(hq.owner_id, null); assert.equal(hq.state, 'NEUTRAL');
  assert.ok(fans.every(n => n.faction_id === 'glucksmann'), 'ses sympathisants restent les siens');
  refreshElectoralState(sim.state); assert.ok(sim.state.actualGameState.national_counts.glucksmann >= 3);
  const rival = sim.state.candidates[0]; rival.x = hq.x; rival.money = 100;
  assert.ok(buildingOffers(sim.state, sim.config, rival, hq).length > 0, 'le QG libéré s’achète normalement');
  for (let i = 0; i < sim.secondsToTicks(20); i++) sim.step();
  assert.equal(c.eliminated, true, 'aucune réapparition');
  const copy = make(); copy.importSnapshot(sim.exportSnapshot());
  for (let i = 0; i < 30; i++) { sim.step(); copy.step(); }
  assert.deepEqual(copy.state, sim.state);
});

test('Élection : scores des mineurs affichés, seuls les principaux se qualifient, report libre au second tour', () => {
  const sim = make();
  completePopulation(sim);
  const fans = sim.state.npcs.filter(n => n.role === 'NEUTRE').slice(0, 4); fans.forEach(n => convertNeutral(sim, n, 'attal'));
  refreshElectoralState(sim.state);
  assert.ok(sim.state.actualGameState.national_support.attal > 0);
  startDebate(sim);
  assert.deepEqual([...sim.state.first_round_result.ranking].sort(), ['le_pen', 'melenchon', 'philippe']);
  assert.ok(sim.state.first_round_result.scores.attal > 0, 'score du mineur publié au premier tour');
  const model = electionModel({ ...sim.state, local_candidate_id: 'candidate:melenchon' });
  assert.equal(model.minors.length, 6); assert.ok(model.minors.find(x => x.f === 'attal').value > 0);
  const total = [...model.ranking, ...MINOR_FACTIONS].reduce((sum, f) => sum + (model.scores?.[f] ?? 0), 0);
  assert.ok(!model.scores || Math.abs(total - 100) < 1e-9, 'pourcentages sur toutes les voix exprimées');
  finishDebate(sim);
  assert.ok(sim.state.candidates.filter(c => c.minor).every(c => c.eliminated));
  assert.ok(fans.every(n => n.role === 'NEUTRE' && n.faction_id === null), 'électeurs libres au second tour');
  const copy = make(); copy.importSnapshot(sim.exportSnapshot());
  assert.deepEqual(copy.state.candidates.map(c => c.eliminated), sim.state.candidates.map(c => c.eliminated));
});

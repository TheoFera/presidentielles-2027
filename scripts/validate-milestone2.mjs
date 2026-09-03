import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { LocalHumanController, AIController, collectCommands } from '../src/simulation/controllers.js';
import { setAIEnabled } from '../src/simulation/commands.js';
import { ringDelta, zoneAt } from '../src/simulation/world.js';
import { localSympathisants } from '../src/simulation/territory.js';
import { validateConfig } from '../src/config.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'].map(async f => JSON.parse(await readFile(new URL(f, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype });
const sim = new GameSimulation(config);
const human = new LocalHumanController(); const ai = new AIController(config);
const actor = () => sim.state.candidates.find(c => c.id === sim.state.local_candidate_id);
const advance = (commands = []) => sim.step([...collectCommands(sim.getState(), human, ai), ...commands]);
const checkpoint = async name => {
  await writeFile(new URL(`../artifacts/${name}.json`, import.meta.url), sim.exportSnapshot());
  console.log(`${name} : ${(sim.state.tick / sim.hz).toFixed(2)} s, ${actor().money.toFixed(2)} k €, ${actor().total_spent} k € dépensés`);
};
const until = (condition, timeoutSeconds, action = () => {}) => {
  const end = sim.state.tick + sim.secondsToTicks(timeoutSeconds);
  while (!condition() && sim.state.tick < end) { action(); advance(); }
  assert.ok(condition(), `Étape non atteinte après ${timeoutSeconds} s (tick ${sim.state.tick}).`);
};
const moveTo = x => {
  until(() => Math.abs(ringDelta(actor().x, x, sim.state.world.length)) < config.prototype.movement.candidate_speed_units_per_second / sim.hz,
    120, () => human.setAxis(Math.sign(ringDelta(actor().x, x, sim.state.world.length))));
  human.reset(); advance();
};
const convince = npc => {
  until(() => npc.role !== 'NEUTRE', 12, () => {
    const delta = ringDelta(actor().x, npc.x, sim.state.world.length);
    human.setAxis(Math.abs(delta) <= config.prototype.persuasion.radius_units * 0.9 ? 0 : Math.sign(delta));
  });
  human.reset(); advance();
};

await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
advance([setAIEnabled(false)]);
const initial = sim.state.npcs.filter(n => n.origin_subzone_id === 'banlieue_b');
for (const npc of initial) convince(npc);
assert.equal(localSympathisants(sim.state, 'banlieue_b', 'melenchon').length, 2);
const permanence = sim.state.buildings.find(b => b.id === 'building:banlieue_b:permanence');
moveTo(permanence.x);
for (let i = 0; i < 20; i++) advance();
await checkpoint('jalon2-billet');
until(() => permanence.level === 1, 3);
assert.equal(actor().spending.BUILD, balance.buildings.permanence.build_cost);
await checkpoint('jalon2-permanence');

const printer = sim.state.buildings.find(b => b.id === 'service:banlieue:imprimerie');
moveTo(printer.x);
until(() => printer.queue.length === 1, 3);
moveTo(printer.x + balance.interaction.radius_units + 0.3);
await checkpoint('jalon2-collecte');
until(() => sim.state.npcs.some(n => n.task?.phase === 'PICKUP'), 30);
await checkpoint('jalon2-retrait');
until(() => sim.state.npcs.some(n => n.role === 'MILITANT'), 30);
assert.equal(printer.owner_id, null);

until(() => localSympathisants(sim.state, 'banlieue_b', 'melenchon').length >= balance.buildings.financement.required_local_sympathisants, 180, () => {
  const neutral = sim.state.npcs.find(n => n.role === 'NEUTRE' && zoneAt(sim.state.world, n.x).id === 'banlieue_b' && (!n.persuasion || n.persuasion.actor_id === actor().id));
  if (neutral) {
    const delta = ringDelta(actor().x, neutral.x, sim.state.world.length);
    human.setAxis(Math.abs(delta) <= prototype.persuasion.radius_units * 0.9 ? 0 : Math.sign(delta));
  } else human.reset();
});
const finance = sim.state.buildings.find(b => b.id === 'building:banlieue_b:financement');
moveTo(finance.x);
until(() => finance.level === 1, 15);
assert.equal(actor().spending.BUILD, balance.buildings.permanence.build_cost + balance.buildings.financement.build_cost);
assert.equal(actor().spending.PRINT, balance.buildings.imprimerie.tract_cost_by_level[0]);
assert.ok(actor().income_per_second > balance.money.base_passive_income_per_second);
assert.ok(sim.state.npcs.some(n => n.role === 'MILITANT' && n.faction_id === 'melenchon'));
await checkpoint('jalon2-financement');
const restored = new GameSimulation(config); restored.importSnapshot(sim.exportSnapshot());
assert.deepEqual(restored.getState(), sim.getState());
console.log('Parcours complet validé avec les réglages normaux, uniquement par marche et présence, sans argent ni PNJ ajoutés. IA candidates suspendues pour isoler le parcours.');

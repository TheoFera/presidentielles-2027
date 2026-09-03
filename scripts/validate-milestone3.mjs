import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { LocalHumanController, AIController, collectCommands } from '../src/simulation/controllers.js';
import { setAIEnabled, selectCandidate, grantMoney, spawnUnit, fillSpecial, controlZone, teleportTarget } from '../src/simulation/commands.js';
import { validateConfig } from '../src/config.js';
import { zoneAt } from '../src/simulation/world.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'].map(async f => JSON.parse(await readFile(new URL(f, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype });
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
function context(faction = 'melenchon') {
  const sim = new GameSimulation(config); const human = new LocalHumanController(); const ai = new AIController(config);
  const step = (extra = []) => sim.step([...collectCommands(sim.getState(), human, ai), ...extra]);
  step([setAIEnabled(false), selectCandidate(`candidate:${faction}`)]);
  const actor = sim.state.candidates.find(c => c.id === sim.state.local_candidate_id);
  const local = sim.state.buildings.find(b => b.id === 'building:banlieue_b:faction');
  step([teleportTarget(actor.id, local.id), grantMoney(actor.id), controlZone(actor.id)]);
  const advance = ticks => { for (let i = 0; i < ticks; i++) step(); };
  const spawn = (role, camp, x) => {
    step([spawnUnit(actor.id, role, camp)]);
    const n = sim.state.npcs.at(-1);
    // Explicit test staging: space debug units out for readable combat scenes.
    n.x = x; n.roam_target_x = x; n.roam_wait_ticks = 100000;
    if (role === 'SERVICE_D_ORDRE') { n.guard_anchor_x = x; n.guard_biome_id = zoneAt(sim.state.world, x).biome_id; }
    return n;
  };
  const save = async name => {
    const restored = new GameSimulation(config); restored.importSnapshot(sim.exportSnapshot());
    assert.deepEqual(restored.state, sim.state);
    await writeFile(new URL(`../artifacts/${name}.json`, import.meta.url), sim.exportSnapshot());
    console.log(`${name} : état validé, tick ${sim.state.tick}`);
  };
  return { sim, actor, local, step, advance, spawn, save };
}

for (const [faction, name] of [['melenchon', 'hologrammes'], ['le_pen', 'vague'], ['philippe', 'crs']]) {
  const c = context(faction);
  for (let i = 0; i < 3; i++) c.spawn(i === 0 ? 'MILITANT' : 'SERVICE_D_ORDRE', faction === 'melenchon' ? 'le_pen' : 'melenchon', c.actor.x + 5 + i * 2);
  c.step([fillSpecial(c.actor.id)]);
  await c.save(`jalon3-${name}`);
}
for (let count = 1; count <= 3; count++) {
  const c = context();
  for (let i = 0; i < count; i++) c.spawn('SERVICE_D_ORDRE', 'le_pen', c.actor.x + 3 + i * 1.7);
  await c.save(`jalon3-${count}so`);
}
{
  const c = context(); c.spawn('MILITANT', 'le_pen', c.actor.x + 4);
  await c.save('jalon3-duel');
}
{
  const c = context();
  for (let i = 0; i < 5; i++) c.spawn('SYMPATHISANT', 'melenchon', 98 + i * 1.2);
  const militant = c.spawn('MILITANT', 'melenchon', 112);
  c.advance(60); assert.equal(c.local.variant, 'service_ordre');
  // Leave and return, exactly as required for the next purchase after construction.
  c.actor.x = c.local.x + 3.1; c.step(); c.actor.x = c.local.x;
  c.advance(60); assert.equal(c.actor.spending.EQUIP, 20);
  c.actor.x = c.local.x + 3.1; c.step();
  await c.save('jalon3-equipement');
  for (let i = 0; i < 600 && militant.task?.phase !== 'PICKUP'; i++) c.step();
  assert.equal(militant.task?.phase, 'PICKUP'); await c.save('jalon3-retrait-so');
  c.advance(35); assert.equal(militant.role, 'SERVICE_D_ORDRE');
  c.spawn('SERVICE_D_ORDRE', 'melenchon', 126); c.spawn('SERVICE_D_ORDRE', 'melenchon', 137);
  c.spawn('MILITANT', 'le_pen', 148);
  c.actor.x = c.local.x + balance.faction_interactions.side_offset;
  await c.save('jalon3-raid');
  c.advance(60); assert.equal(c.actor.spending.RAID, 45);
  c.actor.x = c.local.x + 3.1;
  c.advance(550); assert.ok(c.sim.state.npcs.some(n => n.raid?.phase === 'RETURN'));
}
{
  const c = context('philippe');
  for (let i = 0; i < 5; i++) c.spawn('SYMPATHISANT', 'philippe', 98 + i);
  c.advance(60); assert.equal(c.local.variant, 'cabinet_administratif');
  const finance = c.sim.state.buildings.find(b => b.id === 'building:banlieue_b:financement');
  // Prepared opponent economy for the administrative-action scenario.
  finance.state = 'ACTIVE'; finance.owner_id = 'melenchon'; finance.level = 3;
  c.actor.x = c.local.x + balance.faction_interactions.side_offset; c.step();
  await c.save('jalon3-cabinet');
  c.advance(60); assert.equal(finance.state, 'CLOSED'); assert.equal(c.actor.spending.CLOSE, 120);
  c.step([selectCandidate('candidate:melenchon'), grantMoney('candidate:melenchon'), teleportTarget('candidate:melenchon', finance.id)]);
  await c.save('jalon3-reconstruction');
  c.advance(60); assert.equal(finance.state, 'ACTIVE'); assert.equal(finance.level, 1);
}
console.log('Parcours SO → équipement → raid, Cabinet → fermeture → reconstruction et 7 scènes de combat préparées et vérifiées. Ressources et unités de test explicites ; aucune modification des réglages normaux.');

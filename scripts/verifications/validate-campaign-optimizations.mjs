import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { campaignConfig } from '../validate-campaign.mjs';
import { GameSimulation } from '../../src/simulation/game-simulation.js';
import { completePopulation } from '../../src/simulation/spawns.js';
import { nearestEnemy, canBeHit, enemies } from '../../src/simulation/combat-state.js';
import { combatDelta } from '../../src/simulation/combat-geometry.js';
import { stableIdOrder } from '../../src/simulation/territory.js';
import { invisibleToEnemies } from '../../src/simulation/minor-ultimate-catalog.js';
import { withNpcProximity, updateNpcProximity, visitNearbyNpcs, nearbyNpcs } from '../../src/simulation/npc-proximity.js';
import { CrowdSpacing } from '../../src/presentation/rendu/crowd-spacing.js';

// Compare les traitements ciblés avec HEAD, ou avec un instantané JSON de leurs sources.
// Ce contrôle ne mesure pas les FPS du téléphone : la campagne complète a son propre validateur.
const reference = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : null;
const sourceOf = file => reference?.[file] ?? execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
const source = sourceOf('src/simulation/combat-state.js').match(/export function nearestEnemy\([\s\S]*?^}/m)?.[0];
assert.ok(source, 'La référence doit contenir la recherche de proximité.');
const originalNearest = new Function('canBeHit', 'combatDelta', 'stableIdOrder', 'enemies', 'invisibleToEnemies', 'visitNearbyNpcs', 'nearbyNpcs',
  `return (${source.replace('export ', '')});`)(canBeHit, combatDelta, stableIdOrder, enemies, invisibleToEnemies, visitNearbyNpcs, nearbyNpcs);
const crowdSource = sourceOf('src/presentation/rendu/crowd-spacing.js');
const { CrowdSpacing: OriginalCrowd } = await import('data:text/javascript;base64,' + Buffer.from(crowdSource).toString('base64'));
const sim = new GameSimulation(campaignConfig()); completePopulation(sim);
const state = sim.state;
state.npcs.forEach((npc, i) => {
  npc.role = 'MILITANT'; npc.faction_id = i % 2 ? 'melenchon' : 'le_pen';
  npc.x = i * state.world.length / state.npcs.length;
});
const timings = { proximity: { before: [], after: [] }, crowd: { before: [], after: [] } };
for (let run = 0; run < 6; run++) {
  const modes = run % 2 ? ['after', 'before'] : ['before', 'after'];
  let referenceTargets;
  for (const mode of modes) {
    const nearest = mode === 'before' ? originalNearest : nearestEnemy;
    const positions = state.npcs.map(npc => npc.x);
    let targets = 0;
    const start = performance.now();
    for (let frame = 0; frame < 300; frame++) {
      const step = () => {
        for (const npc of state.npcs) {
          const target = nearest(state, npc, 4);
          targets += target ? Number(target.id.split(':').at(-1)) || 1 : 0;
          npc.x = (npc.x + .05) % state.world.length;
          if (mode === 'after') updateNpcProximity(state, npc);
        }
      };
      if (mode === 'after') withNpcProximity(state, step); else step();
    }
    const ms = performance.now() - start;
    state.npcs.forEach((npc, i) => { npc.x = positions[i]; });
    if (referenceTargets !== undefined) assert.equal(targets, referenceTargets);
    else referenceTargets = targets;
    if (run) timings.proximity[mode].push(ms); // Premier passage réservé au démarrage du moteur JS.
  }
  for (const mode of modes) {
    const crowd = new (mode === 'before' ? OriginalCrowd : CrowdSpacing)();
    const start = performance.now();
    for (let frame = 0; frame < 3000; frame++) crowd.update(state, .5, frame * 1000 / 60);
    if (run) timings.crowd[mode].push(performance.now() - start);
  }
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const report = { population: state.npcs.length, repetitions: 5, reference: process.argv[2] || 'HEAD', treatments: {} };
for (const [name, values] of Object.entries(timings)) {
  const before = median(values.before), after = median(values.after);
  report.treatments[name] = { beforeMs: before, afterMs: after, savedPercent: (1 - after / before) * 100 };
}
await mkdir('artifacts/performance-campaign', { recursive: true });
await writeFile('artifacts/performance-campaign/optimizations.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { campaignConfig } from '../validate-campaign.mjs';
import { GameSimulation } from '../../src/simulation/game-simulation.js';
import { AIController, collectCommands } from '../../src/simulation/controllers.js';
import { chooseAIObjective } from '../../src/simulation/ai-strategy.js';
import { updateCombat } from '../../src/simulation/combat.js';
import { completePopulation } from '../../src/simulation/spawns.js';
import { withAIObservation } from '../../src/simulation/ai-observation.js';

// Le graphe de référence garde les autres évolutions locales (réglages, ultimes, sauvegardes…).
// Seuls les quatre fichiers optimisés sont remplacés par HEAD, ou par un instantané JSON fourni.
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'artifacts/performance-compute');
const files = ['ai-strategy.js', 'controllers.js', 'combat.js', 'combat-state.js'].map(name => `src/simulation/${name}`);
const supplied = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : null;
const sources = Object.fromEntries(files.map(file => [file, supplied?.[file]
  ?? execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' })]));
await mkdir(path.join(root, 'tmp'), { recursive: true });
const referenceRoot = await mkdtemp(path.join(root, 'tmp/compute-reference-'));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const hash = sim => createHash('sha256').update(sim.exportSnapshot()).digest('hex');

try {
  await cp(path.join(root, 'src/simulation'), path.join(referenceRoot, 'src/simulation'), { recursive: true });
  await mkdir(path.join(referenceRoot, 'src/network'), { recursive: true });
  await cp(path.join(root, 'src/network/state-stream.js'), path.join(referenceRoot, 'src/network/state-stream.js'));
  for (const [file, source] of Object.entries(sources)) await writeFile(path.join(referenceRoot, file), source);
  const load = file => import(pathToFileURL(path.join(referenceRoot, `src/simulation/${file}`)).href);
  const [{ GameSimulation: BeforeSimulation }, beforeController, beforeStrategy, beforeCombat] = await Promise.all([
    load('game-simulation.js'), load('controllers.js'), load('ai-strategy.js'), load('combat.js'),
  ]);
  const config = campaignConfig();
  const cases = {};
  function objectiveCase(opening) {
    const sim = new GameSimulation(config, 42); completePopulation(sim);
    sim.state.npcs.forEach((npc, i) => {
      npc.x = i * sim.state.world.length / sim.state.npcs.length;
      npc.role = ['NEUTRE', 'SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'][i % 4];
      npc.faction_id = npc.role === 'NEUTRE' ? null : ['melenchon', 'le_pen', 'philippe'][i % 3];
    });
    const candidates = sim.state.candidates.filter(c => !c.minor);
    for (const c of candidates) { c.headquarters_site_id = opening ? null : 'benchmark:hq'; c.ai_objective = null; }
    return mode => {
      const choose = mode === 'before' ? beforeStrategy.chooseAIObjective : chooseAIObjective;
      let result;
      const start = performance.now();
      for (let round = 0; round < 800; round++) {
        const decide = () => { result = candidates.map(c => choose(sim.state, config, c)); };
        if (mode === 'after') withAIObservation(sim.state, decide); else decide();
      }
      return { ms: performance.now() - start, result };
    };
  }
  function collisionCase() {
    return mode => {
      const sim = new GameSimulation(config, 42); completePopulation(sim);
      const state = sim.state, owner = state.candidates[0]; state.candidates = [owner];
      state.npcs.forEach((npc, i) => {
        npc.role = 'MILITANT'; npc.faction_id = 'le_pen'; npc.hidden_durability = 10000;
        npc.x = i * state.world.length / state.npcs.length;
      });
      state.projectiles = Array.from({ length: 80 }, (_, i) => ({
        id: `projectile:bench:${i}`, kind: 'VERBAL', owner_id: owner.id, faction_id: owner.faction_id,
        x: i * state.world.length / 80, direction: i % 2 ? -1 : 1,
        speed: 3 * sim.hz, remaining_range: 100000, damage: 0, knockback: 0, hit_ids: [],
      }));
      const positions = state.projectiles.map(p => p.x), projectiles = [...state.projectiles];
      const update = mode === 'before' ? beforeCombat.updateCombat : updateCombat;
      const start = performance.now();
      for (let frame = 0; frame < 250; frame++) {
        state.projectiles = projectiles;
        for (let i = 0; i < projectiles.length; i++) {
          const p = projectiles[i]; p.x = positions[i]; p.remaining_range = 100000; p.hit_ids.length = 0;
        }
        update(sim);
      }
      const ms = performance.now() - start;
      return { ms, result: hash(sim) };
    };
  }
  for (const [name, runCase] of Object.entries({ opening: objectiveCase(true), territory: objectiveCase(false), projectiles: collisionCase() })) {
    const times = { before: [], after: [] };
    for (let run = 0; run < 6; run++) {
      const results = {};
      for (const mode of run % 2 ? ['after', 'before'] : ['before', 'after']) {
        const result = runCase(mode); results[mode] = result.result;
        if (run) times[mode].push(result.ms);
      }
      assert.deepEqual(results.after, results.before, `Résultats identiques : ${name}`);
    }
    const beforeMs = median(times.before), afterMs = median(times.after);
    cases[name] = { beforeMs, afterMs, savedPercent: (1 - afterMs / beforeMs) * 100 };
    console.log(`${name} : ${beforeMs.toFixed(1)} → ${afterMs.toFixed(1)} ms, médianes de cinq passages.`);
  }
  const campaigns = [];
  config.balance.time.real_seconds_per_game_day = .6;
  for (const seed of [17, 42, 109]) {
    const results = {};
    for (const mode of seed % 2 ? ['before', 'after'] : ['after', 'before']) {
      const sim = new (mode === 'before' ? BeforeSimulation : GameSimulation)(config, seed);
      const controller = mode === 'before' ? beforeController : { AIController, collectCommands };
      const ai = new controller.AIController(config), hashes = [], commands = createHash('sha256');
      const start = performance.now();
      for (let step = 0; step < 6000 && sim.state.phase === 'CAMPAIGN'; step++) {
        const orders = controller.collectCommands(sim.state, ai, ai);
        commands.update(JSON.stringify(orders)); sim.step(orders);
        if (step % 300 === 299) hashes.push(hash(sim));
      }
      results[mode] = { ms: performance.now() - start, tick: sim.state.tick, hashes, final: hash(sim), commands: commands.digest('hex') };
    }
    assert.deepEqual(results.after.hashes, results.before.hashes, `États intermédiaires identiques : ${seed}`);
    assert.equal(results.after.final, results.before.final, `État final identique : ${seed}`);
    assert.equal(results.after.commands, results.before.commands, `Toutes les commandes identiques : ${seed}`);
    campaigns.push({ seed, ...results });
    console.log(`Campagne ${seed} : ${results.after.tick} pas, toutes les commandes et empreintes identiques.`);
  }
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'reference.json'), JSON.stringify(sources));
  await writeFile(path.join(output, 'compute.json'), JSON.stringify({ population: 200, repetitions: 5, cases, campaigns }, null, 2));
} finally {
  // Le chemin est créé sous tmp/ ; ne supprimer récursivement que cette référence de travail.
  if (path.dirname(referenceRoot) === path.join(root, 'tmp') && path.basename(referenceRoot).startsWith('compute-reference-'))
    await rm(referenceRoot, { recursive: true, force: true });
}

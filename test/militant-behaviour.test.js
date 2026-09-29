import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { validateConfig } from '../src/config.js';
import { updateProduction } from '../src/simulation/economy.js';
import { demobilizeUnit } from '../src/simulation/combat-state.js';
import { zoneAt } from '../src/simulation/world.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'].map(async f => JSON.parse(await readFile(new URL(f, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype });
const advance = (sim, n) => { for (let i = 0; i < n; i++) sim.step(); };
const HOME = 'site:campagne_b'; // sous-zone 10 : le territoire couvre campagne_a, campagne_b et campagne_c.

function setup() {
  const cfg = structuredClone(config);
  cfg.layout.neutral_population_growth.enabled = false;
  const sim = new GameSimulation(cfg);
  sim.state.npcs = []; sim.state.ai_enabled = false;
  // Les candidats restent loin et ne font pas campagne : seuls les militants agissent.
  sim.state.candidates.forEach(c => { c.x = 50; c.campaign_active = false; c.interaction_active = false; });
  const home = sim.state.buildings.find(b => b.id === HOME);
  home.owner_id = 'melenchon'; home.state = 'ACTIVE'; home.level = 1;
  return { sim, home };
}
function unit(sim, role, x, faction = 'melenchon') {
  const npc = sim.spawn(zoneAt(sim.state.world, x), x, false);
  npc.role = role; npc.faction_id = role === 'NEUTRE' ? null : faction;
  npc.roam_target_x = x; npc.roam_wait_ticks = 1000000;
  if (role === 'MILITANT') { npc.hidden_durability = config.balance.physical_units.militant.hidden_durability; npc.home_site_id = HOME; }
  if (role === 'SYMPATHISANT') { npc.next_donation_tick = 1000000; }
  return npc;
}

test('Seul, un militant attend près de sa permanence et ignore les neutres hors de son territoire', () => {
  const { sim, home } = setup();
  const militant = unit(sim, 'MILITANT', 280);
  const far = unit(sim, 'NEUTRE', 330); // retraites_b : deux sous-zones plus loin
  advance(sim, 900);
  assert.ok(Math.abs(militant.x - home.x) < 1, 'le militant revient à sa permanence');
  assert.equal(militant.task.target_id, null);
  assert.equal(far.role, 'NEUTRE');
});

test('Un neutre dans une sous-zone voisine attire le militant, qui rentre ensuite', () => {
  const { sim, home } = setup();
  const militant = unit(sim, 'MILITANT', home.x);
  const near = unit(sim, 'NEUTRE', 225); // campagne_a, limitrophe
  advance(sim, 30);
  assert.equal(militant.task.target_id, near.id);
  advance(sim, 800);
  assert.equal(near.role, 'SYMPATHISANT');
  assert.ok(Math.abs(militant.x - home.x) < 1, 'retour à la permanence après la conversion');
});

test('Trois militants désœuvrés forment un groupe et partent sans faire demi-tour', () => {
  const { sim, home } = setup();
  const militants = [0, 1, 2].map(i => unit(sim, 'MILITANT', home.x + i * 0.2));
  const target = unit(sim, 'NEUTRE', 330);
  advance(sim, 60);
  const id = militants[0].expedition?.id;
  assert.ok(id, 'le groupe est formé');
  assert.ok(militants.every(m => m.expedition?.id === id && m.expedition.direction === 1));
  advance(sim, 60);
  // Un nouveau neutre apparaît dans le territoire, derrière le groupe : il ne l'interrompt pas.
  const behind = unit(sim, 'NEUTRE', 230);
  advance(sim, 60);
  assert.ok(militants.every(m => m.expedition?.id === id && m.task.target_id !== behind.id));
  advance(sim, 1500);
  assert.equal(target.role, 'SYMPATHISANT');
  assert.ok(militants.every(m => m.expedition?.id === id), 'le groupe poursuit sa route');
});

test('Deux militants seulement ne partent pas en expédition', () => {
  const { sim, home } = setup();
  const militants = [0, 1].map(i => unit(sim, 'MILITANT', home.x + i * 0.2));
  unit(sim, 'NEUTRE', 330);
  advance(sim, 200);
  assert.ok(militants.every(m => !m.expedition && Math.abs(m.x - home.x) < 1));
});

test('Le groupe se dissout quand il perd un membre et les survivants rentrent', () => {
  const { sim, home } = setup();
  const militants = [0, 1, 2].map(i => unit(sim, 'MILITANT', home.x + i * 0.2));
  unit(sim, 'NEUTRE', 400);
  advance(sim, 200);
  assert.ok(militants.every(m => m.expedition));
  demobilizeUnit(sim, militants[0]);
  advance(sim, 2);
  assert.ok(militants.slice(1).every(m => !m.expedition));
  advance(sim, 1500);
  assert.ok(militants.slice(1).every(m => m.role !== 'MILITANT' || Math.abs(m.x - home.x) < 1));
});

test('Un sympathisant ne va chercher un tract que dans la sous-zone du point d’impression ou une voisine', () => {
  const { sim, home } = setup();
  const far = unit(sim, 'SYMPATHISANT', 300); // retraites_a : deux sous-zones plus loin
  const order = { id: 'order:test', faction_id: 'melenchon', purchased_tick: 0, cost: 0, assigned_npc_id: null, state: 'QUEUED', production_elapsed_ticks: 0 };
  home.queue.push(order);
  updateProduction(sim);
  assert.equal(order.assigned_npc_id, null);
  const near = unit(sim, 'SYMPATHISANT', 270); // campagne_c, limitrophe
  updateProduction(sim);
  assert.equal(order.assigned_npc_id, near.id);
  assert.equal(far.task, null);
});

test('Affichage : deux PNJ immobiles superposés sont écartés, ceux qui marchent non', async () => {
  const { crowdTargets } = await import('../src/presentation/crowd-spacing.js');
  const state = { npcs: [
    { id: 'npc:1', x: 10, moving: false }, { id: 'npc:2', x: 10, moving: false },
    { id: 'npc:3', x: 20, moving: true }, { id: 'npc:4', x: 20, moving: true },
  ] };
  const targets = crowdTargets(state, 0.5);
  assert.equal(targets.get('npc:1'), -0.25);
  assert.equal(targets.get('npc:2'), 0.25);
  assert.equal(targets.has('npc:3'), false);
  assert.equal(state.npcs[0].x, 10, 'la simulation n’est pas modifiée');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { npcEntryProgress, entryPath } from '../src/presentation/personnages/npc-entry.js';
import { NPC_ENTRY_SECONDS } from '../src/simulation/npc-entry.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';

test('persuasion : attendre la fin exacte de l’arrivée, même après sauvegarde', () => {
  for (const militant of [false, true]) {
    const config = campaignConfig(); config.balance.minor_candidates.enabled = false;
    const sim = new GameSimulation(config, 42);
    sim.state.npcs = []; sim.state.tick = 100;
    const zone = sim.state.world.subzones[0], candidate = sim.state.candidates[0];
    sim.state.candidates.forEach(c => { c.campaign_active = false; });
    candidate.x = zone.center; candidate.axis = 0; candidate.moving = false;
    let actor = candidate;
    if (militant) {
      actor = sim.spawn(zone, candidate.x, false);
      actor.role = 'MILITANT'; actor.faction_id = candidate.faction_id;
    } else candidate.campaign_active = true;
    const npc = sim.spawn(zone, actor.x + 0.2);
    const arrivalTick = npc.entry_tick + Math.ceil(NPC_ENTRY_SECONDS * sim.hz);
    for (const tick of [npc.entry_tick, arrivalTick - 1]) {
      sim.state.tick = tick; sim.updatePersuasion();
      assert.equal(npc.persuasion, null);
      assert.deepEqual(actor.persuasion_target_ids, []);
      assert.ok(npcEntryProgress(sim.state, sim.hz).has(npc.id));
    }
    const copy = new GameSimulation(config); copy.importSnapshot(sim.exportSnapshot());
    for (const game of [sim, copy]) {
      game.updatePersuasion();
      assert.equal(game.state.npcs.find(n => n.id === npc.id).persuasion, null);
      game.state.tick = arrivalTick; game.updatePersuasion();
      const target = game.state.npcs.find(n => n.id === npc.id);
      assert.equal(target.persuasion.actor_id, actor.id);
      assert.equal(target.persuasion.elapsed_ticks, 1);
      assert.equal(npcEntryProgress(game.state, game.hz).has(npc.id), false);
    }
  }
});

test('un PNJ récemment apparu arrive du bas puis rejoint le sol', () => {
  // Le journal d'évènements peut avoir oublié l'apparition : seul l'instant noté sur le PNJ compte.
  const state = { tick: 30, events: [], npcs: [
    { id: 'npc:1', entry_tick: 0 }, { id: 'npc:2', entry_tick: 20 }, { id: 'npc:3', entry_tick: null },
  ] };
  const progress = npcEntryProgress(state, 20, 0, 2);
  assert.equal(progress.get('npc:1'), 0.75);
  assert.equal(progress.get('npc:2'), 0.25);
  assert.equal(progress.has('npc:3'), false);
  assert.equal(npcEntryProgress({ ...state, tick: 40 }, 20, 0, 2).has('npc:1'), false);
  const start = entryPath(0, 0), middle = entryPath(0.5, 0), end = entryPath(1, 0.3);
  assert.deepEqual([start.lift, start.side], [1, 1]);
  assert.deepEqual([end.lift, end.side, end.bob], [0, 0, 0]);
  // Courbe : à mi-chemin, il est déjà plus monté qu'il ne s'est rapproché sur le côté.
  assert.ok(middle.lift < middle.side);
  assert.ok(entryPath(0.5, 0.12).bob > 0);
});

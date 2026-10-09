import test from 'node:test';
import assert from 'node:assert/strict';
import { npcEntryProgress, entryPath } from '../src/presentation/personnages/npc-entry.js';

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

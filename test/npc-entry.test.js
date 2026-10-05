import test from 'node:test';
import assert from 'node:assert/strict';
import { npcEntryProgress, entryLift } from '../src/presentation/npc-entry.js';

test('un PNJ récemment apparu arrive du bas puis rejoint le sol', () => {
  const state = { tick: 30, events: [
    { type: 'NeutralSpawned', npc_id: 'npc:1', tick: 0 },
    { type: 'NpcConverted', npc_id: 'npc:1', tick: 25 },
    { type: 'NeutralSpawned', npc_id: 'npc:2', tick: 20 },
  ] };
  const progress = npcEntryProgress(state, 20, 0, 2);
  assert.equal(progress.get('npc:1'), 0.75);
  assert.equal(progress.get('npc:2'), 0.25);
  assert.equal(npcEntryProgress({ ...state, tick: 40 }, 20, 0, 2).has('npc:1'), false);
  assert.equal(entryLift(0), 1);
  assert.equal(entryLift(1), 0);
  assert.ok(entryLift(0.5) < 0.5 && entryLift(0.5) > 0);
});

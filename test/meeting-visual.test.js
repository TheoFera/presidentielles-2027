import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { buildingAssetId } from '../src/presentation/illustrated-buildings.js';
import { drawMeetingForeground, isOnMeetingStage } from '../src/presentation/electoral.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';

const config = campaignConfig();

test('un meeting avec un sprite distinct est présent dans chaque biome', async () => {
  for (const seed of [1, 42, 2027]) {
    const state = new GameSimulation(config, seed).state;
    const meetings = state.buildings.filter(building => building.type === 'meeting');
    assert.equal(meetings.length, 6);
    assert.equal(new Set(meetings.map(building => building.biome_id)).size, 6);
    assert.equal(new Set(meetings.map(building => buildingAssetId(building, state.world))).size, 6);
    for (const meeting of meetings) {
      const id = buildingAssetId(meeting, state.world);
      assert.ok(visualManifest[id], id);
      await access(new URL(visualManifest[id].file));
    }
  }
});

test('le joueur au sol reste devant la scène ; sur le podium, le bord et les poteaux passent devant lui', () => {
  const state = new GameSimulation(config, 42).state;
  const meeting = state.buildings.find(building => building.type === 'meeting');
  const candidate = state.candidates[0];
  const calls = [];
  const sprite = { naturalWidth: 1122, naturalHeight: 1402 };
  const ctx = {
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    drawImage(...args) { calls.push(args); },
  };
  const renderer = {
    ctx, config, metrics: { characterHeight: 100, groundY: 500 },
    screenX: x => x,
    assets: { get: id => id === buildingAssetId(meeting, state.world) ? sprite : null },
  };
  candidate.x = meeting.x;
  assert.equal(isOnMeetingStage(candidate, config), false);
  drawMeetingForeground(renderer, state);
  assert.equal(calls.length, 0);

  candidate.podium_site_id = meeting.id;
  candidate.combat.height = config.balance.buildings.meeting.podium_height;
  assert.equal(isOnMeetingStage(candidate, config), true);
  drawMeetingForeground(renderer, state);
  assert.equal(calls.length, 3, 'bord avant et deux poteaux redessinés après le candidat sur scène');
  assert.ok(calls[0][2] > 0, 'le bord avant ne reprend que la partie basse du sprite');
  candidate.podium_site_id = null;
  candidate.combat.height = 0;
  assert.equal(isOnMeetingStage(candidate, config), false);

  calls.length = 0;
  candidate.combat.jump_tick = state.tick;
  candidate.combat.height = config.balance.buildings.meeting.podium_height + 0.1;
  assert.equal(isOnMeetingStage(candidate, config, state), true);
  drawMeetingForeground(renderer, state);
  assert.equal(calls.length, 3, 'le saut passe aussi derrière les éléments avant');
  candidate.x += config.balance.buildings.meeting.podium_half_width + 0.1;
  assert.equal(isOnMeetingStage(candidate, config, state), false);
});

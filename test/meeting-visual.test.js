import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { buildingAssetId } from '../src/presentation/carte/illustrated-buildings.js';
import { drawMeetingForeground, isOnMeetingStage, meetingSpriteFrame } from '../src/presentation/carte/electoral.js';
import { compositionMetrics } from '../src/presentation/rendu/renderer.js';
import { ringDelta } from '../src/simulation/world.js';
import { visualManifest } from '../src/presentation/rendu/visual-manifest.js';

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
      assert.ok(visualManifest[id.replace('meeting_stage', 'meeting_micro')], 'micro à part');
      await access(new URL(visualManifest[id].file));
    }
  }
});

test('le joueur au sol reste devant ; sur scène et pendant le saut, tous les accessoires passent devant lui', () => {
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
    ctx, config, metrics: { characterHeight: 100, groundY: 500, pixelsPerUnit: 40 },
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
  assert.equal(calls.length, 2, 'haut et plancher sont superposés après le candidat');
  assert.ok(calls.every(call => call.length === 9 && call[0] === sprite));
  candidate.podium_site_id = null;
  candidate.combat.height = 0;
  assert.equal(isOnMeetingStage(candidate, config), false);

  calls.length = 0;
  candidate.combat.jump_tick = state.tick;
  candidate.combat.height = config.balance.buildings.meeting.podium_height + 0.1;
  assert.equal(isOnMeetingStage(candidate, config, state), true);
  drawMeetingForeground(renderer, state);
  assert.equal(calls.length, 2, 'le saut passe aussi derrière les éléments avant');
  candidate.x += config.balance.buildings.meeting.podium_half_width + 0.1;
  assert.equal(isOnMeetingStage(candidate, config, state), false);
});

test('les bords visibles des six estrades correspondent aux limites physiques, même après changement de zoom', async () => {
  const state = new GameSimulation(config, 42).state;
  for (const meeting of state.buildings.filter(building => building.type === 'meeting')) {
    const id = buildingAssetId(meeting, state.world);
    const png = await readFile(new URL(visualManifest[id].file));
    const sprite = { naturalWidth: png.readUInt32BE(16), naturalHeight: png.readUInt32BE(20) };
    for (const zoom of [0.84, 1, 1.18]) {
      const cfg = structuredClone(config);
      cfg.balance.camera.default_zoom = zoom;
      const metrics = compositionMetrics(cfg, cfg.prototype.presentation.reference_width, cfg.prototype.presentation.reference_height);
      const renderer = { config: cfg, metrics, assets: { get: () => sprite },
        screenX: x => 480 + ringDelta(meeting.x, x, state.world.length) * metrics.pixelsPerUnit };
      const frame = meetingSpriteFrame(renderer, state, meeting);
      const halfWidth = cfg.balance.buildings.meeting.podium_half_width;
      for (const [side, edge] of [[-1, frame.platformLeft], [1, frame.platformRight]]) {
        assert.ok(Math.abs(frame.left + frame.width * edge - renderer.screenX(meeting.x + side * halfWidth)) < 1e-8, `${id} : bord ${side}`);
      }
      assert.ok(Math.abs(frame.width / frame.baseHeight - sprite.naturalWidth / sprite.naturalHeight) < 1e-8, 'le plancher garde ses proportions');
      assert.ok(frame.upperHeight > frame.baseHeight * frame.deckSplit, 'les poteaux et la banderole sont relevés');
      assert.ok(frame.top >= 0, 'la partie haute de la scène reste visible');
      assert.ok(frame.deckY < frame.feetY, `${id} : les pieds sont sur le dessus du plancher, pas derrière son bord`);
      assert.ok(Math.abs(frame.feetY - (metrics.groundY - cfg.balance.buildings.meeting.podium_height * metrics.characterHeight)) < 1e-8);
    }
  }
});

test('le candidat peut atterrir et marcher aux deux extrémités de chaque estrade, puis tombe au-delà', () => {
  const cfg = structuredClone(config);
  cfg.balance.campaign_events.event_enabled = false;
  const sim = new GameSimulation(cfg, 42);
  sim.state.ai_enabled = false;
  sim.state.npcs = [];
  const candidate = sim.state.candidates[0];
  for (const other of sim.state.candidates.slice(1)) other.campaign_active = false;
  const halfWidth = cfg.balance.buildings.meeting.podium_half_width;
  for (const meeting of sim.state.buildings.filter(building => building.type === 'meeting')) {
    for (const side of [-1, 1]) {
      candidate.x = meeting.x + side * (halfWidth - 0.05);
      candidate.podium_site_id = null;
      candidate.combat.height = 0;
      candidate.axis = 0;
      sim.step([{ type: 'Jump', candidateId: candidate.id }]);
      for (let i = 0; i < sim.secondsToTicks(cfg.balance.candidate_combat.jump_duration_seconds); i++) sim.step();
      assert.equal(candidate.podium_site_id, meeting.id, `atterrissage au bord ${side} de ${meeting.biome_id}`);
      assert.equal(candidate.combat.height, cfg.balance.buildings.meeting.podium_height);
      sim.step([{ type: 'Move', candidateId: candidate.id, axis: -side }]);
      assert.equal(candidate.podium_site_id, meeting.id, 'un pas vers le centre reste sur scène');
      candidate.axis = 0;
      candidate.x = meeting.x + side * (halfWidth + 0.05);
      sim.step();
      assert.equal(candidate.podium_site_id, null, 'chute seulement au-delà du bord');
      assert.equal(candidate.combat.height, 0);
    }
  }
});

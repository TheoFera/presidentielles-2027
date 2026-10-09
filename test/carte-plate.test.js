import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { ringDelta } from '../src/simulation/world.js';
import { plateSignFrame } from '../src/presentation/carte/carte-plate.js';
import { readPng } from '../scripts/lib/png.mjs';

test('Les textes des trois devantures restaurées restent dans leurs panneaux peints, au zoom et sur la boucle', () => {
  const { state } = new GameSimulation(structuredClone(config), 42);
  const tiles = new Map([
    ['riches_b', readPng(new URL('../assets/images/carte/tuile-17-riches-b.png', import.meta.url))],
    ['riches_c', readPng(new URL('../assets/images/carte/tuile-18-riches-c.png', import.meta.url))],
  ]);
  for (const id of ['site:riches_b', 'site:riches_c', 'site:riches_c:institut_sondage']) {
    const building = state.buildings.find(b => b.site_id === id);
    const zone = state.world.subzones.find(z => z.id === building.subzone_id);
    const image = tiles.get(zone.id), position = building.x;
    for (const k of [0.5, 1.25]) {
      const pixelsPerUnit = k * 1920 / zone.width;
      const renderer = {
        fixedWorldState: state, metrics: { groundY: 700, pixelsPerUnit },
        screenX: x => 400 + ringDelta(1, x, state.world.length) * pixelsPerUnit,
      };
      const frame = plateSignFrame(renderer, building);
      const x = (frame.x - renderer.screenX(zone.center - zone.width / 2)) / k;
      const y = 1004 + (frame.y - renderer.metrics.groundY) / k;
      // Échantillonne la vraie peinture : un ancien placement tombe dans la vitrine.
      for (const offset of [-0.25, 0, 0.25]) {
        const px = Math.round(x + frame.w / k * offset), py = Math.round(y);
        const p = (py * image.width + px) * 4;
        assert.ok(image.data[p] > 200 && image.data[p + 1] > 180 && image.data[p + 2] > 130,
          `${id} : texte hors du panneau crème (${px}, ${py})`);
        assert.equal(image.data[p + 3], 255);
      }
      assert.equal(frame.painted, true);
      assert.equal(building.x, position, 'La restauration ne déplace pas le site de gameplay');
    }
  }
});

test('Les autres bâtiments conservent leur placement de panneau habituel', () => {
  const { state } = new GameSimulation(structuredClone(config), 42);
  const building = state.buildings.find(b => b.site_id === 'site:paris_a');
  const zone = state.world.subzones.find(z => z.id === building.subzone_id);
  const renderer = {
    fixedWorldState: state, metrics: { groundY: 700, pixelsPerUnit: 1920 / zone.width },
    screenX: x => x * 10,
  };
  assert.deepEqual(plateSignFrame(renderer, building), {
    x: renderer.screenX(building.x), y: 482, w: 220, h: 44, painted: true,
  });
});

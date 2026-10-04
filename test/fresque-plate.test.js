import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TILE, plateTiles } from '../scripts/fresque-plate-gabarits.mjs';
import { seamScore, transparentPixels } from '../scripts/fresque-plate-raccords.mjs';

const layout = JSON.parse(readFileSync(new URL('../Présidentielles 2027/world_layout.json', import.meta.url), 'utf8'));

function image(width, height, color) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [r, g, b] = color(x, y), i = (y * width + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return { width, height, data };
}

test('les 18 tuiles suivent l’ordre de la carte et placent les portes en pixels', () => {
  const tiles = plateTiles(layout);
  assert.equal(tiles.length, 18);
  assert.equal(tiles[0].file, 'tuile-01-paris-a.png');
  assert.equal(tiles[17].file, 'tuile-18-riches-c.png');
  assert.equal(tiles[17].masterLeft, 17 * TILE.width);
  assert.equal(tiles[0].buildings[0].x, Math.round(0.6738 * TILE.width));
  for (const tile of tiles) for (const b of tile.buildings) assert.ok(b.x > 0 && b.x < TILE.width, `${tile.id} : porte hors tuile`);
  assert.deepEqual(tiles.filter(t => t.meeting).map(t => t.id), ['paris_b', 'banlieue_b', 'periurbain_b', 'campagne_b', 'retraites_b', 'riches_b']);
});

test('une coupe dans un dessin continu est invisible, une rupture est détectée', () => {
  const smooth = x => [x % 256, (x * 2) % 256, 120];
  const left = image(60, 20, x => smooth(x)), right = image(60, 20, x => smooth(x + 60));
  assert.equal(seamScore(left, right, 20).visible, false);
  const broken = image(60, 20, () => [250, 10, 10]);
  assert.equal(seamScore(left, broken, 20).visible, true);
});

test('la moindre transparence est comptée', () => {
  const tile = image(10, 10, () => [100, 100, 100]);
  assert.equal(transparentPixels(tile), 0);
  tile.data[3] = 200;
  assert.equal(transparentPixels(tile), 1);
});

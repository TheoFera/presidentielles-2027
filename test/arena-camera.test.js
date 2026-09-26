import test from 'node:test';
import assert from 'node:assert/strict';
import { arenaCamera } from '../src/presentation/match.js';

test('le plateau zoome davantage lorsque les combattants restent proches', () => {
  const camera = arenaCamera([{ x: 7 }, { x: 14 }], 1120, 28);

  assert.equal(camera.center, 10.5);
  assert.equal(camera.pixelsPerUnit, 58);
});

test('le plateau recule juste assez pour conserver des combattants éloignés à l’écran', () => {
  const camera = arenaCamera([{ x: 2 }, { x: 26 }], 1120, 28);

  assert.equal(camera.center, 14);
  assert.equal(camera.pixelsPerUnit, 40);
});

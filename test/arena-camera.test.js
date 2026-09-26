import test from 'node:test';
import assert from 'node:assert/strict';
import { arenaScreenX } from '../src/presentation/match.js';

test('le plateau conserve une projection fixe, indépendante de la position de l’adversaire', () => {
  const playerX = arenaScreenX(7, 1120, 28);
  const journalistNearX = arenaScreenX(14, 1120, 28);
  const journalistFarX = arenaScreenX(21, 1120, 28);

  assert.equal(playerX, 280);
  assert.equal(journalistNearX - playerX, 280);
  assert.equal(journalistFarX - playerX, 560);
});

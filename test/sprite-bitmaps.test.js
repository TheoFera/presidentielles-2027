import test from 'node:test';
import assert from 'node:assert/strict';
import { installSpriteDrawing, spriteScaleFor } from '../src/presentation/rendu/sprite-bitmaps.js';

test('Les planches sont réduites de moitié sur téléphone, pas sur une grande tablette', () => {
  assert.equal(spriteScaleFor(812), 0.5);
  assert.equal(spriteScaleFor(400), 0.5);
  assert.ok(spriteScaleFor(1200) > 0.7 && spriteScaleFor(1200) <= 1);
  assert.equal(spriteScaleFor(2400), 1);
});

test('drawImage garde les coordonnées d’origine pour une planche réduite', () => {
  const calls = [];
  const proto = { drawImage(...args) { calls.push(args.slice(1)); } };
  installSpriteDrawing(proto);
  installSpriteDrawing(proto); // une seule installation
  const ctx = Object.create(proto);
  const reduced = { spriteScaleX: 0.5, spriteScaleY: 0.25, naturalWidth: 400, naturalHeight: 200 };
  ctx.drawImage(reduced, 100, 40, 80, 20, 1, 2, 3, 4);
  ctx.drawImage(reduced, 5, 6);
  ctx.drawImage(reduced, 5, 6, 7, 8);
  const ordinary = { naturalWidth: 400, naturalHeight: 200 };
  ctx.drawImage(ordinary, 100, 40, 80, 20, 1, 2, 3, 4);
  ctx.drawImage(ordinary, 5, 6);
  assert.deepEqual(calls, [
    [50, 10, 40, 5, 1, 2, 3, 4], // zone source convertie, destination inchangée
    [5, 6, 400, 200], // image entière : taille d'origine à l'écran
    [5, 6, 7, 8],
    [100, 40, 80, 20, 1, 2, 3, 4],
    [5, 6],
  ]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { installSpriteDrawing, spriteScaleFor, spriteBitmapLoader, spriteBitmapsWanted, spriteReductionWanted } from '../src/presentation/rendu/sprite-bitmaps.js';
import { prepareAtlasFrames, prepareAtlasBitmaps, preparedDrawingSources, releasePreparedAtlasSource } from '../src/presentation/personnages/minor-sprite-images.js';

function globals(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
}

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

test('Le chargeur réduit les animations, garde leurs dimensions logiques et libère la grande image', async t => {
  let closed = 0;
  const full = { width: 1000, height: 600, close() { closed++; } };
  const reduced = { width: 500, height: 300 };
  globals(t, {
    fetch: async () => ({ ok: true, blob: async () => 'source' }),
    createImageBitmap: async (source, options) => {
      if (source === 'source') return full;
      assert.equal(source, full);
      assert.deepEqual(options, { resizeWidth: 500, resizeHeight: 300, resizeQuality: 'high' });
      return reduced;
    },
  });
  const image = await spriteBitmapLoader(.5)('character-minor-attal-combat', '/animation.png');
  assert.equal(image, reduced);
  assert.equal(image.naturalWidth, 1000); assert.equal(image.naturalHeight, 600);
  assert.equal(image.spriteScaleX, .5); assert.equal(image.spriteScaleY, .5);
  assert.equal(closed, 1);
  assert.equal(await spriteBitmapLoader(.5)('npc-banlieue-1', '/habitant.png'), full);
  assert.equal(closed, 1, 'Un petit habitant reste à sa résolution originale');
});

test('Un navigateur qui ignore la réduction utilise le canevas de secours et libère ses copies', async t => {
  let closed = 0, drawn;
  const full = { width: 1000, height: 600, close() { closed++; } };
  const ignored = { ...full };
  const canvas = { getContext: () => ({ drawImage: (...args) => { drawn = args; } }) };
  const reduced = { width: 500, height: 300 };
  globals(t, {
    document: { createElement: () => canvas },
    fetch: async () => ({ ok: true, blob: async () => 'source' }),
    createImageBitmap: async source => source === 'source' ? full : source === full ? ignored : reduced,
  });
  assert.equal(await spriteBitmapLoader(.5)('character-test', '/animation.png'), reduced);
  assert.deepEqual(drawn, [full, 0, 0, 500, 300]);
  assert.equal(closed, 2);
  assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
});

test('Un échec de conversion conserve une image ordinaire utilisable, sans fuite de la grande copie', async t => {
  let closed = 0;
  const full = { width: 1000, height: 600, close() { closed++; } };
  globals(t, {
    document: { createElement() { throw new Error('Canevas indisponible'); } },
    fetch: async () => ({ ok: true, blob: async () => 'source' }),
    createImageBitmap: async source => {
      if (source === 'source') return full;
      throw new Error('Conversion indisponible');
    },
  });
  const fallback = { set src(url) { assert.equal(url, '/animation.png'); queueMicrotask(() => this.onload()); } };
  assert.equal(await spriteBitmapLoader(.5, () => fallback)('character-test', '/animation.png'), fallback);
  assert.equal(closed, 1);
  assert.equal(fallback.decoding, 'async');
});

test('Les découpes gardent la réduction du téléphone et leurs canevas sont libérés après conversion', async t => {
  const canvases = [], draws = [];
  const proto = { drawImage: (...args) => draws.push(args) };
  installSpriteDrawing(proto);
  globals(t, {
    document: { createElement: () => {
      const canvas = { getContext: () => Object.assign(Object.create(proto), {
        getImageData: () => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4) }),
        putImageData() {},
      }) };
      canvases.push(canvas); return canvas;
    } },
    createImageBitmap: async canvas => ({ width: canvas.width, height: canvas.height }),
  });
  let closed = 0;
  const image = { spriteScaleX: .5, spriteScaleY: .5, naturalWidth: 400, naturalHeight: 300, close() { closed++; } };
  const atlas = { frames: [[20, 10, 80, 100, 60, 110]] };
  const frames = prepareAtlasFrames(image, atlas);
  assert.equal(canvases.length, 1, 'Aucune copie nettoyée de la planche entière');
  assert.equal(frames[0].width, 40); assert.equal(frames[0].height, 50);
  assert.deepEqual(draws[0].slice(1), [10, 5, 40, 50, 0, 0, 40, 50]);
  assert.equal(await prepareAtlasBitmaps(image, atlas), frames);
  assert.deepEqual(frames[0], { width: 40, height: 50 });
  assert.equal(canvases[0].width, 0); assert.equal(canvases[0].height, 0);
  assert.deepEqual([...preparedDrawingSources(image)], frames, 'Seules les petites textures utilisées sont envoyées au GPU');
  const ordinary = {};
  assert.deepEqual(preparedDrawingSources(ordinary), [ordinary]);
  assert.equal(prepareAtlasFrames(image, atlas), frames);
  await prepareAtlasBitmaps(image, atlas);
  assert.equal(canvases.length, 1, 'La préparation déjà terminée est réutilisée');
  const prepared = releasePreparedAtlasSource(image);
  assert.equal(closed, 1);
  assert.equal(prepared.naturalWidth, 400); assert.equal(prepared.naturalHeight, 300);
  assert.equal(prepareAtlasFrames(prepared, atlas), frames, 'Les repères donnent encore accès aux découpes après libération de la source');
  assert.deepEqual([...preparedDrawingSources(prepared)], frames);
  assert.equal(canvases.length, 1);
});

test('Une découpe reste dessinable si la conversion en bitmap est refusée', async t => {
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(16) }), putImageData() {} }) };
  globals(t, { document: { createElement: () => canvas }, createImageBitmap: async () => { throw new Error('Non pris en charge'); } });
  const frames = await prepareAtlasBitmaps({}, { frames: [[0, 0, 2, 2, 1, 2]] });
  assert.equal(frames[0], canvas);
  assert.equal(canvas.width, 2); assert.equal(canvas.height, 2);
});

test('Planches réduites dans l’application et sur iPhone/iPad, réglables depuis l’adresse', () => {
  const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 };
  const ipad = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 };
  const android = { userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Linux armv8l', maxTouchPoints: 5 };
  const mac = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 };
  assert.equal(spriteReductionWanted(false, '', iphone), true);
  assert.equal(spriteReductionWanted(false, '', ipad), true);
  assert.equal(spriteReductionWanted(false, '', android), false);
  assert.equal(spriteReductionWanted(true, '', android), true);
  assert.equal(spriteReductionWanted(false, '', mac), false);
  assert.equal(spriteReductionWanted(false, '?reduction=0', iphone), false);
  assert.equal(spriteReductionWanted(false, '?salon=AB12&reduction=1', android), true);
  assert.equal(spriteBitmapsWanted('', iphone), true);
  assert.equal(spriteBitmapsWanted('?bitmaps=0', android), false);
});

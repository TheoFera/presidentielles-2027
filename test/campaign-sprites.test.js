import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { characterAssetId } from '../src/presentation/illustrated-characters.js';
import { styleSpriteId } from '../src/presentation/campaign-style-art.js';

function alphaStats(png) {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), type = png[25];
  assert.equal(png[24], 8); assert.ok([4, 6].includes(type), 'Le PNG doit posséder un vrai canal alpha');
  const channels = type === 6 ? 4 : 2, stride = width * channels, chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), kind = png.toString('ascii', offset + 4, offset + 8);
    if (kind === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks)); let previous = new Uint8Array(stride), transparent = 0, opaque = 0, offset = 0;
  const paeth = (a,b,c) => { const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++], row = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0, up = previous[x], corner = x >= channels ? previous[x - channels] : 0;
      row[x] = (raw[offset++] + [0,left,up,Math.floor((left+up)/2),paeth(left,up,corner)][filter]) & 255;
    }
    for (let x = channels - 1; x < stride; x += channels) { if (row[x] < 10) transparent++; if (row[x] > 240) opaque++; }
    previous = row;
  }
  return { width, height, transparent: transparent / (width * height), opaque: opaque / (width * height) };
}

const styles = Object.values(CAMPAIGN_STYLES).flat();
const ids = [...styles.map(s => styleSpriteId(s.id)), ...['melenchon-gilet-jaune','philippe-super-europeiste','bardella','zemmour','encapuchonne'].map(id => `character-ultimate-${id}`)];
test('Neuf PNG de styles distincts et cinq sprites d’ultimes réellement transparents', async () => {
  assert.equal(new Set(ids).size, 14);
  const files = new Set();
  for (const id of ids) {
    const entry = visualManifest[id]; assert.ok(entry, `Visuel absent du manifeste : ${id}`);
    files.add(entry.file); const stats = alphaStats(await readFile(new URL(entry.file)));
    assert.ok(stats.height >= 384 && stats.height <= 512, id);
    assert.ok(stats.transparent > .08 && stats.opaque > .2, `${id} : détourage incomplet ou silhouette vide`);
  }
  assert.equal(files.size, 14);
});

test('Chaque style charge son PNG, transformations puis retour au sprite du style', () => {
  for (const [faction, list] of Object.entries(CAMPAIGN_STYLES)) for (const style of list) {
    const candidate = { role: 'CANDIDAT', faction_id: faction, id: `candidate:${faction}`, current_campaign_style: style.id };
    assert.equal(characterAssetId(candidate, { tick: 10 }), styleSpriteId(style.id));
    candidate.ultimate_effect = { kind: 'EUROPE', expires_tick: 20 };
    assert.equal(characterAssetId(candidate, { tick: 10 }), 'character-ultimate-philippe-super-europeiste');
    assert.equal(characterAssetId(candidate, { tick: 20 }), styleSpriteId(style.id));
    candidate.ultimate_effect = null; candidate.bardella_form = true;
    assert.equal(characterAssetId(candidate, { tick: 30 }), 'character-ultimate-bardella');
    candidate.bardella_form = false;
    assert.equal(characterAssetId(candidate, { tick: 30 }), styleSpriteId(style.id));
  }
});

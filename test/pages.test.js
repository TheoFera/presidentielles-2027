import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { buildPages } from '../scripts/build-pages.mjs';
import { validateConfig } from '../src/config.js';

test('Le paquet GitHub Pages contient uniquement le jeu et charge ses réglages depuis un sous-chemin', async t => {
  const output = await mkdtemp(join(tmpdir(), 'presidentielles-pages-'));
  t.after(async () => {
    assert.equal(dirname(output), resolve(tmpdir()));
    assert.ok(output.split(/[\\/]/).at(-1).startsWith('presidentielles-pages-'));
    await rm(output, { recursive: true });
  });
  await buildPages(output);
  assert.deepEqual((await readdir(output)).sort(), ['Présidentielles 2027', 'index.html', 'src'].sort());
  const html = await readFile(join(output, 'index.html'), 'utf8');
  const base = new URL('https://example.github.io/presidentielles-2027/');
  for (const [, path] of html.matchAll(/(?:src|href)="((?:src\/)[^"]+)"/g)) {
    assert.ok(new URL(path, base).pathname.startsWith('/presidentielles-2027/'));
    assert.ok((await readFile(join(output, path))).length > 0);
  }
  const configSource = await readFile(join(output, 'src/config.js'), 'utf8');
  const relative = configSource.match(/const base = new URL\('([^']+)', import.meta.url\)/)[1];
  const dataBase = new URL(relative, new URL('src/config.js', base));
  assert.equal(decodeURIComponent(dataBase.pathname), '/presidentielles-2027/Présidentielles 2027/');
  const config = {};
  for (const [key, file] of Object.entries({ balance: 'game_balance.json', layout: 'world_layout.json', buildings: 'building_catalog.json', prototype: 'prototype_config.json' })) {
    config[key] = JSON.parse(await readFile(join(output, 'Présidentielles 2027', file), 'utf8'));
  }
  assert.equal(validateConfig(config), config);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative as pathRelative } from 'node:path';
import { buildPages } from '../scripts/build-pages.mjs';
import { validateConfig } from '../src/config.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { fileURLToPath } from 'node:url';

test('Le paquet GitHub Pages contient uniquement le jeu et charge ses réglages depuis un sous-chemin', async t => {
  const output = await mkdtemp(join(tmpdir(), 'presidentielles-pages-'));
  t.after(async () => {
    assert.equal(dirname(output), resolve(tmpdir()));
    assert.ok(output.split(/[\\/]/).at(-1).startsWith('presidentielles-pages-'));
    await rm(output, { recursive: true });
  });
  const report = await buildPages(output);
  assert.deepEqual((await readdir(output)).sort(), ['Présidentielles 2027', 'assets', 'index.html', 'src'].sort());
  assert.ok((await readFile(join(output, 'assets/generated/characters/melenchon.png'))).length > 0);
  assert.ok(!(await readdir(join(output, 'assets/generated'))).includes('masters'));
  for (const excluded of ['src/apercu-cadrages.html', 'src/presentation/combat-preview.html', 'src/vendor/README.md', 'src/AGENTS.md', 'assets/generated/animations/melenchon-base-combat-v1.png', 'assets/generated/animations/melenchon-base-combat-v2.png', 'assets/generated/animations/melenchon-base-combat-v3.png']) {
    await assert.rejects(stat(join(output, excluded)), { code: 'ENOENT' });
  }
  for (const included of ['src/vendor/qrcode-LICENSE.txt', 'src/vendor/jsqr-LICENSE.txt', 'assets/generated/menus/accueil.png', 'assets/generated/menus/candidats.png']) {
    assert.ok((await stat(join(output, included))).size > 0, included);
  }
  for (const asset of Object.values(visualManifest)) {
    const path = pathRelative(fileURLToPath(new URL('../', import.meta.url)), fileURLToPath(asset.file));
    assert.ok((await stat(join(output, path))).size > 0, path);
  }
  const exported = await readdir(output, { recursive: true, withFileTypes: true });
  let bytes = 0;
  let count = 0;
  for (const entry of exported.filter(entry => entry.isFile())) {
    count++;
    const file = join(entry.parentPath, entry.name);
    bytes += (await stat(file)).size;
    if (!file.endsWith('.js')) continue;
    const source = await readFile(file, 'utf8');
    for (const [, dependency] of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+\.js)['"]/g)) {
      assert.ok((await stat(resolve(dirname(file), dependency))).isFile(), `${entry.name} → ${dependency}`);
    }
  }
  assert.equal(report.files, count);
  assert.equal(report.bytes, bytes);
  assert.ok(report.imageBytes > 0 && report.imageBytes < bytes);
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
  for (const [key, file] of Object.entries({ balance: 'game_balance.json', layout: 'world_layout.json', buildings: 'building_catalog.json', prototype: 'prototype_config.json', campaignCatalog: 'campaign_events.json' })) {
    config[key] = JSON.parse(await readFile(join(output, 'Présidentielles 2027', file), 'utf8'));
  }
  assert.equal(validateConfig(config), config);
});

test('Une destination personnalisée non vide est préservée', async t => {
  const output = await mkdtemp(join(tmpdir(), 'presidentielles-pages-'));
  t.after(async () => {
    assert.equal(dirname(output), resolve(tmpdir()));
    assert.ok(output.split(/[\\/]/).at(-1).startsWith('presidentielles-pages-'));
    await rm(output, { recursive: true });
  });
  await writeFile(join(output, 'personnel.txt'), 'À conserver');
  await assert.rejects(buildPages(output), /doit être vide/);
  assert.equal(await readFile(join(output, 'personnel.txt'), 'utf8'), 'À conserver');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative as pathRelative } from 'node:path';
import { APP_EXCLUDED_IMAGES, buildPages, useWebpPaths } from '../scripts/build-pages.mjs';
import { cachedWebp, samePixels, webpAvailable } from '../scripts/lib/webp.mjs';
import { validateConfig } from '../src/config.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { worldAssetIds } from '../src/presentation/illustrated-world.js';
import { buildingAssetId } from '../src/presentation/illustrated-buildings.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetPath = id => pathRelative(root, fileURLToPath(visualManifest[id].file)).split(/[\\/]/).join('/');
const excluded = path => APP_EXCLUDED_IMAGES.some(pattern => pattern.test(path));

test('Le paquet de l\'application contient uniquement le jeu et charge ses réglages depuis un sous-chemin', async t => {
  const output = await mkdtemp(join(tmpdir(), 'presidentielles-pages-'));
  t.after(async () => {
    assert.equal(dirname(output), resolve(tmpdir()));
    assert.ok(output.split(/[\\/]/).at(-1).startsWith('presidentielles-pages-'));
    await rm(output, { recursive: true });
  });
  // La conversion WebP (lente la première fois) est vérifiée à part ci-dessous.
  const report = await buildPages(output, { webp: false, app: true });
  const image = path => report.webp ? path.replace(/\.png$/, '.webp') : path;
  assert.deepEqual((await readdir(output)).sort(), ['Présidentielles 2027', 'assets', 'confidentialite.html', 'index.html', 'src'].sort());
  assert.ok((await readFile(join(output, image('assets/generated/characters/melenchon.png')))).length > 0);
  assert.ok(!(await readdir(join(output, 'assets/generated'))).includes('masters'));
  for (const absent of ['src/presentation/world-v3/storyboard.html', 'src/presentation/minor-preview.html', 'src/presentation/world-v3/prompts.js', 'src/vendor/README.md', 'src/AGENTS.md']) {
    await assert.rejects(stat(join(output, absent)), { code: 'ENOENT' }, absent);
  }
  for (const included of ['src/vendor/qrcode-LICENSE.txt', 'src/vendor/jsqr-LICENSE.txt', image('assets/generated/menus/accueil.png'), image('assets/generated/menus/candidats.png')]) {
    assert.ok((await stat(join(output, included))).size > 0, included);
  }
  // L'application ne propose que le décor par défaut.
  assert.match(await readFile(join(output, 'src/app-build.js'), 'utf8'), /APP_BUILD = true/);
  // Toute image du manifeste est exportée, sauf les décors réservés au profil betatest.
  for (const id of Object.keys(visualManifest)) {
    const path = assetPath(id);
    if (excluded(path)) await assert.rejects(stat(join(output, image(path))), { code: 'ENOENT' }, path);
    else assert.ok((await stat(join(output, image(path)))).size > 0, path);
  }
  // Aucune image utile au décor par défaut, aux personnages ou au débat n'est exclue.
  const state = new GameSimulation(campaignConfig()).getState();
  const needed = new Set([...worldAssetIds(visualManifest, state), 'background-debate']);
  for (const building of state.buildings) needed.add(buildingAssetId(building, state.world));
  for (const id of needed) assert.ok(visualManifest[id] && !excluded(assetPath(id)), id);
  const exported = await readdir(output, { recursive: true, withFileTypes: true });
  let bytes = 0;
  let count = 0;
  for (const entry of exported.filter(entry => entry.isFile())) {
    count++;
    const file = join(entry.parentPath, entry.name);
    bytes += (await stat(file)).size;
    if (!/\.(js|css|html)$/.test(file)) continue;
    const source = await readFile(file, 'utf8');
    if (report.webp) assert.doesNotMatch(source, /assets\/generated\/[^'"`\s)]*\.png/, entry.name);
    if (!file.endsWith('.js')) continue;
    for (const [, dependency] of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+\.js)['"]/g)) {
      assert.ok((await stat(resolve(dirname(file), dependency))).isFile(), `${entry.name} → ${dependency}`);
    }
  }
  assert.equal(report.files, count);
  assert.equal(report.bytes, bytes);
  assert.ok(report.imageBytes > 0 && report.imageBytes < bytes);
  const html = await readFile(join(output, 'index.html'), 'utf8');
  const base = new URL('https://example.github.io/presidentielles-2027/');
  for (const [, path] of html.matchAll(/(?:src|href)="((?:src\/|assets\/)[^"]+)"/g)) {
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

test('La version web garde les décors du profil betatest', async t => {
  const output = await mkdtemp(join(tmpdir(), 'presidentielles-pages-'));
  t.after(async () => {
    assert.ok(output.split(/[\\/]/).at(-1).startsWith('presidentielles-pages-'));
    await rm(output, { recursive: true });
  });
  await buildPages(output, { webp: false });
  assert.match(await readFile(join(output, 'src/app-build.js'), 'utf8'), /APP_BUILD = false/);
  for (const id of ['panorama-bobo', 'background-debate']) assert.ok((await stat(join(output, assetPath(id)))).size > 0, id);
});

test('Les chemins d\'images passent en WebP, y compris dans les gabarits', () => {
  assert.equal(useWebpPaths("new URL('../../assets/generated/menus/accueil.png', import.meta.url)"), "new URL('../../assets/generated/menus/accueil.webp', import.meta.url)");
  assert.equal(useWebpPaths('`../../assets/generated/npc-v2/npc-${biome}-${variant}.png?v=5`'), '`../../assets/generated/npc-v2/npc-${biome}-${variant}.webp?v=5`');
  assert.equal(useWebpPaths("url('../../assets/generated/menus/candidats.png')"), "url('../../assets/generated/menus/candidats.webp')");
  assert.equal(useWebpPaths('docs/production/decor-v3/maquettes/rue.png'), 'docs/production/decor-v3/maquettes/rue.png');
});

test('La conversion WebP est vérifiée pixel par pixel', async t => {
  if (!await webpAvailable()) { t.skip('ffmpeg avec libwebp absent'); return; }
  const cache = await mkdtemp(join(tmpdir(), 'presidentielles-webp-'));
  t.after(() => rm(cache, { recursive: true }));
  const source = join(root, 'assets/generated/npc-v2/npc-bobo-3.png');
  const converted = await cachedWebp(source, cache);
  assert.ok(await samePixels(source, converted));
  assert.ok((await stat(converted)).size < (await stat(source)).size);
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

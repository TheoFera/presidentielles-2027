import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { campaignConfig } from './validate-campaign.mjs';
import { buildingAssetId } from '../src/presentation/illustrated-buildings.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const config = campaignConfig(), sim = new GameSimulation(config, config.prototype.seed);
const remote = [...sim.state.buildings].sort((a, b) => a.x - b.x).at(-1);
const delayedId = buildingAssetId(remote, sim.state.world);
const fileName = visualManifest[delayedId].file.split('/').at(-1);
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { delayedId, flows: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  page.on('pageerror', error => report.errors.push(error.message));
  // Expose the actual game's renderer only in this browser test.
  const rendererSource = await readFile('src/presentation/renderer.js', 'utf8');
  await page.route('**/src/presentation/renderer.js', route => route.fulfill({ contentType: 'text/javascript',
    body: rendererSource.replace('this.resize();', 'globalThis.testRenderer = this; this.resize();') }));
  let release, requested = 0;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(`**/${fileName}`, async route => {
    requested++;
    if (requested === 1) { await held; await route.abort('failed'); }
    else await route.continue();
  });
  await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2037');
  await page.locator('#solo').click();
  await page.locator('[data-candidate="melenchon"]').click();
  await page.locator('#prepare-game').click();
  await page.waitForFunction(id => {
    const assets = window.testRenderer?.assets;
    return assets?.cache.has(id) && [...assets.protectedIds].every(key => key === id || assets.cache.get(key)?.ready);
  }, delayedId, { timeout: 60000 });
  assert.equal(await page.locator('#start-campaign').isDisabled(), true);
  assert.notEqual(await page.locator('#loading-percent').textContent(), '100 %');
  report.flows.push('Une image de bâtiment lointain retardée empêche le démarrage et les 100 %.');
  release();
  await page.waitForFunction(() => document.querySelector('#start-campaign')?.textContent === 'Réessayer');
  assert.match(await page.locator('#loading-status').textContent(), /images/);
  await page.locator('#start-campaign').click();
  await page.waitForFunction(() => document.querySelector('#start-campaign')?.textContent === 'Jouer ➜');
  assert.equal(requested, 2);
  report.flows.push('Une erreur propose Réessayer ; la seconde requête réussie autorise le démarrage.');
  await page.locator('#start-campaign').click();
  await page.keyboard.press('p');
  let imageRequests = 0;
  page.on('request', request => { if (request.resourceType() === 'image') imageRequests++; });
  report.traversal = await page.evaluate(async () => {
    const [{ loadConfig }, { GameSimulation }] = await Promise.all([import('/src/config.js'), import('/src/simulation/game-simulation.js')]);
    const config = await loadConfig(), sim = new GameSimulation(config, config.prototype.seed), renderer = window.testRenderer;
    const count = renderer.assets.cache.size, missing = [];
    const player = sim.state.candidates.find(c => c.id === sim.state.local_candidate_id);
    for (const zone of [...sim.state.world.subzones, ...sim.state.world.subzones.toReversed()]) {
      player.x = zone.start + .01; renderer.resetCamera();
      renderer.draw(sim.state, sim.state, 1, 1 / 60);
      for (const id of renderer.assets.protectedIds) if (!renderer.assets.get(id)) missing.push({ zone: zone.index, id });
    }
    return { count, finalCount: renderer.assets.cache.size, missing, status: renderer.assets.status(),
      decodedMiB: [...renderer.assets.cache.values()].reduce((sum, e) => sum + e.image.naturalWidth * e.image.naturalHeight * 4, 0) / 1048576 };
  });
  assert.deepEqual(report.traversal.missing, []);
  assert.equal(report.traversal.status.pending, 0);
  assert.deepEqual(report.traversal.status.failed, []);
  assert.equal(report.traversal.finalCount, report.traversal.count);
  assert.equal(imageRequests, 0);
  assert.deepEqual(report.errors, []);
  report.flows.push('36 changements de zone : aucun sprite manquant, aucune nouvelle requête ni éviction.');
  await mkdir('artifacts/sprite-loading', { recursive: true });
  await writeFile('artifacts/sprite-loading/browser-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }

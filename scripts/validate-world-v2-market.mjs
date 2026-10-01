import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/world-v2-pilot');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto((process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027') + '/src/presentation/world-v2-preview.html?decor=panoramas');
  await page.waitForFunction(() => window.worldV2Preview, { timeout: 60000 });
  await page.selectOption('#zone', 'banlieue_b');
  const refresh = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    worldV2Preview.refresh(); resolve();
  }))));
  await refresh();
  const positions = await page.evaluate(() => {
    const zones = worldV2Preview.sim.state.world.subzones, zone = zones.find(z => z.id === 'banlieue_b');
    return [['centre', zone.center], ['gauche', zone.center - 8], ['droite', zone.center + 8],
      ['entree', zone.start], ['sortie', zone.start + zone.width],
      ['voisine-a', zones.find(z => z.id === 'banlieue_a').center], ['voisine-c', zones.find(z => z.id === 'banlieue_c').center]];
  });
  for (const [name, x] of positions) {
    await page.evaluate(x => worldV2Preview.draw(x), x);
    await page.locator('#game').screenshot({ path: path.join(output, name + '.png') });
  }
  await page.selectOption('#season', '0.6'); await refresh();
  await page.locator('#game').screenshot({ path: path.join(output, 'hiver.png') });
  await page.selectOption('#season', '0');
  const framing = [];
  for (const [name, viewport] of [['mobile-paysage', { width: 844, height: 390 }], ['mobile-portrait', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport); await refresh();
    await page.locator('#game').screenshot({ path: path.join(output, name + '.png') });
    const size = await page.locator('#game').evaluate(canvas => ({ width: canvas.width, height: canvas.height }));
    assert.ok(Math.abs(size.width - size.height * 16 / 9) < 2, name);
    framing.push({ name, ...size });
  }
  const report = await page.evaluate(async () => {
    const { marketBackgroundX, marketStreetFrame } = await import('/src/presentation/world-v2-market.js');
    const { renderer, sim, draw } = worldV2Preview, { state } = sim;
    const zone = state.world.subzones.find(z => z.id === 'banlieue_b'), site = state.buildings.find(b => b.site_id === 'site:banlieue_b');
    const speeds = [-12, 0, 12].map(offset => {
      const camera = zone.center + offset;
      return (marketBackgroundX(renderer.metrics, camera, zone, state.world.length) - marketBackgroundX(renderer.metrics, camera + 1, zone, state.world.length)) / renderer.metrics.pixelsPerUnit;
    });
    draw(zone.center);
    const frame = marketStreetFrame(renderer.metrics, renderer.cameraX, state.world, site, renderer.assets.get('world2-market-street'));
    return { assets: renderer.assets.status(), speeds, signs: renderer.worldV2Sites.size,
      doorRatio: frame.doorHeight / renderer.metrics.characterHeight, zoom: renderer.config.balance.camera,
      sitePosition: (site.x - zone.start) / zone.width };
  });
  assert.deepEqual(errors, []); assert.deepEqual(report.assets.failed, []);
  assert.equal(report.signs, 21); assert.ok(Math.abs(report.doorRatio - 1.15) < 1e-10);
  assert.ok(report.speeds.every(speed => Math.abs(speed - .35) < 1e-10));
  assert.ok(Math.abs(report.sitePosition - .22) < 1e-10);
  const result = { ...report, framing, errors, output, note: 'Contrôles techniques et captures du pilote Banlieue B ; les autres sous-zones ne sont pas validées par ce rapport.' };
  await writeFile(path.join(output, 'rapport.json'), JSON.stringify(result, null, 2));
  // Comparaison à cadrage égal avec la composition rejetée : uniquement dans le navigateur de validation.
  await page.setViewportSize({ width: 1280, height: 720 }); await refresh();
  const after = await page.locator('#game').evaluate(canvas => canvas.toDataURL());
  const source = await readFile('src/presentation/world-v2-expanded.js', 'utf8');
  const beforeSource = source.replace("if(zone.id==='banlieue_b') continue;", '')
    .replace("if((zone.id==='banlieue_a' && ratio===.94) || (zone.id==='banlieue_c' && ratio===.08)) continue;", '')
    .replace("if(siteId==='site:banlieue_b') continue;", '')
    .replace("if(id==='far' || id==='street') drawMarketPilot(renderer,state,tools,id);", '');
  await page.route('**/src/presentation/world-v2-expanded.js', route => route.fulfill({ contentType: 'text/javascript', body: beforeSource }));
  await page.reload(); await page.waitForFunction(() => window.worldV2Preview, { timeout: 60000 });
  await page.selectOption('#zone', 'banlieue_b'); await refresh();
  const before = await page.locator('#game').evaluate(canvas => canvas.toDataURL());
  const comparison = await page.evaluate(async ({ before, after }) => {
    const load = src => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.src = src; });
    const images = await Promise.all([load(before), load(after)]), canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 580; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eee5d3'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    images.forEach((image, index) => {
      const height = 960 * image.height / image.width;
      ctx.drawImage(image, index * 960, 40, 960, height);
    });
    ctx.fillStyle = '#253c34'; ctx.font = '20px system-ui';
    ctx.fillText('Avant : étals masqués, barres répétées', 14, 28);
    ctx.fillText('Après : marché ouvert, rue peinte et basilique en fond', 974, 28);
    return canvas.toDataURL();
  }, { before, after });
  await writeFile(path.join(output, 'avant-apres.png'), Buffer.from(comparison.split(',')[1], 'base64'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}

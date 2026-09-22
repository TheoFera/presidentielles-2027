import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/illustrated-menus');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
const url = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
async function contained(page, selector) {
  for (const button of await page.locator(selector).all()) {
    const box = await button.boundingBox();
    assert.ok(box, `${selector} visible`);
    const viewport = page.viewportSize();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${selector} dans l’écran : ${JSON.stringify(box)}`);
    assert.ok(box.height >= 40, `${selector} cible tactile`);
  }
}
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  // Exercise the fallback used by browsers without fullscreen/orientation locking.
  await context.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Indisponible'));
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('#solo').waitFor();
  assert.ok(await page.locator('#landscape-gate').isVisible());
  assert.ok(await page.locator('#start-menu').evaluate(e => e.inert));
  await page.screenshot({ path: path.join(output, 'telephone-portrait.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('#landscape-gate').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#start-menu').evaluate(e => e.inert), false);
  await contained(page, '#solo, #multiplayer');
  await page.locator('#solo').tap();
  for (const candidate of ['philippe', 'le_pen', 'melenchon']) {
    await page.locator(`[data-candidate="${candidate}"]`).tap();
    assert.equal(await page.locator('.candidate-card[aria-pressed="true"]').count(), 1);
    assert.equal(await page.locator('.candidate-card[aria-pressed="true"]').getAttribute('data-candidate'), candidate);
  }
  await page.screenshot({ path: path.join(output, 'telephone-candidats.png') });
  await page.locator('#prepare-game').tap();
  await page.locator('#start-campaign:not([disabled])').waitFor();
  assert.equal(await page.locator('#start-menu progress').getAttribute('value'), '1');
  assert.ok(await page.getByText('Utilisez les boutons à l’écran.').isVisible());
  for (const [width, height] of [[844, 390], [667, 375], [568, 320]]) {
    await page.setViewportSize({ width, height });
    await contained(page, '#start-campaign, #menu-back');
    const reminder = await page.locator('.landscape-reminder').boundingBox();
    const strip = await page.locator('.loading-strip').boundingBox();
    assert.ok(reminder.y + reminder.height <= strip.y, 'Le rappel paysage reste au-dessus du chargement');
    await page.screenshot({ path: path.join(output, `chargement-${width}.png`) });
  }
  await page.locator('#start-campaign').tap();
  await page.locator('#start-menu').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#landscape-gate').waitFor();
  assert.ok(await page.locator('#game').evaluate(e => e.inert));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('#landscape-gate').waitFor({ state: 'hidden' });
  await page.locator('#help').waitFor();
  assert.equal(await page.locator('#game').evaluate(e => e.inert), false);
  await page.locator('#pause-home').tap();
  await page.locator('#solo').waitFor();

  // Isolate the loader to verify delayed progress, cancellation and retry.
  const loader = await context.newPage();
  loader.on('pageerror', error => errors.push(error.message));
  await loader.setViewportSize({ width: 844, height: 390 });
  await loader.goto(url);
  await loader.locator('#solo').waitFor();
  await loader.evaluate(async () => {
    const { StartMenu } = await import('./src/presentation/start-menu.js');
    window.loaderMenu = new StartMenu({
      prepare: (_candidate, progress) => new Promise((resolve, reject) => { window.testLoad = { resolve, reject, progress }; progress(.25); }),
      play: () => { window.testPlayed = true; }, multiplayer: () => {},
    });
    window.loaderMenu.loading();
  });
  await loader.waitForFunction(() => !!window.testLoad);
  assert.ok(await loader.locator('#start-campaign').isDisabled());
  assert.equal(await loader.locator('#start-menu progress').getAttribute('value'), '0.25');
  await loader.evaluate(() => window.testLoad.reject(new Error('Essai')));
  await loader.getByRole('button', { name: 'Réessayer' }).waitFor();
  await loader.evaluate(() => { window.testLoad = null; });
  await loader.getByRole('button', { name: 'Réessayer' }).click();
  await loader.waitForFunction(() => !!window.testLoad);
  await loader.locator('#menu-back').click();
  await loader.evaluate(() => window.testLoad.resolve());
  assert.equal(await loader.locator('#start-campaign').count(), 0);
  assert.equal(await loader.evaluate(() => !!window.testPlayed), false);
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ success: true, errors, checks: ['portrait bloqué', 'rotation vers paysage', 'sélection des trois candidats', 'commandes tactiles', 'petits écrans paysage', 'pause après rotation', 'progression réelle', 'échec et nouvelle tentative', 'annulation du chargement'] }, null, 2));
  console.log('Menus illustrés, chargement et orientation mobile validés.');
} finally { await browser.close(); }



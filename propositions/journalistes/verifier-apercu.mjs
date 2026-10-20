import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root, 'apercu-combat.html')).href);
  await page.waitForFunction(() => document.querySelector('.detail').textContent.length > 10);
  for (const step of [1, 2, 3, 0]) {
    await page.locator(`[data-step="${step}"]`).click();
    if (step === 3) {
      await page.waitForTimeout(650);
      await page.locator('#reportage-demo').screenshot({ path: path.join(root, 'apercu-retrait-duo.png') });
      await page.waitForTimeout(1050);
      assert.match(await page.locator('.detail').textContent(), /les deux cessent d’attaquer et repartent ensemble par le bas/);
    } else await page.waitForTimeout(700);
    assert.equal(await page.locator(`[data-step="${step}"]`).getAttribute('aria-pressed'), 'true');
    if (step === 2) await page.locator('#reportage-demo').screenshot({ path: path.join(root, 'apercu-combat.png') });
  }
  await page.setViewportSize({ width: 360, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('[data-step="2"]').click();
  await page.waitForTimeout(700);
  await page.locator('#reportage-demo').screenshot({ path: path.join(root, 'apercu-combat-mobile.png') });
  assert.deepEqual(errors, []);
  console.log('4 étapes contrôlées, aucune erreur JavaScript, aucun débordement à 360 px.');
} finally { await browser.close(); }

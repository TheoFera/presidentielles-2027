import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const base = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
const output = 'artifacts/debate-arenas';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], captures = [];
await mkdir(output, { recursive: true });
try {
  for (const map of ['elysee', 'face_a_face', 'remue_menage', 'ecologie']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    if (await page.locator('#legal-notice-accept').isVisible()) await page.locator('#legal-notice-accept').click({ timeout: 60000 });
    await page.locator('#debate').click(); await page.locator('#solo').click();
    await page.locator('[data-faction="melenchon"]').click();
    await page.locator('[data-faction="philippe"]').click();
    await page.locator(`[data-map="${map}"]`).click();
    assert.equal(await page.locator('[data-map]').count(), 4);
    assert.match(await page.locator('.select-footer .menu-note').innerText(), /mortel/);
    if (map === 'elysee') {
      for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 375 }, { width: 1280, height: 720 }]) {
        await page.setViewportSize(viewport);
        for (const selector of ['#debate-fight', '.select-roster', '.select-stage', '.debate-options', '[data-map]']) {
          for (const element of await page.locator(selector).all()) {
            const box = await element.boundingBox();
            assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
              `${selector} doit être visible à ${viewport.width} × ${viewport.height}`);
          }
        }
        await page.screenshot({ path: `${output}/menu-${viewport.width}.png` });
      }
    }
    await page.locator('#debate-fight').click();
    await page.locator('#debate-mode-hud:not([hidden])').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#debate-mode-banner')?.textContent === 'DÉBATTEZ !');
    await page.locator('#debate-mode-banner[hidden]').waitFor({ state: 'attached' });
    await page.screenshot({ path: `${output}/${map}.png` }); captures.push(map);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.screenshot({ path: `${output}/${map}-mobile.png` });
    if (map === 'elysee') {
      await page.keyboard.down('ArrowLeft');
      await page.locator('.debate-fighter.local.ko').waitFor({ timeout: 15000 });
      await page.keyboard.up('ArrowLeft');
      assert.equal(await page.locator('.debate-fighter.local output').innerText(), '0');
      await page.screenshot({ path: `${output}/chute-mortelle.png` });
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/rapport.json`, JSON.stringify({ captures, errors }, null, 2));
  console.log('Quatre arènes, menus sur ordinateur et téléphone, chute mortelle : contrôles réussis.');
} finally { await browser.close(); }

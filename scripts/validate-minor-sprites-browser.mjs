import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027'}/src/presentation/minor-sprite-preview.html`);
  await page.waitForFunction(() => window.galleryReady);
  const counts = await page.locator('canvas').evaluateAll(canvases => canvases.map(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 20, canvas.width, 155).data;
    let visible = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 90) visible++;
    return visible;
  }));
  assert.equal(counts.length, 72);
  assert.ok(counts.every(count => count > 800 && count < 18000), 'Les 72 poses doivent être visibles sans fond opaque.');
  assert.deepEqual(errors, []);
  await mkdir('artifacts/minor-sprites', { recursive: true });
  await page.screenshot({ path: 'artifacts/minor-sprites/galerie.png', fullPage: true });
  console.log('Six candidats, 72 poses visibles, aucune erreur JavaScript.');
} finally { await browser.close(); }

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CAMPAIGN_TEST_NODE_MODULES
  ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright') : 'playwright');
const output = path.resolve('artifacts/permanences');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(`${process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027'}/src/presentation/debogage/propositions-permanence.html`);
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => document.querySelector('#description').textContent.startsWith('1 ·'));
  // Laisser les images de la scène demandées par le moteur se charger.
  await page.waitForTimeout(8000);
  for (const style of ['original', 'enseigne', 'affiches', 'combine']) {
    await page.locator(`[data-style="${style}"]`).click();
    await page.waitForTimeout(1500);
    await page.locator('canvas').screenshot({ path: path.join(output, `${style}.png`) });
    assert.equal(await page.locator(`[data-style="${style}"]`).getAttribute('aria-pressed'), 'true');
  }
  const sites = await page.locator('#site option').evaluateAll(options => options.map(option => option.value));
  for (const candidate of ['melenchon', 'le_pen', 'philippe']) {
    await page.selectOption('#candidate', candidate);
    for (const site of sites) {
      await page.selectOption('#site', site);
      await page.waitForTimeout(250);
      if (candidate === 'melenchon') {
        await page.waitForTimeout(1500);
        await page.locator('canvas').screenshot({ path: path.join(output, `facade-${site.slice(5)}.png`) });
      }
    }
  }
  await page.selectOption('#site', 'site:banlieue_b');
  await page.selectOption('#money', '12345600');
  await page.waitForTimeout(3000);
  await page.locator('canvas').screenshot({ path: path.join(output, 'combine-philippe-banlieue.png') });
  await page.setViewportSize({ width: 844, height: 700 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.selectOption('#candidate', 'le_pen');
  await page.selectOption('#money', '0');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(output, 'petit-ecran.png') });
  assert.deepEqual(errors, []);
  console.log(`Atelier vérifié : 4 rendus, 3 candidats, ${sites.length} façades, montants longs et petit écran ; aucune erreur JavaScript.`);
} finally {
  await browser.close();
}

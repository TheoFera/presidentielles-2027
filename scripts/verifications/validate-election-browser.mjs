import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { startSolo } from './browser-start.mjs';
import { demoElectionState, DEMO_SCENARIOS } from '../../test/election-demo.js';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const base = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
const output = path.resolve('artifacts/election-results');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
// Affiche l’annonce dans la page du jeu avec des données fictives, sans lancer de partie.
const show = (page, state, animate = true) => page.evaluate(async ({ state, animate }) => {
  const { ElectionResults, electionModel } = await import('/src/presentation/menus/election-results.js');
  const host = document.getElementById('results'); host.hidden = false;
  window.demoResults?.clear(); window.demoResults = new ElectionResults(host);
  window.demoResults.render(electionModel(state), { preview: true, animate, onContinue() {}, onReplay() {}, onReturn() { window.demoResults.clear(); host.hidden = true; } });
}, { state, animate });
try {
  for (const [name, width, height] of [['ordinateur', 1600, 900], ['telephone', 844, 390], ['petit-telephone', 640, 360]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    for (const candidate of ['melenchon', 'le_pen', 'philippe']) for (const scenario of DEMO_SCENARIOS) {
      await show(page, demoElectionState(candidate, scenario), false);
      assert.equal(await page.locator('.election-confetti i').count(), ['qualification', 'victoire'].includes(scenario) ? 90 : 0, `${name} ${candidate} ${scenario}`);
      for (const selector of ['.election-score', '.election-band', '.election-footer', '.election-verdict']) {
        for (const el of await page.locator(selector).all()) {
          const box = await el.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${name} : ${selector} déborde`);
        }
      }
      if (candidate === 'melenchon' && ['qualification', 'victoire'].includes(scenario)) {
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(output, `${name}-${scenario}.png`) });
      }
    }
    // Animation complète : rien de visible avant 20 h, puis scores définitifs.
    await show(page, demoElectionState('le_pen', 'qualification'));
    assert.equal(await page.locator('.election-stage.is-playing').count(), 1);
    await page.waitForFunction(() => !document.querySelector('.election-stage.is-playing'), null, { timeout: 6000 });
    assert.equal(await page.locator('.election-score span').first().textContent(), '44,32');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await show(page, demoElectionState('le_pen', 'victoire'));
    assert.equal(await page.locator('.election-confetti i').count(), 0);
    assert.equal(await page.locator('.election-stage.is-playing').count(), 0);
    await page.locator('#results [data-action="return"]').click();
    assert.equal(await page.locator('.election-confetti').count(), 0);
    await page.close();
  }
  // Parcours réel : J0 forcé, annonce figée, puis reprise de la campagne.
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  assert.equal(await page.locator('#results-preview-button').count(), 0);
  await startSolo(page);
  await page.locator('.campaign-style-card:not([disabled])').first().click();
  await page.locator('#world').focus();
  await page.keyboard.press('F3');
  await page.locator('#force-j0').click();
  await page.locator('#results h1').waitFor();
  assert.match(await page.locator('#results h1').textContent(), /Qualifiés/);
  const frozen = await page.locator('#match-debug-text').textContent();
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#match-debug-text').textContent(), frozen, 'la partie avance pendant l’annonce');
  await page.locator('#results [data-action="continue"]').click();
  await page.waitForFunction(() => document.querySelector('#results').hidden);
  assert.deepEqual(errors, []);
  console.log('Soirée électorale : 12 situations, 3 formats, animation, réduction des animations et parcours premier tour : OK.');
} finally { await browser.close(); }

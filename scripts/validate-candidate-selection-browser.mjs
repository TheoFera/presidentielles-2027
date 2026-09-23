import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const url = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
const output = path.resolve('artifacts/candidate-selection');
await mkdir(output, { recursive: true });
const errors = [];
async function open() {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('#solo').waitFor();
  return page;
}
async function setup(page) {
  await page.locator('#multiplayer').click();
  await page.locator('#network-method').selectOption('server');
  await page.waitForFunction(() => document.querySelector('#server-status').textContent.includes('Serveur'));
}
async function selected(page, count) {
  await page.waitForFunction(expected => document.querySelectorAll('[data-candidate][aria-pressed="true"]').length === expected, count);
}
try {
  const host = await open();
  await host.locator('#solo').click();
  await selected(host, 0);
  assert.equal(await host.locator('#prepare-game').isDisabled(), true);
  await host.locator('[data-candidate="philippe"]').click();
  await selected(host, 1);
  assert.equal(await host.locator('#prepare-game').isEnabled(), true);
  await host.locator('#menu-back').click();
  await host.locator('#solo').click();
  await selected(host, 0);
  assert.equal(await host.locator('#prepare-game').isDisabled(), true);
  await host.screenshot({ path: path.join(output, 'solo-sans-selection.png') });
  await host.locator('#menu-back').click();
  await setup(host);
  await host.locator('#create-room').click();
  await host.locator('[data-screen="waiting"]').waitFor();
  assert.equal(await host.locator('[data-candidate]').count(), 0);
  const code = await host.locator('.room-code').textContent();
  const guest = await open();
  await setup(guest);
  await guest.locator('#room-code').fill(code);
  await guest.locator('button[type="submit"]').click();
  await guest.locator('[data-screen="waiting"]').waitFor();
  await host.waitForFunction(() => document.querySelector('#room-message').textContent.startsWith('2/3'));
  assert.equal(await host.locator('[data-candidate]').count(), 0);
  const third = await open();
  await setup(third);
  await third.locator('#room-code').fill(code);
  await third.locator('button[type="submit"]').click();
  for (const page of [host, guest, third]) {
    await page.locator('[data-screen="candidates"]').waitFor();
    await selected(page, 0);
  }
  assert.equal(await host.locator('#prepare-game').isDisabled(), true);
  await host.screenshot({ path: path.join(output, 'multi-sans-selection.png') });
  await host.locator('[data-candidate="melenchon"]').click();
  await selected(host, 1);
  await guest.waitForFunction(() => document.querySelector('[data-candidate="melenchon"]').disabled);
  await selected(guest, 0);
  await guest.locator('[data-candidate="le_pen"]').click();
  await selected(guest, 1);
  await selected(third, 0);
  assert.equal(await host.locator('#prepare-game').isDisabled(), true);
  await third.locator('[data-candidate="philippe"]').click();
  await selected(third, 1);
  await host.waitForFunction(() => !document.querySelector('#prepare-game').disabled);
  await host.screenshot({ path: path.join(output, 'multi-choix-complets.png') });
  await host.locator('#prepare-game').click();
  for (const page of [host, guest, third]) await page.locator('[data-screen="loading"]').waitFor();
  assert.deepEqual(errors, []);
  console.log('Parcours solo et multijoueur à trois joueurs validés, sans présélection.');
} finally {
  await browser.close();
}

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/start-menu'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const url = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
const errors = [];
const pages = [];
async function pageAt(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage(); pages.push(page);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      if (String(input).endsWith('/snapshot')) window.lastSnapshot = JSON.parse(init.body).state;
      return original(input, init);
    };
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.lastExport = blob.text(); return create(blob); };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (!this.download) click.call(this); };
  });
  await page.goto(url); await page.locator('#solo').waitFor(); return page;
}
async function solo(page, candidate) {
  await page.locator('#solo').click(); await page.locator(`[data-candidate="${candidate}"]`).click();
  await page.locator('#prepare-game').click(); await page.locator('#start-campaign:not([disabled])').waitFor();
}
try {
  const page = await pageAt();
  assert.equal(await page.locator('#game').evaluate(e => e.inert), true);
  await page.screenshot({ path: path.join(output, 'accueil.png') });
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#help').isVisible(), false);
  await page.locator('#solo').click(); await page.screenshot({ path: path.join(output, 'candidats.png') });
  await page.locator('[data-candidate="philippe"]').click(); await page.locator('#prepare-game').click();
  await page.locator('#start-campaign:not([disabled])').waitFor();
  await page.screenshot({ path: path.join(output, 'tutoriel.png') });
  await page.locator('#start-campaign').click(); await page.keyboard.press('F3');
  await page.locator('#pause-debug').click(); await page.locator('#debug-tools').evaluate(e => { e.open = true; });
  await page.locator('#save').click();
  const state = JSON.parse(await page.evaluate(() => window.lastExport));
  assert.equal(state.local_candidate_id, 'candidate:philippe'); assert.ok(state.tick < 100);
  await page.locator('#close-debug').click(); await page.keyboard.press('h');
  // Debug pause does not show the help; H resumes, a second press opens it.
  if (!(await page.locator('#help').isVisible())) await page.keyboard.press('h');
  await page.locator('#pause-home').click(); await page.locator('#solo').waitFor();
  // Returning during a load never starts a stale campaign.
  await page.locator('#solo').click(); await page.locator('#prepare-game').click(); await page.locator('#menu-back').click();
  await page.locator('.candidate-grid').waitFor(); await page.waitForTimeout(1900);
  assert.equal(await page.locator('#start-campaign').count(), 0);
  await page.locator('#menu-back').click();
  for (const [name, viewport] of [['mobile-portrait', { width: 390, height: 844 }], ['mobile-paysage', { width: 844, height: 390 }]]) {
    const mobile = await pageAt(viewport); await solo(mobile, 'le_pen');
    assert.equal(await mobile.locator('#start-menu').evaluate(e => e.scrollWidth <= e.clientWidth), true);
    await mobile.locator('#start-campaign').scrollIntoViewIfNeeded();
    await mobile.screenshot({ path: path.join(output, `${name}.png`) });
    await mobile.locator('#start-campaign').click(); assert.equal(await mobile.locator('#start-menu').isVisible(), false);
  }
  const host = page; const guest = await pageAt({ width: 1024, height: 768 });
  await host.locator('#multiplayer').click(); await host.locator('#create-room').click(); await host.locator('.room-code').waitFor();
  const code = (await host.locator('.room-code').textContent()).trim();
  await guest.locator('#multiplayer').click(); await guest.locator('#room-code').fill(code);
  await guest.locator('button[type="submit"]').click(); await guest.locator('#room-error').filter({ hasText: 'déjà pris' }).waitFor();
  await guest.locator('#multiplayer-candidate').selectOption('le_pen'); await guest.locator('button[type="submit"]').click();
  await host.locator('#launch-room:not([disabled])').waitFor();
  await host.screenshot({ path: path.join(output, 'salon.png') });
  await host.locator('#launch-room').click();
  await host.locator('#start-campaign:not([disabled])').waitFor(); await guest.locator('#start-campaign:not([disabled])').waitFor();
  await host.locator('#start-campaign').click(); assert.equal(await host.locator('#start-menu').isVisible(), true);
  await guest.locator('#start-campaign').click(); await host.locator('#start-menu').waitFor({ state: 'hidden' }); await guest.locator('#start-menu').waitFor({ state: 'hidden' });
  await host.waitForFunction(() => window.lastSnapshot?.tick > 0);
  const before = await host.evaluate(() => window.lastSnapshot.candidates.find(c => c.faction_id === 'le_pen').x);
  await guest.keyboard.down('ArrowRight'); await guest.waitForTimeout(800); await guest.keyboard.up('ArrowRight');
  await host.waitForFunction(x => window.lastSnapshot.candidates.find(c => c.faction_id === 'le_pen').x > x + 1, before);
  await guest.keyboard.press('p'); await host.locator('#help').waitFor(); await guest.locator('#help').waitFor();
  await guest.locator('#resume').click(); await host.locator('#help').waitFor({ state: 'hidden' }); await guest.locator('#help').waitFor({ state: 'hidden' });
  await guest.keyboard.press('p'); await guest.locator('#help').waitFor(); await guest.locator('#pause-home').click();
  await host.locator('#disconnect-message').waitFor();
  // The same room flow also supports three humans, with no AI taking over a guest.
  await host.locator('#back-to-home').click();
  await host.locator('#multiplayer').click(); await host.locator('#create-room').click(); await host.locator('.room-code').waitFor();
  const nextCode = (await host.locator('.room-code').textContent()).trim();
  const third = await pageAt();
  for (const [client, faction] of [[guest, 'le_pen'], [third, 'philippe']]) {
    await client.locator('#multiplayer').click(); await client.locator('#room-code').fill(nextCode);
    await client.locator('#multiplayer-candidate').selectOption(faction); await client.locator('button[type="submit"]').click();
    await client.locator('.room-code').waitFor();
  }
  await host.waitForFunction(() => document.querySelectorAll('#room-players p').length === 3);
  await host.locator('#launch-room').click();
  for (const client of [host, guest, third]) { await client.locator('#start-campaign:not([disabled])').waitFor(); await client.locator('#start-campaign').click(); }
  await third.locator('#start-menu').waitFor({ state: 'hidden' });
  await host.waitForFunction(() => window.lastSnapshot?.human_candidate_ids?.length === 3);
  const thirdBefore = await host.evaluate(() => window.lastSnapshot.candidates.find(c => c.faction_id === 'philippe').x);
  await third.keyboard.down('ArrowRight'); await third.waitForTimeout(700); await third.keyboard.up('ArrowRight');
  await host.waitForFunction(x => window.lastSnapshot.candidates.find(c => c.faction_id === 'philippe').x > x + 1, thirdBefore);
  // Static hosting reports the missing server and keeps Solo accessible.
  const offline = await pageAt();
  await offline.route('**/api/multiplayer/status', route => route.fulfill({ status: 404, body: 'Absent' }));
  await offline.locator('#multiplayer').click(); await offline.locator('#server-status').filter({ hasText: 'nécessite un serveur' }).waitFor();
  assert.equal(await offline.locator('#room-form').isVisible(), false);
  await offline.locator('#menu-back').click(); await offline.locator('#solo').waitFor();
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ success: true, errors, checks: ['accueil et clavier', 'candidat transmis à la simulation', 'annulation du chargement', 'tutoriel mobile portrait et paysage', 'salon avec candidat unique', 'départ synchronisé', 'déplacement invité', 'pause partagée', 'déconnexion'] }, null, 2));
  console.log('Parcours Solo et Multijoueur validés.');
} finally { await browser.close(); }

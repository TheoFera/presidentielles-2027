import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const base = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
const output = 'artifacts/debate-selection';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
const newPage = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('#debate').click();
  return page;
};
const portraitsReady = page => page.waitForFunction(() => {
  const images = [...document.querySelectorAll('.select-tile img')];
  return images.length === 9 && images.every(i => i.complete && i.naturalWidth);
});
const fit = async page => {
  const size = page.viewportSize();
  for (const selector of ['#debate-fight', '.select-roster', '.select-stage', '.debate-options']) {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, `${selector} doit rester visible à ${size.width} × ${size.height}`);
  }
};
try {
  await mkdir(output, { recursive: true });
  const solo = await newPage();
  await solo.locator('#solo').click(); await portraitsReady(solo);
  assert.equal(await solo.locator('.select-tile').count(), 9);
  assert.equal(await solo.locator('#start-menu h1').textContent(), 'Débat télé');
  await fit(solo); await solo.screenshot({ path: `${output}/solo-desktop.png` });
  // Les six nouveaux portraits répondent au choix, sans texte ni bouton d’ultime.
  for (const faction of ['glucksmann', 'roussel', 'arthaud', 'dupont_aignan', 'retailleau', 'attal']) {
    await solo.locator(`[data-faction="${faction}"]`).click();
    assert.equal(await solo.locator('.select-fighter.active [data-portrait]').getAttribute('data-portrait'), faction);
    assert.equal(await solo.locator('.select-styles').count(), 0);
    assert.equal(await solo.locator('#debate-fight').isEnabled(), true);
  }
  await solo.locator('[data-faction="arthaud"]').click();
  await solo.locator('[data-slot="1"]').click(); await solo.locator('[data-faction="attal"]').click();
  await solo.locator('[data-format="1v1v1"]').click();
  assert.equal(await solo.locator('.select-fighter').count(), 3);
  assert.equal(await solo.locator('#debate-fight').isEnabled(), true);
  await solo.screenshot({ path: `${output}/solo-trio.png` });
  await solo.locator('[data-format="1v1"]').click();
  await solo.locator('[data-faction="glucksmann"]').focus();
  await solo.keyboard.press('ArrowRight');
  assert.equal(await solo.locator(':focus').getAttribute('data-faction'), 'roussel');
  for (const viewport of [{width:844,height:390}, {width:667,height:375}, {width:960,height:540}]) {
    await solo.setViewportSize(viewport); await fit(solo);
    await solo.screenshot({ path: `${output}/solo-${viewport.width}.png` });
  }
  await solo.setViewportSize({width:1280,height:800});
  await solo.locator('[data-map="plateau"]').click(); await solo.locator('#debate-fight').click();
  await solo.locator('#debate-mode-hud:not([hidden])').waitFor({timeout:60000});
  assert.equal(await solo.locator('.debate-fighter').count(),2);
  assert.equal(await solo.locator('.debate-fighter-ultimate:not([hidden])').count(),0);
  await solo.screenshot({ path: `${output}/combat-minors.png` });
  await solo.close();

  // Deux véritables clients du salon local, avec choix propagés puis chargement commun.
  const host = await newPage(); await host.locator('#multiplayer').click();
  await host.locator('#network-method').selectOption('server');
  await host.locator('#create-room:not([disabled])').waitFor();
  const creation = host.waitForResponse(r => r.url().endsWith('/api/multiplayer/create'));
  await host.locator('#create-room').click();
  const { code } = await (await creation).json();
  const guest = await newPage(); await guest.locator('#multiplayer').click();
  await guest.locator('#network-method').selectOption('server');
  await guest.locator('#room-form button[type="submit"]:not([disabled])').waitFor();
  await guest.locator('#room-code').fill(code); await guest.locator('#room-form button[type="submit"]').click();
  await host.locator('#debate-lobby').waitFor(); await guest.locator('#debate-lobby').waitFor();
  await portraitsReady(host); await portraitsReady(guest);
  await host.locator('[data-faction="arthaud"]').click();
  await guest.locator('[data-faction="attal"]').click();
  await host.locator('[data-faction="attal"] .select-marker').waitFor();
  await guest.locator('[data-faction="arthaud"] .select-marker').waitFor();
  await host.locator('#debate-fight:not([disabled])').waitFor();
  await fit(host); await host.screenshot({path:`${output}/multiplayer-host.png`});
  await guest.screenshot({path:`${output}/multiplayer-guest.png`});
  await host.setViewportSize({width:844,height:390}); await fit(host);
  await host.screenshot({path:`${output}/multiplayer-mobile.png`});
  await host.locator('[data-format="1v1v1"]').click();
  assert.equal(await host.locator('.select-fighter').count(),3);
  await host.locator('#debate-fight').click();
  await host.locator('#debate-mode-hud:not([hidden])').waitFor({timeout:60000});
  await guest.locator('#debate-mode-hud:not([hidden])').waitFor({timeout:60000});
  assert.equal(await host.locator('.debate-fighter').count(),3);
  assert.equal(await guest.locator('.debate-fighter').count(),3);
  assert.deepEqual(errors, []);
  console.log('Sélection des neuf candidats, clavier, trois tailles paysage, combat mineur et salon à deux avec IA vérifiés.');
} finally { await browser.close(); }

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { decodeInvitation } from '../src/network/peer-session.js';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/qr-connection'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
const report = { camera: 'Images du jeu transmises à une caméra simulée, décodage jsQR réel', loopbackIce: true, errors: [], layouts: [], flows: [] };
async function open() {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/api/**', route => route.abort());
  await page.addInitScript(() => {
    window.cameraStreams = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => { window.copiedCode = value; } } });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      if (window.cameraDenied) throw new DOMException('refused', 'NotAllowedError');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 800;
      canvas.getContext('2d').fillRect(0, 0, 800, 800); window.cameraCanvas = canvas;
      const stream = canvas.captureStream(15); window.cameraStreams.push(stream); return stream;
    } });
  });
  await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027');
  await page.locator('#multiplayer').click(); return page;
}
async function fits(page, name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bad = await page.evaluate(() => [...document.querySelectorAll('#start-menu :is(h1,h2,p,button,input,.qr-image,.qr-card,.candidate-badge),dialog[open] :is(h2,video,p,button)')].filter(e => {
    // Les badges dépassent volontairement des cartes, mais doivent rester à l’écran.
    const b = e.getBoundingClientRect(); return b.width && b.height && (b.top < -1 || b.left < -1 || b.bottom > innerHeight + 1 || b.right > innerWidth + 1 || !e.matches('.candidate-card') && ['BUTTON', 'INPUT', 'ARTICLE', 'DIV'].includes(e.tagName) && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2));
  }).map(e => ({ element: e.id || e.className || e.tagName, text: e.textContent.slice(0, 45) })));
  assert.deepEqual(bad, [], name); report.layouts.push(name);
}
async function transfer(source, target, completed) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await completed()) return;
    let bytes;
    try { bytes = await source.screenshot(); }
    catch (error) { if (await completed()) return; throw error; }
    await target.evaluate(async data => {
      const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
      const c = window.cameraCanvas, ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      const size = 700, scale = Math.min(size / img.width, size / img.height);
      ctx.drawImage(img, (800 - img.width * scale) / 2, (800 - img.height * scale) / 2, img.width * scale, img.height * scale);
    }, bytes.toString('base64'));
    await target.waitForTimeout(180);
  }
  throw new Error('Scan incomplet : ' + await target.locator('.qr-scanner p').textContent());
}
try {
  const host = await open(), guest = await open(), third = await open();
  await host.locator('#create-room').click();
  await host.locator('.qr-card svg').first().waitFor(); assert.equal(await host.locator('.qr-card svg').count(), 2);
  for (const slot of [2, 3]) {
    await host.locator(`[data-qr-slot="${slot}"] .qr-copy`).click();
    assert.equal(decodeInvitation(await host.evaluate(() => window.copiedCode), 'offer').slot, slot);
  }
  for (const viewport of [{ width: 667, height: 375 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await host.setViewportSize(viewport); await fits(host, `Deux QR ${viewport.width}x${viewport.height}`);
    await host.screenshot({ path: path.join(output, `invitations-${viewport.width}x${viewport.height}.png`) });
  }
  await host.setViewportSize({ width: 844, height: 390 });
  await guest.evaluate(() => { window.cameraDenied = true; }); await guest.locator('#scan-invitation').click();
  await guest.locator('.qr-scanner p').filter({ hasText: 'Caméra refusée' }).waitFor();
  await fits(guest, 'Caméra refusée'); await guest.locator('.qr-close').click(); await guest.evaluate(() => { window.cameraDenied = false; });
  await guest.locator('#scan-invitation').click(); await guest.waitForFunction(() => window.cameraStreams.length > 0);
  await guest.locator('.qr-switch').click(); await guest.waitForFunction(() => window.cameraStreams.length === 2);
  await guest.locator('.qr-close').click();
  assert.equal(await guest.evaluate(() => window.cameraStreams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
  for (const [page, slot] of [[guest, 2], [third, 3]]) {
    await page.locator('#scan-invitation').click(); await page.waitForFunction(() => window.cameraCanvas);
    await fits(page, 'Scanner invitation');
    await transfer(host.locator(`[data-qr-slot="${slot}"] .qr-image`), page, () => page.locator('[data-screen="qr-answer"] svg').isVisible());
    await page.locator('#copy-answer').click();
    assert.equal(decodeInvitation(await page.evaluate(() => window.copiedCode), 'answer').type, 'answer');
    assert.equal(await page.evaluate(() => window.cameraStreams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
    for (const viewport of [{ width: 667, height: 375 }, { width: 844, height: 390 }]) { await page.setViewportSize(viewport); await fits(page, `Réponse joueur ${slot} ${viewport.width}x${viewport.height}`); }
  }
  // Both invitations were scanned before either answer: accept in reverse order.
  for (const [page, slot] of [[third, 3], [guest, 2]]) {
    await host.locator('#scan-answers').click(); await host.waitForFunction(() => window.cameraCanvas);
    await transfer(page.locator('.qr-image'), host, () => page.locator('[data-screen="waiting"], [data-screen="candidates"]').isVisible());
    if (slot === 3) {
      await host.locator(`[data-qr-slot="${slot}"] .qr-connected`).waitFor();
      assert.equal(await host.locator('[data-candidate]').count(), 0);
    } else await host.locator('[data-screen="candidates"]').waitFor();
    assert.equal(await host.evaluate(() => window.cameraStreams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
  }
  assert.equal(await host.locator('#prepare-game').isDisabled(), true);
  for (const p of [host, guest, third]) assert.equal(await p.locator('[data-candidate][aria-pressed="true"]').count(), 0);
  for (const [p, faction] of [[host, 'philippe'], [guest, 'melenchon'], [third, 'le_pen']]) {
    await p.locator(`[data-candidate="${faction}"]`).click();
    await p.locator(`[data-candidate="${faction}"][aria-pressed="true"]`).waitFor();
    await fits(p, 'Choix du candidat après connexion');
  }
  await host.locator('#prepare-game:not([disabled])').click();
  for (const p of [host, guest, third]) { await p.locator('#start-campaign:not([disabled])').waitFor(); await p.locator('#start-campaign').click(); }
  for (const p of [host, guest, third]) await p.locator('#start-menu').waitFor({ state: 'hidden' });
  report.flows.push('Deux invitations simultanées, lecture réelle des QR animés, réponses dans l’ordre inverse, copie des invitations et réponses, choix des candidats après connexion, trois joueurs démarrent, caméras arrêtées');
  assert.deepEqual(report.errors, []); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.failure = error.stack; for (const [i, context] of browser.contexts().entries()) await context.pages()[0]?.screenshot({ path: path.join(output, `failure-${i}.png`) }); throw error; }
finally { await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }

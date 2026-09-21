import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from './validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CampaignStyleSystem } from '../src/simulation/campaign-styles.js';
import { captureSite } from '../src/simulation/strategic-sites.js';
import { finishSprint } from '../src/simulation/match-lifecycle.js';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/arcade-menu'); await mkdir(output, { recursive: true });
// Optional only for loopback tests on a host that cannot resolve its own mDNS names.
// The game never changes browser network policy; real devices use normal mDNS.
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: process.env.ARCADE_LOOPBACK_ICE ? ['--disable-features=WebRtcHideLocalIpsWithMdns'] : [] });
const url = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
const report = { loopbackIce: !!process.env.ARCADE_LOOPBACK_ICE, layouts: [], layoutErrors: [], flows: [], errors: [] };
const config = campaignConfig();
const opened = [];
const extraBrowsers = [];
async function open(viewport, touch = true) {
  const engine = process.env.ARCADE_SEPARATE_PROCESSES ? await chromium.launch({ headless: true, channel: 'chrome' }) : browser;
  if (engine !== browser) extraBrowsers.push(engine);
  const context = await engine.newContext({ viewport, hasTouch: touch, isMobile: touch });
  await context.grantPermissions(['local-network-access']).catch(() => {});
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  opened.push(page);
  await page.addInitScript(() => {
    window.testPeers = [];
    const Native = RTCPeerConnection;
    window.RTCPeerConnection = class extends Native { constructor(...args) { super(...args); window.testPeers.push(this); } };
  });
  page.on('pageerror', error => report.errors.push(error.message));
  // The default multiplayer path must work on a static site, with no API at all.
  await page.route('**/api/**', route => route.abort());
  await page.goto(url); await page.locator('#solo').waitFor();
  await page.evaluate(async () => {
    const { GameSimulation } = await import('/src/simulation/game-simulation.js');
    const get = GameSimulation.prototype.getState;
    GameSimulation.prototype.getState = function (...args) { const value = get.apply(this, args); window.testSimulation = this; window.testState = value; return value; };
    const { PeerSession } = await import('/src/network/peer-session.js');
    const receive = PeerSession.prototype.receive;
    PeerSession.prototype.receive = function (peer, packet) {
      receive.call(this, peer, packet);
      if (peer.snapshot) window.receivedState = peer.snapshot;
    };
  });
  return page;
}
async function fits(page, selector, name) {
  await page.locator(selector).waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const overflow = await page.locator(selector).evaluate(root => {
    const width = window.visualViewport?.width || innerWidth, height = window.visualViewport?.height || innerHeight;
    return [root, ...root.querySelectorAll('*')].filter(e => {
      const b = e.getBoundingClientRect(); return b.width && b.height && getComputedStyle(e).visibility !== 'hidden';
    }).flatMap(e => {
      const r = e.getBoundingClientRect();
      const out = r.left < -1 || r.top < -1 || r.right > width + 1 || r.bottom > height + 1;
      const clipped = ['DIV', 'SECTION', 'ARTICLE', 'FORM', 'BUTTON', 'DIALOG'].includes(e.tagName) && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2);
      return out || clipped ? [{ element: e.id || e.className || e.tagName, out, clipped, bottom: r.bottom, height, text: e.textContent.slice(0, 55) }] : [];
    });
  });
  if (overflow.length) {
    await page.screenshot({ path: path.join(output, `overflow-${report.layouts.length}.png`) });
    report.layoutErrors.push({ name, overflow }); console.log(JSON.stringify({ name, overflow }));
  }
  report.layouts.push(name);
}
async function solo(page) { await page.locator('#solo').click(); await page.locator('#prepare-game').click(); await page.locator('#start-campaign:not([disabled])').waitFor(); await page.locator('#start-campaign').click(); }
try {
  for (const viewport of process.env.ARCADE_ONLY_NETWORK ? [] : [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 667, height: 375 }]) {
    const label = `${viewport.width}x${viewport.height}`, page = await open(viewport, viewport.width < 1000);
    await fits(page, '#start-menu', `Accueil ${label}`);
    await page.screenshot({ path: path.join(output, `accueil-${label}.png`) });
    await page.locator('#solo').click(); await fits(page, '#start-menu', `Candidats ${label}`);
    await page.screenshot({ path: path.join(output, `candidats-${label}.png`) });
    await page.locator('#prepare-game').click(); await page.locator('#start-campaign:not([disabled])').waitFor();
    await fits(page, '#start-menu', `Tutoriel ${label}`);
    await page.screenshot({ path: path.join(output, `tutoriel-${label}.png`) });
    await page.locator('#start-campaign').click(); await page.locator('#pause-touch').click();
    for (const tab of ['controls', 'field', 'election']) { await page.locator(`[data-help-tab="${tab}"]`).click(); await fits(page, '#help', `Pause ${tab} ${label}`); }
    await page.locator('#pause-home').click(); await page.locator('#multiplayer').click();
    await fits(page, '#start-menu', `Multijoueur ${label}`);
    await page.locator('#text-join').click(); await page.locator('#room-code').fill('erreur'); await page.locator('button[type="submit"]').click();
    await page.locator('#room-error').filter({ hasText: 'invalide' }).waitFor();
    await fits(page, '#start-menu', `Erreur de connexion ${label}`);
    if (viewport.width < 500) {
      await page.locator('#room-code').focus();
      await page.evaluate(() => { Object.defineProperty(visualViewport, 'height', { value: 280, configurable: true }); window.dispatchEvent(new Event('resize')); });
      await fits(page, '#start-menu', `Clavier virtuel ${label}`);
      await page.evaluate(() => { delete visualViewport.height; document.activeElement.blur(); window.dispatchEvent(new Event('resize')); });
    }
    await page.locator('#create-room').click(); await page.locator('#invite-player').waitFor();
    await fits(page, '#start-menu', `Salon ${label}`);
    await page.locator('#invite-player').click(); await page.locator('#text-invite').click(); await page.locator('#copy-signal:not([disabled])').waitFor();
    await fits(page, '#start-menu', `Invitation ${label}`);
    await page.locator('#menu-back').click(); await page.locator('#menu-back').click();
    await solo(page); await page.locator('#pause-touch').click();
    // Import a real mandatory selection to exercise the actual style dialog.
    const sim = new GameSimulation(config, 42); const c = sim.state.candidates.find(c => c.id === sim.state.local_candidate_id);
    const hq = sim.state.buildings.find(b => b.type === 'permanence'); c.x = hq.x; captureSite(sim, hq, c);
    CampaignStyleSystem.open(sim, c, true);
    await page.locator('#load').setInputFiles({ name: 'styles.json', mimeType: 'application/json', buffer: Buffer.from(sim.exportSnapshot()) });
    await page.locator('#campaign-styles[open]').waitFor();
    await fits(page, '#campaign-styles', `Styles ${label}`);
    await page.screenshot({ path: path.join(output, `styles-${label}.png`) });
    await page.locator('.campaign-style-card:not(:disabled)').click();
    await page.locator('#resume').click();
    const result = new GameSimulation(config, 42);
    result.applyCommand({ type: 'DebugStartSprint', factionId: 'philippe' });
    for (const electorate of result.state.electorate) electorate.support = { melenchon: 60, le_pen: 30, philippe: 0, neutral: 10 };
    result.state.sprint_remaining_ticks = 0; finishSprint(result);
    await page.locator('#load').setInputFiles({ name: 'result.json', mimeType: 'application/json', buffer: Buffer.from(result.exportSnapshot()) });
    await page.locator('#results').waitFor(); await fits(page, '#results', `Résultats ${label}`);
    await page.context().close();
  }
  const host = await open({ width: 390, height: 844 });
  const guest = await open({ width: 844, height: 390 });
  const third = await open({ width: 320, height: 568 });
  await host.locator('#multiplayer').click(); await host.locator('#create-room').click();
  async function pair(client, faction) {
    await host.locator('#invite-player').click(); await host.locator('#text-invite').click(); await host.locator('#copy-signal:not([disabled])').waitFor();
    const invitation = await host.locator('#outgoing-code').inputValue();
    await client.locator('#multiplayer').click();
    await client.locator('#text-join').click(); await client.locator('#room-code').fill(invitation); await client.locator('button[type="submit"]').click();
    await client.locator('#text-answer').click(); await client.locator('#outgoing-code').waitFor(); await fits(client, '#start-menu', `Réponse ${faction}`);
    const answer = await client.locator('#outgoing-code').inputValue();
    await host.locator('#answer-code').fill(answer); await host.locator('#accept-peer').click();
    await host.locator('#room-players').waitFor({ timeout: 30000 });
    await client.locator('#room-players').waitFor({ timeout: 30000 });
    await client.locator(`[data-choose="${faction}"]`).click();
    await client.locator(`[data-choose="${faction}"]`).filter({ hasText: 'Votre candidat' }).waitFor();
    if (await host.locator('[data-choose="melenchon"]').isEnabled()) await host.locator('[data-choose="melenchon"]').click();
    await host.locator('#launch-room:not([disabled])').waitFor();
  }
  await pair(guest, 'le_pen');
  await host.locator('#launch-room').click();
  for (const p of [host, guest]) { await p.locator('#start-campaign:not([disabled])').waitFor(); await p.locator('#start-campaign').click(); }
  await guest.locator('#start-menu').waitFor({ state: 'hidden' });
  await host.waitForFunction(() => window.testState?.tick > 0);
  const x = await host.evaluate(() => window.testState.candidates.find(c => c.faction_id === 'le_pen').x);
  const touch = await guest.context().newCDPSession(guest);
  const bounds = await guest.locator('#move-right').boundingBox();
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
  await guest.waitForTimeout(800); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await host.waitForFunction(x => window.testState.candidates.find(c => c.faction_id === 'le_pen').x > x + 1, x);
  report.flows.push('Deux navigateurs tactiles : connexion directe, départ synchronisé et déplacement invité');
  await guest.locator('#pause-touch').click(); await host.locator('#help').waitFor();
  await guest.locator('#pause-home').click(); await host.locator('#disconnect-message').waitFor();
  await fits(host, '#start-menu', 'Déconnexion');
  await host.locator('#back-to-home').click(); await host.locator('#multiplayer').click(); await host.locator('#create-room').click();
  await pair(guest, 'le_pen'); await pair(third, 'philippe');
  assert.equal(await host.locator('#invite-player').isDisabled(), true);
  await fits(host, '#start-menu', 'Salon complet'); await host.screenshot({ path: path.join(output, 'salon-trois-telephones.png') });
  await host.locator('#launch-room').click();
  for (const p of [host, guest, third]) { await p.locator('#start-campaign:not([disabled])').waitFor(); await p.locator('#start-campaign').click(); }
  await third.locator('#start-menu').waitFor({ state: 'hidden' });
  await host.waitForFunction(() => window.testState?.human_candidate_ids?.length === 3 && window.testState.tick > 0);
  const x3 = await host.evaluate(() => window.testState.candidates.find(c => c.faction_id === 'philippe').x);
  await third.keyboard.down('ArrowRight'); await third.waitForTimeout(800); await third.keyboard.up('ArrowRight');
  await host.waitForFunction(x => window.testState.candidates.find(c => c.faction_id === 'philippe').x > x + 1, x3);
  report.flows.push('Trois navigateurs tactiles : troisième candidat contrôlé à distance, aucune API utilisée');
  await host.evaluate(() => window.testSimulation.applyCommand({ type: 'DebugAdvanceCampaign', remaining: 0 }));
  for (const p of [guest, third]) await p.waitForFunction(() => window.receivedState?.phase === 'FIRST_ROUND_ARENA' && window.receivedState.arena.tick > 20);
  await host.evaluate(() => window.testSimulation.applyCommand({ type: 'DebugFinishArena', factionId: 'philippe' }));
  for (const p of [guest, third]) await p.waitForFunction(() => window.receivedState?.phase === 'SECOND_ROUND_SPRINT');
  await host.evaluate(async () => {
    const { finishSprint } = await import('/src/simulation/match-lifecycle.js');
    for (const e of window.testSimulation.state.electorate) e.support = { melenchon: 60, le_pen: 30, philippe: 0, neutral: 10 };
    finishSprint(window.testSimulation);
  });
  for (const p of [guest, third]) await p.waitForFunction(() => window.receivedState?.phase === 'RESULTS');
  report.flows.push('Trois navigateurs : fin du décompte, duel, élimination et résultat synchronisés sans déconnexion');
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.layoutErrors, []);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failure = error.stack;
  for (const [i, page] of opened.entries()) if (!page.isClosed()) {
    await page.screenshot({ path: path.join(output, `failure-${i}.png`) });
    console.log(JSON.stringify(await page.evaluate(() => ({ screen: document.querySelector('#start-menu').innerText, errors: window.testPeers.map(p => ({ connection: p.connectionState, ice: p.iceConnectionState, signaling: p.signalingState })) }))));
  }
  throw error;
}
finally { await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); for (const engine of extraBrowsers) await engine.close(); }

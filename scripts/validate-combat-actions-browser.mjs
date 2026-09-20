import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from './validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CampaignStyleSystem, CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';
import { startSolo } from './browser-start.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/combat-actions');
await mkdir(output, { recursive: true });
const config = campaignConfig();
function snapshot(charge = 0) {
  const sim = new GameSimulation(config, 42);
  sim.state.ai_enabled = false; sim.state.npcs = [];
  sim.state.candidates.forEach((c, i) => { c.x = 100 + i * 100; c.axis = 0; c.money = 0; });
  const c = sim.state.candidates.find(c => c.id === sim.state.local_candidate_id);
  CampaignStyleSystem.select(sim, c, CAMPAIGN_STYLES[c.faction_id][0].id, true);
  sim.applyCommand({ type: 'DebugSetUltimateCharge', candidateId: c.id, value: charge });
  return sim.exportSnapshot();
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = { flows: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  await context.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.lastExport = blob.text(); return create(blob); };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (!this.download) click.call(this); };
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027');
  await startSolo(page);
  async function load(charge = 0) {
    await page.locator('#load').setInputFiles({ name: 'combat.json', mimeType: 'application/json', buffer: Buffer.from(snapshot(charge)) });
    if (await page.locator('#help').isVisible()) await page.locator('#resume').click();
    await page.waitForSelector('#touch-controls', { state: 'visible' });
  }
  async function state() {
    await page.locator('#save').evaluate(e => e.click());
    return page.evaluate(async () => JSON.parse(await window.lastExport));
  }
  const local = s => s.candidates.find(c => c.id === s.local_candidate_id);
  await load(6);
  const boxes = await page.locator('#jump-touch, #ultimate-touch, #attack-touch').evaluateAll(es => es.map(e => {
    const r = e.getBoundingClientRect(); return { id: e.id, x: r.x, y: r.y, right: r.right, bottom: r.bottom };
  }));
  const [jump, ultimate, attack] = boxes;
  assert.ok(jump.right < attack.x); assert.equal(jump.y, attack.y);
  assert.equal(ultimate.x, attack.x); assert.ok(ultimate.bottom < attack.y);
  await page.screenshot({ path: path.join(output, 'commandes-paysage.png') });
  report.flows.push('Sauter à gauche de Frapper ; Ultime au-dessus ; progression visible à 60 %.');

  await load();
  await page.keyboard.down('Space');
  await page.waitForFunction(() => document.getElementById('attack-touch').classList.contains('charging'));
  const startX = local(await state()).x;
  await page.keyboard.down('d');
  await page.waitForFunction(() => document.getElementById('attack-touch').textContent === 'Prête !');
  await page.keyboard.up('d');
  const held = await state();
  assert.equal(local(held).x, startX); assert.equal(held.attacks.length, 0);
  await page.screenshot({ path: path.join(output, 'charge-prete.png') });
  await page.keyboard.up('Space'); await page.waitForTimeout(120);
  assert.ok((await state()).events.some(e => e.type === 'AttackStarted' && e.kind === 'CHARGED'));
  report.flows.push('Espace maintenu : charge prête, personnage immobile, frappe chargée uniquement au relâchement.');

  await load(); await page.keyboard.down('Space');
  await page.waitForFunction(() => document.getElementById('attack-touch').classList.contains('charging'));
  await page.keyboard.press('d'); await page.keyboard.press('d'); await page.waitForTimeout(100);
  await page.keyboard.up('Space'); await page.waitForTimeout(300);
  const dashed = await state();
  assert.ok(dashed.events.some(e => e.type === 'DashStarted'));
  assert.equal(local(dashed).combat.press_tick, null);
  assert.equal(dashed.events.some(e => e.type === 'AttackStarted'), false);
  report.flows.push('Dash annule la charge, sans coup au relâchement.');

  await load(); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(280);
  const jumping = await state(); assert.ok(local(jumping).combat.height > 1.5);
  await page.screenshot({ path: path.join(output, 'saut.png') });
  await page.keyboard.press('Space'); await page.waitForTimeout(90);
  assert.ok((await state()).events.some(e => e.type === 'AttackStarted' && e.kind === 'CANDIDATE'));
  await page.waitForTimeout(800); assert.equal(local(await state()).combat.height, 0);
  report.flows.push('Flèche haut : saut réel, attaque aérienne, retour au sol.');

  await load(10); await page.keyboard.down('Space');
  await page.waitForFunction(() => document.getElementById('attack-touch').classList.contains('charging'));
  assert.equal(await page.locator('#ultimate-touch').isDisabled(), false);
  await page.keyboard.press('r'); await page.keyboard.up('Space'); await page.waitForTimeout(100);
  const power = await state(); assert.equal(local(power).special_charge, 0); assert.equal(local(power).combat.press_tick, null);
  assert.ok(power.events.some(e => e.type === 'UltimateActivated'));
  report.flows.push('R active immédiatement l’ultime pendant une charge.');

  await load();
  const touch = await context.newCDPSession(page);
  const attackBox = await page.locator('#attack-touch').boundingBox();
  const point = { x: attackBox.x + attackBox.width / 2, y: attackBox.y + attackBox.height / 2, id: 1 };
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForFunction(() => document.getElementById('attack-touch').textContent === 'Prête !');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  assert.ok((await state()).events.some(e => e.type === 'AttackStarted' && e.kind === 'CHARGED'));
  await load();
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForFunction(() => document.getElementById('attack-touch').classList.contains('charging'));
  await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.waitForTimeout(100); assert.equal(local(await state()).combat.press_tick, null);
  report.flows.push('Maintien tactile : frappe chargée au relâchement ; annulation tactile sans frappe.');

  await page.setViewportSize({ width: 390, height: 844 }); await load(10);
  await page.screenshot({ path: path.join(output, 'commandes-portrait.png') });
  for (const id of ['jump-touch', 'attack-touch', 'ultimate-touch']) {
    const box = await page.locator(`#${id}`).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390);
  }
  assert.equal(await page.locator('#error').isVisible(), false); assert.deepEqual(report.errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }

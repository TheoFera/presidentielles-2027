import { startSolo } from './browser-start.mjs';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from './validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CAMPAIGN_STYLES, CampaignStyleSystem } from '../src/simulation/campaign-styles.js';
import { captureSite } from '../src/simulation/strategic-sites.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { refreshInfluenceSources } from '../src/simulation/territory.js';

// Use installed Playwright, or the desktop's bundled Node modules without adding runtime dependencies to the game.
const require = createRequire(import.meta.url);
const { chromium } = process.env.CAMPAIGN_TEST_NODE_MODULES ? require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright')) : require('playwright');
const baseURL = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
const output = path.resolve('artifacts/styles-browser'); await mkdir(output, { recursive: true });
const config = campaignConfig();
function snapshot(faction, mandatory = true, styleId = null) {
  const sim = new GameSimulation(config, 42, `candidate:${faction}`);
  sim.state.ai_enabled = false;
  const c = sim.state.candidates.find(c => c.faction_id === faction), hq = sim.state.buildings.find(b => b.type === 'permanence');
  c.x = hq.x; captureSite(sim, hq, c); c.money = 0; c.interaction_active = false;
  for (const other of sim.state.candidates) if (other !== c) other.axis = 0;
  if (!mandatory) { sim.profile.unlocked_campaign_styles[faction] = CAMPAIGN_STYLES[faction].map(s => s.id); CampaignStyleSystem.select(sim, c, styleId || CAMPAIGN_STYLES[faction][0].id); }
  refreshElectoralState(sim.state, config); refreshInfluenceSources(sim.state, config);
  return sim.exportSnapshot();
}
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
const report = { cards: [], viewports: [], errors: [], flows: [] };
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 900 });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', response => { if (response.status() >= 400 && /character-(style|ultimate)-/.test(response.url())) report.errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(baseURL); await page.waitForSelector('#campaign-styles', { state: 'attached' });
    await startSolo(page);
    for (const faction of Object.keys(CAMPAIGN_STYLES)) {
      await page.locator('#load').setInputFiles({ name: 'styles.json', mimeType: 'application/json', buffer: Buffer.from(snapshot(faction)) });
      await page.waitForSelector('#campaign-styles[open]');
      await page.waitForFunction(() => document.querySelectorAll('#campaign-styles canvas[data-loaded="true"]').length === 3);
      assert.equal(await page.locator('.campaign-style-card').count(), 3);
      assert.equal(await page.locator('.campaign-style-card:disabled').count(), 2);
      assert.equal(await page.locator('.campaign-style-cancel').count(), 0);
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#campaign-styles').evaluate(d => d.open), true);
      const layout = await page.locator('.campaign-style-card').evaluateAll(cards => cards.map(c => {
        const r = c.getBoundingClientRect(); return { style: c.dataset.styleId, x: r.x, right: r.right, width: r.width, sprite: c.querySelector('canvas').dataset.spriteId };
      }));
      assert.ok(layout.every(c => c.x >= 0 && c.right <= viewport.width + 1));
      assert.ok(layout[0].x < layout[1].x && layout[1].x < layout[2].x);
      report.cards.push(...layout.map(c => ({ ...c, viewport })));
      await page.screenshot({ path: path.join(output, `${faction}-${viewport.width}x${viewport.height}.png`) });
      await page.locator('.campaign-style-card:not(:disabled)').click(); await page.waitForSelector('#campaign-styles', { state: 'hidden' });
      if (viewport.width === 1440 && faction === 'melenchon') {
        await page.waitForSelector('#change-campaign-style', { state: 'visible' });
        await page.keyboard.down('e');
        await page.waitForFunction(() => document.querySelector('#change-campaign-style progress').value > .15);
        await page.keyboard.up('e');
        assert.equal(await page.locator('#campaign-styles').evaluate(d => d.open), false);
        await page.keyboard.down('e'); await page.waitForSelector('#campaign-styles[open]', { timeout: 6500 }); await page.keyboard.up('e');
        assert.equal(await page.locator('.campaign-style-card.current').count(), 1);
        await page.locator('.campaign-style-cancel').click(); await page.waitForSelector('#campaign-styles', { state: 'hidden' });
        report.flows.push('Maintien clavier, interruption et annulation au QG');
      }
    }
    assert.equal(await page.locator('#error').isVisible(), false);
    report.viewports.push(viewport); await context.close();
  }
  // The same actual application, with a test profile containing all unlocks, exercises each selectable card.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.lastExport = blob.text(); return create(blob); };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (!this.download) click.call(this); };
  });
  await context.addInitScript(profile => localStorage.setItem('presidentielles2027:profile:v1', JSON.stringify(profile)), {
    unlocked_campaign_styles: Object.fromEntries(Object.entries(CAMPAIGN_STYLES).map(([f, styles]) => [f, styles.map(s => s.id)])),
  });
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(baseURL); await page.waitForSelector('#campaign-styles', { state: 'attached' });
    await startSolo(page);
  for (const [faction, styles] of Object.entries(CAMPAIGN_STYLES)) for (const style of styles) {
    await page.locator('#load').setInputFiles({ name: 'style.json', mimeType: 'application/json', buffer: Buffer.from(snapshot(faction)) });
    await page.waitForSelector('#campaign-styles[open]');
    await page.locator(`[data-style-id="${style.id}"]`).click();
    await page.waitForSelector('#campaign-styles', { state: 'hidden' });
    await page.locator('#world').focus();
    if (!await page.locator('#debug').isVisible()) await page.keyboard.press('F3');
    if (!await page.locator('#debug-tools').evaluate(d => d.open)) await page.locator('#debug-tools > summary').click();
    await page.locator('#save').click();
    const text = await page.evaluate(() => window.lastExport);
    const state = JSON.parse(text), c = state.candidates.find(c => c.id === state.local_candidate_id);
    assert.equal(c.current_campaign_style, style.id); assert.equal(c.special_charge, 0);
    report.flows.push(`Sélection réelle et sauvegarde : ${style.id}`);
    await page.locator('#close-debug').click();
  }
  for (const [faction, styles] of Object.entries(CAMPAIGN_STYLES)) for (const style of styles) {
    const result = await page.evaluate(async ({ config, faction, style }) => {
      const { GameSimulation } = await import('/src/simulation/game-simulation.js');
      const { CampaignStyleSystem } = await import('/src/simulation/campaign-styles.js');
      const { beginCombatTick, activateUltimate, updateCombat } = await import('/src/simulation/combat.js');
      const { hit } = await import('/src/simulation/combat-state.js');
      const { WorldRenderer } = await import('/src/presentation/renderer.js');
      const { characterAssetId } = await import('/src/presentation/illustrated-characters.js');
      document.getElementById('ultimate-preview')?.remove();
      const canvas = document.createElement('canvas'); canvas.id = 'ultimate-preview';
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:99999'; document.body.append(canvas);
      const sim = new GameSimulation(config, 42, `candidate:${faction}`, { unlocked_campaign_styles: { [faction]: [style.id] } });
      const c = sim.state.candidates.find(c => c.faction_id === faction), enemy = sim.state.candidates.find(c => c !== sim.state.candidates.find(c => c.faction_id === faction));
      c.x = 100; c.facing = 1; enemy.x = 110;
      CampaignStyleSystem.open(sim, c, true); CampaignStyleSystem.select(sim, c, style.id);
      c.special_charge = config.balance.special_charge.required_points;
      activateUltimate(sim, c);
      if (style.ultimate.kind === 'BARDELLA') hit(sim, enemy, c, { damage: 999, knockback: 0 }, 'preview:ko');
      for (let i = 0; i < 20; i++) { sim.state.tick++; beginCombatTick(sim); updateCombat(sim); }
      const renderer = new WorldRenderer(canvas, config); renderer.draw(sim.state, sim.state, 1, 1/60);
      await renderer.assets.preload([...renderer.assets.protectedIds]);
      renderer.draw(sim.state, sim.state, 1, 1/60); renderer.resizeObserver.disconnect();
      return { style: style.id, sprite: characterAssetId(c, sim.state), failures: renderer.assets.status().failed, powers: sim.state.powers.map(p => p.kind), bardella: c.bardella_form };
    }, { config, faction, style });
    assert.deepEqual(result.failures, []);
    assert.ok(result.bardella || result.powers.includes(style.ultimate.kind));
    await page.screenshot({ path: path.join(output, `ultime-${style.id}.png`) });
    report.flows.push(`Rendu de l’ultime : ${style.id}`);
  }
  await context.close();
  assert.deepEqual(report.errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Validation navigateur : ${report.cards.length} cartes vérifiées sur ${report.viewports.length} tailles ; ${report.flows.length} parcours réussis.`);
} finally { await browser.close(); }

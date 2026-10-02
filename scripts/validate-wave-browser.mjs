import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from './validate-campaign.mjs';

const require = createRequire(import.meta.url);
const { chromium } = process.env.CAMPAIGN_TEST_NODE_MODULES
  ? require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright')) : require('playwright');
const output = path.resolve('artifacts/wave-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
const errors = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027');
    for (const direction of [1, -1]) {
      const result = await page.evaluate(async ({ config, direction }) => {
        const { GameSimulation } = await import('/src/simulation/game-simulation.js');
        const { activateUltimate, beginCombatTick, updateCombat } = await import('/src/simulation/combat.js');
        const { WorldRenderer } = await import('/src/presentation/renderer.js');
        const { waveEffectAtlas } = await import('/src/presentation/wave-sprites.js');
        document.getElementById('wave-preview')?.remove();
        const canvas = document.createElement('canvas'); canvas.id = 'wave-preview';
        canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';
        document.body.append(canvas);
        const sim = new GameSimulation(config, 42, 'candidate:le_pen');
        sim.state.npcs = []; sim.state.ai_enabled = false;
        const c = sim.state.candidates.find(candidate => candidate.faction_id === 'le_pen');
        c.x = 100; c.facing = direction; c.current_campaign_style = 'le_pen_souverainiste';
        for (const enemy of sim.state.candidates) if (enemy !== c) enemy.x = 120;
        c.special_charge = config.balance.special_charge.required_points;
        activateUltimate(sim, c);
        for (let i = 0; i < 15; i++) { sim.state.tick++; beginCombatTick(sim); updateCombat(sim); }
        const renderer = new WorldRenderer(canvas, config);
        renderer.draw(sim.state, sim.state, 1, 1 / 60);
        await renderer.assets.preload([...renderer.assets.protectedIds, waveEffectAtlas.sprite]);
        renderer.draw(sim.state, sim.state, 1, 1 / 60);
        renderer.resizeObserver.disconnect();
        const image = renderer.assets.get(waveEffectAtlas.sprite);
        const check = document.createElement('canvas'); check.width = 768; check.height = 512;
        const ctx = check.getContext('2d', { willReadFrequently: true });
        const frames = waveEffectAtlas.frames.map(([x, y, w, h]) => {
          ctx.clearRect(0, 0, w, h); ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          let borderAlpha = 0, visible = 0, outside = 0;
          for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
            const alpha = data[(py * w + px) * 4 + 3];
            if (px < 8 || px >= w - 8 || py < 8 || py >= h - 8) borderAlpha = Math.max(borderAlpha, alpha);
            if (alpha > 150) visible++;
            if (alpha < 10) outside++;
          }
          return { borderAlpha, visible, outside };
        });
        return { frames, failures: renderer.assets.status().failed, wave: sim.state.projectiles.some(p => p.kind === 'WAVE' && p.launched) };
      }, { config: campaignConfig(), direction });
      assert.equal(result.wave, true); assert.deepEqual(result.failures, []);
      for (const frame of result.frames) {
        assert.ok(frame.borderAlpha < 10, 'Aucune découpe sur les bords');
        assert.ok(frame.visible > 20000, 'Vague visible');
        assert.ok(frame.outside > 150000, 'Fond transparent autour de la vague');
      }
      await page.screenshot({ path: path.join(output, `vague-${viewport.width}-${direction}.png`) });
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('Vague vérifiée sur ordinateur et mobile, dans les deux directions : quatre cadres sans bord coupé, fond transparent et aucune erreur navigateur.');
} finally { await browser.close(); }

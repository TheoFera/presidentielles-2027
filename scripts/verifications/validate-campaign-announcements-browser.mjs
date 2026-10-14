import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { config } from '../game-config.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.resolve(process.env.CAMPAIGN_TEST_ARTIFACTS || 'artifacts/campaign-announcements');
const base = 'http://localhost:2027';
const fixture = (await readFile(path.join(root, 'index.html'), 'utf8')).replace('<script type="module" src="src/main.js"></script>', '');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
await mkdir(output, { recursive: true });
try {
  for (const [name, width, height, touch] of [['desktop', 1600, 900, false], ['mobile', 844, 390, true], ['small-mobile', 640, 360, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/announcements-check') return route.fulfill({ contentType: 'text/html', body: fixture });
      const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (url.origin !== base || path.relative(root, file).startsWith('..')) return route.abort();
      if (!['.js', '.css', '.json'].includes(path.extname(file))) return route.abort();
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
      try { await route.fulfill({ contentType: mime[path.extname(file)], body: await readFile(file) }); }
      catch { await route.fulfill({ status: 404, body: 'Fichier introuvable.' }); }
    });
    await page.goto(`${base}/announcements-check`);
    await page.evaluate(() => {
      for (const id of ['legal-notice', 'start-menu', 'orientation-hint']) document.getElementById(id).remove();
      document.getElementById('game').removeAttribute('inert');
    });
    for (const variant of config.campaignCatalog) for (const headline of variant.headlines) {
      await page.evaluate(async ({ config, variant, headline }) => {
        const { GameSimulation } = await import('/src/simulation/game-simulation.js');
        const { CampaignEventDirector } = await import('/src/simulation/campaign-events.js');
        const { CampaignDisplay } = await import('/src/presentation/interface/campaign.js');
        const { ElectoralDisplay } = await import('/src/presentation/carte/electoral.js');
        document.getElementById('campaign-events')?.remove();
        const sim = new GameSimulation({ ...config, campaignCatalog: [{ ...variant, headlines: [headline] }] }, 42);
        sim.config.balance.campaign_events.event_enabled = true;
        const event = CampaignEventDirector.start(sim, { family: 'RASSEMBLEMENT' });
        const display = new CampaignDisplay(sim.config);
        display.update(sim.state);
        new ElectoralDisplay(sim.config).update(sim.state, sim.state.candidates[0]);
        document.getElementById('money').textContent = '125 k€';
        window.announcementCheck = { sim, event, display };
      }, { config, variant, headline });
      await page.locator('.campaign-card').evaluate(card => card.getAnimations().forEach(animation => animation.finish()));
      for (const compact of [false, true]) {
        if (compact) await page.evaluate(() => {
          const { sim, event, display } = window.announcementCheck;
          display.seen.set(event.id, performance.now() - 6100);
          display.update(sim.state);
          document.querySelector('.campaign-card').getAnimations().forEach(animation => animation.finish());
        });
        const report = await page.evaluate(() => {
          const card = document.querySelector('.campaign-card'), title = card.querySelector('.news-title');
          const box = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
          return { card: box(card), game: box(document.getElementById('game')), wheel: box(document.getElementById('electoral-display')),
            controls: [...document.querySelectorAll('#touch-controls button')].filter(button => button.getBoundingClientRect().width).map(box),
            title: title.textContent, dimensions: [title.scrollWidth, title.clientWidth, title.scrollHeight, title.clientHeight], fits: title.scrollWidth <= title.clientWidth + 1 && title.scrollHeight <= title.clientHeight + 1,
            texts: [...card.children].filter(child => getComputedStyle(child).display !== 'none').map(child => child.textContent) };
        });
        const label = `${name} / ${variant.biome_target} / ${compact ? 'rappel' : headline}`;
        assert.equal(report.fits, true, `${label} : texte coupé ${JSON.stringify(report)}`);
        assert.equal(report.title, compact ? variant.title : headline);
        assert.ok(report.card.left >= report.game.left && report.card.right <= report.game.right + 1 && report.card.top >= report.game.top && report.card.bottom <= report.game.bottom, `${label} : hors du jeu`);
        assert.ok(report.card.bottom < report.game.top + (report.game.bottom - report.game.top) * config.layout.visual_layout.player_ground_y_ratio, `${label} : ligne de marche masquée`);
        const overlaps = other => report.card.left < other.right && report.card.right > other.left && report.card.top < other.bottom && report.card.bottom > other.top;
        assert.equal(overlaps(report.wheel), false, `${label} : carte masquée`);
        assert.ok(report.controls.every(control => !overlaps(control)), `${label} : commande masquée`);
        if (compact) assert.deepEqual(report.texts, ['EN DIRECT', variant.title]);
        if (headline === config.campaignCatalog[0].headlines.at(-1)) await page.screenshot({ path: path.join(output, `${name}-${compact ? 'rappel' : 'flash'}.png`) });
      }
    }
    console.log(`${name} : les 18 titres et les six rappels sont lisibles, sans masquer la carte, la marche ou les commandes.`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { startSolo } from './browser-start.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/map-wheel');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
  for (const [name, width, height, touch] of [['desktop', 1600, 900, false], ['mobile', 844, 390, true], ['small-mobile', 640, 360, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: touch ? 1 : 2 });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027');
    if (await page.locator('#legal-notice-accept').isVisible()) await page.locator('#legal-notice-accept').click();
    await page.locator('#campaign').click();
    await startSolo(page);
    await page.locator('.map-sector').first().waitFor();
    assert.equal(await page.locator('.map-sector').count(), 18);
    assert.equal(await page.locator('.map-biome-arc').count(), 6);
    assert.equal(await page.locator('.map-icon image').count(), 18);
    await page.evaluate(async () => {
      const image = new Image();
      image.src = document.querySelector('.map-icon image').getAttribute('href');
      await image.decode();
    });
    // Chaque contour doit tenir dans son quartier, même après la rotation.
    const overflowing = await page.locator('.map-icon').evaluateAll(icons => icons.flatMap((icon, index) => {
      const inverse = icon.closest('svg').querySelector('.map-rotor').getCTM().inverse();
      const middle = (index + .5) * Math.PI / 9;
      const crop = icon.closest('svg').querySelector(`#map-wheel-crop-${icon.dataset.icon} rect`);
      const matrix = inverse.multiply(icon.getCTM());
      const x = crop.x.baseVal.value, y = crop.y.baseVal.value;
      const w = crop.width.baseVal.value, h = crop.height.baseVal.value;
      for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
        const point = new DOMPoint(cx, cy).matrixTransform(matrix);
        const dx = point.x - 160, dy = 160 - point.y;
        const radius = Math.hypot(dx, dy);
        const angle = Math.atan2(Math.sin(Math.atan2(dx, dy) - middle), Math.cos(Math.atan2(dx, dy) - middle));
        if (radius < 81 || radius > 135 || Math.abs(angle) > Math.PI / 18 - .01) return [icon.dataset.icon];
      }
      return [];
    }));
    assert.deepEqual(overflowing, [], `${name} : un dessin déborde de son secteur`);
    const rotor = page.locator('.map-rotor');
    const before = await rotor.getAttribute('transform');
    await page.locator('#world').focus();
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(old => document.querySelector('.map-rotor').getAttribute('transform') !== old, before);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('h');
    await page.locator('#help').waitFor();
    // Laisser l'affichage appliquer la position figée avant de la comparer.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const paused = await rotor.getAttribute('transform');
    await page.waitForTimeout(100);
    // Tolérer le dernier ajustement d'interpolation, inférieur à un pixel.
    const angleOf = transform => Number(transform.match(/rotate\(([^ ]+)/)[1]);
    assert.ok(Math.abs(angleOf(await rotor.getAttribute('transform')) - angleOf(paused)) < .05);
    await page.keyboard.press('h');
    await page.locator('#help').waitFor({ state: 'hidden' });
    const boxes = await page.evaluate(() => {
      const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
      return { game: box('game'), wheel: box('electoral-display'), funds: box('funds') };
    });
    assert.ok(boxes.funds.right < boxes.wheel.left);
    assert.ok(boxes.wheel.right <= boxes.game.right && boxes.wheel.top >= boxes.game.top);
    assert.ok(Math.abs(boxes.wheel.width / boxes.game.width - .18) < .01);
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    await page.locator('#electoral-display').screenshot({ path: path.join(output, `${name}-wheel.png`) });
    // Mesure fictive uniquement pour vérifier le contraste et l'agencement du HUD.
    await page.evaluate(async () => {
      const { ElectoralDisplay } = await import('/src/presentation/carte/electoral.js');
      const update = ElectoralDisplay.prototype.update;
      ElectoralDisplay.prototype.update = function (state, candidate, x) {
        const snapshot = { measured_tick: 0,
          national_support: { melenchon: 30, le_pen: 20, philippe: 10, neutral: 35, pending: 5 },
          zones: state.world.subzones.map((z, i) => ({ subzone_id: z.id, controller: ['melenchon', 'le_pen', 'philippe', null][i % 4] })),
        };
        return update.call(this, { ...state, polls: { ...state.polls, [candidate.faction_id]: { active: true, lastPollSnapshot: snapshot } } }, candidate, x);
      };
      const card = document.createElement('article'); card.className = 'campaign-card';
      const title = document.createElement('strong'); title.textContent = 'Meeting exceptionnel';
      const description = document.createElement('span'); description.textContent = 'Un rassemblement se prépare dans le quartier.';
      card.append(title, description); document.getElementById('campaign-flashes').append(card);
    });
    await page.locator('#poll-scores').waitFor();
    const overlays = await page.evaluate(() => {
      const ids = ['electoral-display', 'poll-scores', 'campaign-flashes'];
      return ids.map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, x: r.x, y: r.y, right: r.right, bottom: r.bottom }; });
    });
    for (let i = 0; i < overlays.length; i++) for (let j = i + 1; j < overlays.length; j++) {
      const a = overlays[i], b = overlays[j];
      assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `${name} : ${a.id} recouvre ${b.id}`);
    }
    await page.screenshot({ path: path.join(output, `${name}-poll.png`) });
    await page.locator('#electoral-display').screenshot({ path: path.join(output, `${name}-wheel-poll.png`) });
    await page.keyboard.press('h');
    assert.equal(await page.locator('#help').isVisible(), true);
    console.log(`${name} : rotation, pause, dimensions et commandes vérifiées`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}

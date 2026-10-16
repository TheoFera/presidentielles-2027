// Déclenchement depuis le vrai bouton du jeu, avec préparation des bitmaps et dégâts réels.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CAMPAIGN_TEST_NODE_MODULES ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright') : 'playwright');
const directory = path.resolve('artifacts/ultimes-mineurs/rafale');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' }), errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('presidentielles2027:profile:v1', JSON.stringify({ nickname: 'betatest' })));
  await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027');
  await page.locator('#legal-notice-accept').click({ timeout: 30000 });
  await page.locator('#debate').click(); await page.locator('#solo').click();
  await page.locator('[data-faction="glucksmann"]').click(); await page.locator('[data-faction="philippe"]').click();
  await page.evaluate(async () => {
    const { DebateMatch } = await import('/src/simulation/debate-mode.js');
    const create = DebateMatch.prototype.createCandidates, step = DebateMatch.prototype.step;
    window.rafaleCheck = { planeDraws: 0, missileDraws: 0, deformation: [], hits: 0, complete: false };
    DebateMatch.prototype.createCandidates = function () {
      const candidates = create.call(this);
      candidates[0].special_charge = this.config.balance.special_charge.required_points;
      candidates[1].combat.stun_ticks = 600; return candidates;
    };
    DebateMatch.prototype.step = function (...args) {
      // La cible suit successivement les trois zones pour vérifier chaque impact séparément.
      const power = this.state.powers.find(p => p.kind === 'DELIVERY');
      if (power) {
        const drop = power.impacts.find(drop => !drop.done), target = this.state.candidates[1];
        if (drop) target.x = drop.x;
        target.combat.height = 0; target.combat.knockback_velocity = 0;
        target.combat.invulnerable_until_tick = 0; target.combat.stun_ticks = 600;
      }
      const result = step.apply(this, args); window.rafaleMatch = this;
      const live = this.state.powers.find(p => p.kind === 'DELIVERY');
      if (live) {
        window.rafaleCheck.impacts = structuredClone(live.impacts);
        window.rafaleCheck.complete = live.impacts.every(drop => drop.done);
        const hits = this.state.hit_results.filter(hit => hit.attack_id === live.id);
        window.rafaleCheck.hits = hits.length;
        window.rafaleCheck.damage = hits.reduce((sum, hit) => sum + hit.damage, 0);
        window.rafaleCheck.charge = this.state.candidates[0].special_charge;
      }
      return result;
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
      if (window.rafaleMatch?.state.powers.some(p => p.kind === 'DELIVERY')) {
        const plane = image.width === 1697 && image.height === 757, missile = image.width === 2100 && image.height === 487;
        if (plane || missile) {
          const report = window.rafaleCheck, matrix = this.getTransform();
          report[plane ? 'planeDraws' : 'missileDraws']++;
          const sourceWidth = args.length === 8 ? args[2] : image.width, sourceHeight = args.length === 8 ? args[3] : image.height;
          const ratio = (Math.hypot(matrix.a, matrix.b) * args.at(-2) / sourceWidth) / (Math.hypot(matrix.c, matrix.d) * args.at(-1) / sourceHeight);
          if (Math.abs(ratio - 1) > .01) report.deformation.push(ratio);
        }
      }
      return draw.call(this, image, ...args);
    };
  });
  await page.locator('#debate-fight').click();
  await page.waitForFunction(() => window.rafaleMatch?.state.phase === 'FIGHT', null, { timeout: 90000 });
  await page.locator('#ultimate-touch.ready').click();
  await page.waitForFunction(() => window.rafaleCheck.missileDraws > 0);
  await page.screenshot({ path: path.join(directory, 'rafale-en-debat.png') });
  await page.waitForFunction(() => window.rafaleCheck.complete);
  const report = await page.evaluate(() => window.rafaleCheck);
  assert.ok(report.planeDraws > 0 && report.missileDraws > 0);
  assert.equal(report.hits, 3); assert.equal(report.damage, 39); assert.equal(report.impacts.length, 3);
  assert.ok(report.charge < 100); assert.deepEqual(report.deformation, []); assert.deepEqual(errors, []);
  await writeFile(path.join(directory, 'verification-interface.json'), JSON.stringify({ ...report, errors }, null, 2));
  console.log('Rafale déclenché dans l’interface : avion et missiles dessinés, trois impacts et trois touches, aucune erreur ni déformation.');
} finally { await browser.close(); }

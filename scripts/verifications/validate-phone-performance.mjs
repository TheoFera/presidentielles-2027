import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Mesure le parcours réel, sans réseau : les requêtes lisent les sources locales.
// --reference=fichier.json remplace seulement les sources indiquées dans cet instantané.
const root = fileURLToPath(new URL('../../', import.meta.url));
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const label = option('label') || 'current', engine = option('engine') || 'chromium';
const reference = option('reference') ? JSON.parse((await readFile(option('reference'), 'utf8')).replace(/^\uFEFF/, '')) : {};
const require = createRequire(import.meta.url);
const playwright = require(process.env.CAMPAIGN_TEST_NODE_MODULES ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright') : 'playwright');
const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: 'chrome' } : {}) });
const output = path.join(root, 'artifacts/performance-mobile');
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ noBitmaps }) => {
    Object.defineProperty(navigator, 'standalone', { value: true });
    window.auditCanvases = [];
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function (...args) {
      const element = create.apply(this, args);
      if (args[0].toLowerCase() === 'canvas') window.auditCanvases.push(new WeakRef(element));
      return element;
    };
    window.auditDraws = [];
    window.auditBitmaps = [];
    if (noBitmaps) window.createImageBitmap = undefined;
    if (typeof createImageBitmap === 'function') {
      const createBitmap = window.createImageBitmap;
      window.createImageBitmap = async (...args) => {
        const bitmap = await createBitmap(...args);
        window.auditBitmaps.push(new WeakRef(bitmap));
        return bitmap;
      };
    }
  }, { noBitmaps: process.argv.includes('--no-bitmaps') });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const relative = decodeURIComponent(url.pathname).slice(1) || 'index.html';
    const file = path.resolve(root, relative);
    if (path.relative(root, file).startsWith('..') || !url.hostname.match(/^(localhost|127\.0\.0\.1)$/)) return route.abort();
    try {
      let body = reference[relative] ?? await readFile(file);
      if (relative === 'src/app-build.js' && process.argv.includes('--app')) body = 'export const APP_BUILD = true;';
      if (relative === 'src/presentation/rendu/renderer.js') {
        body = String(body).replace('this.canvas = canvas;', 'this.canvas = canvas; window.auditRenderer = this;');
      }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
      await route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body });
    } catch { await route.fulfill({ status: 404, body: 'Fichier introuvable.' }); }
  });
  await page.goto('http://localhost:2037/');
  await page.locator('#legal-notice-accept').click();
  await page.locator('#campaign').click();
  await page.locator('#solo').click();
  await page.locator('[data-candidate="melenchon"]').click();
  const started = performance.now();
  await page.locator('#prepare-game').click();
  await page.locator('#start-campaign:not([disabled])').waitFor({ timeout: 120000 });
  const loadingMs = performance.now() - started;
  const memory = await page.evaluate(() => {
    const entries = [...window.auditRenderer.assets.cache.values()].filter(entry => entry.ready);
    const decodedBytes = entries.reduce((sum, { image }) => sum + (image.naturalWidth || image.width) * (image.naturalHeight || image.height) * 4, 0);
    const spriteBytes = entries.reduce((sum, { image }) => sum + image.width * image.height * 4, 0);
    const sources = new Set(entries.map(entry => entry.image));
    const auxiliaryBitmapBytes = window.auditBitmaps.reduce((sum, ref) => {
      const bitmap = ref.deref(); return sum + (bitmap && !sources.has(bitmap) ? bitmap.width * bitmap.height * 4 : 0);
    }, 0);
    const canvasBytes = window.auditCanvases.reduce((sum, ref) => {
      const canvas = ref.deref(); return sum + (canvas ? canvas.width * canvas.height * 4 : 0);
    }, 0);
    return { images: entries.length, decodedMiB: decodedBytes / 1048576, spriteMiB: spriteBytes / 1048576,
      auxiliaryBitmapMiB: auxiliaryBitmapBytes / 1048576, canvasMiB: canvasBytes / 1048576,
      estimatedImageMiB: (spriteBytes + canvasBytes + auxiliaryBitmapBytes) / 1048576 };
  });
  await page.locator('#start-campaign').click();
  await page.waitForFunction(() => document.querySelector('#start-menu').hidden);
  let interfaceAudit;
  if (process.argv.includes('--audit-interface')) {
    interfaceAudit = await page.evaluate(() => new Promise(resolve => {
      const report = { frames: 180, mutations: 0, attributes: {} };
      const count = records => {
        for (const record of records) {
          report.mutations++;
          const key = record.attributeName || record.type;
          report.attributes[key] = (report.attributes[key] || 0) + 1;
        }
      };
      const observer = new MutationObserver(count);
      observer.observe(document.getElementById('game'), { subtree: true, attributes: true, childList: true, characterData: true });
      let frames = 0;
      function step() {
        if (++frames < report.frames) requestAnimationFrame(step);
        else { count(observer.takeRecords()); observer.disconnect(); resolve(report); }
      }
      requestAnimationFrame(step);
    }));
  }
  if (engine === 'chromium') {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.evaluate(() => {
    const renderer = window.auditRenderer, draw = renderer.draw;
    renderer.draw = function (...args) {
      const start = performance.now();
      const result = draw.apply(this, args);
      window.auditDraws.push(performance.now() - start);
      return result;
    };
  });
  await page.keyboard.down('ArrowRight');
  const frames = await page.evaluate(() => new Promise(resolve => {
    const gaps = []; let last = performance.now(), start = last;
    function frame(now) {
      gaps.push(now - last); last = now;
      if (now - start < 8000) requestAnimationFrame(frame); else resolve(gaps);
    }
    requestAnimationFrame(frame);
  }));
  await page.keyboard.up('ArrowRight');
  const details = await page.evaluate(() => ({ draws: window.auditDraws, failed: window.auditRenderer.assets.status().failed,
    canvas: [window.auditRenderer.canvas.width, window.auditRenderer.canvas.height], error: document.querySelector('#error').hidden ? null : document.querySelector('#error').textContent }));
  const spriteValidation = process.argv.includes('--verify-sprites') ? await page.evaluate(async () => {
    const [{ MINOR_ATLASES }, { minorCombatAtlases, minorExtraAtlases, minorStandingAtlases }, { ultimateGuardAtlases }, { minorUltimateAtlases }, { prepareAtlasFrames }] = await Promise.all([
      import('/src/presentation/personnages/minor-sprite-atlases.js'), import('/src/presentation/personnages/minor-animation-sprites.js'),
      import('/src/presentation/effets/ultimate-guard-sprites.js'), import('/src/presentation/effets/minor-ultimate-art.js'), import('/src/presentation/personnages/minor-sprite-images.js'),
    ]);
    const atlases = [...Object.entries(MINOR_ATLASES).map(([faction, atlas]) => ({ ...atlas, sprite: `minor-${faction}` })),
      ...Object.values(minorCombatAtlases), ...Object.values(minorExtraAtlases).flatMap(Object.values), ...Object.values(minorStandingAtlases),
      ...Object.values(ultimateGuardAtlases), ...Object.values(minorUltimateAtlases)];
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    let checked = 0;
    for (const atlas of atlases) {
      const image = window.auditRenderer.assets.get(atlas.sprite);
      if (!image) throw new Error(`Planche absente : ${atlas.sprite}`);
      const frames = prepareAtlasFrames(image, atlas);
      for (const [index, frame] of frames.entries()) {
        const [, , width, height] = atlas.frames[index];
        if (frame.width !== width || frame.height !== height) throw new Error(`Résolution réduite : ${atlas.sprite}, pose ${index}`);
        canvas.width = width; canvas.height = height;
        ctx.drawImage(frame, 0, 0); // Vérifie aussi que les textures restent utilisables après libération de la source.
        checked++;
      }
    }
    canvas.width = 0; canvas.height = 0;
    return { atlases: atlases.length, frames: checked, nativeResolution: true };
  }) : undefined;
  const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
  const report = { label, engine, cpuSlowdown: engine === 'chromium' ? 4 : 1, loadingMs, ...memory, canvas: details.canvas,
    frames: frames.length, medianMs: percentile(frames, .5), p95Ms: percentile(frames, .95), over50Ms: frames.filter(ms => ms > 50).length,
    draws: details.draws.length, drawMedianMs: percentile(details.draws, .5), drawP95Ms: percentile(details.draws, .95), interfaceAudit, spriteValidation, errors, failed: details.failed };
  await page.screenshot({ path: path.join(output, `phone-${label}-${engine}.png`) });
  await writeFile(path.join(output, `phone-${label}-${engine}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(details.failed, []);
  assert.equal(details.error, null);
} finally { await browser.close(); }

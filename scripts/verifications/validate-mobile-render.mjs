import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional source snapshot preserves unrelated, uncommitted artwork in both runs.
const referencePath = process.argv[2];
const reference = referencePath ? JSON.parse(await readFile(referencePath, 'utf8')) : null;
const allowCompositingRounding = process.argv.includes('--allow-compositing-rounding');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const { PNG } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'pngjs'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const reports = [];
const referencePixels = new Map();
const root = fileURLToPath(new URL('../../', import.meta.url));
try {
  for (const dpr of [1, 2]) for (const mode of reference ? ['before', 'after'] : ['after']) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: dpr, hasTouch: true });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Sources locales : comparaison reproductible sans serveur ni réseau.
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return route.abort();
      const mime = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
      try { await route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: await readFile(file) }); }
      catch { await route.fulfill({ status: 404, body: 'Fichier introuvable.' }); }
    });
    await page.route('**/performance-check', route => route.fulfill({ contentType: 'text/html', body: '<canvas style="width:844px;height:390px"></canvas>' }));
    if (mode === 'before') for (const [file, body] of Object.entries(reference)) {
      await page.route(`**/${file}`, route => route.fulfill({ contentType: 'text/javascript', body }));
    }
    await page.goto(`${process.env.CAMPAIGN_TEST_URL || 'http://localhost:2037'}/performance-check`);
    await page.evaluate(async () => {
      const [{ loadConfig }, { GameSimulation }, { WorldRenderer }] = await Promise.all([
        import('/src/config.js'), import('/src/simulation/game-simulation.js'), import('/src/presentation/rendu/renderer.js')]);
      const config = await loadConfig();
      window.sim = new GameSimulation(config, 42);
      const { completePopulation } = await import('/src/simulation/spawns.js');
      const { AIController } = await import('/src/simulation/controllers.js');
      completePopulation(window.sim);
      const ai = new AIController(config);
      for (let i = 0; i < 400; i++) window.sim.step(window.sim.state.candidates.flatMap(c => ai.commands(window.sim.state, c.id)));
      window.renderer = new WorldRenderer(document.querySelector('canvas'), config);
      window.renderer.assets.limit = 300; // Keep already visited scenes for this comparison only.
      const crowd = window.renderer.crowd;
      crowd.update = (state, gap) => Object.getPrototypeOf(crowd).update.call(crowd, state, gap, 1000);
    });
    const scenes = [];
    for (let biome = 0; biome < 6; biome++) for (const progress of [0, .25, .5, .75]) {
      const result = await page.evaluate(async ({ biome, progress }) => {
        const { sim, renderer } = window, state = sim.state;
        const zone = state.world.subzones[biome * 3];
        state.candidates.find(c => c.id === state.local_candidate_id).x = zone.start + (progress === 0 ? .01 : zone.width * .5 + .137);
        state.campaign_progress_01 = progress;
        renderer.resetCamera();
        for (let pass = 0; pass < 3; pass++) {
          renderer.draw(state, state, 1, 1 / 60);
          await Promise.all([...renderer.assets.cache.values()].map(entry => entry.promise));
        }
        let draws = 0;
        const original = renderer.ctx.drawImage;
        renderer.ctx.drawImage = function (...args) { draws++; return original.apply(this, args); };
        renderer.draw(state, state, 1, 1 / 60);
        renderer.ctx.drawImage = original;
        const pixels = renderer.canvas.toDataURL().split(',')[1];
        const start = performance.now();
        for (let i = 0; i < 20; i++) renderer.draw(state, state, 1, 1 / 60);
        // Attend aussi que les commandes de dessin aient été exécutées.
        renderer.ctx.getImageData(0, 0, 1, 1);
        return { draws, milliseconds: (performance.now() - start) / 20, pixels, failed: renderer.assets.status().failed };
      }, { biome, progress });
      assert.deepEqual(result.failed, [], 'Toutes les images doivent être chargées.');
      const png = PNG.sync.read(Buffer.from(result.pixels, 'base64'));
      const key = `${dpr}:${biome}:${progress}`;
      if (mode === 'before') referencePixels.set(key, png);
      else if (referencePixels.has(key)) {
        const before = referencePixels.get(key); let changed = 0, maximum = 0;
        for (let i = 0; i < png.data.length; i += 4) {
          let delta = 0;
          for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(before.data[i + c] - png.data[i + c]));
          if (delta) changed++;
          maximum = Math.max(maximum, delta);
        }
        if (changed) console.log(`Écart DPR ${dpr}, quartier ${biome}, avancement ${progress} : ${changed} pixels, écart maximal ${maximum}/255.`);
        if (allowCompositingRounding) assert.ok(maximum <= 1, `Aucun écart supérieur à un arrondi de couleur : ${key}`);
      }
      scenes.push({ biome, progress, draws: result.draws, milliseconds: result.milliseconds, hash: createHash('sha256').update(png.data).digest('hex') });
    }
    assert.deepEqual(errors, []);
    reports.push({ dpr, mode, scenes });
    if (mode === 'after' && reference) {
      const before = reports.find(r => r.dpr === dpr && r.mode === 'before');
      if (!allowCompositingRounding) assert.deepEqual(scenes.map(s => s.hash), before.scenes.map(s => s.hash), `Pixels identiques, DPR ${dpr}`);
    }
    await context.close();
    console.log(`${mode}, DPR ${dpr} : ${scenes.length} scènes vérifiées, ${scenes.reduce((sum, s) => sum + s.draws, 0)} dessins d’images.`);
  }
  await mkdir('artifacts/performance-mobile', { recursive: true });
  await writeFile('artifacts/performance-mobile/render-comparison.json', JSON.stringify(reports, null, 2));
} finally { await browser.close(); }

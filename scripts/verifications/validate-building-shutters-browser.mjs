import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { config } from '../game-config.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve(process.env.CAMPAIGN_TEST_ARTIFACTS || 'artifacts/building-shutters');
const base = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
const root = fileURLToPath(new URL('../../', import.meta.url));
const reference = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : null;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1320, height: 1320 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  // Sert les sources locales dans Chrome sans ouvrir de connexion réseau ni lancer un serveur.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/building-shutters-check') return route.fulfill({ contentType: 'text/html', body:
      '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Vérification des rideaux</title><style>body{margin:0;background:#f3e4c5}canvas{display:block}</style><canvas id="sheet"></canvas></html>' });
    const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (url.origin !== new URL(base).origin || !file.startsWith(root)) return route.abort();
    const mime = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
    try {
      const name = path.relative(root, file).split(path.sep).join('/');
      await route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: reference?.[name] ?? await readFile(file) });
    }
    catch { await route.fulfill({ status: 404, body: 'Fichier introuvable.' }); }
  });
  await page.goto(`${base}/building-shutters-check`);
  const report = await page.evaluate(async config => {
    const { GameSimulation } = await import('/src/simulation/game-simulation.js');
    const { captureSite, neutralizeSite } = await import('/src/simulation/strategic-sites.js');
    const { drawBuildingShutters, BUILDING_OPENINGS, BUILDING_CLOSURE_ASSETS, buildingOpeningBounds } = await import('/src/presentation/carte/building-shutters.js');
    const { drawPlateWorld, plateFeatureFrame, plateAssetIds } = await import('/src/presentation/carte/carte-plate.js');
    const { visualManifest } = await import('/src/presentation/rendu/visual-manifest.js');
    const { ringDelta } = await import('/src/simulation/world.js');
    const images = new Map();
    await Promise.all([...plateAssetIds(), ...BUILDING_CLOSURE_ASSETS].map(async id => {
      const image = new Image(); image.src = visualManifest[id].file; await image.decode(); images.set(id, image);
    }));
    const sim = new GameSimulation(config, 42), { state } = sim;
    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false;
    const renderer = { ctx, config, assets: { get: id => images.get(id), load: () => Promise.resolve(null) },
      width: 1920, height: 1080, metrics: { groundY: 1004, anchorX: 960, pixelsPerUnit: 80 },
      fixedWorldState: state, fixedWorldActive: true, cameraX: 0 };
    renderer.screenX = x => 960 + ringDelta(renderer.cameraX, x, state.world.length) * 80;
    const controls = state.buildings.filter(b => b.controls_zone), samples = [];
    const results = [];
    for (const b of controls) {
      const zone = state.world.subzones.find(z => z.id === b.subzone_id);
      renderer.cameraX = zone.center;
      const opening = BUILDING_OPENINGS[b.site_id], frame = plateFeatureFrame(renderer, b, opening);
      const occupied = plateFeatureFrame(renderer, b, buildingOpeningBounds(opening));
      const modes = new Map();
      const take = (mode, tick) => {
        renderer.buildingShutterTick = tick;
        // Le moteur repeint le fond à chaque image. Éviter ici de cumuler les
        // arrondis de transparence des captures et des quartiers précédents.
        ctx.clearRect(0, 0, 1920, 1080);
        drawPlateWorld(renderer, state); drawBuildingShutters(renderer, state);
        const copy = document.createElement('canvas'); copy.width = 1920; copy.height = 1080;
        copy.getContext('2d').drawImage(canvas, 0, 0); modes.set(mode, copy);
        return ctx.getImageData(0, 0, 1920, 1080).data;
      };
      sim.state.tick = 0;
      // Même les QG actifs au départ sont fermés pour vérifier chaque placement.
      neutralizeSite(sim, b); b.shutter_transition = null;
      const closed = take('Fermé', 0);
      captureSite(sim, b, state.candidates[0]);
      const half = take('À mi-course', sim.hz / 2);
      const open = take('Ouvert', sim.hz);
      let differences = 0, outside = 0, halfDifferences = 0;
      for (let y = 0; y < 1080; y++) for (let x = 0; x < 1920; x++) {
        const i = (y * 1920 + x) * 4;
        if (closed[i] !== open[i] || closed[i + 1] !== open[i + 1] || closed[i + 2] !== open[i + 2]) {
          differences++;
          if (x < occupied.left - 1 || x > occupied.left + occupied.w + 1 || y < occupied.top - 1 || y > occupied.top + occupied.h + 1) outside++;
        }
        if (half[i] !== open[i] || half[i + 1] !== open[i + 1] || half[i + 2] !== open[i + 2]) halfDifferences++;
      }
      results.push({ site: b.site_id, kind: opening.kind || 'shutter', differences, outside, halfDifferences });
      samples.push({ site: b.site_id, opening, modes });
    }
    const sheet = document.querySelector('#sheet'), c = sheet.getContext('2d');
    sheet.width = 1320; sheet.height = 1320;
    window.shutterCheck = { sim, renderer, canvas, samples, sheet };
    window.paintShutterSheet = mode => {
      c.fillStyle = '#f3e4c5'; c.fillRect(0, 0, sheet.width, sheet.height);
      samples.forEach(({ site, opening, modes }, index) => {
        const x = index % 3 * 440, y = Math.floor(index / 3) * 220;
        c.fillStyle = '#263b40'; c.font = 'bold 16px system-ui';
        const [biome, letter] = site.slice(5).split('_');
        const name = { paris: 'Paris', banlieue: 'Banlieue', periurbain: 'Périurbain', campagne: 'Campagne', retraites: 'Retraités', riches: 'Riches' }[biome];
        c.fillText(`${name} ${letter.toUpperCase()} · ${mode}`, x + 12, y + 23);
        const crop = { x: opening.x - 55, y: opening.y - 95, w: opening.w + 110, h: opening.h + 120 };
        const scale = Math.min(416 / crop.w, 185 / crop.h);
        c.drawImage(modes.get(mode), crop.x, crop.y, crop.w, crop.h,
          x + (440 - crop.w * scale) / 2, y + 30, crop.w * scale, crop.h * scale);
      });
    };
    window.paintShutterSheet('Fermé');
    return results;
  }, structuredClone(config));
  for (const mode of ['Fermé', 'À mi-course', 'Ouvert']) {
    await page.evaluate(mode => window.paintShutterSheet(mode), mode);
    const name = mode === 'Fermé' ? 'fermes' : mode === 'Ouvert' ? 'ouverts' : 'mi-course';
    await page.locator('#sheet').screenshot({ path: path.join(output, `${name}.png`) });
  }
  await page.evaluate(() => {
    const { samples, sheet } = window.shutterCheck;
    sheet.width = 1200; sheet.height = 690;
    const c = sheet.getContext('2d'); c.fillStyle = '#f3e4c5'; c.fillRect(0, 0, 1200, 690);
    const examples = [['site:paris_b', 'Grande devanture'], ['site:retraites_c', 'Petite permanence'], ['site:campagne_a', 'Grandes portes du garage']];
    examples.forEach(([id, title], row) => {
      const { opening, modes } = samples.find(s => s.site === id);
      ['Ouvert', 'À mi-course', 'Fermé'].forEach((mode, col) => {
        const x = col * 400, y = row * 230;
        c.fillStyle = '#263b40'; c.font = 'bold 15px system-ui'; c.fillText(`${title} · ${mode}`, x + 12, y + 24);
        const crop = { x: opening.x - 65, y: opening.y - 90, w: opening.w + 130, h: opening.h + 115 };
        const scale = Math.min(376 / crop.w, 193 / crop.h);
        c.drawImage(modes.get(mode), crop.x, crop.y, crop.w, crop.h,
          x + (400 - crop.w * scale) / 2, y + 32, crop.w * scale, crop.h * scale);
      });
    });
  });
  await page.locator('#sheet').screenshot({ path: path.join(output, 'exemples.png') });
  // Le moteur complet doit lui aussi dessiner le mouvement, sous les personnages.
  const integration = await page.evaluate(async () => {
    const { WorldRenderer } = await import('/src/presentation/rendu/renderer.js');
    const { worldAssetIds } = await import('/src/presentation/carte/illustrated-world.js');
    const { sim } = window.shutterCheck;
    const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:960px;height:540px'; document.body.append(canvas);
    const renderer = new WorldRenderer(canvas, sim.config);
    await renderer.assets.keep(worldAssetIds(renderer.assets.manifest, sim.state));
    const b = sim.state.buildings.find(b => b.id === 'site:paris_b');
    const player = sim.state.candidates[0]; player.x = b.x; renderer.cameraX = b.x;
    sim.state.tick = sim.hz; b.shutter_transition = { tick: 0, from: 1 };
    renderer.draw(sim.state, { ...sim.state, tick: 0 }, 0.5, 1 / 60);
    const sampledTick = renderer.buildingShutterTick;
    // Reproduit la cagnotte placée à la hauteur du coffre de la grande boutique.
    const { buildingSignFrame } = await import('/src/presentation/carte/fixed-world.js');
    const shop = sim.state.buildings.find(b => b.site_id === 'site:riches_b');
    sim.state.local_candidate_id = player.id; player.x = shop.x; shop.owner_id = player.faction_id;
    shop.state = 'ACTIVE'; shop.shutter_transition = null; shop.stored_money_cents = 12300;
    renderer.cameraX = shop.x;
    renderer.draw(sim.state, sim.state, 1, 1 / 60);
    const sign = buildingSignFrame(renderer, shop), context = canvas.getContext('2d');
    const t = context.getTransform();
    const pixels = context.getImageData(Math.floor((sign.x - sign.w / 2) * t.a + t.e),
      Math.floor((sign.y + sign.h / 2 + 5) * t.d + t.f), Math.ceil(sign.w * t.a), Math.ceil(19 * t.d)).data;
    let moneyTextPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 220 && pixels[i + 1] > 200 && pixels[i + 2] < 200) moneyTextPixels++;
    }
    window.shutterMoneyCanvas = canvas;
    return { fixedWorld: renderer.fixedWorldActive, sampledTick, expectedTick: sim.hz / 2, moneyTextPixels };
  });
  await page.evaluate(() => {
    const sheet = document.querySelector('#sheet'), source = window.shutterMoneyCanvas;
    sheet.width = source.width; sheet.height = source.height;
    sheet.getContext('2d').drawImage(source, 0, 0);
  });
  await page.locator('#sheet').screenshot({ path: path.join(output, 'cagnotte.png') });
  assert.equal(report.length, 18);
  for (const row of report) {
    assert.ok(row.differences > 500, `${row.site} : rideau fermé visible`);
    assert.equal(row.outside, 0, `${row.site} : la façade hors de l'ouverture reste intacte`);
    assert.ok(row.halfDifferences > 100, `${row.site} : course intermédiaire visible`);
    if (row.kind === 'shutter') assert.ok(row.halfDifferences < row.differences, `${row.site} : descente progressive`);
  }
  assert.equal(integration.fixedWorld, true);
  assert.equal(integration.sampledTick, integration.expectedTick);
  assert.ok(integration.moneyTextPixels > 30, 'Le texte de la cagnotte reste visible devant le coffre du rideau');
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'rapport.json'), JSON.stringify({ report, integration, errors }, null, 2));
  console.log(`18 fermetures vérifiées dans Chrome : ouvert, à mi-course, fermé ; aucun débordement. Captures : ${output}`);
} finally {
  await browser.close();
}

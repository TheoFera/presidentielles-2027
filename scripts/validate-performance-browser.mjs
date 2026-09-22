import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { startSolo } from './browser-start.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const output = path.resolve('artifacts/performance');
await mkdir(output, { recursive: true });
const label = process.argv[2] || 'current';
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (label === 'before') {
    // Compare against committed source without changing the working tree.
    const changed = execFileSync('git', ['diff', '--name-only', '--', 'src'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
    for (const file of changed) {
      const body = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
      await page.route(`**/${file}`, route => route.fulfill({ body, contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript' }));
    }
  }
  await page.addInitScript(() => {
    window.longTasks = [];
    new PerformanceObserver(list => window.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2037');
  const begin = performance.now();
  await startSolo(page);
  const loadingMs = performance.now() - begin;
  await page.keyboard.press('p');
  const gameplayStartedAt = await page.evaluate(() => performance.now());
  const result = await page.evaluate(async () => {
    const [{ loadConfig }, { GameSimulation }, { WorldRenderer }] = await Promise.all([
      import('/src/config.js'), import('/src/simulation/game-simulation.js'),
      import('/src/presentation/renderer.js'),
    ]);
    const config = await loadConfig();
    const sim = new GameSimulation(config);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:960px;height:640px';
    document.body.append(canvas);
    const renderer = new WorldRenderer(canvas, config);
    let requests = 0;
    const createImage = renderer.assets.createImage;
    renderer.assets.createImage = () => { requests++; return createImage(); };
    const frames = [], transitions = [];
    for (const index of [0, 1, 2, 3, 4, 5, 0]) {
      const zone = sim.state.world.subzones[index];
      sim.state.candidates[0].x = zone.start + zone.width * .5;
      renderer.resetCamera();
      const state = sim.getState({ presentation: true });
      renderer.draw(state, state, 1, 1 / 60);
      await renderer.assets.preload([...renderer.assets.protectedIds]);
      for (let i = 0; i < 4; i++) {
        renderer.draw(state, state, 1, 1 / 60);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      const before = requests;
      for (let i = 0; i < 12; i++) {
        await new Promise(requestAnimationFrame);
        const start = performance.now();
        renderer.draw(state, state, 1, 1 / 60);
        frames.push(performance.now() - start);
      }
      transitions.push({ zone: index, protected: renderer.assets.protectedIds.size, repeatedLoads: requests - before });
    }
    renderer.resizeObserver.disconnect();
    window.performanceCanvas = canvas;
    let snapshotTime = 0;
    for (let batch = 0; batch < 10; batch++) {
      await new Promise(requestAnimationFrame);
      const start = performance.now();
      for (let i = 0; i < 10; i++) sim.getState({ presentation: true });
      snapshotTime += performance.now() - start;
    }
    frames.sort((a, b) => a - b);
    return { transitions, requests, drawMedianMs: frames[Math.floor(frames.length * .5)], drawP95Ms: frames[Math.floor(frames.length * .95)], snapshotMeanMs: snapshotTime / 100 };
  });
  // Read the actual render surface: a page screenshot could capture the pause
  // overlay instead of the scene beneath it and falsely pass the comparison.
  const pixels = await page.evaluate(() => window.performanceCanvas.toDataURL('image/png').split(',')[1]);
  await writeFile(path.join(output, `${label}.png`), Buffer.from(pixels, 'base64'));
  if (label === 'after') {
    const { PNG } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'pngjs'));
    const before = PNG.sync.read(await readFile(path.join(output, 'before.png')));
    const after = PNG.sync.read(await readFile(path.join(output, 'after.png')));
    assert.equal(after.width, before.width);
    assert.equal(after.height, before.height);
    assert.ok(before.data.equals(after.data), 'La scène témoin doit rester identique pixel par pixel.');
  }
  const longTasks = await page.evaluate(() => window.longTasks);
  const report = { loadingMs, gameplayStartedAt, ...result, longTasks, errors };
  await writeFile(path.join(output, `${label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  if (label !== 'before') assert.ok(result.transitions.every(t => t.repeatedLoads === 0), 'Les scènes immobiles ne doivent pas recharger leurs images en boucle.');
} finally {
  await browser.close();
}

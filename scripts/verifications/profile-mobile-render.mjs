import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startSolo } from './browser-start.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const label = process.argv[2] || 'current';
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2037');
  await startSolo(page);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await client.send('Profiler.enable'); await client.send('Profiler.start');
  await page.keyboard.down('ArrowRight');
  const frames = await page.evaluate(() => new Promise(resolve => {
    const frames = []; let last = performance.now(), start = last;
    const step = now => { frames.push(now - last); last = now; if (now - start < 10000) requestAnimationFrame(step); else resolve(frames); };
    requestAnimationFrame(step);
  }));
  await page.keyboard.up('ArrowRight');
  const { profile } = await client.send('Profiler.stop');
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), costs = new Map();
  profile.samples.forEach((id, i) => {
    const node = nodes.get(id), key = `${node.callFrame.functionName || '(anonyme)'} ${node.callFrame.url.split('/').slice(-2).join('/')}:${node.callFrame.lineNumber + 1}`;
    costs.set(key, (costs.get(key) || 0) + profile.timeDeltas[i] / 1000);
  });
  frames.sort((a,b) => a-b);
  const report = { cpuSlowdown: 4, viewport: '844 × 390, DPR 2', frames: frames.length, medianMs: frames[Math.floor(frames.length*.5)], p95Ms: frames[Math.floor(frames.length*.95)], over50Ms: frames.filter(ms => ms > 50).length, topSelfTimeMs: [...costs].sort((a,b)=>b[1]-a[1]).slice(0,22), errors };
  await mkdir('artifacts/performance-mobile', { recursive: true });
  await writeFile(`artifacts/performance-mobile/profile-${label}.json`, JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }

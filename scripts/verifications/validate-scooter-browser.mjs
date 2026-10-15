import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1050 } });
  await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027');
  const report = await page.evaluate(async () => {
    const { drawMountedCandidate, prepareVehicleAtlas, mountedVehicleAssetId } = await import('/src/presentation/carte/vehicles.js');
    const { CAMPAIGN_STYLES } = await import('/src/simulation/campaign-styles.js');
    const { fixedWorldAssets } = await import('/src/presentation/rendu/fixed-world-assets.js');
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1050;
    document.body.replaceChildren(canvas); document.body.style.cssText = 'margin:0; overflow:auto';
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eee5cf'; ctx.fillRect(0, 0, 1200, 1050);
    const images = new Map();
    for (const name of ['melenchon', 'le_pen', 'philippe', 'bardella']) {
      const id = `riders-periurbain-${name}`, im = new Image();
      im.src = fixedWorldAssets[id].file; await im.decode(); images.set(id, im);
    }
    const state = { tick: 0, world: { length: 1000 }, buildings: [{ id: 'garage', subzone_id: 'periurbain_b' }] };
    const renderer = { ctx, cameraX: 0, metrics: { anchorX: 0, pixelsPerUnit: 10, characterHeight: 155, groundY: 0 },
      assets: { get: id => images.get(id) } };
    const results = [];
    for (const [col, faction_id] of ['melenchon', 'le_pen', 'philippe'].entries()) {
      for (const [row, current_campaign_style] of [null, ...CAMPAIGN_STYLES[faction_id].map(s => s.id)].entries()) {
        const entity = { id: `${col}:${row}`, role: 'CANDIDAT', faction_id, current_campaign_style,
          vehicle: { type: 'scooter', site_id: 'garage' }, facing: row % 2 ? -1 : 1, moving: true };
        renderer.metrics.groundY = 210 + row * 235;
        const id = mountedVehicleAssetId(entity, state), im = images.get(id), frame = prepareVehicleAtlas(id, im)[row];
        const name = { melenchon: 'Mélenchon', le_pen: 'Le Pen', philippe: 'Philippe' }[faction_id];
        ctx.fillStyle = '#43594e'; ctx.font = '15px system-ui'; ctx.fillText(`${name} · ${row ? CAMPAIGN_STYLES[faction_id][row - 1].name : 'tenue de base'}`, col * 400 + 15, row * 235 + 22);
        const drawn = drawMountedCandidate(renderer, entity, col * 400 + 200, state);
        results.push({ id, row, drawn, frame, size: [im.naturalWidth, im.naturalHeight] });
      }
    }
    const entity = { id: 'bardella', role: 'CANDIDAT', faction_id: 'le_pen', bardella_form: true,
      vehicle: { type: 'scooter', site_id: 'garage' }, facing: 1 };
    renderer.metrics.characterHeight = 70; renderer.metrics.groundY = 1030;
    results.push({ id: 'bardella', drawn: drawMountedCandidate(renderer, entity, 600, state) });
    return results;
  });
  assert.equal(report.length, 13);
  for (const result of report) {
    assert.equal(result.drawn, true, result.id);
    if (!result.frame) continue;
    assert.ok(result.frame.width > 100 && result.frame.height > 100, result.id);
    assert.ok(result.frame.y > 0 && result.frame.y + result.frame.height < result.size[1], `Pose entière : ${result.id}`);
  }
  await mkdir('tmp/verification-scooter', { recursive: true });
  await page.screenshot({ path: 'tmp/verification-scooter/apercu.png', fullPage: true });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}

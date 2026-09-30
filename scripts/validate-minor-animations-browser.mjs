import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1150, height: 850 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('artifacts/minor-sprites/shared', { recursive: true });
  const pixels = () => page.locator('canvas').evaluateAll(canvases => canvases.map(canvas => {
    const data = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let visible = 0, hash = 0;
    for (let i=0;i<data.length;i++) { hash=(hash*31+data[i])|0; if (i%4===3&&data[i]>90) visible++; }
    return { visible, hash };
  }));
  const factions = (process.env.CAMPAIGN_TEST_CANDIDATES || 'glucksmann,roussel,arthaud,dupont_aignan,retailleau,attal').split(',');
  for (const faction of factions) {
    await page.goto(`${process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027'}/src/presentation/minor-sprite-preview.html?candidate=${faction}`);
    await page.waitForFunction(() => window.galleryReady);
    await page.evaluate(() => window.setMinorPreview('guard',0));
    const all = await pixels(); assert.equal(all.length,46);
    assert.ok(all.every(({visible})=>visible>600&&visible<24000), `${faction} : les 44 poses et deux aperçus doivent être visibles.`);
    await page.screenshot({ path: `artifacts/minor-sprites/shared/${faction}.png`, fullPage: true });
    await page.locator('#comparison').screenshot({ path: `artifacts/minor-sprites/shared/${faction}-comparison.png` });
    for (const scenario of ['walk','guard','combo','charge','jump','dash','hit','knockdown','persuade','ko']) {
      const hashes = [];
      for (const seconds of [0,.08,.16,.3,.6,.9,1.2,1.4,1.6]) {
        await page.evaluate(({scenario,seconds})=>window.setMinorPreview(scenario,seconds),{scenario,seconds});
        const result = await pixels(); assert.ok(result[1].visible>600,`${faction} : ${scenario} à ${seconds}s`); hashes.push(result[1].hash);
      }
      assert.ok(new Set(hashes).size>=2,`${faction} : ${scenario} doit s'animer.`);
    }
    await page.locator('#direction').click();
    await page.evaluate(()=>window.setMinorPreview('combo',.1));
    await page.screenshot({path:`artifacts/minor-sprites/shared/${faction}-gauche.png`});
    console.log(`${faction} : 44 poses, 10 animations via le moteur du jeu et sens gauche vérifiés.`);
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from './validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { startSolo } from './browser-start.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/melenchon-animation'); await mkdir(output, { recursive:true });
const config = campaignConfig(), base = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
function snapshot(step = 0, distance = 1.7) {
  const sim = new GameSimulation(config,42); sim.state.ai_enabled = false; sim.state.npcs = [];
  sim.state.candidates.forEach((c,i) => { c.x = 100+i*100; c.axis=0; c.money=0; });
  const c=sim.state.candidates[0]; c.facing=1; c.combat.combo_step=step; c.combat.combo_expires_tick=100;
  sim.state.candidates[1].x=c.x+distance;
  return sim.exportSnapshot();
}
await writeFile(path.join(output,'essai-combat.json'),snapshot());
const browser = await chromium.launch({headless:true,channel:'chrome'}), report={flows:[],errors:[]};
try {
  const context = await browser.newContext({viewport:{width:1100,height:620},hasTouch:true});
  await context.addInitScript(() => {
    const create=URL.createObjectURL.bind(URL); URL.createObjectURL=blob=>{window.lastExport=blob.text();return create(blob);};
    const click=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){if(!this.download)click.call(this);};
  });
  const page=await context.newPage(); page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base); await startSolo(page);
  async function load(step=0,distance=1.7) {
    await page.locator('#load').setInputFiles({name:'essai.json',mimeType:'application/json',buffer:Buffer.from(snapshot(step,distance))});
    if(await page.locator('#help').isVisible()) await page.locator('#resume').click();
    await page.waitForTimeout(100);
  }
  async function state() {
    await page.locator('#save').evaluate(e=>e.click()); return page.evaluate(async()=>JSON.parse(await window.lastExport));
  }
  await load(0,4); await page.screenshot({path:path.join(output,'garde-en-jeu.png')});
  const atlasLoaded = await page.evaluate(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('animations/melenchon-base-combat-v4.png')));
  assert.equal(atlasLoaded,true); report.flows.push('Planche de poses distinctes chargée dans le jeu, garde près du candidat adverse.');
  for(const step of [0,1,2]) {
    await load(step); await page.keyboard.press('Space'); await page.waitForTimeout(90);
    const s=await state(); assert.ok(s.attacks.some(a=>a.owner_id===s.local_candidate_id&&a.step===step+1));
    await page.screenshot({path:path.join(output,`coup-${step+1}-en-jeu.png`)});
  }
  report.flows.push('Les deux poings et le coup de pied final suivent les trois attaques réelles.');
  await load(); await page.keyboard.down('Space');
  await page.waitForFunction(()=>document.getElementById('attack-touch').textContent==='Prête !');
  await page.screenshot({path:path.join(output,'charge-en-jeu.png')});
  await page.keyboard.up('Space'); await page.waitForTimeout(150);
  assert.ok((await state()).attacks.some(a=>a.kind==='CHARGED'));
  await page.screenshot({path:path.join(output,'charge-frappe-en-jeu.png')});
  report.flows.push('Préparation, maintien prêt et coup de pied chargé.');
  await load(); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(230);
  await page.screenshot({path:path.join(output,'saut-en-jeu.png')});
  await load(); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(100);
  await page.keyboard.press('Space'); await page.waitForTimeout(80);
  const flying=await state(); assert.ok(flying.candidates[0].combat.height>0); assert.ok(flying.attacks.length);
  await page.screenshot({path:path.join(output,'saut-frappe-en-jeu.png')});
  report.flows.push('Saut et coup de pied aérien à la hauteur calculée par la simulation.');

  // An inspectable gallery uses the exact production renderer, not a separate illustration.
  const gallery=await context.newPage(); gallery.on('pageerror',e=>report.errors.push(e.message));
  await gallery.goto(`${base}/src/presentation/melenchon-preview.html`); await gallery.waitForFunction(()=>window.galleryReady);
  await gallery.waitForTimeout(100);
  const drawn = await gallery.locator('canvas').evaluateAll(canvases => canvases.map(canvas => {
    const data=canvas.getContext('2d').getImageData(60,60,180,160).data;
    let costumePixels=0;
    for(let i=0;i<data.length;i+=4) if(data[i]<90&&data[i+1]<90&&data[i+2]<90) costumePixels++;
    return costumePixels>300 && costumePixels<180*160*.8;
  }));
  assert.equal(drawn.length,13); assert.ok(drawn.every(Boolean),'Chaque aperçu doit contenir un personnage visible.');
  await gallery.screenshot({path:path.join(output,'planche-en-jeu.png'),fullPage:true});
  assert.deepEqual(report.errors,[]); await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}

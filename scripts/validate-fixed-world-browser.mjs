import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { config } from './game-config.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/world-v2/browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/fixed-world-check', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="fr"><meta charset="utf-8"><style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas id="game"></canvas></html>' }));
  await page.goto((process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027') + '/fixed-world-check');
  const report = await page.evaluate(async config => {
    const { GameSimulation } = await import('/src/simulation/game-simulation.js');
    const { WorldRenderer } = await import('/src/presentation/renderer.js');
    const { worldAssetIds } = await import('/src/presentation/illustrated-world.js');
    const { panoramaFrame } = await import('/src/presentation/fixed-world.js');
    const { captureSite } = await import('/src/simulation/strategic-sites.js');
    const { CampaignEventDirector } = await import('/src/simulation/campaign-events.js');
    const { completePopulation } = await import('/src/simulation/spawns.js');
    const { drawMountedCandidate } = await import('/src/presentation/vehicles.js');
    const { CAMPAIGN_STYLES } = await import('/src/simulation/campaign-styles.js');
    const sim = new GameSimulation(config, 42); sim.state.ai_enabled = false;
    const state = sim.state, player = state.candidates[0];
    player.interaction_active = false; player.campaign_active = false;
    state.candidates.slice(1).forEach(c => { c.disappeared = true; });
    const renderer = new WorldRenderer(document.querySelector('#game'), config);
    await renderer.assets.keep(worldAssetIds(renderer.assets.manifest, state));
    const thumbs = [];
    const draw = x => { player.x = x; renderer.resetCamera(); renderer.cameraX = x; renderer.draw(state, state, 1, 1/60, false); };
    const thumb = label => { const c = document.createElement('canvas'); c.width = 320; c.height = 196; const ctx = c.getContext('2d'); ctx.drawImage(renderer.canvas, 0, 0, 320, 180); ctx.fillStyle='#f1e6ca';ctx.fillRect(0,180,320,16);ctx.fillStyle='#253b34';ctx.font='11px sans-serif';ctx.fillText(label,5,192);thumbs.push(c); };
    for (const zone of state.world.subzones) { draw(zone.center); thumb(zone.id); }
    const centers = thumbs.splice(0);
    for (const zone of state.world.subzones) { draw(zone.start); thumb('Raccord ' + zone.id); }
    const montage = items => { const c = document.createElement('canvas'); c.width = 1280; c.height = Math.ceil(items.length/4)*196;const ctx=c.getContext('2d');items.forEach((image,i)=>ctx.drawImage(image,(i%4)*320,Math.floor(i/4)*196)); return c.toDataURL(); };
    const frames = Object.keys(config.prototype.presentation.biome_palettes).map(id => {
      const image = renderer.assets.get('panorama-' + ({paris_19e:'bobo',periurbain_usine:'periurbain',quartiers_riches:'riches'}[id]||id));
      const frame = panoramaFrame(renderer, state.world, id, image);
      return { id, source: image.naturalWidth/image.naturalHeight, drawn: frame.width/frame.height };
    });
    const joins = montage(thumbs), panorama = montage(centers);
    draw(0); const first = renderer.canvas.toDataURL(); draw(state.world.length);
    if (first !== renderer.canvas.toDataURL()) throw new Error('Le raccord circulaire modifie le rendu');
    const atlas = document.createElement('canvas'); atlas.width=1040;atlas.height=1260;
    const actx=atlas.getContext('2d');actx.fillStyle='#eae3d1';actx.fillRect(0,0,atlas.width,atlas.height);
    let count=0;
    for (const faction of ['melenchon','le_pen','philippe','bardella']) for (const style of faction==='bardella'?[null]:[null,...CAMPAIGN_STYLES[faction].map(s=>s.id)]) for (const type of ['velo','scooter']) {
      const col=count%4,row=Math.floor(count/4);count++;
      actx.save();actx.translate(col*260,row*180);
      const entity={...player,faction_id:faction==='bardella'?'le_pen':faction,current_campaign_style:style,bardella_form:faction==='bardella',vehicle:{type},moving:false};
      drawMountedCandidate({ctx:actx,assets:renderer.assets,metrics:{characterHeight:105,groundY:144}},entity,130,state);
      actx.fillStyle='#303a32';actx.textAlign='center';actx.font='11px sans-serif';actx.fillText(`${style||faction} · ${type}`,130,169);actx.restore();
    }
    const riders=atlas.toDataURL();
    const garage = state.buildings.find(b => b.type === 'garage_velo'); captureSite(sim, garage, player);
    player.vehicle = {type:'velo',site_id:garage.id}; player.axis=1; player.moving=true; draw(garage.x);
    const vehicle = renderer.canvas.toDataURL();
    player.vehicle=null;player.axis=0;player.moving=false;
    completePopulation(sim); const event=CampaignEventDirector.start(sim,{family:'RASSEMBLEMENT',biomeId:'banlieue'});
    for(let i=0;i<sim.secondsToTicks(16);i++)sim.step();
    draw(event.march.center_x); const rally=renderer.canvas.toDataURL();
    window.worldCheck={sim,renderer,draw};
    return {panorama,joins,vehicle,rally,riders,frames,assets:renderer.assets.status()};
  }, config);
  for (const field of ['panorama','joins','vehicle','rally','riders']) await writeFile(path.join(output,field+'.png'),Buffer.from(report[field].split(',')[1],'base64'));
  for (const f of report.frames) assert.ok(Math.abs(f.source-f.drawn)<1e-12, 'Décor déformé : '+f.id);
  assert.deepEqual(report.assets.failed,[]);
  const viewports=[];
  for (const viewport of [{width:844,height:390},{width:1920,height:720},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    const scale=await page.evaluate(()=>{const {draw,sim,renderer}=window.worldCheck;renderer.resize();draw(sim.state.world.length-0.05);const matrix=renderer.ctx.getTransform();return {x:matrix.a,y:matrix.d};});
    assert.ok(Math.abs(scale.x-scale.y)<1e-12,'Étirement selon le format de l’écran');viewports.push({...viewport,scale});
    if(viewport.width===844)await page.screenshot({path:path.join(output,'mobile-raccord-boucle.png')});
  }
  await page.setViewportSize({width:1280,height:720});
  await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027');
  await page.locator('#solo').click();
  await page.locator('[data-candidate="melenchon"]').click();
  await page.locator('#prepare-game').click();
  await page.locator('#start-campaign:not([disabled])').waitFor({timeout:60000});
  await page.locator('#start-campaign').click();
  await page.keyboard.press('ArrowRight');
  await page.screenshot({path:path.join(output,'partie-reelle.png')});
  assert.deepEqual(errors,[]);
  const summary={frames:report.frames,viewports,assets:report.assets,errors,output};
  await writeFile(path.join(output,'rapport.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
} finally { await browser.close(); }

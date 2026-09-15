import { startSolo } from './browser-start.mjs';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from './validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { hit } from '../src/simulation/combat-state.js';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright'));
const config=campaignConfig(),output=path.resolve('artifacts/damage-feedback');await mkdir(output,{recursive:true});
function snapshot(hp,impact=false){
 const sim=new GameSimulation(config,42);sim.state.ai_enabled=false;sim.state.npcs=[];
 sim.state.candidates.forEach((c,i)=>{c.x=100+i*100;c.money=0;c.axis=0;});
 const c=sim.state.candidates[0];c.resistance=hp;c.last_damage_tick=sim.state.tick;
 if(impact)hit(sim,sim.state.candidates[1],c,{damage:8,knockback:0},'test:incoming');
 return sim.exportSnapshot();
}
const browser=await chromium.launch({headless:true,channel:'chrome'});
const report={views:[],errors:[]};
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://localhost:2027');await page.waitForSelector('#damage-feedback',{state:'attached'});
    await startSolo(page);
 async function load(hp,impact=false){await page.locator('#load').setInputFiles({name:'damage.json',mimeType:'application/json',buffer:Buffer.from(snapshot(hp,impact))});if(await page.locator('#help').isVisible())await page.locator('#resume').click();}
 for(const hp of [100,75,40,10]){
  await load(hp);await page.waitForFunction(hp=>{const e=document.querySelector('#damage-feedback');return hp===100?e.hidden:!e.hidden;},hp);
  const opacity=await page.locator('#damage-feedback').evaluate(e=>Number(e.style.getPropertyValue('--damage-opacity')));
  if(report.views.length)assert.ok(opacity>report.views.at(-1).opacity);
  await page.screenshot({path:path.join(output,`resistance-${hp}.png`)});report.views.push({hp,opacity});
 }
 await load(75,true);const first=await page.locator('#damage-feedback').evaluate(e=>Number(e.style.getPropertyValue('--damage-opacity')));
 await page.waitForTimeout(800);const after=await page.locator('#damage-feedback').evaluate(e=>Number(e.style.getPropertyValue('--damage-opacity')));assert.ok(first>after);
 await page.locator('#move-right').tap();await page.locator('#attack-touch').tap(); // Overlay cannot intercept input.
 assert.equal(await page.locator('#damage-feedback').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 await load(40);await page.waitForSelector('#damage-feedback',{state:'hidden',timeout:11000});
 await page.setViewportSize({width:390,height:844});await load(20);await page.waitForSelector('#damage-feedback',{state:'visible'});
 const box=await page.locator('#damage-feedback').boundingBox();assert.equal(box.width,390);assert.equal(box.height,844);
 await page.screenshot({path:path.join(output,'portrait.png')});
 await page.emulateMedia({reducedMotion:'reduce'});await load(10);
 const a=await page.locator('#damage-feedback').evaluate(e=>e.style.getPropertyValue('--damage-opacity'));await page.waitForTimeout(200);
 assert.equal(await page.locator('#damage-feedback').evaluate(e=>e.style.getPropertyValue('--damage-opacity')),a);
 assert.equal(await page.locator('#error').isVisible(),false);assert.deepEqual(report.errors,[]);
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}

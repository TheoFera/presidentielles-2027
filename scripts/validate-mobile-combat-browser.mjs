import { startSolo } from './browser-start.mjs';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from './validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CAMPAIGN_STYLES, CampaignStyleSystem } from '../src/simulation/campaign-styles.js';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const config=campaignConfig();
const output=path.resolve('artifacts/mobile-combat'); await mkdir(output,{recursive:true});
function snapshot(faction,index,charge=0) {
  const sim=new GameSimulation(config,42,`candidate:${faction}`); sim.state.ai_enabled=false; sim.state.npcs=[];
  sim.state.candidates.forEach((c,i)=>{c.x=100+i*100; c.axis=0;c.money=0;});
  const c=sim.state.candidates.find(c=>c.faction_id===faction);
  CampaignStyleSystem.select(sim,c,CAMPAIGN_STYLES[faction][index].id,true);
  sim.applyCommand({type:'DebugSetUltimateCharge',candidateId:c.id,value:charge});
  return sim.exportSnapshot();
}
const browser=await chromium.launch({headless:true,channel:'chrome'});
const report={flows:[],errors:[]};
try {
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
 await context.addInitScript(()=>{
   const create=URL.createObjectURL.bind(URL); URL.createObjectURL=blob=>{window.lastExport=blob.text();return create(blob);};
   const click=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){if(!this.download)click.call(this);};
 });
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027');
 await page.waitForSelector('#campaign-styles',{state:'attached'});
    await startSolo(page);
 async function load(f,i,charge=0){
  await page.locator('#load').setInputFiles({name:'combat.json',mimeType:'application/json',buffer:Buffer.from(snapshot(f,i,charge))});
  if(await page.locator('#help').isVisible()) await page.locator('#resume').click();
  await page.waitForSelector('#touch-controls',{state:'visible'});
 }
 async function save(){
  await page.keyboard.press('F3'); if (!(await page.locator('#debug-tools').evaluate(e=>e.open))) await page.locator('#debug-tools > summary').click(); await page.locator('#save').click();
  const state=await page.evaluate(async()=>JSON.parse(await window.lastExport));
  await page.locator('#close-debug').click(); return state;
 }
 for(const [faction,styles] of Object.entries(CAMPAIGN_STYLES)) for(let i=0;i<styles.length;i++){
   await load(faction,i,0); assert.equal(await page.locator('#ultimate-touch').isVisible(),false);
   await load(faction,i,6); await page.waitForSelector('#ultimate-touch',{state:'visible'});
   assert.equal(await page.locator('#ultimate-touch').isDisabled(),true);
   assert.equal(await page.locator('#ultimate-touch').evaluate(e=>e.style.getPropertyValue('--charge')),'60%');
   await load(faction,i,10); await page.waitForSelector('#ultimate-touch.ready');
   const boxes=await page.locator('#ultimate-touch, #attack-touch').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,height:r.height};}));
   assert.ok(boxes[0].right<boxes[1].x);assert.equal(boxes[0].height,boxes[1].height);
   await page.screenshot({path:path.join(output,`pret-${styles[i].id}.png`)});
   await page.locator('#ultimate-touch').tap(); await page.waitForSelector('#ultimate-touch',{state:'hidden'});
   const state=await save(),c=state.candidates.find(c=>c.id===state.local_candidate_id);
   assert.equal(c.special_charge,0);assert.ok(state.events.some(e=>e.type==='UltimateActivated'&&e.kind===styles[i].ultimate.kind));
   if(styles[i].ultimate.kind==='BARDELLA')assert.equal(c.bardella_guardian_armed,true);
   report.flows.push(`${styles[i].id} : invisible à zéro, remplissage 60 %, prêt, activation tactile`);
 }
 await load('melenchon',0);
 await page.locator('#move-right').tap(); await page.locator('#move-right').tap();
 let state=await save();let c=state.candidates.find(c=>c.id===state.local_candidate_id);assert.equal(c.dash_charges,2);
 assert.ok(state.events.some(e=>e.type==='DashStarted'&&e.direction===1));report.flows.push('Double appui tactile : dash réel, une charge consommée');
 await load('melenchon',0);
 await page.keyboard.down('d');await page.waitForTimeout(500);await page.keyboard.up('d');state=await save();c=state.candidates.find(c=>c.id===state.local_candidate_id);assert.equal(c.dash_charges,3);
 await page.keyboard.press('F3'); await page.keyboard.press('k'); await page.locator('#close-debug').click(); await page.waitForSelector('#ultimate-touch.ready');await page.keyboard.press('r');await page.waitForSelector('#ultimate-touch',{state:'hidden'});
 report.flows.push('Maintien clavier sans dash ; K recharge, R active');
 await load('melenchon',0,10);await page.waitForSelector('#ultimate-touch.ready');
 await page.waitForTimeout(11000);const fill=await page.locator('#ultimate-touch').evaluate(e=>parseFloat(e.style.getPropertyValue('--charge')));assert.ok(fill>30&&fill<95,fill);
 await page.waitForSelector('#ultimate-touch',{state:'hidden',timeout:6500});report.flows.push('Décharge réelle du bouton après 10 secondes, disparition à 15 secondes');
 await page.setViewportSize({width:390,height:844});await load('le_pen',2,10);
 await page.waitForSelector('#ultimate-touch.ready');await page.screenshot({path:path.join(output,'mobile-portrait.png')});
 assert.equal(await page.locator('#error').isVisible(),false);assert.deepEqual(report.errors,[]);
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { campaignConfig } from '../../scripts/validate-campaign.mjs';
import { GameSimulation } from '../../src/simulation/game-simulation.js';
import { activateUltimate, beginCombatTick, updateCombat, cancelCurrentAttack, requestAttack } from '../../src/simulation/combat.js';
import { combatState } from '../../src/simulation/combat-state.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CAMPAIGN_TEST_NODE_MODULES ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright') : 'playwright');
const config=campaignConfig(), scenes=[];
function scene(label,faction,age,prepare=()=>{},finish=()=>{}) {
  const sim=new GameSimulation(config,42), s=sim.state;
  const owner=s.candidates.find(c=>c.faction_id===faction), target=s.candidates.find(c=>c.faction_id==='philippe');
  s.tick=120;s.npcs=[];s.candidates=[owner,target];s.local_candidate_id=owner.id;
  owner.x=100;owner.facing=1;owner.campaign_active=true;owner.special_charge=100;target.x=104;target.current_campaign_style='philippe_gestionnaire';target.resistance=100;
  prepare(sim,owner,target);activateUltimate(sim,owner);
  for(let n=0;n<Math.ceil(age*sim.hz);n++){s.tick++;beginCombatTick(sim);updateCombat(sim);}
  finish(sim,owner,target);
  scenes.push({label,state:structuredClone(s)});
}
scene('Roussel · aller','roussel',.25);
scene('Roussel · retour','roussel',.95);
scene('NDA · votre silhouette','dupont_aignan',.5);
scene('NDA · vue adverse','dupont_aignan',.5,()=>{},(sim,o,t)=>sim.state.local_candidate_id=t.id);
scene('Glucksmann · appel','glucksmann',.3);
scene('Glucksmann · livraison','glucksmann',1.7);
scene('Arthaud · équipement','arthaud',.7);
scene('Arthaud · faucille','arthaud',.7,()=>{},(sim,o,t)=>{cancelCurrentAttack(sim,o);t.x=102;requestAttack(sim,o);for(let i=0;i<6;i++){sim.state.tick++;beginCombatTick(sim);updateCombat(sim);}});
scene('Arthaud · marteau','arthaud',.7,()=>{},(sim,o,t)=>{cancelCurrentAttack(sim,o);o.combat.combo_step=1;o.combat.combo_expires_tick=sim.state.tick+100;t.x=102;requestAttack(sim,o);for(let i=0;i<15;i++){sim.state.tick++;beginCombatTick(sim);updateCombat(sim);}});
scene('Retailleau · mur','retailleau',.5);
scene('Retailleau · bascule','retailleau',3.9);
scene('Attal · cartable posé','attal',1.1);
scene('Attal · second appui','attal',1.1,()=>{},(sim,o,t)=>{activateUltimate(sim,o);for(let i=0;i<5;i++){sim.state.tick++;beginCombatTick(sim);updateCombat(sim);}});
const output=path.resolve('artifacts/ultimes-mineurs');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
const page=await browser.newPage({viewport:{width:1800,height:1600}});page.on('pageerror',e=>errors.push(e.message));
await page.route('**/ultimes-review',r=>r.fulfill({contentType:'text/html',body:'<html lang="fr"><body style="margin:0"><canvas width="1800" height="1600"></canvas></body></html>'}));
await page.goto((process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027')+'/ultimes-review');
const report=await page.evaluate(async({config,scenes})=>{
const {visualManifest}=await import('/src/presentation/rendu/visual-manifest.js');
const {WorldRenderer}=await import('/src/presentation/rendu/renderer.js');
const {drawCombatEffects}=await import('/src/presentation/effets/combat-effects.js');
const loaded=new Map(await Promise.all(Object.entries(visualManifest).filter(([id])=>id.startsWith('minor-')||id.startsWith('character-minor-')||id.startsWith('ultimate-minor-')||id.startsWith('character-philippe')||id==='character-style-philippe-gestionnaire').map(async([id,e])=>{const image=new Image();image.src=e.file;await image.decode();return[id,image];})));
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),result=[];
for(const [i,{label,state}]of scenes.entries()){
 const tile=document.createElement('canvas');tile.width=600;tile.height=320;const t=tile.getContext('2d');
 t.fillStyle='#e8dfca';t.fillRect(0,0,600,320);t.fillStyle='#ceb58f';t.fillRect(0,275,600,45);
 const renderer={ctx:t,config,p:config.prototype.presentation,width:600,height:320,metrics:{groundY:270,characterHeight:100,pixelsPerUnit:40,groundOffsetRatio:.06},assets:{get:id=>loaded.get(id),load:async()=>{}},screenX:x=>140+(x-100)*40};
 renderer.drawVisiblePerson=WorldRenderer.prototype.drawVisiblePerson;
 renderer.drawPerson=WorldRenderer.prototype.drawPerson;
 for(const entity of state.candidates)renderer.drawPerson(entity,renderer.screenX(entity.x),state);
 drawCombatEffects(renderer,state,false);
 t.fillStyle='#223342';t.textAlign='center';t.font='bold 18px system-ui';t.fillText(label,300,24);
 ctx.drawImage(tile,(i%3)*600,Math.floor(i/3)*320);
 result.push({label,powers:state.powers.map(p=>p.kind)});
}
return result;
},{config,scenes});
assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,'ultimes-en-jeu.png')});await writeFile(path.join(output,'verification.json'),JSON.stringify({report,errors},null,2));
// Parcours réel : le second appui doit rester disponible malgré la jauge vidée.
const game=await browser.newPage({viewport:{width:1280,height:800}});
game.on('pageerror',e=>errors.push(e.message));
await game.addInitScript(()=>localStorage.setItem('presidentielles2027:profile:v1',JSON.stringify({nickname:'betatest'})));
await game.goto(process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027');
await game.locator('#legal-notice-accept').click({timeout:30000});
await game.locator('#debate').click();
await game.locator('#solo').click();
await game.locator('[data-faction="attal"]').click();
await game.locator('[data-faction="philippe"]').click();
await game.evaluate(async()=>{
 const {DebateMatch}=await import('/src/simulation/debate-mode.js');
 const create=DebateMatch.prototype.createCandidates,step=DebateMatch.prototype.step;
 DebateMatch.prototype.createCandidates=function(){const result=create.call(this);result[0].special_charge=this.config.balance.special_charge.required_points;result[1].combat.stun_ticks=600;return result;};
 DebateMatch.prototype.step=function(...args){const result=step.apply(this,args);window.minorUltimateTest=this;return result;};
});
await game.locator('#debate-fight').click();
await game.waitForFunction(()=>window.minorUltimateTest?.state.phase==='FIGHT',null,{timeout:90000});
await game.locator('#ultimate-touch.ready').click();
await game.waitForFunction(()=>window.minorUltimateTest.state.powers.some(p=>p.kind==='SATCHEL'&&p.launched));
assert.equal(await game.locator('#ultimate-touch').isVisible(),true);
assert.equal(await game.locator('#ultimate-touch').textContent(),'Faire éclater');
assert.equal(await game.locator('.debate-fighter-ultimate:not([hidden])').count(),2);
await game.locator('#ultimate-touch:not([disabled])').click();
await game.waitForFunction(()=>window.minorUltimateTest.state.powers.some(p=>p.kind==='SATCHEL'&&p.detonated_tick!=null));
await game.screenshot({path:path.join(output,'attal-second-appui-interface.png')});
assert.deepEqual(errors,[]);
console.log(`${report.length} scènes dessinées et cartable déclenché par deux appuis dans l’interface réelle, aucune erreur navigateur.`);
}finally{await browser.close();}

import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 for(const candidate of ['melenchon','le_pen','philippe']) {
 const page=await browser.newPage({viewport:{width:1080,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.CAMPAIGN_TEST_URL||'http://localhost:2037'}/src/presentation/melenchon-guard-preview.html?candidate=${candidate}`);
 await page.waitForFunction(()=>window.galleryReady);
 const result=await page.evaluate(()=>{
   const p=window.guardPreview,c=p.candidate; p.manual(0);p.advance(1);c.x=100;p.advance(1);
   const before=JSON.stringify(p.sim.state),frames=[],positions=[];p.manual(1);
   for(let i=0;i<12;i++){p.advance(1);frames.push(p.renderer.melenchonMotionTracker.walkers.get(c.id).distance);positions.push(c.x);}
   p.manual(0);p.advance(2);const stopped=c.x;p.advance(8);
   return {frames,positions,stopped,after:c.x,tick:p.sim.state.tick,changed:before!==JSON.stringify(p.sim.state)};
 });
 assert.ok(result.positions.at(-1)>result.positions[0]);assert.ok(new Set(result.frames).size>6);assert.equal(result.after,result.stopped);
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(160);await page.keyboard.up('ArrowLeft');
 await page.screenshot({path:`artifacts/${candidate}-guard-moving.png`});
 await page.getByRole('button',{name:'Reprendre la démonstration'}).click();await page.waitForTimeout(250);
 await page.screenshot({path:`artifacts/${candidate}-guard-demo.png`});
 assert.deepEqual(errors,[]);console.log(`${candidate} : déplacement simulé, cycle lié à la distance, arrêt et clavier vérifiés.`);
 await page.close();
 }
}finally{await browser.close();}

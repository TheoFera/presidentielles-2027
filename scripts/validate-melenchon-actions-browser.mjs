import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 for(const candidate of ['melenchon','le_pen','philippe']) {
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.CAMPAIGN_TEST_URL||'http://localhost:2037'}/src/presentation/melenchon-actions-preview.html?candidate=${candidate}`);
 await page.waitForFunction(()=>window.galleryReady);
 const snapshots=[];
 for(const tick of [0,4,25,45]){
  await page.evaluate(t=>window.previewTick(t),tick);
  const pixels=await page.locator('canvas').evaluateAll(canvases=>canvases.map(c=>{
   const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let dark=0;for(let i=0;i<data.length;i+=4)if(data[i]<90&&data[i+1]<90&&data[i+2]<90)dark++;
   return {dark,signature:c.toDataURL()};
  }));
  assert.equal(pixels.length,13);assert.ok(pixels.every(p=>p.dark>200&&p.dark<20000));snapshots.push(pixels);
  await page.screenshot({path:`artifacts/${candidate}-actions-${tick}.png`,fullPage:true});
 }
 for(const index of [1,2,3,4,5,6,8,9,10,11,12])assert.ok(snapshots.some(s=>s[index].signature!==snapshots[0][index].signature),`Animation ${index} figée`);
 assert.deepEqual(errors,[]);console.log(`${candidate} : 13 scènes visibles ; poses animées, KO et atterrissage vérifiés.`);
 await page.close();
 }
} finally {await browser.close();}

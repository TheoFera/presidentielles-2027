import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
const output=path.resolve('artifacts/candidate-animations');await mkdir(output,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1100,height:800}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const faction of ['melenchon','le_pen','philippe']) {
    await page.goto(`${process.env.CAMPAIGN_TEST_URL || 'http://localhost:2037'}/src/presentation/combat-preview.html?candidate=${faction}`);
    await page.waitForFunction(()=>window.galleryReady);
    await page.waitForTimeout(100);
    const visible=await page.locator('canvas').evaluateAll(canvases=>canvases.map(c=>{
      const data=c.getContext('2d').getImageData(0,0,c.width,230).data;
      let dark=0;for(let i=0;i<data.length;i+=4) if(data[i]<90&&data[i+1]<90&&data[i+2]<90)dark++;
      return dark>300&&dark<20000;
    }));
    assert.equal(visible.length,13);assert.ok(visible.every(Boolean),faction);
    await page.screenshot({path:path.join(output,`${faction}.png`),fullPage:true});
    console.log(`${faction} : 13 poses visibles.`);
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}

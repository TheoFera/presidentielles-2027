import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {skinAnimationAtlases} from '../src/presentation/skin-animation-atlases.js';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
await mkdir('artifacts/skin-animations',{recursive:true});
try {
  for(const [skin,{faction}] of Object.entries(skinAnimationAtlases)) {
    const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    for(const [name,url] of [['combat','combat-preview'],['actions','melenchon-actions-preview'],['guard','melenchon-guard-preview']]) {
      await page.goto(`${process.env.CAMPAIGN_TEST_URL||'http://localhost:2037'}/src/presentation/${url}.html?candidate=${faction}&skin=${skin}`);
      await page.waitForFunction(()=>window.galleryReady);
      assert.equal(await page.getByLabel('Tenue du candidat').inputValue(),skin);
      if(name==='actions')await page.evaluate(()=>window.previewTick(4));
      if(name==='guard') {
        const movement=await page.evaluate(()=>{
          const p=window.guardPreview;p.manual(1);const x=p.candidate.x;const frames=[];
          for(let i=0;i<10;i++){p.advance(1);frames.push(p.renderer.melenchonMotionTracker.walkers.get(p.candidate.id).distance);}
          p.manual(0);p.advance(1);const stopped=p.candidate.x;p.advance(4);
          return {x,stopped,after:p.candidate.x,frames};
        });
        assert.ok(movement.stopped>movement.x);assert.equal(movement.after,movement.stopped);assert.ok(new Set(movement.frames).size>5);
      } else {
        const pixels=await page.locator('canvas').evaluateAll(canvases=>canvases.map(c=>{
          const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          let ink=0;for(let i=0;i<data.length;i+=4)if(data[i]<120&&data[i+1]<120&&data[i+2]<120)ink++;
          return ink;
        }));
        assert.equal(pixels.length,13);assert.ok(pixels.every(n=>n>150&&n<25000),skin+' '+name);
      }
      await page.screenshot({path:`artifacts/skin-animations/${skin}-${name}.png`,fullPage:true});
    }
    assert.deepEqual(errors,[]);console.log(skin+' : combat, réactions, interactions et marche vérifiés.');await page.close();
  }
} finally {await browser.close();}

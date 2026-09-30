import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {skinAnimationAtlases} from '../src/presentation/skin-animation-atlases.js';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright'));
const cases=[...['melenchon','le_pen','philippe'].map(faction=>({faction})),...Object.entries(skinAnimationAtlases).map(([skin,{faction}])=>({skin,faction})),{faction:'philippe',skin:'philippe_europeiste',form:'europe'},{faction:'le_pen',skin:'le_pen_gouvernement',form:'bardella'}];
const browser=await chromium.launch({headless:true,channel:'chrome'});
await mkdir('artifacts/major-guard-audit',{recursive:true});
try {
  for(const entry of cases){
    const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    const query=new URLSearchParams({candidate:entry.faction,...(entry.skin?{skin:entry.skin}:{}),...(entry.form?{form:entry.form}:{})});
    await page.goto(`${process.env.CAMPAIGN_TEST_URL||'http://localhost:2027'}/src/presentation/melenchon-guard-preview.html?${query}`);
    await page.waitForFunction(()=>window.galleryReady);
    const result=await page.evaluate(form=>{
      const p=window.guardPreview;p.setPaused(true);p.manual(0);p.advance(1);p.manual(1);
      const tracker=()=>form?p.renderer.ultimateMotionTracker:p.renderer.melenchonMotionTracker;
      const frames=new Set(),distances=[];
      for(let i=0;i<24;i++){p.advance(1);const value=tracker().walkers.get(p.candidate.id);distances.push(value.distance);frames.add(Math.floor(value.distance/2*8+1e-8)%8);}
      p.manual(0);p.advance(1);const stopped=p.candidate.x;p.advance(5);
      const distance=tracker().walkers.get(p.candidate.id).distance;
      p.manual(-1);p.advance(3);const left=p.candidate.x;
      return {frames:[...frames],distances,stopped,after:left,distance};
    },entry.form||null);
    assert.equal(result.frames.length,8,JSON.stringify(entry)+' : huit pas');
    assert.equal(result.distance,0,'Arrêt : remise au repos');assert.ok(result.after<result.stopped,'Retour vers la gauche');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`artifacts/major-guard-audit/${entry.form||entry.skin||entry.faction}.png`,fullPage:true});
    console.log(`${entry.form||entry.skin||entry.faction} : huit pas, arrêt et retour vérifiés.`);
    await page.close();
  }
} finally {await browser.close();}

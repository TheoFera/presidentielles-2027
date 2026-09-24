import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
await mkdir('artifacts/ultimate-animations',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto(`${process.env.CAMPAIGN_TEST_URL||'http://localhost:2037'}/src/presentation/ultimate-preview.html`);
  await page.waitForFunction(()=>window.galleryReady);
  await page.evaluate(()=>{window.ultimatePreview.setPaused(true);window.ultimatePreview.reset();});
  for(const [name,ticks]of [['activation',0],['impact',18],['retour',4],['contre',23],['saut',13],['effets',40]]){
    await page.evaluate(n=>window.ultimatePreview.advance(n),ticks);
    await page.screenshot({path:`artifacts/ultimate-animations/${name}.png`,fullPage:true});
    if(name==='impact')await page.locator('.tile').first().screenshot({path:'artifacts/ultimate-animations/echarpe.png'});
  }
  await page.evaluate(()=>{window.ultimatePreview.reset();window.ultimatePreview.advance(88);});
  await page.locator('.tile').nth(3).screenshot({path:'artifacts/ultimate-animations/deferlement-retour.png'});
  await page.getByRole('button',{name:'Inverser la direction'}).click();
  await page.evaluate(()=>window.ultimatePreview.advance(15));
  await page.screenshot({path:'artifacts/ultimate-animations/gauche.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/ultimate-animations/portrait.png',fullPage:true});
  assert.equal(await page.locator('canvas').count(),8);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('Huit ultimes : rendu, impact, saut, direction gauche et portrait vérifiés.');
}finally{await browser.close();}

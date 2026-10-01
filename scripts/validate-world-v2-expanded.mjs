import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright'));
const output=path.resolve('artifacts/world-v2-expanded');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto((process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027')+'/src/presentation/world-v2-preview.html?decor=panoramas');
  await page.waitForFunction(()=>window.worldV2Preview,{timeout:60000});
  const report=await page.evaluate(()=>{
    const {sim,renderer,draw}=window.worldV2Preview,{state}=sim;
    const montage=(positions)=>{
      const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=Math.ceil(positions.length/3)*258;
      const ctx=canvas.getContext('2d');
      positions.forEach((item,i)=>{
        draw(item.x);const x=i%3*426,y=Math.floor(i/3)*258;
        ctx.drawImage(renderer.canvas,x,y,426,236);ctx.fillStyle='#e9ddbf';ctx.fillRect(x,y+236,426,22);ctx.fillStyle='#263d32';ctx.font='13px system-ui';ctx.fillText(item.label,x+8,y+252);
      });return canvas.toDataURL();
    };
    const zones=montage(state.world.subzones.map(z=>({x:z.center,label:z.id})));
    const joins=montage(state.world.subzones.filter(z=>z.local_index===0).map(z=>({x:z.start,label:'Raccord '+z.id})));
    draw(0);const first=renderer.canvas.toDataURL();draw(state.world.length);
    return {zones,joins,loopIdentical:first===renderer.canvas.toDataURL(),assets:renderer.assets.status(),signs:renderer.worldV2Sites.size};
  });
  for(const name of ['zones','joins'])await writeFile(path.join(output,name+'.png'),Buffer.from(report[name].split(',')[1],'base64'));
  assert.deepEqual(errors,[]);assert.deepEqual(report.assets.failed,[]);assert.equal(report.signs,21);assert.equal(report.loopIdentical,true);
  await page.selectOption('#zone','paris_b');await page.screenshot({path:path.join(output,'paris-b.png')});
  await page.selectOption('#zone','banlieue_a');await page.screenshot({path:path.join(output,'banlieue-a.png')});
  await page.selectOption('#zone','retraites_b');await page.screenshot({path:path.join(output,'retraites-b.png')});
  await page.selectOption('#season','0.6');await page.screenshot({path:path.join(output,'hiver.png')});
  const resize=async viewport=>{await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{worldV2Preview.refresh();resolve();}))));};
  await resize({width:844,height:390});await page.screenshot({path:path.join(output,'mobile-paysage.png')});
  await resize({width:390,height:844});await page.screenshot({path:path.join(output,'mobile-portrait.png')});
  const summary={assets:report.assets,signs:report.signs,loopIdentical:report.loopIdentical,errors,output};
  await writeFile(path.join(output,'rapport.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
} finally {await browser.close();}

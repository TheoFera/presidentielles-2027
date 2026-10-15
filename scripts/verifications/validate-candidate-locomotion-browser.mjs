import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CAMPAIGN_TEST_NODE_MODULES ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright') : 'playwright');
const output = path.resolve('artifacts/animation-audit'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' }), errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1160, height: 1120 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto((process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027') + '/src/presentation/debogage/apercu-deplacements.html');
  await page.waitForFunction(() => window.controleDeplacements?.ready);
  await page.evaluate(() => window.controleDeplacements.pause());
  const reports = [];
  for (const facing of [-1, 1]) {
    const pair = await page.evaluate(facing => ({ idle: window.controleDeplacements.render('idle', 0, facing), walk: window.controleDeplacements.render('walk', 0, facing) }), facing);
    assert.deepEqual(pair.walk, pair.idle, 'Le déplacement ordinaire conserve exactement la pose et l’échelle de l’attente.');
    for (const mode of ['idle', 'walk', 'guard', 'guard-walk']) for (let frame = 0; frame < 8; frame++) {
      const records = await page.evaluate(({ mode, frame, facing }) => window.controleDeplacements.render(mode, frame * 7, facing, frame), { mode, frame, facing });
      assert.equal(records.length, 9, `${mode} ${frame} : les neuf candidats doivent être dessinés.`);
      assert.ok(records.every(p => Number.isFinite(p.ratio) && Math.abs(p.ratio - 1) < 1e-10));
      reports.push({ mode, frame, facing, records });
    }
  }
  const animation=await page.evaluate(()=>{
    const api=window.controleDeplacements,factions=['attal','dupont_aignan','glucksmann'],result=[];
    for(const facing of [-1,1])for(const mode of ['guard','guard-walk']){
      const sequences=new Map(factions.map(f=>[f,[]]));
      for(let phase=0;phase<4;phase++)for(const record of api.render(mode,Math.ceil((phase+.1)*.175*api.hz),facing,mode==='guard-walk'?phase*2:null))if(sequences.has(record.faction))sequences.get(record.faction).push(record.fingerprint);
      for(const [faction,hashes]of sequences)result.push({mode,facing,faction,distinct:new Set(hashes).size});
    }
    // Le vrai suivi de la distance doit avancer lui aussi ; les index ne sont plus forcés ici.
    const tracked=new Map(factions.map(f=>[f,new Set()]));
    for(let tick=0;tick<=api.hz;tick++)for(const record of api.render('guard-walk',tick,1))if(tracked.has(record.faction))tracked.get(record.faction).add(record.fingerprint);
    return{sequences:result,tracked:[...tracked].map(([faction,frames])=>({faction,distinct:frames.size}))};
  });
  for(const r of animation.sequences)assert.equal(r.distinct,r.mode==='guard'?3:4,`${r.faction} ${r.mode} : les dessins doivent réellement changer.`);
  for(const r of animation.tracked)assert.equal(r.distinct,4,`${r.faction} : cycle de déplacement bloqué.`);
  for (const [mode, file] of [['idle', 'attente-neuf-candidats'], ['walk', 'deplacement-neuf-candidats'], ['guard-walk', 'garde-neuf-candidats']]) {
    await page.evaluate(mode => window.controleDeplacements.render(mode, 14, 1, 2), mode);
    await page.locator('canvas').screenshot({ path: path.join(output, file + '.png') });
  }
  await page.evaluate(()=>{
    const api=window.controleDeplacements,source=document.querySelector('canvas'),strip=document.createElement('canvas');strip.id='boucles';strip.width=1920;strip.height=960;
    const ctx=strip.getContext('2d');ctx.fillStyle='#e9e1ce';ctx.fillRect(0,0,strip.width,strip.height);
    const candidates=[['philippe',0],['attal',1],['dupont_aignan',2],['glucksmann',4]];
    for(const [row,[faction,tile]]of candidates.entries())for(let column=0;column<8;column++){
      const mode=column<4?'guard':'guard-walk',phase=column%4;
      api.render(mode,Math.ceil((phase+.1)*.175*api.hz),1,mode==='guard-walk'?phase*2:null);
      ctx.drawImage(source,tile%3*360+60,Math.floor(tile/3)*280+52,240,210,column*240,row*240+25,240,210);
      ctx.fillStyle='#223440';ctx.textAlign='center';ctx.font='13px system-ui';ctx.fillText(`${api.names[faction]} · ${mode==='guard'?'garde':'pas'} ${phase+1}`,column*240+120,row*240+18);
    }
    document.querySelector('main').append(strip);
  });
  await page.locator('#boucles').screenshot({path:path.join(output,'boucles-garde-comparees.png')});
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'locomotion-measurements.json'), JSON.stringify({ reports, animation, errors }, null, 2));
  console.log(`${reports.length * 9} dessins contrôlés : neuf candidats, quatre situations, huit phases, deux orientations. Attente et déplacement ordinaire identiques en proportions et pose, aucune erreur navigateur.`);
  console.log('Garde : trois dessins distincts par personnage. Déplacement en garde : quatre appuis réellement parcourus, y compris avec le suivi de distance.');
} finally { await browser.close(); }

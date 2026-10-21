import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CAMPAIGN_TEST_NODE_MODULES ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES,'playwright') : 'playwright');
const root=process.cwd(), output=path.resolve('artifacts/journalistes');await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/verification') {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html lang="fr"><meta charset="utf-8"><title>Vérification des journalistes</title><style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas></html>');return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname)),relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'image/png');res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],requests=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/journalistes/'))requests.push(r.url());});
  await page.goto(`http://127.0.0.1:${server.address().port}/verification`);
  await page.evaluate(async()=>{
    const [{loadConfig},{GameSimulation},{WorldRenderer},{worldAssetIds},{spawnPressTeam,updatePressTeam},{pressMember,filmed,leavePressTeam},{hit},{requestDash},{CampaignStyleSystem,CAMPAIGN_STYLES}]=await Promise.all([
      import('/src/config.js'),import('/src/simulation/game-simulation.js'),import('/src/presentation/rendu/renderer.js'),import('/src/presentation/carte/illustrated-world.js'),
      import('/src/simulation/press-team.js'),import('/src/simulation/press-rules.js'),import('/src/simulation/combat-state.js'),import('/src/simulation/mobile-combat.js'),import('/src/simulation/campaign-styles.js')]);
    const config=await loadConfig(),sim=new GameSimulation(config,42),renderer=new WorldRenderer(document.querySelector('canvas'),config);
    sim.state.ai_enabled=false;const c=sim.state.candidates[0];sim.state.local_candidate_id=c.id;
    CampaignStyleSystem.select(sim,c,CAMPAIGN_STYLES[c.faction_id][0].id,true);
    await renderer.assets.keep(worldAssetIds(renderer.assets.manifest,sim.state));
    const api=window.pressCheck={sim,renderer,c,spawnPressTeam,updatePressTeam,pressMember,filmed,leavePressTeam,hit,requestDash,records:[],film_labels:0};
    const nativeText=renderer.ctx.strokeText.bind(renderer.ctx);
    renderer.ctx.strokeText=(text,...args)=>{if(String(text).startsWith('FILMÉ'))api.film_labels++;return nativeText(text,...args);};
    api.frame=()=>{const previous=sim.motionSnapshot(),t=performance.now();sim.step();renderer.draw(sim.presentationView(),previous,.5,1/60);return performance.now()-t;};
    api.sample=async(n,phase)=>{const durations=[],intervals=[];let last=performance.now();for(let i=0;i<n;i++){await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-last);last=now;durations.push(api.frame());}api.records.push({phase,durations,intervals});};
    api.frame();
  });
  await page.evaluate(()=>window.pressCheck.sample(90,'sans-journalistes'));
  const before=requests.length;
  await page.evaluate(()=>{const a=window.pressCheck;a.spawnPressTeam(a.sim,a.c);});
  await page.evaluate(()=>window.pressCheck.sample(55,'apparition'));
  await page.locator('canvas').screenshot({path:path.join(output,'arrivee.png')});
  await page.evaluate(()=>{const a=window.pressCheck,cam=a.pressMember(a.sim.state,'PRESS_CAMERA'),r=a.pressMember(a.sim.state,'PRESS_REPORTER');cam.x=a.c.x-2.8;r.x=a.c.x-1.3;r.combat.cooldown_ticks=10000;});
  await page.evaluate(()=>window.pressCheck.sample(35,'filmage'));
  const film=await page.evaluate(()=>{const a=window.pressCheck;return a.filmed(a.sim.state,a.sim.config,a.c);});assert.equal(film,true);
  assert.equal(await page.evaluate(()=>window.pressCheck.film_labels),0,'aucun texte de statistiques de filmage dans le jeu');
  await page.locator('canvas').screenshot({path:path.join(output,'combat-filmage.png')});
  const walk = await page.evaluate(async()=>{
    const {drawPressCharacter} = await import('/src/presentation/personnages/press-sprites.js');
    const {drawIllustratedCharacter}=await import('/src/presentation/personnages/illustrated-characters.js');
    const {PRESS_ATLASES}=await import('/src/presentation/personnages/press-atlases.js');
    const {prepareAtlasFrames}=await import('/src/presentation/personnages/minor-sprite-images.js');
    const {standingSpriteMotion}=await import('/src/presentation/personnages/standing-sprite-motion.js');
    const {drawStandingSprite}=await import('/src/presentation/personnages/standing-sprite-motion.js');
    const a=window.pressCheck,canvas=document.createElement('canvas');canvas.width=1200;canvas.height=600;
    const reference=document.createElement('canvas');reference.width=1200;reference.height=600;
    const referenceCtx=reference.getContext('2d',{willReadFrequently:true});
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),reports=[],frames=[];
    const r={config:a.sim.config,p:a.renderer.p,assets:a.renderer.assets,ctx,height:600,pressAlpha:0,personMarks:new Map(),
      metrics:{characterHeight:196,groundY:270,groundOffsetRatio:0}};
    const s={...a.sim.state,press_team:{...a.sim.state.press_team,phase:'ACTIVE'},attacks:[]};
    let first;
    for(let t=0;t<16;t++){
      ctx.clearRect(0,0,1200,600);referenceCtx.clearRect(0,0,1200,600);s.tick=t;
      for(let row=0;row<2;row++)for(let col=0;col<6;col++){
        const source=a.pressMember(a.sim.state,row?'PRESS_REPORTER':'PRESS_CAMERA');
        const actor={...source,variant:Math.floor(col/2),facing:col%2?-1:1,moving:true,filming:false,press_ready:true,
          combat:{...source.combat,attack_id:null,stun_ticks:0}};
        r.metrics.groundY=270+row*300;drawPressCharacter(r,actor,col*200+100,s);
        // Même silhouette confiée au VRAI rendu des habitants, pour comparer le mouvement.
        const atlas=PRESS_ATLASES[actor.variant],index=row?3:0,frame=atlas.frames[index];
        const sprite=prepareAtlasFrames(r.assets.get(atlas.sprite),atlas)[index];
        const height=196*r.p.npc_height_multiplier*(atlas.sizeScale||1),scale=height/atlas.referenceHeight;
        const offset=(frame[0]-frame[4])*scale+frame[2]*scale/2;
        const motion=standingSpriteMotion('walk',t/a.sim.hz),angle=motion.stride*.025;
        const centerX=col*200+100+actor.facing*Math.cos(angle)*offset/motion.breathing;
        const centerY=r.metrics.groundY+Math.sin(angle)*offset/motion.breathing;
        const npc={...actor,role:'NEUTRE',presentation_name:'Journaliste',persuasion_target_ids:[],combat:{...actor.combat,engaged:false}};
        referenceCtx.save();referenceCtx.translate(col*200+100,0);referenceCtx.scale(atlas.widthScale||1,1);referenceCtx.translate(-col*200-100,0);
        drawIllustratedCharacter({...r,ctx:referenceCtx,metrics:{...r.metrics,characterHeight:196*(atlas.sizeScale||1),groundY:centerY},assets:{get:()=>sprite,load:async()=>sprite}},npc,centerX,s);
        referenceCtx.restore();
      }
      const pixels=ctx.getImageData(0,0,1200,600).data;
      const npcPixels=referenceCtx.getImageData(0,0,1200,600).data;
      if(t===0)first=pixels;
      if(t===4){
        for(let row=0;row<2;row++)for(let col=0;col<6;col++){
          let upper=0,legs=0,npcDifference=0;
          for(let y=80+row*300;y<271+row*300;y++)for(let x=col*200+5;x<col*200+195;x++){
            const p=(y*1200+x)*4;let changed=false;for(let k=0;k<4;k++)if(pixels[p+k]!==first[p+k])changed=true;
            if(changed){if(y<210+row*300)upper++;else if(y>230+row*300)legs++;}
            // Une unité de canal tolère l’arrondi du filtrage avec le calage horizontal.
            if(y>95+row*300&&y<260+row*300){for(let k=0;k<4;k++)if(Math.abs(pixels[p+k]-npcPixels[p+k])>1){npcDifference++;break;}}
          }
          reports.push({role:row?'journaliste':'cameraman',variante:Math.floor(col/2)+1,sens:col%2?'gauche':'droite',pixels_buste_modifies:upper,pixels_jambes_modifies:legs,pixels_differents_du_rendu_pnj:npcDifference});
        }
      }
      frames.push(canvas.toDataURL('image/png').split(',')[1]);
    }
    // Une texture opaque révèle les fissures de filtrage à la jonction des découpes.
    const solid=document.createElement('canvas');solid.width=100;solid.height=200;
    const solidCtx=solid.getContext('2d');solidCtx.fillStyle='#38536c';solidCtx.fillRect(0,0,100,200);
    const kneeCanvas=document.createElement('canvas');kneeCanvas.width=256;kneeCanvas.height=300;
    const kneeCtx=kneeCanvas.getContext('2d',{willReadFrequently:true}),knees=[];
    for(const height of [80.3,137.6,180.32,196,220.7])for(const time of [.07,.23,.41]){
      const width=height*.5;kneeCtx.clearRect(0,0,256,300);kneeCtx.save();kneeCtx.translate(128.25,270.3);
      drawStandingSprite(kneeCtx,solid,{x:0,y:0,width:100,height:200},height,width,standingSpriteMotion('walk',time));kneeCtx.restore();
      const seam=270.3-height*.25;let minAlpha=255;
      for(const side of [-1,0,1])for(let y=Math.floor(seam)-1;y<=Math.ceil(seam)+1;y++)
        minAlpha=Math.min(minAlpha,kneeCtx.getImageData(Math.floor(128.25+side*width*.25),y,1,1).data[3]);
      knees.push({hauteur:height,temps:time,opacite_minimale:minAlpha});
    }
    return {reports,frames,knees};
  });
  for(let i=0;i<walk.frames.length;i++)await writeFile(path.join(output,`marche-${String(i).padStart(2,'0')}.png`),Buffer.from(walk.frames[i],'base64'));
  for(const check of walk.reports){assert.equal(check.pixels_differents_du_rendu_pnj,0,JSON.stringify(check));assert.ok(check.pixels_jambes_modifies>0,JSON.stringify(check));}
  for(const check of walk.knees)assert.equal(check.opacite_minimale,255,JSON.stringify(check));
  if(process.argv.includes('--preview')){
    const preview=await page.evaluate(async()=>{
      const {drawPressCharacter}=await import('/src/presentation/personnages/press-sprites.js');
      const a=window.pressCheck,canvas=document.createElement('canvas');canvas.width=960;canvas.height=560;
      const ctx=canvas.getContext('2d'),frames=[];
      const r={config:a.sim.config,p:a.renderer.p,assets:a.renderer.assets,ctx,height:560,pressAlpha:0,personMarks:new Map(),
        metrics:{characterHeight:182,groundY:240,groundOffsetRatio:0}};
      const names=['Kaki et rouge','Marine et ocre','Bleu et vert'];
      const s={...a.sim.state,press_team:{...a.sim.state.press_team,phase:'ACTIVE'},attacks:[]};
      for(let tick=0;tick<120;tick++){
        ctx.fillStyle='#e9e1d2';ctx.fillRect(0,0,960,560);s.tick=tick;s.attacks=[];
        ctx.fillStyle='#263940';ctx.font='500 18px system-ui';ctx.textAlign='center';
        ctx.fillText('Pose debout → marche des PNJ → pose debout',480,25);
        ctx.fillText('Pose debout → micro maintenu → retour à la base',480,313);
        for(let row=0;row<2;row++)for(let variant=0;variant<3;variant++){
          const moving=row===0&&tick>=24&&tick<96;
          const phase=tick%60,attackAge=phase-23;
          r.metrics.groundY=row?545:265;
          for(const role of ['PRESS_CAMERA','PRESS_REPORTER']){
            const source=a.pressMember(a.sim.state,role);
            const actor={...source,id:`preview:${row}:${variant}:${role}`,variant,facing:1,moving,filming:false,aim_ticks:0,press_ready:false,
              combat:{...source.combat,attack_id:null,height:0,stun_ticks:0}};
            if(row===1&&role==='PRESS_CAMERA'){
              actor.aim_ticks=phase>=23&&phase<41?phase-22:0;actor.filming=phase>=41&&phase<55;
            }
            const settings=a.sim.config.balance.press_team;
            const windup=a.sim.secondsToTicks(settings.micro_windup_seconds),active=a.sim.secondsToTicks(settings.micro_active_seconds),recovery=a.sim.secondsToTicks(settings.micro_recovery_seconds);
            if(row===1&&role==='PRESS_REPORTER'&&attackAge>=0&&attackAge<windup+active+recovery){
              actor.combat.attack_id='preview-micro';s.attacks=[{id:'preview-micro',owner_id:actor.id,elapsed_ticks:attackAge,windup_ticks:windup,active_ticks:active,recovery_ticks:recovery,
                micro_hold_until_tick:attackAge>=windup?tick-attackAge+windup+a.sim.secondsToTicks(settings.micro_stun_seconds):0}];
            }else s.attacks=[];
            const x=variant*320+(role==='PRESS_CAMERA'?66:190);
            drawPressCharacter(r,actor,x,s);
          }
          if(row===0){ctx.fillStyle='#263940';ctx.font='500 14px system-ui';ctx.fillText(names[variant],variant*320+160,54);}
        }
        frames.push(canvas.toDataURL('image/png').split(',')[1]);
      }
      return frames;
    });
    const dir=path.join(output,'apercu-validation');await mkdir(dir,{recursive:true});
    for(let i=0;i<preview.length;i++)await writeFile(path.join(dir,`image-${String(i).padStart(3,'0')}.png`),Buffer.from(preview[i],'base64'));
    const feetPreview=await page.evaluate(async()=>{
      const {drawPressCharacter}=await import('/src/presentation/personnages/press-sprites.js');
      const a=window.pressCheck,canvas=document.createElement('canvas');canvas.width=900;canvas.height=330;
      const ctx=canvas.getContext('2d'),r={config:a.sim.config,p:a.renderer.p,assets:a.renderer.assets,ctx,height:330,pressAlpha:0,
        metrics:{characterHeight:240,groundY:300,groundOffsetRatio:0}};
      ctx.fillStyle='#e9e1d2';ctx.fillRect(0,0,900,330);
      ctx.strokeStyle='#849080';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(20,300);ctx.lineTo(880,300);ctx.stroke();ctx.setLineDash([]);
      const s={...a.sim.state,press_team:{...a.sim.state.press_team,phase:'ACTIVE'},attacks:[]};
      for(const [i,label]of ['Repos','Cadrage à l’arrêt','Filmage à l’arrêt'].entries()){
        const source=a.pressMember(a.sim.state,'PRESS_CAMERA');
        const actor={...source,variant:0,facing:1,moving:false,filming:i===2,aim_ticks:i===1?1:0,press_ready:false,
          combat:{...source.combat,attack_id:null,height:0,stun_ticks:0}};
        ctx.fillStyle='#263940';ctx.font='500 18px system-ui';ctx.textAlign='center';ctx.fillText(label,150+i*300,32);
        drawPressCharacter(r,actor,150+i*300,s);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await writeFile(path.join(output,'appuis-cameraman-kaki.png'),Buffer.from(feetPreview,'base64'));
  }
  const escaped=await page.evaluate(async()=>{const a=window.pressCheck;a.requestDash(a.sim,a.c,-1);await a.sample(30,'dash');return a.c.x<a.pressMember(a.sim.state,'PRESS_CAMERA').x;});assert.equal(escaped,true);
  await page.locator('canvas').screenshot({path:path.join(output,'dash-repositionnement.png')});
  await page.evaluate(()=>{const a=window.pressCheck,r=a.pressMember(a.sim.state,'PRESS_REPORTER');a.c.x=r.x+.3;a.hit(a.sim,a.c,r,{kind:'CANDIDATE',damage:90,direction:-1,knockback:0,stun_seconds:.18},'verification');});
  await page.evaluate(()=>window.pressCheck.sample(25,'retrait'));
  await page.locator('canvas').screenshot({path:path.join(output,'retrait.png')});
  await page.evaluate(()=>window.pressCheck.sample(30,'sortie'));
  assert.equal(await page.evaluate(()=>window.pressCheck.sim.state.press_team),null);
  assert.equal(requests.length,before,'aucun chargement des journalistes au moment de leur apparition');
  const report=await page.evaluate(()=>{
    const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];
    return window.pressCheck.records.map(({phase,durations,intervals})=>({phase,calcul_et_dessin_median_ms:percentile(durations,.5),calcul_et_dessin_p95_ms:percentile(durations,.95),calcul_et_dessin_max_ms:Math.max(...durations),intervalle_image_p95_ms:percentile(intervals,.95)}));
  });
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'verification.json'),JSON.stringify({errors,images_journalistes:requests.length,chargements_pendant_apparition:requests.length-before,marche:walk.reports,raccords_genoux:walk.knees,report},null,2));
  console.log(JSON.stringify({output,errors,report}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

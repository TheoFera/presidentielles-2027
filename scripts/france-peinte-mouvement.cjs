// Mesure les déplacements réellement envoyés au canvas par les plans du pilote.
const {chromium}=require('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto('http://localhost:2027/src/presentation/world-v3/captures.html?decor=france_peinte');
    await page.waitForFunction(()=>document.title==='Captures prêtes',{},{timeout:120000});
    const report=await page.evaluate(async()=>{
      const [{loadConfig},{GameSimulation},{WorldRenderer},{worldAssetIds},complete]=await Promise.all([
        import('/src/config.js'),import('/src/simulation/game-simulation.js'),import('/src/presentation/renderer.js'),
        import('/src/presentation/illustrated-world.js'),import('/src/presentation/france-peinte-complete.js')]);
      const config=await loadConfig(),sim=new GameSimulation(config,42),state=sim.state;
      const canvas=document.createElement('canvas');canvas.style.width='1280px';canvas.style.height='720px';document.body.append(canvas);
      const renderer=new WorldRenderer(canvas,config);await renderer.assets.keep(worldAssetIds(renderer.assets.manifest,state));
      renderer.cameraX=35;renderer.draw(state,state,1,1/60,false);
      const tools={snow:0,seasonFilter:()=> 'none'}, results=[];
      const draw=renderer.ctx.drawImage.bind(renderer.ctx);
      for(const [plane,center] of [['horizon',33],['far',35],['mid',36],['back',36]]) {
        const positions=[];
        for(const camera of [center,center+.5]) {
          const calls=[];
          renderer.ctx.drawImage=(...args)=>{calls.push({x:args[1]+args[3]/2,width:args[3]});draw(...args);};
          renderer.cameraX=camera;complete.drawCompletePlane(renderer,state,tools,plane);
          // Le premier ensemble de dessins est le plan principal ; les détails suivent.
          const nearest=calls.slice(0,plane==='back'?3:calls.length).sort((a,b)=>Math.abs(a.x-renderer.metrics.anchorX)-Math.abs(b.x-renderer.metrics.anchorX))[0];
          if(!nearest) throw new Error(`Plan invisible : ${plane}`);
          positions.push(nearest.x);
        }
        results.push({plane,deplacement:positions[1]-positions[0],vitesseRelative:-(positions[1]-positions[0])/(.5*renderer.metrics.pixelsPerUnit)});
      }
      renderer.ctx.drawImage=draw;
      if(!results.every((r,i)=>r.vitesseRelative>0 && (i===0 || r.vitesseRelative>results[i-1].vitesseRelative))) throw new Error('Ordre de parallaxe incorrect.');
      return {plans:results,rue:{vitesseRelative:1},limite:'Mesure locale autour du centre de chaque plan ; la parallaxe se resserre aux sorties du territoire.'};
    });
    fs.mkdirSync('artifacts/france-peinte/reprise/pilote-v5',{recursive:true});
    fs.writeFileSync('artifacts/france-peinte/reprise/pilote-v5/mouvement.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

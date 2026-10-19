// Aperçu séquentiel avec les fonctions de dessin du jeu, sans recalage individuel des poses.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from '../validate-campaign.mjs';
import { GameSimulation } from '../../src/simulation/game-simulation.js';
import { combatState } from '../../src/simulation/combat-state.js';
import { activateUltimate, beginCombatTick, updateCombat, cancelCurrentAttack, requestAttack } from '../../src/simulation/combat.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CAMPAIGN_TEST_NODE_MODULES ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright') : 'playwright');
const config = campaignConfig(), hz = config.balance.simulation_architecture.fixed_tick_hz;
const balance = config.balance.candidate_combat, fps = 15;
const output = path.resolve('artifacts/dupont-aignan-animations');
await mkdir(path.join(output, 'images'), { recursive: true });
const initial = new GameSimulation(config, 42).state;
const original = initial.candidates.find(c => c.faction_id === 'dupont_aignan');
const reference = initial.candidates.find(c => c.faction_id === 'philippe');
for (const actor of [original, reference]) Object.assign(actor, { x: 100, facing: 1, moving: false, axis: 0, current_campaign_style: null, combat: combatState(), persuasion_target_ids: [] });
reference.x = 110;
const frames = [], chapters = [];
function base(age = 0) {
  const state = structuredClone(initial);
  Object.assign(state, { tick: 600 + Math.round(age * hz), candidates: [structuredClone(original), structuredClone(reference)], npcs: [], temporary_units: [], buildings: [], powers: [], attacks: [], projectiles: [], hit_results: [], local_candidate_id: original.id });
  return state;
}
function chapter(label, seconds, update, note = '') {
  chapters.push({ label, start: frames.length / fps, note });
  for (let i = 0; i < Math.ceil(seconds * fps); i++) {
    const age = i / fps, state = base(age);
    update?.(state.candidates[0], state, age, i / (seconds * fps));
    frames.push({ state, label, note });
  }
}
const guard = state => { state.previewGuard = true; };
chapter('Attente', 1.4);
chapter('Déplacement ordinaire', 1.6, (a,s,t) => { a.moving = true; a.axis = 1; a.x += t * 1.2; });
chapter('Retour vers la gauche', 1.6, (a,s,t) => { a.moving = true; a.axis = -1; a.facing = -1; a.x -= t * 1.2; });
chapter('Garde de combat', 1.4, (a,s) => guard(s));
chapter('Avancée en garde', 1.8, (a,s,t) => { guard(s); a.moving = true; a.axis = 1; a.x += t * 2; });
chapter('Recul en garde', 1.8, (a,s,t) => { guard(s); a.moving = true; a.axis = -1; a.x -= t * 2; });
chapter('Persuasion — proposition 3', 2.1, a => { a.persuasion_target_ids = ['pnj']; });
chapter('Écoute d’un interlocuteur', 1.4, a => { a.persuasion = { candidate_id: reference.id }; });
function attack(a,s,t,kind,step = 1) {
  guard(s);
  const windup = Math.ceil((step === 3 ? balance.finisher_windup_seconds : balance.light_windup_seconds) * hz);
  const active = Math.ceil(balance.active_seconds * hz) || 4;
  const recovery = Math.ceil((step === 3 ? balance.finisher_recovery_seconds : balance.light_recovery_seconds) * hz);
  const elapsed = Math.floor(t * hz), duration = windup + active + recovery;
  if (elapsed >= duration) return;
  const action = { id: 'apercu-coup', owner_id: a.id, kind, step, direction: 1, elapsed_ticks: elapsed, windup_ticks: windup, active_ticks: active, recovery_ticks: recovery };
  s.attacks = [action]; a.combat.attack_id = action.id;
}
for (const [step,label] of [[1,'Premier coup'],[2,'Deuxième coup'],[3,'Coup final du combo']]) chapter(label, 1, (a,s,t) => attack(a,s,t,'CANDIDATE',step));
chapter('Préparation du coup chargé', 1.4, (a,s) => { guard(s); a.combat.charge_active = true; a.combat.press_tick = 600; });
chapter('Coup chargé', 1.1, (a,s,t) => attack(a,s,t,'CHARGED'));
const jumpSeconds = balance.jump_duration_seconds;
function jump(a,s,t) {
  guard(s);
  if (t < jumpSeconds) { a.combat.jump_tick = 600; a.combat.height = Math.sin(Math.PI * t / jumpSeconds) * balance.jump_height_ratio; }
}
chapter('Saut et réception', jumpSeconds + .5, jump);
chapter('Coup en l’air et réception', jumpSeconds + .5, (a,s,t) => { jump(a,s,t); if (t > .2 && t < .6) attack(a,s,t-.2,'CANDIDATE'); });
chapter('Attaque plongeante et réception', jumpSeconds + .5, (a,s,t) => { jump(a,s,t); if (t > .3 && t < .8) attack(a,s,t-.3,'DIVE'); });
chapter('Esquive vers l’avant', 1, (a,s,t) => { guard(s); const duration = config.balance.dash.duration_seconds; if (t <= duration) Object.assign(a, { dash_active: true, dash_direction: 1, dash_until_tick: 600 + Math.ceil(duration * hz) }); });
chapter('Esquive vers l’arrière', 1, (a,s,t) => { guard(s); const duration = config.balance.dash.duration_seconds; if (t <= duration) Object.assign(a, { dash_active: true, dash_direction: -1, dash_until_tick: 600 + Math.ceil(duration * hz) }); });
for (const [mode,label] of [['light','Réaction à un coup léger'],['heavy','Réaction à un coup fort'],['back','Projection en arrière'],['stun','Étourdissement']]) {
  chapter(label, 1, (a,s,t) => {
    guard(s); if (t > .65) return;
    a.combat.stun_ticks = 10;
    a.combat.last_hit = { tick: mode === 'stun' ? 590 : 600, strong: mode !== 'light', knockback: mode === 'back', target_id: a.id };
    if (mode === 'back') a.combat.knockback_velocity = -1;
  });
}
const downSeconds = balance.knockdown_fall_seconds + balance.knockdown_ground_seconds + balance.knockdown_rise_seconds;
chapter('Chute puis relevé', downSeconds + .7, (a,s) => { guard(s); a.combat.knockdown_tick = 600; });
chapter('K.O. et maintien au sol', 1.8, a => { a.is_ko = true; a.ko_started_tick = 600; });

// L’ultime utilise les véritables transitions de simulation, jusqu’à l’attaque de réapparition.
chapters.push({ label: 'Ultime : disparition puis réapparition', start: frames.length / fps, note: 'Vue de Dupont-Aignan : silhouette translucide pendant l’invisibilité.' });
const sim = new GameSimulation(config,42); sim.state = base();
const owner = sim.state.candidates[0]; owner.special_charge = 100; owner.campaign_active = true;
owner.x = 100; sim.state.candidates[1].x = 120;
let triggered = false, revealed = false;
for (let i = 0; i < 5 * fps; i++) {
  const until = 600 + Math.floor(i / fps * hz);
  while (sim.state.tick < until) {
    sim.state.tick++; beginCombatTick(sim);
    if (!triggered && sim.state.tick >= 600 + Math.round(.4 * hz)) { activateUltimate(sim,owner); triggered = true; }
    if (!revealed && sim.state.tick >= 600 + Math.round(3 * hz)) { cancelCurrentAttack(sim,owner); requestAttack(sim,owner); revealed = true; }
    updateCombat(sim);
  }
  const state = structuredClone(sim.state); state.previewGuard = true;
  frames.push({ state, label: chapters.at(-1).label, note: chapters.at(-1).note });
}
chapter('Retour à l’attente', 1.4);

const browserHTML = '<!doctype html><html lang="fr"><meta charset="utf-8"><body style="margin:0"><canvas width="1000" height="620"></canvas></body></html>';
const root = process.cwd();
const server = createServer(async(req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (url.pathname === '/') { res.setHeader('Content-Type','text/html'); res.end(browserHTML); return; }
  const file = path.resolve(root,'.'+decodeURIComponent(url.pathname));
  const relative = path.relative(root,file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !['src','assets','donnees-jeu'].includes(relative.split(path.sep)[0])) { res.writeHead(404).end(); return; }
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : 'image/png'); res.end(await readFile(file)); } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], measurements = [];
try {
  const page = await browser.newPage({ viewport: { width:1000,height:620 } });
  page.on('pageerror',error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async config => {
    const { visualManifest } = await import('/src/presentation/rendu/visual-manifest.js');
    const { WorldRenderer } = await import('/src/presentation/rendu/renderer.js');
    const loaded = new Map(await Promise.all(Object.entries(visualManifest).filter(([id]) => id.startsWith('minor-dupont') || id.startsWith('character-minor-dupont') || id.startsWith('character-philippe') || id === 'character-style-philippe-gestionnaire').map(async ([id,entry]) => { const image=new Image(); image.src=entry.file; await image.decode(); return [id,image]; })));
    const canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
    const renderer={ctx,config,p:config.prototype.presentation,width:1000,height:620,metrics:{groundY:500,characterHeight:170,pixelsPerUnit:25,groundOffsetRatio:0},assets:{get:id=>loaded.get(id),load:async()=>{}},screenX:x=>340+(x-100)*25,drawVisiblePerson:WorldRenderer.prototype.drawVisiblePerson,
      combatPoseTracker:{active:(entity,state)=>entity.faction_id==='philippe'||!!state.previewGuard}};
    let bounds=[];
    const nativeDraw=ctx.drawImage.bind(ctx);
    ctx.drawImage=(image,...args)=>{
      const m=ctx.getTransform(), cropped=args.length===8;
      const dx=args[cropped?4:0],dy=args[cropped?5:1],w=args[cropped?6:2]??image.width,h=args[cropped?7:3]??image.height;
      bounds.push({x:m.a*dx+m.e,y:m.d*dy+m.f,width:Math.abs(m.a*w),height:Math.abs(m.d*h)});
      nativeDraw(image,...args);
    };
    window.renderBatch = frames => frames.map(({state,label,note,comparison=false})=>{
      ctx.reset(); ctx.fillStyle='#ede8df'; ctx.fillRect(0,0,1000,620);
      ctx.fillStyle='#d8cbb8'; ctx.fillRect(0,501,1000,119);
      ctx.strokeStyle='#9b8976'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(30,500); ctx.lineTo(970,500); ctx.stroke();
      const top=500-170*296/340*1.1236;
      ctx.save();ctx.setLineDash([5,6]);ctx.strokeStyle='#9da6a4';ctx.beginPath();ctx.moveTo(70,top);ctx.lineTo(940,top);ctx.stroke();ctx.restore();
      ctx.textAlign='center';ctx.fillStyle='#263b45';ctx.font='bold 25px system-ui';ctx.fillText(label,500,40);
      ctx.font='15px system-ui';ctx.fillText('Sprites redessinés · Cou et épaules raccordés · Ligne de sol commune',500,68);
      bounds=[];
      if(comparison) {
        const idle=structuredClone(state.candidates[0]);
        Object.assign(idle,{id:'nda-repos',persuasion_target_ids:[],persuasion:null,crisis_meeting_id:null});
        WorldRenderer.prototype.drawPerson.call(renderer,idle,170,state);
        bounds=[];
      }
      WorldRenderer.prototype.drawPerson.call(renderer,state.candidates[0],comparison?450:renderer.screenX(state.candidates[0].x),state);
      const actorBounds=bounds.slice(); bounds=[];
      const ref=structuredClone(state.candidates[1]); Object.assign(ref,{x:110,combat:{...ref.combat,attack_id:null,stun_ticks:0,height:0},moving:false,axis:0});
      WorldRenderer.prototype.drawPerson.call(renderer,ref,740,{...state,tick:0,attacks:[],powers:[],previewGuard:true});
      const refBounds=bounds.slice();
      ctx.fillStyle='#263b45';ctx.font='bold 19px system-ui';ctx.fillText(comparison?'Persuasion corrigée':'Nicolas Dupont-Aignan',comparison?450:340,548);ctx.fillText('Édouard Philippe',740,548);
      if(comparison)ctx.fillText('Dupont-Aignan au repos',170,548);
      ctx.font='15px system-ui';ctx.fillText('Animation en cours',comparison?450:340,574);ctx.fillText('Garde fixe — repère de taille',740,574);
      if(comparison)ctx.fillText('Repère de gabarit',170,574);
      ctx.font='14px system-ui';if(note)ctx.fillText(note,500,606);
      return {image:canvas.toDataURL('image/png').split(',')[1],actorBounds,refBounds};
    });
  },config);
  for (let i=0;i<frames.length;i+=15) {
    const batch=await page.evaluate(batch=>window.renderBatch(batch),frames.slice(i,i+15));
    await Promise.all(batch.map(async(frame,j)=>{
      assert.ok(frame.refBounds.length>0,'Philippe doit rester visible.');
      assert.ok(frame.actorBounds.length>0,'Dupont-Aignan doit rester visible dans sa vue locale.');
      for(const b of [...frame.actorBounds,...frame.refBounds]) assert.ok(b.y>=0 && b.y+b.height<=621,'Silhouette hors cadre.');
      measurements.push({frame:i+j,label:frames[i+j].label,actorBounds:frame.actorBounds,refBounds:frame.refBounds});
      await writeFile(path.join(output,'images',`image-${String(i+j).padStart(4,'0')}.png`),Buffer.from(frame.image,'base64'));
    }));
  }
  const persuasion=frames.filter(frame=>frame.label==='Persuasion — proposition 3');
  const comparison=await page.evaluate(batch=>window.renderBatch(batch),persuasion.map(frame=>({...frame,comparison:true,label:'Comparaison du gabarit — repos et persuasion'})));
  await mkdir(path.join(output,'comparaison-gabarit'),{recursive:true});
  await Promise.all(comparison.map((frame,i)=>writeFile(path.join(output,'comparaison-gabarit',`image-${String(i).padStart(4,'0')}.png`),Buffer.from(frame.image,'base64'))));
  assert.deepEqual(errors,[]);
} finally { await browser.close(); server.close(); }
function ffmpeg(args) {
  const result=spawnSync(process.env.CAMPAIGN_FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
}
const video=path.join(output,'dupont-aignan-animations-persuasion-gabarit-v3.mp4');
ffmpeg(['-framerate',String(fps),'-i',path.join(output,'images','image-%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-movflags','+faststart',video]);
ffmpeg(['-i',video,'-vf','fps=10,scale=700:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer','-loop','0',path.join(output,'dupont-aignan-animations-persuasion-gabarit-v3.gif')]);
ffmpeg(['-framerate',String(fps),'-i',path.join(output,'comparaison-gabarit','image-%04d.png'),'-filter_complex','fps=10,scale=1000:-1,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer','-loop','0',path.join(output,'comparaison-persuasion-gabarit-v3.gif')]);
const videoData=(await readFile(video)).toString('base64');
const chaptersJSON=JSON.stringify(chapters).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Animations de Dupont-Aignan — comparaison avec Philippe</title>
<style>body{margin:0;background:#172831;color:#f3efe6;font:16px system-ui}main{max-width:1100px;margin:auto;padding:24px}h1{font-size:25px}video{display:block;width:100%;background:#ede8df;border-radius:12px}nav{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}button,select{font:inherit;padding:10px;border:1px solid #86948f;border-radius:8px;background:#f2e9db;color:#172831}p{color:#d4dfdb}label{display:flex;align-items:center;gap:8px}#titre{font-size:18px;font-weight:600}</style>
<main><h1>Dupont-Aignan : toutes les animations à la suite</h1><p>Édouard Philippe reste en garde fixe sur la même ligne de sol. La ligne pointillée indique le haut de sa silhouette. Les tailles et les appuis proviennent du rendu du jeu.</p>
<video id="video" controls autoplay muted loop playsinline src="data:video/mp4;base64,${videoData}"></video>
<nav><button id="pause">Pause / Lecture</button><button id="avant">− 1 image</button><button id="apres">+ 1 image</button><label>Vitesse <select id="vitesse"><option value=".25">Ralenti × 0,25</option><option value=".5">Ralenti × 0,5</option><option value="1" selected>Normale</option></select></label><label>Animation <select id="chapitres"></select></label></nav>
<p id="titre"></p><p>Chaque personnage est dessiné entier, avec un raccord continu entre le cou, le col et les épaules. La persuasion conserve les gestes de la proposition 3. Le saut s’élève volontairement au-dessus du repère ; les poses accroupies et au sol restent plus basses. L’ultime montre la vue du joueur Dupont-Aignan.</p></main>
<script>const chapters=${chaptersJSON};const v=document.getElementById('video'),s=document.getElementById('chapitres');chapters.forEach((c,i)=>s.add(new Option(c.label,i)));s.onchange=()=>{v.currentTime=chapters[+s.value].start;v.play().catch(()=>{})};document.getElementById('pause').onclick=()=>v.paused?v.play().catch(()=>{}):v.pause();document.getElementById('avant').onclick=()=>{v.pause();v.currentTime=Math.max(0,v.currentTime-1/${fps})};document.getElementById('apres').onclick=()=>{v.pause();v.currentTime=Math.min(v.duration,v.currentTime+1/${fps})};document.getElementById('vitesse').onchange=e=>v.playbackRate=+e.target.value;v.ontimeupdate=()=>{let i=chapters.findLastIndex(c=>c.start<=v.currentTime+.01);s.value=i;document.getElementById('titre').textContent=chapters[i].label+' — '+v.currentTime.toFixed(1)+' s / '+v.duration.toFixed(1)+' s'};</script></html>`;
await writeFile(path.join(output,'apercu-persuasion-gabarit-v3.html'),html);
await writeFile(path.join(output,'verification.json'),JSON.stringify({fps,seconds:frames.length/fps,chapters,errors,measurements},null,2));
console.log(JSON.stringify({output,animations:chapters.length,seconds:frames.length/fps}));

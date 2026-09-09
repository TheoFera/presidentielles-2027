import { loadConfig } from '../src/config.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { WorldRenderer } from '../src/presentation/renderer.js';
import { factionVariant } from '../src/simulation/building-rules.js';
import { CampaignDisplay } from '../src/presentation/campaign.js';
import { CampaignEventDirector } from '../src/simulation/campaign-events.js';
import { characterAssetId, biomeArtId } from '../src/presentation/illustrated-characters.js';
const config = await loadConfig();
const simulation = new GameSimulation(config);
const baseline = simulation.getState();
const renderer = new WorldRenderer(document.querySelector('canvas'), config);
window.addEventListener('error', event => {
  const status = document.getElementById('status'); status.hidden = false;
  status.textContent = `Erreur de rendu : ${event.message} (${event.filename}:${event.lineno})`;
});
const controls = Object.fromEntries(['zone','position','season','candidate','sites','animation'].map(id => [id, document.getElementById(id)]));
for (const zone of baseline.world.subzones) controls.zone.add(new Option(`${zone.index + 1}. ${zone.biome_name} — ${zone.concept}`, zone.index));
const parameters = new URLSearchParams(location.search);
let campaignDisplay;
if (parameters.get('ui') === '1') {
  for (const href of ['../src/style.css','../src/presentation/illustrated-ui.css']) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.append(link);
  }
  const game = document.createElement('main'); game.id = 'game';
  document.body.append(game); game.append(document.querySelector('canvas'));
  game.insertAdjacentHTML('beforeend', '<nav id="game-menu"><button>Pause</button><button>Plein écran</button></nav><div id="funds"><output id="money">99,2 k €<br>+0,27 k €/s</output><output id="campaign-budget">Plafond restant : 16 800 k €</output></div><div id="electoral-display"><output id="day">J-231</output></div><div id="touch-controls" style="display:flex"><div class="touch-directions"><button>←</button><button>→</button></div><button>Frapper</button></div>');
  const css = document.createElement('style'); css.textContent = '#game canvas{width:100%;height:100%}'; document.head.append(css);
  campaignDisplay = new CampaignDisplay(config);
}
for (const [id, control] of Object.entries(controls)) if (parameters.has(id)) control.value = parameters.get(id);
const sceneLabel = document.createElement('label'); sceneLabel.textContent = 'Scène ';
const scene = document.createElement('select'); scene.id = 'scene'; scene.add(new Option('Campagne', 'world')); scene.add(new Option('Arène', 'arena'));
sceneLabel.append(scene); document.querySelector('header').append(sceneLabel);
scene.value = parameters.get('scene') || 'world';
scene.addEventListener('change', refresh);
let state, scrolling = parameters.get('scroll') === '1';
function refresh() {
  state = structuredClone(baseline);
  if (campaignDisplay) {
    const fixture = new GameSimulation(config);
    for (const family of ['MEETING_DE_CRISE','CRISE_FINANCEMENT','CANDIDAT_FRAGILISE']) CampaignEventDirector.start(fixture,{family});
    state.campaign_events = fixture.getState().campaign_events;
  }
  const zone = state.world.subzones[Number(controls.zone.value)];
  const candidate = state.candidates.find(c => c.faction_id === controls.candidate.value);
  state.local_candidate_id = candidate.id;
  candidate.x = controls.position.value === 'center' ? zone.center : controls.position.value === 'start' ? zone.start : zone.end;
  candidate.axis = 0; state.campaign_progress_01 = Number(controls.season.value);
  for (const building of state.buildings) {
    const owned = !['neutral','closed'].includes(controls.sites.value);
    if (building.ownership_model === 'neutral_service') continue;
    building.owner_id = owned ? candidate.faction_id : null;
    if (building.type === 'faction') building.variant = owned ? factionVariant(candidate.faction_id) : null;
    building.level = owned ? controls.sites.value === 'level3' ? 3 : 1 : 0;
    building.state = controls.sites.value === 'closed' ? 'CLOSED' : owned ? 'ACTIVE' : 'NEUTRAL';
    building.headquarters = controls.sites.value === 'level3' && building.type === 'permanence';
    building.closure_progress = controls.sites.value === 'closing' ? 0.65 : 0;
  }
  candidate.moving = controls.animation.value === 'walk'; candidate.is_ko = controls.animation.value === 'ko';
  if (parameters.get('roles') === '1') {
    state.npcs = state.npcs.slice(0,7).map((npc,i) => ({...npc,id:`aperçu-${i}`,x:candidate.x-9+i*3,role:i<2?'SERVICE_D_ORDRE':i<4?'CRS':'CANDIDAT',faction_id:candidate.faction_id,presentation_name:i>=4?'Journaliste':undefined}));
  }
  if (parameters.get('people') === 'new') {
    const indices=zone.biome_index===2?[3,4]:[3];
    state.npcs=indices.map((variant,i)=>{
      const npc={...baseline.npcs[0],origin_subzone_id:zone.id,x:candidate.x+3+i*3,role:'NEUTRE'};
      for(let n=0;n<100;n++) {npc.id=`nouveau-${n}`;if(characterAssetId(npc,state)===`npc-${biomeArtId(zone.biome_id)}-${variant}`)break;}
      return npc;
    });
  }
  candidate.persuasion_target_ids = controls.animation.value === 'persuade' ? ['aperçu'] : [];
  if (controls.animation.value === 'hurt') { candidate.combat.stun_ticks = 10; candidate.combat.knockback_velocity = -2; }
  if (controls.animation.value === 'attack') state.attacks.push({ owner_id: candidate.id, direction: 1, elapsed_ticks: 5, windup_ticks: 3, active_ticks: 5, strong: true, kind: 'CANDIDATE' });
  if (parameters.get('special') === '1') {
    candidate.special_active = true;
    state.projectiles.push({x:candidate.x+3,direction:1,kind:candidate.faction_id==='le_pen'?'WAVE':'VERBAL',faction_id:candidate.faction_id});
  }
  renderer.resetCamera(); renderer.artZone = null;
  if (scene.value === 'arena') {
    const arenaSimulation = new GameSimulation(config);
    arenaSimulation.applyCommand({type:'DebugForceJ0'});
    state = arenaSimulation.getState();
    void renderer.assets.keep(Object.keys(renderer.assets.manifest).filter(id => /^(character-|journalist-|security-|crs-|background-arena)/.test(id)));
  }
}
for (const control of Object.values(controls)) control.addEventListener('change', refresh);
document.getElementById('scroll').onclick = event => { scrolling = !scrolling; event.target.textContent = scrolling ? 'Arrêter le parcours' : 'Parcourir la boucle'; };
document.getElementById('clean').onclick = () => { document.querySelector('header').hidden = true; document.getElementById('status').hidden = true; };
refresh();
if (parameters.get('clean') === '1') { document.querySelector('header').hidden = true; document.getElementById('status').hidden = true; }
let last = performance.now(), readyFrames = 0, frameSamples = [];
function draw(now) {
  if(readyFrames>=12) {frameSamples.push(now-last);if(frameSamples.length>180)frameSamples.shift();}
  const elapsed = Math.min(0.1, (now - last) / 1000); last = now;
  state.tick = Math.floor(now / 1000 * config.balance.simulation_architecture.fixed_tick_hz);
  if (scrolling) { const c = state.candidates.find(c => c.id === state.local_candidate_id); c.x = (c.x + elapsed * Number(parameters.get('speed') || 4) + state.world.length) % state.world.length; c.moving = true; }
  renderer.draw(state, state, 1, elapsed);
  campaignDisplay?.update(state);
  const assets = renderer.assets.status();
  readyFrames=assets.pending===0&&assets.loaded>0?readyFrames+1:0;
  const fps=frameSamples.length?Math.round(1000/(frameSamples.reduce((a,b)=>a+b,0)/frameSamples.length)):0;
  document.getElementById('status').textContent = `${readyFrames>=12?'Prêt · ':''}${assets.loaded} images chargées · ${assets.pending} chargements · ${assets.failed.length} erreurs · ${fps} images/s — Aperçu isolé : aucune sauvegarde de partie modifiée.`;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

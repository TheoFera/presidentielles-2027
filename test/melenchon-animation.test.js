import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { combatState } from '../src/simulation/combat-state.js';
import { CombatPoseTracker, melenchonPose, usesMelenchonCombat, drawMelenchonCombat, MELENCHON_SPRITE, MELENCHON_FRAMES } from '../src/presentation/melenchon-combat.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { combatAtlases, usesCandidateCombat } from '../src/presentation/melenchon-combat.js';

function setup() {
  const config = campaignConfig(), sim = new GameSimulation(config, 42), state = sim.state;
  state.npcs = []; state.candidates.forEach((c,i) => { c.x = 100 + i*100; c.axis = 0; });
  const c = state.candidates[0], enemy = state.candidates[1]; c.facing = 1;
  return { config, state, c, enemy };
}
function attack(state, c, step = 1, kind = 'CANDIDATE') {
  const a = { id: 'attack:1', owner_id: c.id, direction: -1, step, kind, elapsed_ticks: 0, windup_ticks: 3, active_ticks: 3, recovery_ticks: 6 };
  state.attacks = [a]; c.combat.attack_id = a.id; return a;
}

test('Les poses distinctes utilisent leur atlas transparent', async () => {
  assert.equal(MELENCHON_SPRITE, 'character-melenchon-combat-v4');
  const bytes = await readFile(new URL(visualManifest[MELENCHON_SPRITE].file));
  assert.equal(bytes[25],6);
  for (const [x,y,w,h] of MELENCHON_FRAMES) { assert.ok(x>=0 && y>=0 && x+w<=bytes.readUInt32BE(16) && y+h<=bytes.readUInt32BE(20)); }
});

test('Proximité : entrée en garde, marge de sortie et maintien deux secondes sans modifier le jeu', () => {
  const {config,state,c,enemy} = setup(), tracker = new CombatPoseTracker();
  assert.equal(tracker.active(c,state,config),false);
  enemy.x = c.x+4; const before = JSON.stringify(state);
  assert.equal(tracker.active(c,state,config),true); assert.equal(JSON.stringify(state),before);
  state.tick = 30; enemy.x = c.x+6; assert.equal(tracker.active(c,state,config),true);
  enemy.x = c.x+8; state.tick = 90; assert.equal(tracker.active(c,state,config),true);
  state.tick = 91; assert.equal(tracker.active(c,state,config),false);
  enemy.x = c.x+4; tracker.active(c,state,config); tracker.clear(); enemy.x = c.x+8;
  assert.equal(tracker.active(c,state,config),false);
});

test('Pas de garde pour les alliés, les sympathisants inoffensifs ou un candidat KO ; jonction circulaire gérée', () => {
  const {config,state,c,enemy} = setup(), tracker = new CombatPoseTracker();
  enemy.x = c.x+1; enemy.is_ko = true; assert.equal(tracker.active(c,state,config),false);
  state.npcs.push({id:'npc:1',x:c.x+1,role:'SYMPATHISANT',faction_id:enemy.faction_id,combat:combatState()});
  assert.equal(tracker.active(c,state,config),false);
  state.npcs[0].role = 'MILITANT'; state.npcs[0].faction_id = c.faction_id;
  assert.equal(tracker.active(c,state,config),false);
  enemy.is_ko = false; c.x = state.world.length-1; enemy.x = 1;
  assert.equal(tracker.active(c,state,config),true);
});

test('Deux poings distincts et coup de pied final synchronisés sur préparation, activité et récupération', () => {
  const {config,state,c} = setup();
  for (const [step,prepare,impact] of [[1,2,3],[2,4,5],[3,6,7]]) {
    const a = attack(state,c,step);
    assert.equal(melenchonPose(c,state,config).frame,prepare);
    a.elapsed_ticks = 3; assert.equal(melenchonPose(c,state,config).frame,impact);
    assert.equal(melenchonPose(c,state,config).direction,-1);
    a.elapsed_ticks = 11; assert.equal(melenchonPose(c,state,config).frame,0);
  }
});

test('Charge configurable, coup puissant distinct, saut normal et coup de pied aérien', () => {
  const {config,state,c} = setup();
  c.combat.charge_active = true; c.combat.press_tick = 0;
  assert.equal(melenchonPose(c,state,config).name,'charge_focus');
  state.tick = Math.ceil(config.balance.candidate_combat.charge_ready_seconds*30);
  assert.equal(melenchonPose(c,state,config).name,'charge_ready');
  c.combat.charge_active = false; const a = attack(state,c,0,'CHARGED'); a.elapsed_ticks = 3;
  assert.equal(melenchonPose(c,state,config).frame,10);
  state.attacks = []; c.combat.attack_id = null; c.combat.jump_tick = state.tick;
  assert.equal(melenchonPose(c,state,config).frame,12);
  state.tick += 5; assert.equal(melenchonPose(c,state,config).frame,13);
  state.tick += 10; assert.equal(melenchonPose(c,state,config).frame,14);
  attack(state,c).elapsed_ticks = 3;
  assert.equal(melenchonPose(c,state,config).frame,15);
});

test('Interruption immédiate : stun, KO, dash et ultime remplacent la pose ; autres skins inchangés', () => {
  const {config,state,c} = setup(); attack(state,c);
  c.combat.stun_ticks = 1; assert.equal(melenchonPose(c,state,config),null); c.combat.stun_ticks = 0;
  c.is_ko = true; assert.equal(melenchonPose(c,state,config),null); c.is_ko = false;
  c.dash_active = true; assert.equal(melenchonPose(c,state,config),null); c.dash_active = false;
  state.attacks[0].kind = 'SPECIAL'; assert.equal(melenchonPose(c,state,config),null);
  for (const skin of [null,'melenchon_universaliste']) { c.current_campaign_style = skin; assert.equal(usesMelenchonCombat(c,state),true); }
  for (const skin of ['melenchon_populiste','melenchon_communautariste']) { c.current_campaign_style = skin; assert.equal(usesMelenchonCombat(c,state),false); }
});

test('Rendu : repère au sol, hauteur de saut, miroir et découpe de l’atlas sans altérer la simulation', () => {
  const {config,state,c} = setup(); attack(state,c).elapsed_ticks = 3;
  c.combat.jump_tick = 0; c.combat.height = 1;
  const calls = [];
  const ctx = new Proxy({}, {get:(_,name) => (...args) => calls.push([name,...args])});
  const atlas = {}, renderer = {ctx,config,metrics:{characterHeight:100,groundY:400},assets:{get:()=>atlas}};
  const before = JSON.stringify(state);
  assert.equal(drawMelenchonCombat(renderer,c,200,state),true);
  assert.ok(calls.some(c => c[0]==='translate' && c[1]===200 && c[2]===306));
  assert.ok(calls.some(c => c[0]==='scale' && c[1]===-1));
  const draws = calls.filter(c => c[0]==='drawImage'); assert.equal(draws.length,1); assert.ok(draws.every(c => c[1]===atlas));
  assert.equal(JSON.stringify(state),before);
  renderer.assets = {get:()=>null,load:()=>null};
  assert.equal(drawMelenchonCombat(renderer,c,200,state),false);
});

for (const faction of ['le_pen','philippe']) test(faction+' : atlas, poses, costumes et transformations', async () => {
  const {config,state,c} = setup(); c.faction_id=faction;
  const definition=combatAtlases[faction];
  const bytes=await readFile(new URL(visualManifest[definition.sprite].file));
  assert.equal(bytes[25],6); assert.equal(definition.frames.length,16);
  for (const [x,y,w,h,px,py] of definition.frames) {
    assert.ok(x>=0 && y>=0 && x+w<=bytes.readUInt32BE(16) && y+h<=bytes.readUInt32BE(20));
    assert.ok(px>=x && px<=x+w && py>=y && py<=y+h);
  }
  assert.equal(usesCandidateCombat(c,state),true);
  c.current_campaign_style=definition.style; assert.equal(usesCandidateCombat(c,state),true);
  const requested=[],calls=[],image={};
  const renderer={config,metrics:{characterHeight:100,groundY:400},ctx:new Proxy({},{get:(_,name)=>(...args)=>calls.push([name,...args])}),assets:{get:id=>{requested.push(id);return image;}}};
  for (const step of [1,2,3]) {
    attack(state,c,step).elapsed_ticks=3;
    assert.equal(drawMelenchonCombat(renderer,c,200,state),true);
    assert.equal(melenchonPose(c,state,config).frame,step===1?3:step===2?5:7);
  }
  assert.ok(requested.every(id=>id===definition.sprite));
  assert.ok(calls.filter(c=>c[0]==='drawImage').every(c=>c[1]===image));
  c.current_campaign_style=faction==='le_pen'?'le_pen_zemmouriste':'philippe_notable';
  assert.equal(usesCandidateCombat(c,state),false);
  c.current_campaign_style=null;c.bardella_form=true;assert.equal(usesCandidateCombat(c,state),false);
  c.bardella_form=false;c.ultimate_effect={kind:'EUROPE',expires_tick:100};assert.equal(usesCandidateCombat(c,state),false);
});

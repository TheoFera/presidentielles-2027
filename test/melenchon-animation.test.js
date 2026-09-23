import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { combatState } from '../src/simulation/combat-state.js';
import { CombatPoseTracker, melenchonPose, usesMelenchonCombat, drawMelenchonCombat, MELENCHON_SPRITE, MELENCHON_FRAMES } from '../src/presentation/melenchon-combat.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { combatAtlases, combatAtlasFor, usesCandidateCombat } from '../src/presentation/melenchon-combat.js';
import { skinAnimationAtlases, skinAnimationFor } from '../src/presentation/skin-animation-atlases.js';
import {additionalExtraAtlases} from '../src/presentation/candidate-extra-atlases.js';
import {candidateExtraPose} from '../src/presentation/candidate-extra-poses.js';

test('Les nouvelles planches de Marine et Philippe contiennent 16 poses RGBA cadrées', async () => {
  for (const faction of ['le_pen','philippe']) {
    for (const sheet of ['movement','actions']) {
      const atlas=additionalExtraAtlases[faction][sheet];
      assert.equal(atlas.frames.length,16);
      const bytes=await readFile(new URL(visualManifest[atlas.sprite].file));
      assert.equal(bytes[25],6);
      for(const [x,y,w,h,px,py] of atlas.frames) {
        assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=bytes.readUInt32BE(16)&&y+h<=bytes.readUInt32BE(20));
        assert.ok(px>=x&&px<=x+w&&py>=y&&py<=y+h);
      }
    }
  }
});

test('Les autres candidats ont leurs propres poses avec les priorités communes', () => {
  for(const faction of ['le_pen','philippe']) {
    const {config,state,c}=setup();c.faction_id=faction;
    const pose=(landing=null,frame=0)=>candidateExtraPose(c,state,config,true,landing,frame);
    c.moving=true;c.axis=1;
    for(let frame=0;frame<8;frame++) assert.deepEqual([pose(null,frame).sheet,pose(null,frame).frame],['movement',frame]);
    c.moving=false;c.axis=0;c.persuasion_target_ids=['npc'];
    assert.deepEqual([pose().sheet,pose().frame,pose().name],['actions',4,'persuade']);
    c.purchase_hold={};assert.equal(pose().frame,6);
    c.purchase_hold=null;c.persuasion_target_ids=[];
    assert.deepEqual([pose(0).sheet,pose(0).frame],['actions',2]);
    c.combat.stun_ticks=5;c.combat.last_hit={tick:state.tick,target_id:c.id,strong:false};
    assert.deepEqual([pose().sheet,pose().frame],['movement',11]);
    state.tick+=4;assert.equal(pose().frame,12);
    c.combat.last_hit.strong=true;c.combat.knockback_velocity=2;assert.equal(pose().frame,15);
    c.combat.knockback_velocity=0;c.combat.stun_ticks=0;c.combat.last_hit=null;
    const a=attack(state,c);a.kind='SPECIAL';assert.deepEqual([pose().sheet,pose().frame],['actions',14]);
    a.elapsed_ticks=a.windup_ticks;assert.equal(pose().frame,15);
    c.is_ko=true;c.ko_started_tick=state.tick;assert.equal(pose().frame,10);
    state.tick+=30;assert.equal(pose().frame,13);
  }
});

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

test('Les six tenues supplémentaires couvrent combat, mouvements et interactions sans changer de costume', async () => {
  assert.equal(Object.keys(skinAnimationAtlases).length,6);
  for(const [style,skin] of Object.entries(skinAnimationAtlases)) {
    const {config,state,c}=setup();c.faction_id=skin.faction;c.current_campaign_style=style;
    assert.equal(skinAnimationFor(c),skin);assert.equal(usesCandidateCombat(c,state),true);
    for(const definition of [skin.combat,...Object.values(skin.extras)]) {
      assert.equal(definition.frames.length,16);
      const bytes=await readFile(new URL(visualManifest[definition.sprite].file));
      assert.equal(bytes[25],6);
      for(const [x,y,w,h,px,py] of definition.frames){
        assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=bytes.readUInt32BE(16)&&y+h<=bytes.readUInt32BE(20),definition.sprite);
        assert.ok(px>=x&&px<=x+w&&py>=y&&py<=y+h);
      }
    }
    const requested=[],renderer={config,metrics:{characterHeight:100,groundY:400},ctx:new Proxy({},{get:()=>()=>{}}),assets:{get:id=>{requested.push(id);return {};}}};
    attack(state,c).elapsed_ticks=3;
    drawMelenchonCombat(renderer,c,200,state);assert.equal(requested.at(-1),skin.combat.sprite);
    assert.equal(combatAtlasFor(c),skin.combat);
    state.attacks=[];c.combat.attack_id=null;c.moving=true;c.axis=1;state.candidates.find(a=>a.id!==c.id).x=c.x+1;
    const pose=candidateExtraPose(c,state,config,true,null,7);assert.equal(pose.sheet,'movement');assert.equal(pose.frame,7);
    c.moving=false;c.axis=0;c.purchase_hold={};drawMelenchonCombat(renderer,c,200,state);assert.equal(requested.at(-1),skin.extras.actions.sprite);
    c.current_campaign_style='skin_inconnu';assert.equal(usesCandidateCombat(c,state),false);
    c.current_campaign_style=style;c.faction_id=skin.faction==='philippe'?'melenchon':'philippe';assert.equal(skinAnimationFor(c),null);
  }
});

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

test('Interruption immédiate : stun, KO, dash et ultime remplacent la pose pour tous les skins', () => {
  const {config,state,c} = setup(); attack(state,c);
  c.combat.stun_ticks = 1; assert.equal(melenchonPose(c,state,config),null); c.combat.stun_ticks = 0;
  c.is_ko = true; assert.equal(melenchonPose(c,state,config),null); c.is_ko = false;
  c.dash_active = true; assert.equal(melenchonPose(c,state,config),null); c.dash_active = false;
  state.attacks[0].kind = 'SPECIAL'; assert.equal(melenchonPose(c,state,config),null);
  for (const skin of [null,'melenchon_universaliste']) { c.current_campaign_style = skin; assert.equal(usesMelenchonCombat(c,state),true); }
  for (const skin of ['melenchon_populiste','melenchon_communautariste']) { c.current_campaign_style = skin; assert.equal(usesMelenchonCombat(c,state),true); }
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
  assert.equal(usesCandidateCombat(c,state),true);
  c.current_campaign_style=null;c.bardella_form=true;assert.equal(usesCandidateCombat(c,state),false);
  c.bardella_form=false;c.ultimate_effect={kind:'EUROPE',expires_tick:100};assert.equal(usesCandidateCombat(c,state),false);
});


// Additional Mélenchon actions use simulation states, without changing their timing.
test('Animations supplémentaires : découpes transparentes valides', async () => {
  const {melenchonExtraAtlases}=await import('../src/presentation/melenchon-extra-atlases.js');
  for(const atlas of Object.values(melenchonExtraAtlases)) {
    const bytes=await readFile(new URL(visualManifest[atlas.sprite].file));assert.equal(bytes[25],6);
    assert.equal(atlas.frames.length,atlas.referenceHeight?8:16);
    for(const [x,y,w,h,px,py] of atlas.frames) {
      assert.ok(x>=0&&y>=0&&x+w<=bytes.readUInt32BE(16)&&y+h<=bytes.readUInt32BE(20));
      assert.ok(px>=x&&px<=x+w&&py>=y&&py<=y+h);
    }
  }
});
test('Mélenchon : déplacements, vrais impacts reçus, KO, interactions et priorités', async () => {
  const {melenchonExtraPose:pose}=await import('../src/presentation/melenchon-extra-poses.js');
  const {config,state,c}=setup();state.tick=10;
  const select=(guard=false,landing=null)=>pose(c,state,config,guard,landing);
  assert.equal(select(),null);
  c.moving=true;assert.equal(select(),null);assert.equal(select(true).name,'combat_walk');
  c.persuasion_target_ids=['npc'];assert.equal(select(),null);c.persuasion_target_ids=[];c.moving=false;
  c.purchase_hold={kind:'CAPTURE'};assert.equal(select().name,'interaction_hold');c.purchase_hold=null;
  c.persuasion_target_ids=['npc'];assert.equal(select().name,'persuade');c.persuasion_target_ids=[];
  c.combat.stun_ticks=6;c.combat.last_hit={target_id:c.id,tick:10,strong:false};assert.equal(select().name,'hit_light');
  c.combat.last_hit.strong=true;assert.equal(select().name,'hit_heavy');
  state.tick=14;c.combat.knockback_velocity=4;assert.equal(select().name,'knockback');
  c.combat.knockback_velocity=0;state.tick=20;assert.equal(select().name,'stun');
  c.combat.stun_ticks=0;c.dash_active=true;c.dash_until_tick=28;c.dash_direction=-1;assert.equal(select().name,'dash');assert.equal(select().direction,-1);c.dash_active=false;
  c.is_ko=true;c.ko_started_tick=20;assert.equal(select().name,'ko_fall');state.tick=80;assert.equal(select().name,'ko_ground');c.is_ko=false;
  assert.equal(select(false,0).name,'landing');assert.equal(select(false,9).name,'landing');assert.equal(select(false,10),null);
  c.moving=true;assert.equal(select(true,4).name,'landing');assert.equal(select(true,6).name,'combat_walk');c.moving=false;
  attack(state,c);assert.equal(select(false,0),null);
  state.attacks[0].kind='SPECIAL';assert.equal(select().name,'ultimate');
});
test('Atterrissage : durée visuelle, remise à zéro et absence de mutation des sauvegardes', async () => {
  const {MelenchonMotionTracker}=await import('../src/presentation/melenchon-extra-poses.js');
  const {config,state,c}=setup(),tracker=new MelenchonMotionTracker();
  c.combat.jump_tick=0;state.tick=1;assert.equal(tracker.landing(c,state,config),null);
  c.combat.jump_tick=null;state.tick=Math.ceil(config.balance.candidate_combat.jump_duration_seconds*30);
  const before=JSON.stringify(state);assert.equal(tracker.landing(c,state,config),0);assert.equal(JSON.stringify(state),before);
  state.tick++;assert.equal(tracker.landing(c,state,config),1);
  tracker.clear();assert.equal(tracker.landing(c,state,config),null);
  state.tick=0;assert.equal(tracker.landing(c,state,config),null);
});

test('Cycle de garde : distance réelle, arrêts, demi-tour, téléportation et aucun état sauvegardé modifié',async()=>{
  const {MelenchonMotionTracker}=await import('../src/presentation/melenchon-extra-poses.js');
  const {config,state,c}=setup(),tracker=new MelenchonMotionTracker();c.axis=1;
  const select=active=>{const before=JSON.stringify(state);const f=tracker.walk(c,state,config,active);assert.equal(JSON.stringify(state),before);return f;};
  state.tick=47;assert.equal(select(true),0);
  for(let i=0;i<5;i++){state.tick++;c.x+=.1;select(true);}
  assert.equal(select(true),2);state.tick+=10;assert.equal(select(true),2,'Le temps seul ne doit pas faire marcher les jambes.');
  assert.equal(select(false),0);assert.equal(select(true),0);
  c.x+=.1;state.tick++;select(true);c.facing=-1;assert.equal(select(true),0);
  c.x+=40;state.tick++;assert.equal(select(true),0);
  tracker.clear();assert.equal(select(true),0);
  state.tick=0;assert.equal(select(true),0);
});

test('Marche en garde : appuis fournis par la distance ; réaction légère sans blocage', async()=>{
  const {melenchonExtraPose:pose}=await import('../src/presentation/melenchon-extra-poses.js');
  const {config,state,c}=setup();c.moving=true;
  const frames=[];for(let f=0;f<8;f++){state.tick=f;const p=pose(c,state,config,true,null,f);frames.push(p.frame);assert.equal(p.sheet,'guardStep');}
  assert.deepEqual(frames,Array.from({length:8},(_,i)=>i));
  c.moving=false;c.combat.stun_ticks=5;c.combat.last_hit={target_id:c.id,tick:0,strong:false};
  state.tick=0;assert.equal(pose(c,state,config,true).frame,6);
  state.tick=4;assert.equal(pose(c,state,config,true).frame,7);
  c.combat.stun_ticks=0;state.tick=6;assert.equal(pose(c,state,config,true).frame,7);
  c.moving=true;assert.equal(pose(c,state,config,true).name,'combat_walk');c.moving=false;
  attack(state,c);assert.equal(pose(c,state,config,true),null);state.attacks=[];c.combat.attack_id=null;
  state.tick=8;assert.equal(pose(c,state,config,true),null);
  c.combat.knockback_velocity=4;assert.equal(pose(c,state,config,true).name,'knockback');
  c.combat.knockback_velocity=.4;assert.equal(pose(c,state,config,true),null);
});

test('Tailles Mélenchon : persuasion initiale, ultime agrandi, ancrage au sol conservé',async()=>{
  const {melenchonExtraAtlases:atlases}=await import('../src/presentation/melenchon-extra-atlases.js');
  for(const action of ['finisher','ultimate','persuade','interaction','ko']){
    const {config,state,c}=setup();state.tick=0;
    if(action==='finisher')attack(state,c,3).elapsed_ticks=3;
    if(action==='ultimate')attack(state,c,0,'SPECIAL');
    if(action==='persuade')c.persuasion_target_ids=['npc'];
    if(action==='interaction')c.purchase_hold={kind:'CAPTURE'};
    if(action==='ko'){c.is_ko=true;c.ko_started_tick=0;}
    const definition=action==='finisher'?{frames:MELENCHON_FRAMES,referenceHeight:340}:atlases[action==='interaction'?'shuffle':'actions'];
    const frame={finisher:7,ultimate:14,persuade:6,interaction:4,ko:10}[action];
    const calls=[],ctx=new Proxy({},{get:(_,k)=>(...args)=>calls.push([k,...args])});
    drawMelenchonCombat({config,ctx,metrics:{characterHeight:100,groundY:400},assets:{get:()=>({})}},c,200,state);
    const d=calls.find(a=>a[0]==='drawImage'),[,,w,h]=definition.frames[frame],scale=100/(definition.referenceHeight||360);
    const extraScale=action==='persuade'?1:action==='ultimate'?1.06*1.06:1.06;
    assert.ok(Math.abs(d[8]-w*scale*1.06*extraScale)<1e-8,action+' largeur');
    assert.ok(Math.abs(d[9]-h*scale*1.1236*extraScale)<1e-8,action+' hauteur');
    assert.ok(calls.some(a=>a[0]==='translate'&&a[2]===406));
  }
});

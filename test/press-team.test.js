import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { spawnPressTeam, updatePressTeam } from '../src/simulation/press-team.js';
import { filmed, pressMoveFactor, pressAttackFactor, pressMember, leavePressTeam } from '../src/simulation/press-rules.js';
import { beginCombatTick, updateCombat, attackInput, requestAttack, startNpcAttack } from '../src/simulation/combat.js';
import { hit, canBeHit } from '../src/simulation/combat-state.js';
import { requestDash } from '../src/simulation/mobile-combat.js';
import { CampaignStyleSystem, CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';
import { ringDelta } from '../src/simulation/world.js';
import { CampaignPrediction } from '../src/network/campaign-prediction.js';
import { pressPose, pressWalking } from '../src/presentation/personnages/press-sprites.js';

function setup(population = false) {
  const config = campaignConfig(); config.balance.minor_candidates.enabled = false;
  const sim = new GameSimulation(config, 42); sim.state.ai_enabled = false;
  if (!population) sim.state.npcs = [];
  sim.state.candidates.forEach((c,i) => { c.x=103+i*50; c.axis=0; });
  const c = sim.state.candidates[0];
  CampaignStyleSystem.select(sim,c,CAMPAIGN_STYLES[c.faction_id][0].id,true);
  sim.state.actualGameState.national_support = { melenchon:34, le_pen:26, philippe:23 };
  spawnPressTeam(sim,c);
  const camera = pressMember(sim.state,'PRESS_CAMERA'), reporter = pressMember(sim.state,'PRESS_REPORTER');
  sim.state.tick = camera.ready_tick;
  camera.x=100; reporter.x=101.5; reporter.combat.cooldown_ticks=10000;
  updatePressTeam(sim);
  return {sim,c,camera,reporter};
}
function ticks(sim,n) { for(let i=0;i<n;i++){sim.state.tick++;beginCombatTick(sim);updatePressTeam(sim);updateCombat(sim);} }
function aim(f) { ticks(f.sim,20); assert.equal(filmed(f.sim.state,f.sim.config,f.c),true); }

test('Filmage : marche et saut à 50 %, coups à 75 %, sans masquer par invisibilité ou PNJ',()=>{
  const f=setup(); aim(f);
  assert.equal(pressMoveFactor(f.sim.state,f.sim.config,f.c),.5);
  assert.equal(pressAttackFactor(f.sim.state,f.sim.config,f.c),.75);
  f.c.ultimate_effect={kind:'INVISIBLE',expires_tick:10000}; f.c.disappeared=true;
  assert.equal(filmed(f.sim.state,f.sim.config,f.c),true);
  f.c.ultimate_effect={kind:'EUROPE',expires_tick:10000};
  assert.equal(filmed(f.sim.state,f.sim.config,f.c),true,'aucune immunité Europe pour un autre candidat');
  f.c.faction_id='philippe';
  assert.equal(filmed(f.sim.state,f.sim.config,f.c),false);
});

test('Le seul obstacle de filmage est le mur debout ; la caméra ne se coupe pas derrière le mur',()=>{
  const f=setup();aim(f);const s=f.sim.state;
  s.powers.push({kind:'BARRIER',x:102,base_height:0,fall_tick:s.tick+100});
  assert.equal(filmed(s,f.sim.config,f.c),false);assert.equal(f.camera.filming,true);
  s.powers[0].fall_tick=s.tick;
  assert.equal(filmed(s,f.sim.config,f.c),true);
  s.powers[0]={kind:'CRS',x:102,fall_tick:s.tick+100};
  assert.equal(filmed(s,f.sim.config,f.c),true);
});

test('Un saut sort du cône sans arrêter la caméra et conserve une parabole continue',()=>{
  const f=setup();aim(f);attackInput(f.sim,f.c,'Jump');
  ticks(f.sim,5);
  const expected=f.sim.config.balance.candidate_combat.jump_height_ratio*4*(2.5/29)*(1-2.5/29);
  assert.ok(Math.abs(f.c.combat.height-expected)<.03);
  let escaped=false;
  for(let i=0;i<65;i++){
    ticks(f.sim,1);
    if(f.c.combat.height>1.2&&!filmed(f.sim.state,f.sim.config,f.c)){escaped=true;assert.equal(f.camera.filming,true);}
  }
  assert.equal(escaped,true);assert.equal(f.c.combat.height,0);
});

test('Un coup engagé ralentit de 25 % ; les durées de sauvegarde restent entières',()=>{
  const f=setup();aim(f); f.c.facing=-1;requestAttack(f.sim,f.c);
  ticks(f.sim,1);const a=f.sim.state.attacks.find(a=>a.owner_id===f.c.id);assert.ok(a);
  ticks(f.sim,3);assert.equal(a.elapsed_ticks,3);
  assert.ok(Number.isInteger(a.elapsed_ticks));
});

test('Dash : traverse le groupe, coupe le champ puis la journaliste revient devant sans téléportation',()=>{
  const f=setup();aim(f); f.c.x=102.2;f.c.facing=-1;requestDash(f.sim,f.c,-1);
  let crossed=false,largestStep=0;
  for(let i=0;i<70;i++){
    const previous=f.reporter.x;ticks(f.sim,1);
    largestStep=Math.max(largestStep,Math.abs(ringDelta(previous,f.reporter.x,f.sim.state.world.length)));
    if(f.c.x<f.camera.x){crossed=true;assert.equal(filmed(f.sim.state,f.sim.config,f.c),false);}
    if(crossed && f.sim.state.press_team.direction===-1 && f.reporter.x<f.camera.x)break;
  }
  assert.equal(crossed,true);assert.equal(f.sim.state.press_team.direction,-1);
  assert.ok(f.reporter.x<f.camera.x);assert.ok(largestStep<=4.8/f.sim.hz+1e-8);
  assert.ok(Math.abs(f.c.x-99.2)<.2,'le dash garde environ trois unités de portée');
  ticks(f.sim,50);
  assert.equal(filmed(f.sim.state,f.sim.config,f.c),true,'le cadreur doit pouvoir reprendre le filmage après la réorganisation');
});

test('Micro : 6 dégâts, petite interruption, aucun recul et pas de seconde touche pendant la même frappe',()=>{
  const f=setup();f.reporter.combat.cooldown_ticks=0;
  f.c.x=f.reporter.x+1.2;
  for(let i=0;i<20&&f.c.hits_received===0;i++)ticks(f.sim,1);
  assert.equal(f.c.resistance,94);assert.ok(f.c.combat.stun_ticks>0);assert.ok(f.c.combat.stun_ticks<=6);
  assert.equal(f.c.combat.knockback_velocity,0);ticks(f.sim,6);assert.equal(f.c.resistance,94);
});

for(const role of ['PRESS_CAMERA','PRESS_REPORTER'])test(`Défaite de ${role} : les deux cessent le combat et sortent par le bas`,()=>{
  const f=setup();aim(f);const target=role==='PRESS_CAMERA'?f.camera:f.reporter;
  f.c.x=target.x+.5;f.c.facing=-1;
  hit(f.sim,f.c,target,{kind:'CANDIDATE',damage:100,knockback:0,stun_seconds:.2,direction:-1},'test');
  assert.equal(f.sim.state.press_team.phase,'LEAVING');assert.equal(f.camera.expired,false);
  assert.equal(canBeHit(f.reporter),false);assert.equal(canBeHit(f.camera),false);
  assert.equal(filmed(f.sim.state,f.sim.config,f.c),false);
  ticks(f.sim,50);assert.equal(f.sim.state.press_team,null);assert.equal(f.sim.state.temporary_units.length,0);
  assert.equal(f.sim.state.press_director.next_tick,f.sim.state.tick-2+75*f.sim.hz);
});

test('Un coup non mortel sur la caméra interrompt le tournage puis impose un nouveau cadrage',()=>{
  const f=setup();aim(f); f.c.x=100.7;
  hit(f.sim,f.c,f.camera,{kind:'CANDIDATE',damage:8,knockback:0,stun_seconds:.2,direction:-1},'test');
  assert.equal(f.camera.filming,false);assert.equal(f.camera.hidden_durability,22);
  ticks(f.sim,10);assert.equal(f.camera.filming,false);
});

test('Arrivée différée, conditions d’avance et plafond des interventions',()=>{
  const f=setup(); f.sim.state.temporary_units=[];f.sim.state.press_team=null;delete f.sim.state.press_director;
  f.sim.state.tick=60*f.sim.hz-1;updatePressTeam(f.sim);assert.equal(f.sim.state.press_director.warning,null);
  f.sim.state.tick=61*f.sim.hz;updatePressTeam(f.sim);
  f.sim.state.tick=73*f.sim.hz;updatePressTeam(f.sim);assert.ok(f.sim.state.press_director.warning);
  assert.equal(f.sim.state.temporary_units.length,0);
  f.sim.state.tick=75*f.sim.hz;updatePressTeam(f.sim);assert.equal(f.sim.state.temporary_units.length,2);
  assert.equal(canBeHit(pressMember(f.sim.state,'PRESS_CAMERA')),false);
  leavePressTeam(f.sim,'TEST');f.sim.state.tick+=48;updatePressTeam(f.sim);
  const d=f.sim.state.press_director;f.sim.state.tick=d.next_tick-1;updatePressTeam(f.sim);assert.equal(f.sim.state.press_team,null);
  d.count=3;f.sim.state.tick+=1000;updatePressTeam(f.sim);assert.equal(f.sim.state.press_team,null);
});

test('Sauvegarde et reprise déterministes pendant l’arrivée, le filmage et le départ',()=>{
  const f=setup(true);aim(f);
  for(const phase of ['ACTIVE','LEAVING']){
    if(phase==='LEAVING')leavePressTeam(f.sim,'TEST');
    const snapshot=f.sim.exportSnapshot();const copy=new GameSimulation(f.sim.config,42); copy.importSnapshot(snapshot);
    ticks(f.sim,3);ticks(copy,3);assert.deepEqual(copy.getState(),f.sim.getState());
  }
});

test('La marche réelle et la prédiction multijoueur appliquent exactement le même ralentissement',()=>{
  const f=setup();aim(f);const before=f.c.x;
  const prediction=new CampaignPrediction(f.sim.config,f.c.id);
  f.sim.state.input_acks={[f.c.id]:0};prediction.authoritative(f.sim.getState());
  prediction.step([{type:'Move',candidateId:f.c.id,axis:-1}]);
  f.sim.step([{type:'Move',candidateId:f.c.id,axis:-1}]);
  assert.ok(Math.abs(before-f.c.x-2.2/f.sim.hz)<1e-9);
  assert.ok(Math.abs(prediction.x-f.c.x)<1e-9);
});

test('La charge complète demande réellement plus de temps pendant le filmage',()=>{
  const f=setup();aim(f);f.c.facing=1;attackInput(f.sim,f.c,'PressAttack');ticks(f.sim,31);
  assert.ok(f.c.combat.charge_active);
  assert.ok(f.sim.state.tick-f.c.combat.press_tick-f.c.combat.press_delay_ticks<30);
  ticks(f.sim,10);attackInput(f.sim,f.c,'ReleaseAttack');
  const attack=f.sim.state.attacks.find(a=>a.owner_id===f.c.id);
  assert.equal(attack.kind,'CHARGED');assert.equal(attack.partial,false);assert.equal(attack.damage,21);
});

test('La caméra ne se tourne pas seule : sortir de sa portée la fait se déplacer et recadrer',()=>{
  const f=setup();aim(f);f.c.x=f.camera.x+5;
  const before=f.camera.x;ticks(f.sim,1);
  assert.ok(f.camera.x>before);assert.equal(f.camera.filming,false);assert.equal(filmed(f.sim.state,f.sim.config,f.c),false);
});

test('Un combo sur le cameraman suffit ; le micro laisse le temps de terminer le combat',()=>{
  const f=setup();aim(f);f.reporter.combat.cooldown_ticks=0;
  // La cible a atteint le cadreur par une esquive : trois touches normales, sans bonus de dégâts.
  f.c.x=f.camera.x+.8;f.c.facing=-1;
  for(let i=0;i<90&&f.sim.state.press_team?.phase==='ACTIVE';i++){
    if(i%5===0)requestAttack(f.sim,f.c,-1);
    ticks(f.sim,1);
  }
  assert.equal(f.sim.state.press_team.phase,'LEAVING');assert.equal(f.camera.hidden_durability,0);
  assert.ok(f.c.resistance>=82,'la journaliste ne doit pas faire perdre plus de 18 PV dans ce court échange');
});

test('Le groupe part après 25 secondes ou après huit secondes sans avance suffisante',()=>{
  for(const reason of ['TIMEOUT','LEAD_LOST']){
    const f=setup();
    if(reason==='TIMEOUT')f.sim.state.tick=f.sim.state.press_team.active_tick+25*f.sim.hz;
    else {f.sim.state.actualGameState.national_support={melenchon:29,le_pen:28,philippe:25};f.sim.state.tick=60;updatePressTeam(f.sim);f.sim.state.tick+=8*f.sim.hz;}
    updatePressTeam(f.sim);assert.equal(f.sim.state.press_team.phase,'LEAVING');
    assert.equal(f.sim.state.events.at(-1).reason,reason);
  }
});

test('Marche des journalistes : silhouette stable comme les PNJ, arrêt net pendant le filmage et la frappe',()=>{
  const f=setup();
  for(const unit of [f.camera,f.reporter]){
    const base=unit===f.camera?0:3;unit.moving=true;
    for(let tick=0;tick<90;tick++){
      const state={...f.sim.state,tick};assert.equal(pressWalking(unit,state),true);assert.equal(pressPose(unit,state,f.sim.hz),base);
    }
    unit.moving=false;assert.equal(pressWalking(unit,f.sim.state),false);
    unit.moving=true;unit.combat.stun_ticks=1;assert.equal(pressWalking(unit,f.sim.state),false);unit.combat.stun_ticks=0;
    unit.combat.attack_id='micro';assert.equal(pressWalking(unit,f.sim.state),false);unit.combat.attack_id=null;
  }
  f.camera.moving=false;f.camera.filming=true;assert.equal(pressPose(f.camera,f.sim.state,f.sim.hz),2);
  for(const phase of ['ENTRY','LEAVING']){f.sim.state.press_team.phase=phase;assert.equal(pressWalking(f.camera,f.sim.state),true);}
});

test('Le micro part de la base debout et y revient, sans pose de marche dans le cycle',()=>{
  const f=setup(),actor=f.reporter;actor.moving=false;actor.combat.attack_id='micro';
  const attack={id:'micro',owner_id:actor.id,windup_ticks:8,active_ticks:3,recovery_ticks:6,elapsed_ticks:0};
  f.sim.state.attacks=[attack];
  const poses=[0,3,8,11,14,16].map(age=>{attack.elapsed_ticks=age;return pressPose(actor,f.sim.state,f.sim.hz);});
  assert.deepEqual(poses,[3,4,5,4,3,3]);
  actor.combat.attack_id=null;assert.equal(pressPose(actor,f.sim.state,f.sim.hz),3);
});

test('Même sur une touche tardive, le micro reste tendu pendant toute la courte interruption',()=>{
  const f=setup(),s=f.sim.config.balance.press_team;
  f.c.x=f.reporter.x+s.micro_range;f.reporter.combat.cooldown_ticks=0;
  startNpcAttack(f.sim,f.reporter,'MICROPHONE',{target_id:f.c.id,range:s.micro_range,damage:s.micro_damage,knockback:0,electoral_damage:0,
    stun_seconds:s.micro_stun_seconds,windup_ticks:f.sim.secondsToTicks(s.micro_windup_seconds),active_ticks:f.sim.secondsToTicks(s.micro_active_seconds),
    recovery_ticks:f.sim.secondsToTicks(s.micro_recovery_seconds),cooldown_seconds:s.micro_cooldown_seconds});
  const attack=f.sim.state.attacks.find(a=>a.owner_id===f.reporter.id);
  attack.elapsed_ticks=attack.windup_ticks+attack.active_ticks-2;ticks(f.sim,1);
  assert.equal(f.c.resistance,94);assert.ok(f.c.combat.stun_ticks>0);
  const hold=attack.micro_hold_until_tick;assert.equal(hold,f.sim.state.tick+f.c.combat.stun_ticks);
  let held=0;
  while(f.c.combat.stun_ticks>0){assert.equal(pressPose(f.reporter,f.sim.state,f.sim.hz),5);held++;ticks(f.sim,1);}
  assert.equal(held,f.sim.secondsToTicks(s.micro_stun_seconds));
  ticks(f.sim,8);assert.equal(f.c.resistance,94,'Une extension plus longue ne doit pas infliger plusieurs touches.');
});

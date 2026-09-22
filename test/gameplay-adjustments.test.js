import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignConfig} from '../scripts/validate-campaign.mjs';
import {GameSimulation} from '../src/simulation/game-simulation.js';
import {combatState,demobilizeUnit} from '../src/simulation/combat-state.js';
import {attackInput,updateCombat,beginCombatTick,startNpcAttack,updateMilitantCombat} from '../src/simulation/combat.js';
import {verticalHit} from '../src/simulation/combat-actions.js';
import {updateStyleTemporary} from '../src/simulation/style-ultimates.js';
import {aiCombatCommands} from '../src/simulation/ai-combat.js';
import {captureSite} from '../src/simulation/strategic-sites.js';
import {aiEconomicTarget} from '../src/simulation/economy.js';
import {drawCandidateCombat,usesCandidateCombat,candidateCombatPose} from '../src/presentation/melenchon-combat.js';
function setup(){const sim=new GameSimulation(campaignConfig(),42);sim.state.npcs=[];sim.state.ai_enabled=false;sim.state.candidates.forEach((c,i)=>{c.x=100+i*100;c.axis=0;});return {sim,c:sim.state.candidates[0]};}

test('Persuasion : rester immobile ; marcher annule immédiatement les deux côtés',()=>{
 const {sim,c}=setup(),n=sim.spawn(sim.state.world.subzones[0],c.x+.2);
 sim.updatePersuasion();assert.equal(n.persuasion.actor_id,c.id);assert.equal(c.persuasion_target_ids.length,1);
 c.axis=1;sim.updatePersuasion();assert.equal(n.persuasion,null);assert.deepEqual(c.persuasion_target_ids,[]);
 c.axis=0;c.moving=true;sim.updatePersuasion();assert.equal(n.persuasion,null);
 c.moving=false;sim.updatePersuasion();assert.equal(n.persuasion.elapsed_ticks,1);
});

test('Retour PNJ : destinations distinctes dans la zone de spawn, conservées après sauvegarde',()=>{
 const {sim}=setup(),zone=sim.state.world.subzones[0],point=sim.state.world.socialPoints.find(p=>p.subzone_id===zone.id);
 const units=Array.from({length:3},()=>sim.spawn(zone,point.x,false,point));
 for(const n of units){n.role='MILITANT';n.faction_id='melenchon';n.hidden_durability=10;demobilizeUnit(sim,n);}
 assert.equal(new Set(units.map(n=>n.roam_target_x)).size,3);
 for(const n of units){assert.ok(n.roam_target_x>zone.start&&n.roam_target_x<zone.end);assert.ok(Math.abs(n.roam_target_x-point.x)<=sim.config.prototype.world.respawn_spread_units);}
 const copy=new GameSimulation(sim.config);copy.importSnapshot(sim.exportSnapshot());
 for(let i=0;i<200;i++){sim.updateNpcs();copy.updateNpcs();}
 assert.deepEqual(copy.state.npcs,sim.state.npcs);assert.ok(sim.state.npcs.every(n=>n.role==='NEUTRE'));
});

test('Mêlée : un coup léger ne touche plus à deux unités, le pied garde un peu plus de portée',()=>{
 for(const [distance,combo,expected]of [[2,0,false],[1.3,0,true],[1.7,0,false],[1.7,2,true]]){
  const {sim,c}=setup(),enemy=sim.state.candidates[1];enemy.x=c.x+distance;c.combat.combo_step=combo;c.combat.combo_expires_tick=100;
  attackInput(sim,c,'PressAttack');attackInput(sim,c,'ReleaseAttack');
  const before=enemy.resistance;
  for(let i=0;i<8;i++){sim.state.tick++;beginCombatTick(sim);updateCombat(sim);}
  assert.equal(enemy.resistance<before,expected,`${distance} / combo ${combo}`);
 }
});

test('Militants : rapprochement avant de tirer et projectile expiré avant cinq unités',()=>{
 for(const [distance,expected] of [[3,true],[5,false]]){
  const {sim,c}=setup(),enemy=sim.state.candidates[1];enemy.x=c.x+distance;
  const n=sim.spawn(sim.state.world.subzones[0],c.x);n.role='MILITANT';n.faction_id=c.faction_id;n.facing=1;n.hidden_durability=30;
  const s=sim.config.balance.physical_units.militant;
  if(distance===5){updateMilitantCombat(sim,n);assert.equal(n.combat.attack_id,null);assert.ok(n.x>c.x);n.x=c.x;}
  startNpcAttack(sim,n,'VERBAL',{range:s.verbal_range,damage:s.verbal_damage,knockback:s.verbal_knockback,electoral_damage:s.verbal_attack_electoral_damage,cooldown_seconds:s.verbal_cooldown_seconds});
  const before=enemy.resistance;
  for(let i=0;i<40;i++){sim.state.tick++;beginCombatTick(sim);updateCombat(sim);}
  assert.equal(enemy.resistance<before,expected);assert.equal(sim.state.projectiles.length,0);
 }
});

test('Zemmour : 0,8 tir/s, bulle basse évitable dès une hauteur de 0,8 personnage',()=>{
 const {sim,c}=setup(),s=sim.config.balance.specials.zemmour;
 assert.equal(s.shots_per_second,2/2.5);
 const unit={id:'temporary:1',owner_id:c.id,power_id:'power:1',role:'ZEMMOUR',faction_id:c.faction_id,x:c.x,facing:1,next_shot_tick:0,shot_count:0,combat:combatState()};
 updateStyleTemporary(sim,unit);assert.equal(sim.state.projectiles.length,1);assert.equal(unit.next_shot_tick,38);
 sim.state.tick=37;updateStyleTemporary(sim,unit);assert.equal(sim.state.projectiles.length,1);
 sim.state.tick=38;updateStyleTemporary(sim,unit);assert.equal(sim.state.projectiles.length,2);
 const target=sim.state.candidates[1];target.combat.height=.8;assert.equal(verticalHit(sim.config,unit,target,{kind:'BUBBLE'}),false);
 target.combat.height=0;assert.equal(verticalHit(sim.config,unit,target,{kind:'BUBBLE'}),true);
});

test('Hologrammes : poses de poings distinctes et transparence conservée',()=>{
 const {sim,c}=setup(),state=sim.state;
 const unit={...c,id:'temporary:1',role:'HOLOGRAMME',current_campaign_style:null,ready_tick:0,combat:combatState()};
 state.temporary_units=[unit];unit.combat.attack_id='attack:2';state.attacks=[{id:'attack:2',owner_id:unit.id,kind:'HOLOGRAM',elapsed_ticks:3,windup_ticks:3,active_ticks:3,recovery_ticks:6,direction:1}];
 assert.equal(usesCandidateCombat(unit,state),true);assert.equal(candidateCombatPose(unit,state,sim.config).frame,5);
 const calls=[],props={};const ctx=new Proxy(props,{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
 const r={ctx,config:sim.config,metrics:{characterHeight:100,groundY:400},assets:{get:()=>({})}};
 assert.equal(drawCandidateCombat(r,unit,200,state),true);assert.ok(calls.some(c=>c[0]==='drawImage'));assert.equal(props.globalAlpha,.48);
});

test('IA : cadence normale intermédiaire et décisions répétables sans consommer le hasard',()=>{
 const {sim,c}=setup(),target=sim.state.candidates[1];target.x=c.x+1;
 const rng=sim.state.rng_state;let attacks=0;
 for(let tick=0;tick<300;tick++){sim.state.tick=tick;const a=aiCombatCommands(sim.state,sim.config,c,target);assert.deepEqual(a,aiCombatCommands(sim.state,sim.config,c,target));attacks+=a.some(c=>c.type==='Attack');}
 assert.ok(attacks>=25&&attacks<40);assert.equal(sim.state.rng_state,rng);
});

test('IA : un bâtiment allié améliorable justifie un court détour hors objectif',()=>{
 const {sim,c}=setup();c.money=1000;
 const site=sim.state.buildings.find(b=>b.type==='permanence');captureSite(sim,site,c);c.x=site.x+5;
 for(let i=0;i<8;i++){const n=sim.spawn(sim.state.world.subzones.find(z=>z.id===site.subzone_id),site.x);if(n){n.role='SYMPATHISANT';n.faction_id=c.faction_id;n.hidden_durability=30;}}
 const objective={purpose:'CONQUER',subzone_id:'different-zone'};
 const target=aiEconomicTarget(sim.state,sim.config,c,objective);
 assert.ok(target);assert.equal(target.offer.kind,'UPGRADE');assert.equal(target.id,site.id);
});

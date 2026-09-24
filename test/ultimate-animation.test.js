import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {campaignConfig} from '../scripts/validate-campaign.mjs';
import {GameSimulation} from '../src/simulation/game-simulation.js';
import {activateUltimate,beginCombatTick,updateCombat,cancelCurrentAttack} from '../src/simulation/combat.js';
import {tryBardellisation,surgeMotionPlan} from '../src/simulation/style-ultimates.js';
import {ultimateAtlases} from '../src/presentation/ultimate-sprite-data.js';
import {ultimateCharacterPose,scarfPose,drawUltimateCharacter,drawUltimateProjectile,drawUltimateEffect,molotovArcHeight,SURGE_HEIGHT_RATIO} from '../src/presentation/ultimate-sprites.js';
import {drawStyleEffects} from '../src/presentation/style-effects.js';
import {visualManifest} from '../src/presentation/visual-manifest.js';
import {usesCandidateCombat} from '../src/presentation/melenchon-combat.js';
import {candidateExtraPose} from '../src/presentation/candidate-extra-poses.js';
import {combatDelta} from '../src/simulation/combat-geometry.js';

const config=campaignConfig();
function recordingRenderer(){
  const calls=[];
  const ctx=new Proxy({}, {get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
  return {ctx,calls,config,metrics:{groundY:300,characterHeight:100,pixelsPerUnit:40},p:{npc_height_multiplier:.8},screenX:x=>x*40,assets:{get:id=>({id}),load:async()=>null}};
}
const make=()=>new GameSimulation(config,42);
test('Déferlement : sept trajectoires distinctes, changements et choix reproductibles',()=>{
  const state={seed:42,tick:0},paths=[];
  for(let i=1;i<=7;i++){
    const unit={id:`temporary:${i}`,ready_tick:8},plans=[];
    for(let tick=8;tick<80;tick++){state.tick=tick;const plan=surgeMotionPlan(state,unit,30);assert.deepEqual(plan,surgeMotionPlan(structuredClone(state),structuredClone(unit),30));plans.push(plan);}
    assert.ok(new Set(plans.map(p=>p.direction)).size>1);paths.push(JSON.stringify(plans));
  }
  assert.equal(new Set(paths).size,7);
  assert.equal(config.balance.specials.zemmour.knockback,0);assert.equal(config.balance.specials.zemmour.damage,4);
});
test('Déferlement : sortie derrière Mélenchon, trois ou quatre virages puis retour vers sa position mobile',()=>{
  const sim=make(),state=sim.state,c=state.candidates.find(c=>c.faction_id==='melenchon');
  state.npcs=[];c.x=100;c.facing=1;c.current_campaign_style='melenchon_communautariste';c.special_charge=config.balance.special_charge.required_points;
  activateUltimate(sim,c);const units=state.temporary_units;
  assert.equal(units.length,7);assert.ok(units.every(unit=>Math.abs(combatDelta(state,c.x,unit.x))<.1));
  assert.deepEqual(units.map(unit=>unit.surge_turn_ticks.length),[4,3,4,3,4,3,4]);
  state.tick=1;assert.equal(candidateExtraPose(c,state,config,false)?.name,'ultimate');
  while(state.tick<units[0].return_tick){state.tick++;beginCombatTick(sim);updateCombat(sim);}
  c.x=104;c.facing=-1;
  while(state.tick<units[0].expires_tick-1){c.x+=.03;state.tick++;beginCombatTick(sim);updateCombat(sim);}
  assert.ok(units.every(unit=>Math.abs(combatDelta(state,c.x,unit.x))<.8));
  assert.equal(candidateExtraPose(c,state,config,false)?.name,'ultimate');
  assert.equal(SURGE_HEIGHT_RATIO,.84);
});
test('Molotov : priorité aux candidats, repli sur une unité et trajectoire en cloche',()=>{
  const launch=({candidates=true,npc=true}={})=>{
    const sim=make(),state=sim.state,actor=state.candidates.find(c=>c.faction_id==='melenchon');
    actor.x=100;actor.facing=1;actor.current_campaign_style='melenchon_populiste';actor.special_charge=config.balance.special_charge.required_points;
    for(const candidate of state.candidates)if(candidate!==actor){candidate.x=candidate.faction_id==='le_pen'?112:118;candidate.eliminated=!candidates;}
    state.npcs=npc?[{id:'npc:proche',role:'MILITANT',faction_id:'le_pen',x:101,combat:{height:0},hidden_durability:100}]:[];
    activateUltimate(sim,actor);return {actor,projectile:state.projectiles[0]};
  };
  let result=launch();assert.equal(result.projectile.target_x,112);assert.equal(result.projectile.initial_range,12);
  result=launch({candidates:false,npc:true});assert.equal(result.projectile.target_x,101);
  result=launch({candidates:false,npc:false});assert.equal(result.projectile.target_x,106);
  assert.equal(molotovArcHeight({initial_range:10,remaining_range:10}),.72);
  assert.ok(molotovArcHeight({initial_range:10,remaining_range:5})>.9);
  assert.equal(molotovArcHeight({initial_range:10,remaining_range:0}),0);
  assert.equal(config.balance.specials.fire.projectile_speed,16);
});
test('Molotov : départ au lâcher du geste et visée actualisée',()=>{
  const sim=make(),state=sim.state,actor=state.candidates.find(c=>c.faction_id==='melenchon');
  const target=state.candidates.find(c=>c.faction_id==='le_pen');state.npcs=[];
  actor.x=100;actor.facing=1;actor.current_campaign_style='melenchon_populiste';actor.special_charge=config.balance.special_charge.required_points;
  target.x=112;activateUltimate(sim,actor);const projectile=state.projectiles[0];
  assert.equal(projectile.launch_tick,sim.secondsToTicks(config.balance.specials.fire.launch_delay_seconds));
  while(state.tick<projectile.launch_tick-1){state.tick++;beginCombatTick(sim);updateCombat(sim);assert.equal(projectile.x,100);assert.equal(projectile.launched,false);}
  actor.x=102;target.x=110;state.tick++;
  assert.equal(ultimateCharacterPose(actor,state,config)?.frame,2);
  beginCombatTick(sim);updateCombat(sim);
  assert.equal(projectile.launched,true);assert.equal(projectile.initial_range,8);assert.ok(projectile.x>102);
});
test('Vague : sprite allongé et animation visuelle ralentie',()=>{
  const projectile={kind:'WAVE',x:2,direction:1},r0=recordingRenderer(),r2=recordingRenderer(),r5=recordingRenderer();
  drawUltimateProjectile(r0,projectile,{tick:0});drawUltimateProjectile(r2,projectile,{tick:2});drawUltimateProjectile(r5,projectile,{tick:5});
  const d0=r0.calls.find(c=>c[0]==='drawImage'),d2=r2.calls.find(c=>c[0]==='drawImage'),d5=r5.calls.find(c=>c[0]==='drawImage');
  assert.equal(d0[8],2.6*r0.metrics.pixelsPerUnit);assert.equal(d0[2],d2[2]);assert.notEqual(d0[2],d5[2]);
});
test('Vague : départ retardé jusqu’aux bras tendus et orientation prise au lancement',()=>{
  const sim=make(),state=sim.state,actor=state.candidates.find(c=>c.faction_id==='le_pen');
  state.npcs=[];actor.x=100;actor.facing=1;actor.current_campaign_style='le_pen_souverainiste';actor.special_charge=config.balance.special_charge.required_points;
  activateUltimate(sim,actor);const projectile=state.projectiles[0];
  assert.equal(projectile.launch_tick,sim.secondsToTicks(config.balance.specials.le_pen_navy_wave.launch_delay_seconds));
  while(state.tick<projectile.launch_tick-1){state.tick++;beginCombatTick(sim);updateCombat(sim);assert.equal(projectile.x,100);assert.equal(projectile.launched,false);}
  actor.x=104;actor.facing=-1;state.tick++;
  assert.equal(ultimateCharacterPose(actor,state,config)?.frame,2);
  beginCombatTick(sim);updateCombat(sim);
  assert.equal(projectile.launched,true);assert.equal(projectile.direction,-1);assert.ok(projectile.x<104&&projectile.x>103);
});
test('Feu au niveau des pieds, effets découpés et aucun nom Bardella',()=>{
  const r=recordingRenderer();drawStyleEffects(r,{tick:0,powers:[{fire_zone:{x:2,expires_tick:10}}],candidates:[],npcs:[],temporary_units:[],attacks:[]});
  const translation=r.calls.find(c=>c[0]==='translate'),draw=r.calls.find(c=>c[0]==='drawImage');
  assert.equal(translation[2]+draw[9],314);
  const clipped=Object.keys(ultimateAtlases.europe.clips)[0],effect=recordingRenderer();
  drawUltimateEffect(effect,'europe',Number(clipped),0,0,100,100);assert.ok(effect.calls.some(c=>c[0]==='clip'));
  const label=recordingRenderer();drawStyleEffects(label,{tick:0,powers:[],attacks:[],candidates:[{id:'b',x:0,bardella_form:true,combat:{}}]});assert.ok(!label.calls.some(c=>c[0]==='fillText'));
});
test('Huit ultimes : PNG transparents, cadres valides et ressources exportées',()=>{
  assert.equal(Object.keys(ultimateAtlases).length,8);
  for(const [key,atlas]of Object.entries(ultimateAtlases)){
    const file=visualManifest[atlas.sprite];assert.ok(file,key);
    const png=readFileSync(new URL(file.file));assert.equal(png[25],6,key+' : canal alpha');
    const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
    assert.equal(atlas.frames.length,['bardella','europe'].includes(key)?16:8);
    for(const [x,y,w,h,px,py]of atlas.frames){assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,key);assert.ok(Number.isFinite(px+py));}
  }
});
test('Écharpe : portée exacte, deux directions, hauteur du saut et annulation immédiate',()=>{
  const sim=make(),state=sim.state,c=state.candidates.find(c=>c.faction_id==='philippe');c.x=2;c.combat.height=.8;
  const attack={id:'test',owner_id:c.id,kind:'SCARF',range:5,direction:1,elapsed_ticks:3,windup_ticks:3,active_ticks:3,recovery_ticks:6};
  c.combat.attack_id=attack.id;state.attacks=[attack];state.powers=[];
  for(const direction of [1,-1]){
    attack.direction=direction;const r=recordingRenderer();drawStyleEffects(r,state);
    const translate=r.calls.find(c=>c[0]==='translate'),draw=r.calls.find(c=>c[0]==='drawImage');
    assert.ok(draw);assert.equal(translate[1]+direction*draw[8],r.screenX(c.x)+direction*attack.range*r.metrics.pixelsPerUnit);
    assert.equal(translate[2],300+6-80-76*1.06);
    assert.equal(ultimateCharacterPose(c,state,config).direction,direction);
  }
  attack.elapsed_ticks=2;assert.equal(scarfPose(attack).extension,0);
  attack.elapsed_ticks=3;assert.equal(scarfPose(attack).extension,1);
  attack.elapsed_ticks=8;assert.equal(scarfPose(attack).extension,0);
  cancelCurrentAttack(sim,c);assert.equal(ultimateCharacterPose(c,state,config),null);
  const r=recordingRenderer();drawStyleEffects(r,state);assert.equal(r.calls.some(c=>c[0]==='drawImage'),false);
});
test('Europe : bouclier uniquement après une riposte confirmée, puis disparition',()=>{
  const c={id:'europe',x:0,combat:{},ultimate_effect:{kind:'EUROPE',expires_tick:100}};
  const state={tick:20,powers:[],attacks:[],candidates:[c],hit_results:[]};
  const draws=()=>{const r=recordingRenderer();drawStyleEffects(r,state);return r.calls.filter(c=>c[0]==='drawImage');};
  assert.equal(draws().length,0);
  state.hit_results=[{source_id:'enemy',target_id:c.id,tick:20,attack_id:'projectile:1',damage:4}];assert.equal(draws().length,0);
  state.hit_results.push({source_id:c.id,target_id:'enemy',tick:20,attack_id:'riposte:hit:1',damage:8});
  const [draw]=draws();assert.ok(draw);assert.ok(draw[9]>draw[8]*1.6);
  state.tick=29;assert.equal(draws().length,0);
  assert.ok(ultimateAtlases.bardella.clips[0]);assert.ok(ultimateAtlases.bardella.clips[15]);
});
test('Les vrais pouvoirs et unités sélectionnent leurs animations sans modifier la simulation',()=>{
  const cases=[['le_pen','le_pen_souverainiste','wave'],['melenchon','melenchon_populiste','fire'],['melenchon','melenchon_communautariste','surge'],['philippe','philippe_gestionnaire','wall'],['le_pen','le_pen_zemmouriste','zemmour'],['le_pen','le_pen_gouvernement','bardella'],['philippe','philippe_europeiste','europe']];
  for(const [faction,style,sheet]of cases){
    const sim=make(),state=sim.state,c=state.candidates.find(c=>c.faction_id===faction);
    c.current_campaign_style=style;c.special_charge=config.balance.special_charge.required_points;state.npcs=[];
    activateUltimate(sim,c);assert.equal(c.special_charge,0,style);
    if(sheet==='bardella')assert.equal(tryBardellisation(sim,c),true);
    const actor=state.temporary_units[0]||c;
    assert.equal(ultimateCharacterPose(actor,state,config)?.sheet,sheet);
    for(let i=0;i<100;i++){
      state.tick++;beginCombatTick(sim);updateCombat(sim);
      const before=JSON.stringify(state),r=recordingRenderer();
      for(const entity of [...state.candidates,...state.temporary_units])drawUltimateCharacter(r,entity,100,state);
      for(const p of state.projectiles)drawUltimateProjectile(r,p,state);
      drawStyleEffects(r,state);assert.equal(JSON.stringify(state),before);
    }
  }
});
test('Hologrammes inchangés et garde habituelle conservée pendant le pouvoir écharpe',()=>{
  const sim=make(),state=sim.state;
  const hologram={role:'HOLOGRAMME',id:'h',faction_id:'melenchon',combat:{}};
  assert.equal(ultimateCharacterPose(hologram,state,config),null);assert.equal(usesCandidateCombat(hologram,state),true);
  const c=state.candidates.find(c=>c.faction_id==='philippe');c.current_campaign_style='philippe_notable';c.ultimate_effect={kind:'SCARF',expires_tick:100};
  assert.equal(usesCandidateCombat(c,state),true);
});

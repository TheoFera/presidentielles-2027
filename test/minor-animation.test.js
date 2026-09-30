import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { candidateCombatPose, usesCandidateCombat, combatAtlasFor } from '../src/presentation/melenchon-combat.js';
import { candidateExtraPose, extraAtlasesFor } from '../src/presentation/candidate-extra-poses.js';
import { MINOR_ANIMATION_FILES } from '../src/presentation/minor-animation-sprites.js';
import { MINOR_ANIMATION_DATA } from '../src/presentation/minor-animation-data.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { readPng } from '../scripts/lib/png.mjs';
import { standingSpriteMotion, drawStandingSprite } from '../src/presentation/standing-sprite-motion.js';

test('Les six secondaires utilisent les mêmes phases de coups, de charge et de saut que Philippe', () => {
  const config = campaignConfig(), state = new GameSimulation(config, 42).state;
  const actor = state.candidates.find(c => c.faction_id === 'philippe'); actor.current_campaign_style = null;
  for (const faction of Object.keys(MINOR_ANIMATION_FILES)) {
    actor.faction_id = faction; assert.ok(usesCandidateCombat(actor, state)); assert.ok(combatAtlasFor(actor));
    for (const kind of ['CANDIDATE', 'CHARGED', 'DIVE']) for (const step of [1,2,3]) for (const age of [0,3,6,11]) {
      const attack = { id: 'test', owner_id: actor.id, direction: -1, kind, step, elapsed_ticks: age, windup_ticks: 3, active_ticks: 3, recovery_ticks: 6 };
      state.attacks = [attack]; actor.combat.attack_id = attack.id;
      actor.faction_id = 'philippe'; const expected = candidateCombatPose(actor, state, config, true);
      actor.faction_id = faction; assert.deepEqual(candidateCombatPose(actor, state, config, true), expected);
    }
    state.attacks = []; actor.combat.attack_id = null;
    for (const jumpAge of [0,6,24]) {
      actor.combat.jump_tick = state.tick-jumpAge;
      actor.faction_id = 'philippe'; const expected = candidateCombatPose(actor, state, config, true);
      actor.faction_id = faction; assert.deepEqual(candidateCombatPose(actor, state, config, true), expected);
    }
    actor.combat.jump_tick = null;
    for (const age of [0,30,90]) {
      actor.combat.charge_active = true; actor.combat.press_tick = state.tick-age;
      actor.faction_id = 'philippe'; const expected = candidateCombatPose(actor,state,config,true);
      actor.faction_id = faction; assert.deepEqual(candidateCombatPose(actor,state,config,true),expected);
    }
    actor.combat.charge_active = false;
  }
});

test('Pas de garde, esquive, réception, persuasion et relevé partagent les priorités des principaux', () => {
  const config = campaignConfig(), state = new GameSimulation(config, 42).state;
  const original = state.candidates.find(c => c.faction_id === 'philippe');
  for (const faction of Object.keys(MINOR_ANIMATION_FILES)) {
    const actor = structuredClone(original); actor.faction_id = faction; actor.current_campaign_style = null;
    const pose = (landing=null, frame=0) => candidateExtraPose(actor,state,config,true,landing,frame);
    actor.moving = true; actor.axis = 1;
    for (let frame=0; frame<8; frame++) assert.deepEqual([pose(null,frame).sheet,pose(null,frame).frame],['movement',frame]);
    actor.moving = false; actor.axis = 0; actor.persuasion_target_ids = ['npc'];
    assert.equal(pose().name,'persuade'); assert.ok([4,5].includes(pose().frame));
    actor.persuasion_target_ids = []; assert.equal(pose(0).frame,2); assert.equal(pose(5).frame,3);
    actor.dash_active = true; actor.dash_direction = -1; actor.dash_until_tick = state.tick+Math.ceil(config.balance.dash.duration_seconds*config.balance.simulation_architecture.fixed_tick_hz);
    assert.equal(pose().sheet,'movement'); assert.equal(pose().frame,8); assert.equal(pose().direction,-1);
    actor.dash_active = false; actor.is_ko = true; actor.ko_started_tick = state.tick;
    assert.equal(pose().frame,8); actor.ko_started_tick -= 60; assert.equal(pose().frame,11);
    actor.is_ko = false; actor.combat.knockdown_tick = state.tick;
    assert.equal(pose().frame,8);
    actor.combat.knockdown_tick = null; actor.purchase_hold = {};
    assert.equal(pose(),null,'Aucune planche d’achat inutile pour un secondaire.');
  }
});

test('Toutes les planches utiles sont transparentes, cadrées et enregistrées, sans véhicules', () => {
  for (const [faction, files] of Object.entries(MINOR_ANIMATION_FILES)) {
    assert.deepEqual(Object.keys(files),['combat','movement','actions']);
    for (const [sheet,file] of Object.entries(files)) {
      const atlas = sheet === 'combat' ? combatAtlasFor({ faction_id: faction }) : extraAtlasesFor({ faction_id: faction })[sheet];
      assert.ok(visualManifest[atlas.sprite].file.endsWith(file));
      const image = readPng(file); assert.equal(atlas.frames.length,sheet === 'actions'?12:16);
      assert.ok(image.data.some((value,index)=>index%4===3&&value===0));
      for (const [x,y,w,h,px,py] of atlas.frames) assert.ok(x>=0&&y>=0&&x+w<=image.width&&y+h<=image.height&&px>=x&&px<=x+w&&py===y+h);
    }
    assert.equal(MINOR_ANIMATION_DATA[faction].movement.frames.length,8+3+5);
  }
});

test('La marche générale conserve le mouvement discret commun et alterne les appuis sans genou haut', () => {
  const calls = [], ctx = { drawImage: (...args) => calls.push(args) }, image = {};
  for (const time of [Math.PI/26,3*Math.PI/26]) {
    calls.length = 0;
    drawStandingSprite(ctx,image,{x:0,y:0,width:100,height:200},200,100,standingSpriteMotion('walk',time));
    assert.equal(calls.length,3); assert.equal(calls[0][4],150);
    assert.ok(calls.slice(1).every(args=>args[8]>=47&&args[8]<=50));
    assert.ok(calls[1][8]!==calls[2][8]);
  }
});

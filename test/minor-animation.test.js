import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { candidateCombatPose, usesCandidateCombat, combatAtlasFor } from '../src/presentation/personnages/melenchon-combat.js';
import { candidateExtraPose, extraAtlasesFor } from '../src/presentation/personnages/candidate-extra-poses.js';
import { MINOR_ANIMATION_FILES, minorCombatAtlases, minorExtraAtlases, minorStandingAtlases } from '../src/presentation/personnages/minor-animation-sprites.js';
import { MINOR_ANIMATION_DATA } from '../src/presentation/personnages/minor-animation-data.js';
import { visualManifest } from '../src/presentation/rendu/visual-manifest.js';
import { readPng } from '../scripts/lib/png.mjs';
import { standingSpriteMotion, drawStandingSprite } from '../src/presentation/personnages/standing-sprite-motion.js';
import { additionalCombatAtlases } from '../src/presentation/personnages/candidate-combat-atlases.js';
import { MINOR_SPRITES } from '../src/presentation/personnages/minor-sprites.js';
import { MINOR_ATLASES } from '../src/presentation/personnages/minor-sprite-atlases.js';
import { measureMinorSprites } from '../scripts/outils-images/measure-minor-sprites.mjs';
import { characterFrameScale, CHARACTER_HEIGHT_RATIO } from '../src/presentation/personnages/character-scale.js';
import { minorLocomotionAtlases, minorGuardIdleFrame } from '../src/presentation/personnages/minor-locomotion-sprites.js';

test('La persuasion validée de Dupont-Aignan conserve ses découpes, ses appuis et la hauteur de Philippe', () => {
  const atlas = minorExtraAtlases.dupont_aignan.persuasion;
  const file = 'assets/images/candidats/dupont-aignan/dupont-aignan-persuasion-v1.png';
  assert.ok(visualManifest[atlas.sprite].file.endsWith(file));
  assert.deepEqual(atlas.frames, measureMinorSprites(readPng(file), { count: 2, columns: 2, koFrames: [] }).frames);
  for (let i = 0; i < 2; i++) {
    const frame = atlas.frames[i], scale = characterFrameScale(atlas, i, 170);
    assert.equal(frame[1] + frame[3], frame[5], 'Les chaussures restent sur la ligne de sol.');
    assert.ok(Math.abs(frame[3] * scale - 170 * CHARACTER_HEIGHT_RATIO) < .001);
  }
});

test('Les douze planches redessinées ont des découpes et points d’appui mesurés dans leurs PNG', () => {
  for (const faction of ['roussel', 'arthaud', 'attal']) {
    const single = MINOR_ATLASES[faction].frames.length === 1;
    const measured = measureMinorSprites(readPng(MINOR_SPRITES[faction]), single ? { count: 1, columns: 1, koFrames: [] } : undefined);
    if (single) measured.frames[0][4] = measured.frames[0][0] + measured.frames[0][2] / 2;
    assert.deepEqual(MINOR_ATLASES[faction].frames, measured.frames);
    for (const [sheet, file] of Object.entries(MINOR_ANIMATION_FILES[faction])) {
      const options = { count: sheet === 'actions' ? 12 : 16, columns: 4, koFrames: sheet === 'actions' ? [8, 9, 10, 11] : [] };
      assert.deepEqual(MINOR_ANIMATION_DATA[faction][sheet].frames, measureMinorSprites(readPng(file), options).frames);
    }
  }
});





test('Roussel redessiné : hauteur de garde proche des références et huit pas sans changement de taille', () => {
  const height = (atlas, frame) => atlas.frames[frame][3] * (atlas.uniformCharacter ? characterFrameScale(atlas,frame,1) : 1.1236/(atlas.referenceHeight||340));
  const guard = height(minorCombatAtlases.roussel, 0);
  const reference = (height(additionalCombatAtlases.philippe, 0) + height(additionalCombatAtlases.le_pen, 0)) / 2;
  assert.ok(Math.abs(guard / reference - 1) < .06, 'La surface seule peut masquer une silhouette trop basse.');
  for (let frame = 0; frame < 8; frame++) {
    assert.ok(Math.abs(height(minorExtraAtlases.roussel.movement, frame) / guard - 1) < .04, `pas de garde ${frame}`);
  }
});

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
    for (let frame=0; frame<8; frame++) assert.deepEqual([pose(null,frame).sheet,pose(null,frame).frame],[minorLocomotionAtlases[faction]?'guardWalk':'movement',frame]);
    actor.moving = false; actor.axis = 0; actor.persuasion_target_ids = ['npc'];
    assert.equal(pose().name,'persuade');
    assert.ok((faction === 'dupont_aignan' ? [0,1] : [4,5]).includes(pose().frame));
    assert.equal(pose().sheet, faction === 'dupont_aignan' ? 'persuasion' : 'actions');
    actor.persuasion_target_ids = []; assert.equal(pose(0).frame,2); assert.equal(pose(5).frame,3);
    actor.dash_active = true; actor.dash_direction = -1; actor.dash_until_tick = state.tick+Math.ceil(config.balance.dash.duration_seconds*config.balance.simulation_architecture.fixed_tick_hz);
    assert.equal(pose().sheet,'movement'); assert.equal(pose().frame,8); assert.equal(pose().direction,-1);
    actor.dash_active = false; actor.is_ko = true; actor.ko_started_tick = state.tick;
    assert.equal(pose().frame,faction==='attal'?1:8); actor.ko_started_tick -= 60; assert.equal(pose().frame,faction==='attal'?4:11);
    actor.is_ko = false; actor.combat.knockdown_tick = state.tick;
    assert.equal(pose().frame,faction==='attal'?1:8);
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




test('Les six secondaires : garde, huit pas et persuasion à la taille de garde de Philippe', () => {
 const reference = additionalCombatAtlases.philippe.frames[0][3] / 340 * 1.1236;
 assert.equal(CHARACTER_HEIGHT_RATIO,reference);
 for(const faction of Object.keys(MINOR_ANIMATION_FILES)) {
  for(const [sheet,indices]of [['combat',[0,1,2,3,4,5,6,7,9,10,11]],['movement',[0,1,2,3,4,5,6,7]],['actions',[0,1,4,5,6,7]]]) {
   const atlas=sheet==='combat'?minorCombatAtlases[faction]:minorExtraAtlases[faction][sheet];
   const posture = faction === 'glucksmann' && sheet === 'combat' ? .92 : 1;
   for(const index of indices)for(const height of [80,150,220])assert.ok(Math.abs(atlas.frames[index][3]*characterFrameScale(atlas,index,height)-reference*height*posture)<1e-10,faction+' '+sheet+' '+index);
  }
 }
});

test('Les poses courbées et couchées conservent une hauteur inférieure à la garde', () => {
 for(const faction of Object.keys(MINOR_ANIMATION_FILES)) {
  const combat=minorCombatAtlases[faction],extra=minorExtraAtlases[faction];
  for(const index of [8,12,13,15])assert.ok(combat.frames[index][3]*characterFrameScale(combat,index,1)<CHARACTER_HEIGHT_RATIO,faction+' saut '+index);
  const atlas=extra.knockout||extra.actions,index=extra.knockout?4:11;
  assert.ok(atlas.frames[index][3]*characterFrameScale(atlas,index,1)<CHARACTER_HEIGHT_RATIO*.65,faction+' K.O.');
 }
});

test('Déplacement rigide d’un candidat : un seul dessin, sans écrasement des jambes', () => {
 const calls=[],ctx={drawImage:(...args)=>calls.push(args)};
 drawStandingSprite(ctx,{}, {x:0,y:0,width:120,height:240},150,75,{...standingSpriteMotion('walk',.5),rigid:true});
 assert.equal(calls.length,1);assert.equal(calls[0][7]/calls[0][3],calls[0][8]/calls[0][4]);
});

test('Attal, NDA et Glucksmann : pose neutre au repos et en déplacement ordinaire', () => {
 for(const faction of ['attal','dupont_aignan','glucksmann']) {
  const atlas=minorStandingAtlases[faction],actions=minorExtraAtlases[faction].actions;
  assert.equal(atlas.sprite,actions.sprite);
  assert.deepEqual(atlas.frames,[actions.frames[6]],'La référence en plein pas ne sert pas de pose d’attente.');
  assert.ok(Math.abs(atlas.frames[0][3]*characterFrameScale(atlas,0,150)-146.7289411764706)<1e-10);
 }
});

test('Les trois nouveaux cycles de garde utilisent des dessins distincts et une échelle anatomique constante', () => {
 for(const faction of ['attal','dupont_aignan','glucksmann']) {
  const {guardIdle,guardWalk}=minorLocomotionAtlases[faction];
  assert.equal(new Set(guardIdle.frames.map(f=>f.join(','))).size,3,faction+' garde figée');
  assert.equal(guardWalk.frames.length,8);
  assert.equal(new Set(guardWalk.frames.map(f=>f.join(','))).size,4,faction+' appuis');
  const image=readPng(new URL(visualManifest[guardIdle.sprite].file));
  for(const atlas of [guardIdle,guardWalk])for(const [i,frame]of atlas.frames.entries()) {
   assert.equal(characterFrameScale(atlas,i,150),characterFrameScale(guardIdle,0,150),'Aucun grossissement de la tête entre deux appuis.');
   const [x,y,w,h,px,py]=frame;
   assert.ok(x>=0&&y>=0&&x+w<=image.width&&y+h<=image.height&&px>=x&&px<=x+w&&py===y+h);
  }
 }
 assert.deepEqual([0,4,8,11,14].map(tick=>minorGuardIdleFrame(tick,20)),[0,1,2,1,0]);
});

test('Glucksmann : le visage conserve son gabarit entre la pose droite, la garde et les coups', () => {
 // Hauteurs cheveux–menton relevées sur les trois dessins de référence.
 const poses = [[minorStandingAtlases.glucksmann, 138], [minorLocomotionAtlases.glucksmann.guardIdle, 138], [minorCombatAtlases.glucksmann, 122]];
 for (const height of [80,150,220]) {
  const reference = poses[0][1] * characterFrameScale(poses[0][0],0,height);
  for (const [atlas,headHeight] of poses.slice(1)) {
   assert.ok(Math.abs(headHeight * characterFrameScale(atlas,0,height) / reference - 1) < .02, 'La garde fléchie ne doit pas agrandir la tête.');
   assert.ok(atlas.frames[0][3] * characterFrameScale(atlas,0,height) < CHARACTER_HEIGHT_RATIO * height, 'Les genoux fléchis abaissent le personnage.');
  }
 }
});

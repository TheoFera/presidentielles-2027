import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { candidateCombatPose, usesCandidateCombat, combatAtlasFor } from '../src/presentation/melenchon-combat.js';
import { candidateExtraPose, extraAtlasesFor } from '../src/presentation/candidate-extra-poses.js';
import { MINOR_ANIMATION_FILES, minorCombatAtlases } from '../src/presentation/minor-animation-sprites.js';
import { MINOR_ANIMATION_DATA } from '../src/presentation/minor-animation-data.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { readPng } from '../scripts/lib/png.mjs';
import { standingSpriteMotion, drawStandingSprite } from '../src/presentation/standing-sprite-motion.js';
import { additionalCombatAtlases } from '../src/presentation/candidate-combat-atlases.js';
import { additionalExtraAtlases } from '../src/presentation/candidate-extra-atlases.js';
import { MINOR_SPRITES } from '../src/presentation/minor-sprites.js';
import { MINOR_ATLASES } from '../src/presentation/minor-sprite-atlases.js';
import { measureMinorSprites } from '../scripts/measure-minor-sprites.mjs';

test('Les six mineurs gardent une échelle proche de Philippe après correction des têtes', () => {
  for (const [faction, sheets] of Object.entries(MINOR_ANIMATION_DATA)) for (const [sheet, atlas] of Object.entries(sheets)) {
    const reference = sheet === 'combat' ? additionalCombatAtlases.philippe : additionalExtraAtlases.philippe[sheet];
    const height = reference.referenceHeight || 340;
    const redrawn = ['roussel', 'arthaud', 'attal'].includes(faction);
    // Une tête réduite diminue le rectangle complet. Renormaliser sa hauteur à l'identique
    // agrandirait le corps et annulerait en partie la correction du dessin.
    const heightRatio = (atlas.frames[0][3] / atlas.referenceHeight) / (reference.frames[0][3] / height);
    assert.ok(Math.abs(heightRatio - 1) < (redrawn ? .1 : 1e-8), `${faction} · ${sheet} : hauteur`);
    if (!atlas.frameScales && faction !== 'dupont_aignan') {
      const widthRatio = (atlas.frames[0][2] * atlas.widthScale / atlas.referenceHeight) / (reference.frames[0][2] / height);
      assert.ok(Math.abs(widthRatio - 1) < (redrawn ? .08 : 1e-8), `${faction} · ${sheet} : largeur`);
    }
  }
});

test('Les douze planches redessinées ont des découpes et points d’appui mesurés dans leurs PNG', () => {
  for (const faction of ['roussel', 'arthaud', 'attal']) {
    assert.deepEqual(MINOR_ATLASES[faction].frames, measureMinorSprites(readPng(MINOR_SPRITES[faction])).frames);
    for (const [sheet, file] of Object.entries(MINOR_ANIMATION_FILES[faction])) {
      const options = { count: sheet === 'actions' ? 12 : 16, columns: 4, koFrames: sheet === 'actions' ? [8, 9, 10, 11] : [] };
      assert.deepEqual(MINOR_ANIMATION_DATA[faction][sheet].frames, measureMinorSprites(readPng(file), options).frames);
    }
  }
});

test('Dupont-Aignan garde ses proportions : aucune pose étirée en hauteur', () => {
  for (const atlas of Object.values(MINOR_ANIMATION_DATA.dupont_aignan)) assert.equal(atlas.widthScale * 1.06, 1.1236);
  assert.equal(minorCombatAtlases.dupont_aignan.minor, true);
});

test('Roussel : échelle constante par rangée, marche à la taille de la garde, sans étirement du visage', () => {
  const rendered = (atlas, frame) => atlas.frames[frame][3] / atlas.referenceHeight * atlas.frameScales[frame];
  for (const [sheet, atlas] of Object.entries(MINOR_ANIMATION_DATA.roussel)) {
    const reference = sheet === 'combat' ? additionalCombatAtlases.philippe : additionalExtraAtlases.philippe[sheet];
    const height = reference.referenceHeight || 340;
    assert.equal(atlas.widthScale * 1.06, 1.1236);
    for (let row = 0; row < atlas.frames.length; row += 4) assert.equal(new Set(atlas.frameScales.slice(row, row + 4)).size, 1);
    assert.ok(atlas.frameScales.every(scale => scale > 0 && scale <= 1));
    assert.ok(atlas.frames[0][3] / atlas.referenceHeight * .92 < reference.frames[0][3] / height);
  }
  // Les huit pas de garde ne doivent pas rapetisser Roussel par rapport à la garde de combat.
  const { combat, movement } = MINOR_ANIMATION_DATA.roussel, guard = rendered(combat, 0);
  for (let frame = 0; frame < 8; frame++) assert.ok(Math.abs(rendered(movement, frame) / guard - 1) < .04, `pas ${frame}`);
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

test('Chaque frame des secondaires garde la taille de la même pose chez Philippe et Le Pen', () => {
  const HEIGHT = 1.1236, WIDTH = 1.06, images = {};
  // Surface affichée (racine), à l'échelle réelle du jeu, pour une frame d'une planche.
  const size = (faction, sheet, index) => {
    const atlas = sheet === 'combat' ? combatAtlasFor({ faction_id: faction }) : extraAtlasesFor({ faction_id: faction })[sheet];
    const image = images[atlas.sprite] ??= readPng(new URL(visualManifest[atlas.sprite].file));
    const [sx, sy, sw, sh] = atlas.frames[index];
    const scale = (atlas.frameScales?.[index] ?? 1) / (atlas.referenceHeight || (sheet === 'combat' ? 340 : 360));
    let opaque = 0;
    for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) if (image.data[(y * image.width + x) * 4 + 3] >= 90) opaque++;
    return Math.sqrt(opaque * scale * WIDTH * (atlas.widthScale || 1) * scale * HEIGHT * (sheet === 'combat' && !atlas.minor && index === 1 ? 1.055 : 1));
  };
  // Les secondaires n'ont pas les frames 8-9 (maintien) ni 14-15 (ultime) des actions.
  const referenceFrame = (sheet, index) => sheet === 'actions' && index >= 8 ? index + 2 : index;
  const reference = {};
  for (const sheet of ['combat', 'movement', 'actions']) reference[sheet] = Array.from({ length: sheet === 'actions' ? 12 : 16 },
    (_, index) => (size('philippe', sheet, referenceFrame(sheet, index)) + size('le_pen', sheet, referenceFrame(sheet, index))) / 2);
  for (const faction of Object.keys(MINOR_ANIMATION_FILES)) {
    const ratios = Object.entries(reference).flatMap(([sheet, sizes]) => sizes.map((value, index) => ({ sheet, index, ratio: size(faction, sheet, index) / value })));
    const median = ratios.map(r => r.ratio).sort((a, b) => a - b)[ratios.length >> 1];
    for (const { sheet, index, ratio } of ratios) assert.ok(Math.abs(ratio / median - 1) < .08, `${faction} · ${sheet} ${index} : ${Math.round(ratio / median * 100)} %`);
  }
});

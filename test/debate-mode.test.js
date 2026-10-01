import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { DebateMatch, debateModeAICommands, debateSetupError, debateStyleAvailable, debateFighterIds, multiplayerDebateSetup } from '../src/simulation/debate-mode.js';
import { hit } from '../src/simulation/combat-state.js';
import { verticalHit } from '../src/simulation/combat-actions.js';
import { DebateSimulation } from '../src/simulation/debate-simulation.js';
import { MINOR_FACTIONS } from '../src/simulation/world.js';
import { debateStyles } from '../src/simulation/debate-mode.js';
import { chooseCandidate, candidatesReady, startRoom } from '../src/network/lobby.js';
import { debateAssetIds } from '../src/presentation/debate-mode.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { DEBATE_ARENAS, arenaSupportHeight } from '../src/presentation/debate-arenas.js';
import { validateConfig } from '../src/config.js';
import { fallSafeCommands, predictLanding } from '../src/simulation/debate-navigation.js';

const config = validateConfig(campaignConfig());
const fighter = (faction, style) => ({ faction, style });
const duel = (map = 'studio', a = fighter('melenchon', 'melenchon_universaliste'), b = fighter('le_pen', 'le_pen_souverainiste')) => ({ format: '1v1', map, seed: 5, fighters: [a, b] });
const trio = map => ({ format: '1v1v1', map, seed: 9, fighters: [fighter('philippe', 'philippe_gestionnaire'), fighter('le_pen', 'le_pen_zemmouriste'), fighter('melenchon', 'melenchon_populiste')] });
// Profil sans déblocage : seul le premier style de chaque candidat est jouable.
const fresh = { nickname: 'Joueur' };

function started(setup) {
  const match = new DebateMatch(config, setup);
  while (match.state.phase === 'COUNTDOWN') match.step();
  return match;
}
const run = (match, commands = () => [], ticks = 1) => { for (let i = 0; i < ticks; i++) match.step(commands(match.state)); };

for (const map of Object.keys(DEBATE_ARENAS)) {
  test(`${map} : départ sur une surface réelle, visuel chargé, sortie de scène mortelle`, () => {
    const match = started(duel(map));
    const [player, enemy] = match.state.candidates;
    for (const c of new DebateMatch(config, trio(map)).state.candidates) {
      assert.ok(c.platform_id);
      assert.equal(arenaSupportHeight(match.state, c.x, c.combat.height), c.combat.height);
    }
    assert.ok(debateAssetIds(visualManifest, duel(map)).includes(DEBATE_ARENAS[map].asset));
    player.x = 1.3; player.platform_id = null;
    run(match, () => [{ type: 'Move', candidateId: player.id, axis: -1 }], 80);
    assert.equal(player.debate_hp, 0);
    assert.equal(player.is_ko, true);
    assert.equal(player.ko_reason, 'FALL');
    assert.equal(player.disappeared, true);
    assert.equal(match.state.winner_id, enemy.id);
    assert.ok(match.state.events.some(e => e.type === 'DebateFall' && e.candidate_id === player.id));
  });
}

test('Arène : marcher dans un trou tue ; sauter ce même trou permet d’atterrir sur la scène suivante', () => {
  for (const jump of [false, true]) {
    const match = started(duel('elysee'));
    const [player, enemy] = match.state.candidates;
    const left = match.state.platforms.find(p => p.id === 'scene-gauche');
    player.x = left.x + left.half_width - 0.4; enemy.x = 23;
    run(match, () => [{ type: 'Move', candidateId: player.id, axis: 1 }, ...(jump ? [{ type: 'Jump', candidateId: player.id }] : [])]);
    run(match, () => [{ type: 'Move', candidateId: player.id, axis: 1 }], 27);
    run(match, () => [{ type: 'Move', candidateId: player.id, axis: 0 }], 55);
    if (jump) {
      assert.equal(player.is_ko, false); assert.equal(player.platform_id, 'scene-centrale');
      assert.equal(player.combat.height, 0);
    } else { assert.equal(player.ko_reason, 'FALL'); assert.equal(player.is_ko, true); }
  }
});

test('Arène : quitter un balcon au-dessus d’une scène fait atterrir, sans K.O.', () => {
  const match = started(duel('elysee'));
  const player = match.state.candidates[0];
  const balcony = match.state.platforms.find(p => p.id === 'balcon-gauche');
  Object.assign(player, { x: balcony.x - balcony.half_width + 0.1, platform_id: balcony.id }); player.combat.height = balcony.height;
  run(match, () => [{ type: 'Move', candidateId: player.id, axis: -1 }], 4);
  run(match, () => [{ type: 'Move', candidateId: player.id, axis: 0 }], 45);
  assert.equal(player.platform_id, 'scene-gauche'); assert.equal(player.combat.height, 0);
  assert.equal(player.debate_hp, 100);
});

test('Face-à-face : une plateforme sous le niveau principal rattrape une chute', () => {
  const match = started(duel('face_a_face'));
  const player = match.state.candidates[0];
  const rescue = match.state.platforms.find(p => p.id === 'secours-gauche');
  player.x = rescue.x; player.platform_id = null;
  run(match, () => [], 30);
  assert.equal(player.combat.height, rescue.height); assert.equal(player.platform_id, rescue.id);
  assert.equal(player.is_ko, false);
  run(match, () => [{ type: 'Jump', candidateId: player.id }]);
  assert.ok(player.combat.height > rescue.height);
});

test('Arène : le coup plongeant dans un trou continue sous zéro et donne un K.O.', () => {
  const match = started(duel('elysee'));
  const player = match.state.candidates[0];
  player.x = 10.2; player.platform_id = null; player.combat.height = 0.5;
  player.combat.jump_tick = match.state.tick; player.combat.jump_base = 0;
  player.combat.dive_tick = match.state.tick; player.facing = -1;
  // Se placer hors de toute plateforme, même pendant le mouvement diagonal du plongeon.
  player.x = -3;
  run(match, () => [], 60);
  assert.equal(player.ko_reason, 'FALL'); assert.equal(player.is_ko, true);
});

test('Arène : dash et recul peuvent sortir de la scène malgré l’invulnérabilité', () => {
  for (const mode of ['dash', 'recul']) {
    const match = started(duel('remue_menage'));
    const player = match.state.candidates[0];
    player.x = 24.9;
    if (mode === 'dash') run(match, () => [{ type: 'Dash', candidateId: player.id, direction: 1 }]);
    else player.combat.knockback_velocity = 15;
    run(match, () => [], 90);
    assert.equal(player.ko_reason, 'FALL', mode);
  }
});

test('Arènes : l’IA franchit les trous et rejoint une cible située sur un autre îlot', () => {
  for (const map of ['elysee', 'ecologie']) {
    const match = started(duel(map));
    const [target, ai] = match.state.candidates;
    let reached = false;
    for (let i = 0; i < 450 && !ai.is_ko; i++) {
      match.step(debateModeAICommands(match.state, config, ai.id));
      if (ai.platform_id === target.platform_id) { reached = true; break; }
    }
    assert.ok(reached, map); assert.equal(ai.is_ko, false, map);
  }
});

test('Arènes : l’IA ne tombe jamais seule, où que se trouve son adversaire', () => {
  for (const map of ['elysee', 'face_a_face', 'remue_menage', 'ecologie']) for (const [i, platform] of config.balance.debate_mode.maps[map].platforms.entries()) {
    const match = started({ ...duel(map), seed: 3 + i });
    const [target, ai] = match.state.candidates;
    Object.assign(target, { x: platform.x, platform_id: platform.id }); target.combat.height = platform.height;
    for (let t = 0; t < 600 && match.state.phase !== 'OVER'; t++) match.step(debateModeAICommands(match.state, config, ai.id));
    assert.notEqual(ai.ko_reason, 'FALL', `${map} / ${platform.id}`);
  }
});

test('Arène : l’IA prévoit sa trajectoire avant de marcher, sauter ou dasher vers un trou', () => {
  const match = started(duel('elysee'));
  const ai = match.state.candidates[1];
  const left = match.state.platforms.find(p => p.id === 'scene-gauche');
  Object.assign(ai, { x: left.x + left.half_width - 0.3, platform_id: left.id, facing: 1 });
  assert.equal(predictLanding(match.state, config, ai, { axis: 1 }), null);
  assert.equal(predictLanding(match.state, config, ai, { axis: 1, jump: true })?.id, 'scene-centrale');
  const safe = fallSafeCommands(match.state, config, ai, [{ type: 'Move', candidateId: ai.id, axis: 1 }, { type: 'Dash', candidateId: ai.id, direction: 1 }]);
  assert.equal(safe.some(c => c.type === 'Dash'), false);
  assert.notEqual(safe.findLast(c => c.type === 'Move').axis, 1);
  // Repoussée vers le vide, l’IA arrête de frapper et lutte contre le recul.
  Object.assign(ai, { x: left.x + left.half_width - 1.2 }); ai.combat.knockback_velocity = 6;
  const pushed = fallSafeCommands(match.state, config, ai, [{ type: 'Move', candidateId: ai.id, axis: 1 }, { type: 'Attack', candidateId: ai.id, direction: 1 }]);
  assert.equal(pushed.some(c => c.type === 'Attack'), false);
  assert.equal(pushed.findLast(c => c.type === 'Move').axis, -1);
});

test('Arène à trois : une chute élimine seulement sa victime, deux chutes simultanées donnent un match nul', () => {
  const match = started(trio('elysee'));
  match.state.candidates[0].x = -2;
  run(match, () => [], 70);
  assert.equal(match.state.phase, 'FIGHT'); assert.equal(match.state.ko_order.length, 1);
  for (const c of match.state.candidates.filter(c => !c.is_ko)) { c.x = -2; c.platform_id = null; }
  run(match, () => [], 70);
  assert.equal(match.state.phase, 'OVER'); assert.equal(match.state.winner_id, null);
});

test('Les six candidats mineurs sont jouables : déplacement, coups et aucun ultime', () => {
  for (const faction of MINOR_FACTIONS) {
    const style = debateStyles(config, faction)[0];
    assert.equal(style.ultimate, null);
    assert.equal(debateStyleAvailable(config, fresh, faction, style.id), true);
    const setup = duel('plateau', fighter(faction, style.id));
    assert.equal(debateSetupError(config, setup, fresh), null);
    const match = started(setup), [player, enemy] = match.state.candidates;
    assert.equal(player.minor, true);
    const x = player.x;
    run(match, () => [{ type: 'Move', candidateId: player.id, axis: 1 }], 4);
    assert.ok(player.x > x);
    player.axis = 0; enemy.x = player.x + .5;
    run(match, () => [{ type: 'Attack', candidateId: player.id, direction: 1 }], 15);
    assert.ok(enemy.debate_hp < 100, faction);
    player.special_charge = 100;
    run(match, () => [{ type: 'ActivateUltimate', candidateId: player.id }]);
    assert.equal(player.ultimate_effect, null);
    assert.equal(match.state.powers.length, 0);
    const assets = debateAssetIds(visualManifest, setup);
    assert.ok(assets.includes(`minor-${faction}`));
    assert.ok(assets.includes(`character-minor-${faction}-combat`));
  }
});

test('Salon : candidats mineurs acceptés en Débat télé et exclus de la campagne', () => {
  const room = { mode: 'debate', phase: 'lobby', players: [{ id: 'a', slot: 1 }, { id: 'b', slot: 2 }] };
  chooseCandidate(room, 'a', 'arthaud', 'arthaud_standard');
  chooseCandidate(room, 'b', 'attal', 'attal_standard');
  assert.equal(candidatesReady(room), true);
  assert.throws(() => chooseCandidate(room, 'b', 'arthaud', 'arthaud_standard'), /autre joueur/);
  const setup = multiplayerDebateSetup(config, room, { format: '1v1v1', map: 'studio' });
  assert.equal(debateSetupError(config, setup), null);
  startRoom(room, setup);
  assert.equal(room.phase, 'loading');
  assert.deepEqual(new DebateMatch(config, room.debate).state.candidates.map(c => c.minor), [true, true, false]);
  const campaign = { mode: 'campaign', phase: 'lobby', players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  assert.throws(() => chooseCandidate(campaign, 'a', 'attal'), /disponible/);
});

test('Réglages : même candidat seulement avec un autre style, styles verrouillés sauf profil betatest', () => {
  assert.equal(debateSetupError(config, duel()), null);
  assert.equal(debateSetupError(config, duel('studio', fighter('melenchon', 'melenchon_universaliste'), fighter('melenchon', 'melenchon_populiste'))), null);
  assert.match(debateSetupError(config, duel('studio', fighter('melenchon', 'melenchon_universaliste'), fighter('melenchon', 'melenchon_universaliste'))), /autre style/);
  assert.match(debateSetupError(config, { ...duel(), fighters: [duel().fighters[0]] }), /2 combattants/);
  assert.match(debateSetupError(config, { ...duel(), map: 'inconnue' }), /carte/);
  const locked = duel('studio', fighter('melenchon', 'melenchon_populiste'));
  assert.match(debateSetupError(config, locked, fresh), /débloqué/);
  assert.equal(debateStyleAvailable(config, { nickname: ' BetaTest ' }, 'melenchon', 'melenchon_populiste'), true);
  assert.equal(debateSetupError(config, locked, { nickname: 'betatest' }), null);
  // L’IA peut utiliser n’importe quel style, même verrouillé pour le joueur.
  assert.equal(debateSetupError(config, duel('studio', fighter('melenchon', 'melenchon_universaliste'), fighter('le_pen', 'le_pen_gouvernement')), fresh), null);
});

test('Compte à rebours : aucune commande avant « Débattez ! », puis 100 PV chacun', () => {
  const match = new DebateMatch(config, duel());
  const player = match.state.candidates[0];
  const x = player.x;
  for (let i = 0; i < 10; i++) match.step([{ type: 'Move', candidateId: player.id, axis: 1 }]);
  assert.equal(match.state.phase, 'COUNTDOWN');
  assert.equal(match.state.candidates[0].x, x);
  while (match.state.phase === 'COUNTDOWN') match.step();
  assert.equal(match.state.phase, 'FIGHT');
  assert.ok(match.state.events.some(e => e.type === 'DebateFightStarted'));
  assert.deepEqual(match.state.candidates.map(c => c.debate_hp), [100, 100]);
  run(match, s => [{ type: 'Move', candidateId: s.candidates[0].id, axis: 1 }], 5);
  assert.ok(match.state.candidates[0].x > x);
});

test('Duel miroir : deux Mélenchon sont bien adversaires, identifiants distincts', () => {
  const match = started(duel('plateau', fighter('melenchon', 'melenchon_universaliste'), fighter('melenchon', 'melenchon_populiste')));
  const [a, b] = match.state.candidates;
  assert.deepEqual([a.id, b.id], ['candidate:melenchon', 'candidate:melenchon:2']);
  const debate = new DebateSimulation(config, match.state);
  b.x = a.x + 0.5; a.facing = 1;
  assert.ok(hit(debate, a, b, { kind: 'CANDIDATE', step: 1, damage: 1, knockback: 0, direction: 1 }, 'test'));
  assert.ok(b.debate_hp < 100);
});

test('Studio : on monte sur un pupitre, le sol ne touche pas un candidat perché, marcher dans le vide fait redescendre', () => {
  const match = started(duel());
  const [player, rival] = match.state.candidates;
  const desk = match.state.platforms.find(p => p.id === 'pupitre-gauche');
  player.x = desk.x; rival.x = 20.5;
  run(match, s => [{ type: 'Jump', candidateId: s.candidates[0].id }], 1);
  run(match, () => [], 40);
  assert.equal(player.platform_id, desk.id);
  assert.equal(player.combat.height, desk.height);
  assert.equal(player.combat.jump_tick, null);
  // Un coup donné depuis le sol passe sous les pieds du candidat perché.
  rival.x = desk.x + 0.5; rival.facing = -1;
  const debate = new DebateSimulation(config, match.state);
  assert.equal(hit(debate, rival, player, { kind: 'CANDIDATE', step: 1, damage: 1, knockback: 0, direction: -1 }, 'sol'), null);
  rival.x = 20.5;
  run(match, s => [{ type: 'Move', candidateId: s.candidates[0].id, axis: 1 }], 25);
  run(match, s => [{ type: 'Move', candidateId: s.candidates[0].id, axis: 0 }], 1);
  run(match, () => [], 30);
  assert.equal(player.platform_id, null);
  assert.equal(player.combat.height, 0);
});

test('Studio : le coup plongeant ne touche pas un adversaire perché que le sauteur n’a pas atteint', () => {
  const match = started(duel());
  const [player, rival] = match.state.candidates;
  const desk = match.state.platforms.find(p => p.id === 'pupitre-gauche');
  const dive = { kind: 'DIVE' };
  rival.combat.height = desk.height;
  player.combat.height = 0.5;
  assert.equal(verticalHit(config, player, rival, dive), false);
  player.combat.height = desk.height;
  assert.equal(verticalHit(config, player, rival, dive), true);
  rival.combat.height = 0;
  player.combat.height = 0.5;
  assert.equal(verticalHit(config, player, rival, dive), true);
});

test('Studio : marcher au-delà du bord d’un pupitre fait tomber', () => {
  const match = started(duel());
  const [player, rival] = match.state.candidates;
  const desk = match.state.platforms.find(p => p.id === 'pupitre-gauche');
  rival.x = 24; player.x = desk.x;
  run(match, s => [{ type: 'Jump', candidateId: s.candidates[0].id }], 1);
  run(match, () => [], 40);
  assert.equal(player.platform_id, desk.id);
  run(match, s => [{ type: 'Move', candidateId: s.candidates[0].id, axis: -1 }], 45);
  assert.ok(player.x < desk.x - desk.half_width);
  assert.equal(player.combat.height, 0);
  assert.equal(player.platform_id, null);
});

test('IA : elle passe par un pupitre latéral pour atteindre le bureau central', () => {
  const match = started(duel());
  const [player, ai] = match.state.candidates;
  const center = match.state.platforms.find(p => p.id === 'bureau-central');
  const path = new Set();
  for (let i = 0; i < 30 * 12 && ai.platform_id !== center.id; i++) {
    Object.assign(player, { x: center.x, platform_id: center.id, debate_hp: 100 }); player.combat.height = center.height; player.combat.jump_tick = null;
    match.step(debateModeAICommands(match.state, config, ai.id));
    if (ai.platform_id) path.add(ai.platform_id);
  }
  assert.equal(ai.platform_id, center.id);
  assert.ok(path.size >= 2, 'le bureau central n’est pas accessible directement depuis le sol');
});

test('1 contre 1 contre 1 : le combat continue après le premier K.O., dernier debout gagne', () => {
  for (const map of ['plateau', 'studio', ...Object.keys(DEBATE_ARENAS)]) {
    const match = started(trio(map));
    const limit = 30 * 240;
    while (match.state.phase !== 'OVER' && match.state.tick < limit) match.step(match.state.candidates.flatMap(c => debateModeAICommands(match.state, config, c.id)));
    const s = match.state;
    assert.equal(s.phase, 'OVER', map);
    assert.equal(s.ko_order.length, 2);
    assert.equal(s.events.at(-1).type, 'DebateFinished');
    const winner = s.candidates.find(c => c.id === s.winner_id);
    assert.ok(winner && !winner.is_ko);
    assert.ok(!s.ko_order.includes(winner.id));
    // Après la fin, la simulation finit les animations mais ne rejoue plus le combat.
    const hp = s.candidates.map(c => c.debate_hp);
    run(match, () => [{ type: 'Attack', candidateId: winner.id }], 60);
    assert.deepEqual(match.state.candidates.map(c => c.debate_hp), hp);
  }
});

test('Même graine, mêmes commandes : combat identique', () => {
  for (const map of ['studio', ...Object.keys(DEBATE_ARENAS)]) {
    const play = () => { const m = started(duel(map)); for (let i = 0; i < 600; i++) m.step(m.state.candidates.flatMap(c => debateModeAICommands(m.state, config, c.id))); return JSON.stringify(m.getState()); };
    assert.equal(play(), play(), map);
  }
});

test('Débat multijoueur : un combattant par joueur, une IA libre pour compléter le 1 contre 1 contre 1', () => {
  const room = { players: [{ id: 'b', slot: 2, faction: 'melenchon', style: 'melenchon_populiste' }, { id: 'a', slot: 1, faction: 'melenchon', style: 'melenchon_universaliste' }] };
  const duo = multiplayerDebateSetup(config, room, { format: '1v1', map: 'studio' });
  assert.deepEqual(duo.fighters.map(f => f.player), ['a', 'b']);
  assert.equal(duo.format, '1v1');
  assert.equal(debateSetupError(config, duo), null);
  const withAI = multiplayerDebateSetup(config, room, { format: '1v1v1', map: 'plateau' });
  assert.equal(withAI.format, '1v1v1');
  assert.equal(withAI.fighters[2].player, null);
  assert.notEqual(withAI.fighters[2].faction, 'melenchon', 'l’IA prend un candidat absent');
  assert.equal(debateSetupError(config, withAI), null);
  assert.deepEqual(debateFighterIds(withAI.fighters), ['candidate:melenchon', 'candidate:melenchon:2', `candidate:${withAI.fighters[2].faction}`]);
  const match = new DebateMatch(config, { ...withAI, seed: 3 });
  assert.deepEqual(match.state.candidates.map(c => c.id), debateFighterIds(withAI.fighters));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { DebateMatch, debateModeAICommands, debateSetupError, debateStyleAvailable, debateFighterIds, multiplayerDebateSetup } from '../src/simulation/debate-mode.js';
import { hit } from '../src/simulation/combat-state.js';
import { DebateSimulation } from '../src/simulation/debate-simulation.js';
import { MINOR_FACTIONS } from '../src/simulation/world.js';
import { debateStyles } from '../src/simulation/debate-mode.js';
import { chooseCandidate, candidatesReady, startRoom } from '../src/network/lobby.js';
import { debateAssetIds } from '../src/presentation/debate-mode.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';

const config = campaignConfig();
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

test('Studio : on monte sur un pupitre, le sol ne touche pas un candidat perché, ↓ fait redescendre', () => {
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
  for (const map of ['plateau', 'studio']) {
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
  const play = () => { const m = started(duel()); for (let i = 0; i < 600; i++) m.step(m.state.candidates.flatMap(c => debateModeAICommands(m.state, config, c.id))); return JSON.stringify(m.getState()); };
  assert.equal(play(), play());
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

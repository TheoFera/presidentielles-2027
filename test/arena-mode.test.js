import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { ArenaMatch, arenaModeAICommands, arenaSetupError, arenaStyleAvailable } from '../src/simulation/arena-mode.js';
import { hit } from '../src/simulation/combat-state.js';
import { ArenaSimulation } from '../src/simulation/arena-simulation.js';

const config = campaignConfig();
const fighter = (faction, style) => ({ faction, style });
const duel = (map = 'studio', a = fighter('melenchon', 'melenchon_universaliste'), b = fighter('le_pen', 'le_pen_souverainiste')) => ({ format: '1v1', map, seed: 5, fighters: [a, b] });
const trio = map => ({ format: '1v1v1', map, seed: 9, fighters: [fighter('philippe', 'philippe_gestionnaire'), fighter('le_pen', 'le_pen_zemmouriste'), fighter('melenchon', 'melenchon_populiste')] });
// Profil sans déblocage : seul le premier style de chaque candidat est jouable.
const fresh = { nickname: 'Joueur' };

function started(setup) {
  const match = new ArenaMatch(config, setup);
  while (match.state.phase === 'COUNTDOWN') match.step();
  return match;
}
const run = (match, commands = () => [], ticks = 1) => { for (let i = 0; i < ticks; i++) match.step(commands(match.state)); };

test('Réglages : même candidat seulement avec un autre style, styles verrouillés sauf profil betatest', () => {
  assert.equal(arenaSetupError(config, duel()), null);
  assert.equal(arenaSetupError(config, duel('studio', fighter('melenchon', 'melenchon_universaliste'), fighter('melenchon', 'melenchon_populiste'))), null);
  assert.match(arenaSetupError(config, duel('studio', fighter('melenchon', 'melenchon_universaliste'), fighter('melenchon', 'melenchon_universaliste'))), /autre style/);
  assert.match(arenaSetupError(config, { ...duel(), fighters: [duel().fighters[0]] }), /2 combattants/);
  assert.match(arenaSetupError(config, { ...duel(), map: 'inconnue' }), /carte/);
  const locked = duel('studio', fighter('melenchon', 'melenchon_populiste'));
  assert.match(arenaSetupError(config, locked, fresh), /débloqué/);
  assert.equal(arenaStyleAvailable(config, { nickname: ' BetaTest ' }, 'melenchon', 'melenchon_populiste'), true);
  assert.equal(arenaSetupError(config, locked, { nickname: 'betatest' }), null);
  // L’IA peut utiliser n’importe quel style, même verrouillé pour le joueur.
  assert.equal(arenaSetupError(config, duel('studio', fighter('melenchon', 'melenchon_universaliste'), fighter('le_pen', 'le_pen_gouvernement')), fresh), null);
});

test('Compte à rebours : aucune commande avant « Débattez ! », puis 100 PV chacun', () => {
  const match = new ArenaMatch(config, duel());
  const player = match.state.candidates[0];
  const x = player.x;
  for (let i = 0; i < 10; i++) match.step([{ type: 'Move', candidateId: player.id, axis: 1 }]);
  assert.equal(match.state.phase, 'COUNTDOWN');
  assert.equal(match.state.candidates[0].x, x);
  while (match.state.phase === 'COUNTDOWN') match.step();
  assert.equal(match.state.phase, 'FIGHT');
  assert.ok(match.state.events.some(e => e.type === 'ArenaFightStarted'));
  assert.deepEqual(match.state.candidates.map(c => c.arena_hp), [100, 100]);
  run(match, s => [{ type: 'Move', candidateId: s.candidates[0].id, axis: 1 }], 5);
  assert.ok(match.state.candidates[0].x > x);
});

test('Duel miroir : deux Mélenchon sont bien adversaires, identifiants distincts', () => {
  const match = started(duel('plateau', fighter('melenchon', 'melenchon_universaliste'), fighter('melenchon', 'melenchon_populiste')));
  const [a, b] = match.state.candidates;
  assert.deepEqual([a.id, b.id], ['candidate:melenchon', 'candidate:melenchon:2']);
  const arena = new ArenaSimulation(config, match.state);
  b.x = a.x + 0.5; a.facing = 1;
  assert.ok(hit(arena, a, b, { kind: 'CANDIDATE', step: 1, damage: 1, knockback: 0, direction: 1 }, 'test'));
  assert.ok(b.arena_hp < 100);
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
  const arena = new ArenaSimulation(config, match.state);
  assert.equal(hit(arena, rival, player, { kind: 'CANDIDATE', step: 1, damage: 1, knockback: 0, direction: -1 }, 'sol'), null);
  rival.x = 20.5;
  run(match, s => [{ type: 'DropDown', candidateId: s.candidates[0].id }], 1);
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
    Object.assign(player, { x: center.x, platform_id: center.id, arena_hp: 100 }); player.combat.height = center.height; player.combat.jump_tick = null;
    match.step(arenaModeAICommands(match.state, config, ai.id));
    if (ai.platform_id) path.add(ai.platform_id);
  }
  assert.equal(ai.platform_id, center.id);
  assert.ok(path.size >= 2, 'le bureau central n’est pas accessible directement depuis le sol');
});

test('1 contre 1 contre 1 : le combat continue après le premier K.O., dernier debout gagne', () => {
  for (const map of ['plateau', 'studio']) {
    const match = started(trio(map));
    const limit = 30 * 240;
    while (match.state.phase !== 'OVER' && match.state.tick < limit) match.step(match.state.candidates.flatMap(c => arenaModeAICommands(match.state, config, c.id)));
    const s = match.state;
    assert.equal(s.phase, 'OVER', map);
    assert.equal(s.ko_order.length, 2);
    assert.equal(s.events.at(-1).type, 'ArenaFinished');
    const winner = s.candidates.find(c => c.id === s.winner_id);
    assert.ok(winner && !winner.is_ko);
    assert.ok(!s.ko_order.includes(winner.id));
    // Après la fin, la simulation finit les animations mais ne rejoue plus le combat.
    const hp = s.candidates.map(c => c.arena_hp);
    run(match, () => [{ type: 'Attack', candidateId: winner.id }], 60);
    assert.deepEqual(match.state.candidates.map(c => c.arena_hp), hp);
  }
});

test('Même graine, mêmes commandes : combat identique', () => {
  const play = () => { const m = started(duel()); for (let i = 0; i < 600; i++) m.step(m.state.candidates.flatMap(c => arenaModeAICommands(m.state, config, c.id))); return JSON.stringify(m.getState()); };
  assert.equal(play(), play());
});

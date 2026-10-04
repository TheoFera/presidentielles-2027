import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { DebateMatch, debateModeAICommands, debateSetupError, debateStyleAvailable, debateFighterIds, multiplayerDebateSetup, debateThemes } from '../src/simulation/debate-mode.js';
import { hit } from '../src/simulation/combat-state.js';
import { updateActions, verticalHit } from '../src/simulation/combat-actions.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { DebateSimulation } from '../src/simulation/debate-simulation.js';
import { MINOR_FACTIONS } from '../src/simulation/world.js';
import { debateStyles } from '../src/simulation/debate-mode.js';
import { chooseCandidate, candidatesReady, startRoom, closeRoom } from '../src/network/lobby.js';
import { debateAssetIds } from '../src/presentation/debate-mode.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { DEBATE_ARENAS, arenaSupportHeight } from '../src/presentation/debate-arenas.js';
import { validateConfig } from '../src/config.js';
import { fallSafeCommands, predictLanding } from '../src/simulation/debate-navigation.js';

const config = validateConfig(campaignConfig());
// Carte de test (ancien studio retiré du jeu) : pupitres simples pour vérifier la physique des plateformes.
config.balance.debate_mode.maps.pupitres_test = {
  name: 'Pupitres (test)',
  platforms: [
    { id: 'pupitre-gauche', name: 'Pupitre gauche', x: 8, half_width: 1.4, height: 1 },
    { id: 'pupitre-droit', name: 'Pupitre droit', x: 20, half_width: 1.4, height: 1 },
    { id: 'bureau-central', name: 'Bureau du présentateur', x: 14, half_width: 1.9, height: 1.9 },
  ],
};
const fighter = (faction, style) => ({ faction, style });
const duel = (map = 'remue_menage', a = fighter('melenchon', 'melenchon_universaliste'), b = fighter('le_pen', 'le_pen_souverainiste')) => ({ format: '1v1', map, seed: 5, fighters: [a, b] });
const trio = map => ({ format: '1v1v1', map, seed: 9, fighters: [fighter('philippe', 'philippe_gestionnaire'), fighter('le_pen', 'le_pen_zemmouriste'), fighter('melenchon', 'melenchon_populiste')] });
// Profil sans déblocage : seul le premier style de chaque candidat est jouable.
const fresh = { nickname: 'Joueur' };

function started(setup) {
  const match = new DebateMatch(config, setup);
  while (match.state.phase === 'COUNTDOWN') match.step();
  return match;
}
const run = (match, commands = () => [], ticks = 1) => { for (let i = 0; i < ticks; i++) match.step(commands(match.state)); };

test('Saut commun : trajectoire identique en campagne, au premier tour et dans les quatre arènes', () => {
  const campaign = new GameSimulation(config, 42);
  campaign.state.buildings = [];
  const simulations = [campaign,
    new DebateSimulation(config, DebateSimulation.create(config, campaign.state)),
    ...Object.keys(DEBATE_ARENAS).map(map => {
      const match = started(duel(map));
      return new DebateSimulation(match.config, match.state);
    }),
  ];
  let reference = null;
  for (const sim of simulations) {
    const actor = sim.state.candidates[0];
    actor.x = 14; actor.platform_id = null;
    Object.assign(actor.combat, { jump_tick: sim.state.tick, jump_base: 0, height: 0 });
    const heights = [];
    const duration = sim.secondsToTicks(config.balance.candidate_combat.jump_duration_seconds);
    for (let tick = 0; tick < duration; tick++) {
      sim.state.tick++; updateActions(sim, actor); heights.push(actor.combat.height);
    }
    assert.ok(Math.abs(Math.max(...heights) - 1.6) < 0.003);
    if (reference) assert.deepEqual(heights, reference, sim.state.map_id ?? 'débat du premier tour');
    else reference = heights;
  }
});

test('Une arène ne peut pas réintroduire un réglage de saut individuel', () => {
  for (const key of ['jump_height', 'jump_duration_seconds']) {
    const invalid = structuredClone(config);
    invalid.balance.debate_mode.maps.remue_menage[key] = 2;
    assert.throws(() => validateConfig(invalid), /saut commun/);
  }
});

test('IA : sous un balcon étroit, sauter tout droit évite de rester bloqué au sol', () => {
  const match = started(duel('elysee'));
  const [actor, target] = match.state.candidates;
  const balcony = match.state.platforms.find(p => p.id === 'balcon-droit');
  actor.x = 21.03; actor.platform_id = 'scene-droite';
  target.x = 23.13; target.platform_id = balcony.id; target.combat.height = balcony.height;
  const commands = debateModeAICommands(match.state, config, actor.id);
  assert.ok(commands.some(c => c.type === 'Jump'));
  assert.equal(commands.find(c => c.type === 'Move').axis, 0);
  for (let i = 0; i < 40 && actor.platform_id !== balcony.id; i++) {
    match.step(debateModeAICommands(match.state, config, actor.id));
  }
  assert.equal(actor.platform_id, balcony.id);
});

test('Les deux balcons de chaque arène ont la même hauteur et se rejoignent avec le saut commun', () => {
  const heights = [];
  for (const map of Object.keys(DEBATE_ARENAS)) {
    for (const platform of config.balance.debate_mode.maps[map].platforms.filter(p => p.height > 0)) {
      heights.push([map, platform.height]);
      const match = started(duel(map));
      const actor = match.state.candidates[0];
      const floor = match.state.platforms.find(p => p.height === 0 && Math.abs(platform.x - p.x) <= p.half_width);
      assert.ok(floor);
      actor.x = platform.x; actor.combat.height = 0; actor.platform_id = floor.id;
      match.state.candidates[1].x = platform.x < 14 ? 23 : 5;
      run(match, () => [{ type: 'Jump', candidateId: actor.id }]);
      run(match, () => [], match.secondsToTicks(config.balance.candidate_combat.jump_duration_seconds) + 2);
      assert.equal(actor.platform_id, platform.id, `${map} : ${platform.id}`);
      assert.equal(actor.combat.height, platform.height);
    }
  }
  assert.equal(heights.length, 8);
  // Chaque balcon suit son dessin : même hauteur des deux côtés d’une arène, pas forcément d’une arène à l’autre.
  for (const map of Object.keys(DEBATE_ARENAS)) assert.equal(new Set(heights.filter(([m]) => m === map).map(([, h]) => h)).size, 1, map);
});

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
    // La chute termine le round (pas le débat) : l’adversaire le remporte.
    assert.equal(match.state.phase, 'ROUND_OVER');
    assert.equal(match.state.rounds[0].winner_id, enemy.id);
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

test('Arène à trois : une chute élimine seulement sa victime, deux chutes simultanées donnent un round nul', () => {
  const match = started(trio('elysee'));
  match.state.candidates[0].x = -2;
  run(match, () => [], 70);
  assert.equal(match.state.phase, 'FIGHT'); assert.equal(match.state.ko_order.length, 1);
  for (const c of match.state.candidates.filter(c => !c.is_ko)) { c.x = -2; c.platform_id = null; }
  run(match, () => [], 70);
  assert.equal(match.state.phase, 'ROUND_OVER'); assert.equal(match.state.rounds[0].winner_id, null);
  assert.deepEqual(match.state.candidates.map(c => c.rounds_won), [0, 0, 0]);
});

// Termine le round en cours : les perdants tombent à 0 PV, puis on attend le round suivant.
function finishRound(match, losers) {
  while (match.state.phase === 'COUNTDOWN') match.step();
  for (const id of losers) match.state.candidates.find(c => c.id === id).debate_hp = 0;
  match.step();
  while (match.state.phase === 'ROUND_OVER') match.step();
}

test('Thèmes : trois thèmes différents tirés de la graine, ou ceux choisis pour le salon', () => {
  const ids = config.balance.debate_mode.themes.map(t => t.id);
  for (const seed of [1, 5, 77, 123456]) {
    const themes = debateThemes(config, { ...duel(), seed });
    assert.equal(themes.length, 3); assert.equal(new Set(themes).size, 3);
    assert.ok(themes.every(id => ids.includes(id)));
    assert.deepEqual(debateThemes(config, { ...duel(), seed }), themes, 'même graine, mêmes thèmes');
  }
  assert.deepEqual(debateThemes(config, { ...duel(), themes: ['economie', 'immigration', 'ecologie'] }), ['economie', 'immigration', 'ecologie']);
  assert.notDeepEqual(debateThemes(config, { ...duel(), seed: 1, themes: ['economie', 'economie', 'ecologie'] }), ['economie', 'economie', 'ecologie']);
  assert.deepEqual(new DebateMatch(config, duel()).state.rounds.map(r => r.theme), debateThemes(config, duel()));
});

test('Toujours 3 rounds : tout repart à zéro entre deux thèmes, 2 – 1 donne la victoire', () => {
  const match = new DebateMatch(config, duel());
  const [a, b] = match.state.candidates.map(c => c.id);
  const start = match.state.candidates.map(c => c.x);
  assert.equal(match.state.phase, 'COUNTDOWN');
  match.step();
  assert.ok(match.state.events.some(e => e.type === 'DebateRoundStarted' && e.round === 1 && e.theme === match.state.rounds[0].theme));
  while (match.state.phase === 'COUNTDOWN') match.step();
  // Pendant le round : on se déplace, on charge l’ultime, on dashe.
  const first = match.state.candidates[0];
  first.x += 3; first.special_charge = 50; first.dash_charges = 0;
  finishRound(match, [b]);
  assert.equal(match.state.round_index, 1); assert.equal(match.state.phase, 'COUNTDOWN');
  const fresh = match.state.candidates[0];
  assert.deepEqual(match.state.candidates.map(c => c.x), start);
  assert.deepEqual(match.state.candidates.map(c => c.debate_hp), [100, 100]);
  assert.equal(fresh.special_charge, 0); assert.equal(fresh.dash_charges, config.balance.dash.max_charges);
  assert.deepEqual(match.state.candidates.map(c => c.rounds_won), [1, 0]);
  // Même 2 – 0, le troisième thème se joue.
  finishRound(match, [b]);
  assert.equal(match.state.round_index, 2); assert.notEqual(match.state.phase, 'OVER');
  finishRound(match, [a]);
  const s = match.state;
  assert.equal(s.phase, 'OVER'); assert.equal(s.rounds.length, 3);
  assert.equal(s.winner_id, a); assert.deepEqual(s.standings, [a, b]);
  assert.deepEqual(s.rounds.map(r => r.winner_id), [a, a, b]);
  assert.deepEqual(s.candidates.map(c => c.rounds_won), [2, 1]);
});

test('À trois, 1 – 1 – 1 : un round bonus « Question du public » départage', () => {
  const match = new DebateMatch(config, trio('remue_menage'));
  const [a, b, c] = match.state.candidates.map(x => x.id);
  finishRound(match, [b, c]);
  finishRound(match, [a, c]);
  finishRound(match, [a, b]);
  assert.equal(match.state.rounds.length, 4);
  assert.deepEqual(match.state.rounds[3], { theme: config.balance.debate_mode.bonus_theme.id, winner_id: null, bonus: true });
  assert.equal(match.state.round_index, 3); assert.equal(match.state.phase, 'COUNTDOWN');
  finishRound(match, [a, c]);
  assert.equal(match.state.phase, 'OVER'); assert.equal(match.state.winner_id, b); assert.equal(match.state.standings[0], b);
});

test('Les six candidats mineurs sont jouables : déplacement, coups et aucun ultime', () => {
  for (const faction of MINOR_FACTIONS) {
    const style = debateStyles(config, faction)[0];
    assert.equal(style.ultimate, null);
    // Verrouillés au départ, jouables une fois battus en campagne (déblocage).
    assert.equal(debateStyleAvailable(config, fresh, faction, style.id), false);
    const owner = { unlocked_minor_candidates: [faction] };
    assert.equal(debateStyleAvailable(config, owner, faction, style.id), true);
    const setup = duel('remue_menage', fighter(faction, style.id));
    assert.equal(debateSetupError(config, setup, fresh), 'Ce style n’est pas encore débloqué.');
    assert.equal(debateSetupError(config, setup, owner), null);
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
  // À deux, la sélection attend que l’hôte renonce au 3e joueur.
  assert.throws(() => chooseCandidate(room, 'a', 'arthaud', 'arthaud_standard'), /troisième joueur/);
  closeRoom(room);
  chooseCandidate(room, 'a', 'arthaud', 'arthaud_standard');
  chooseCandidate(room, 'b', 'attal', 'attal_standard');
  assert.equal(candidatesReady(room), true);
  assert.throws(() => chooseCandidate(room, 'b', 'arthaud', 'arthaud_standard'), /autre joueur/);
  const setup = multiplayerDebateSetup(config, room, { format: '1v1v1', map: 'remue_menage' });
  assert.equal(debateSetupError(config, setup), null);
  startRoom(room, setup);
  assert.equal(room.phase, 'loading');
  assert.deepEqual(new DebateMatch(config, room.debate).state.candidates.map(c => c.minor), [true, true, false]);
  const campaign = { mode: 'campaign', phase: 'lobby', players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  assert.throws(() => chooseCandidate(campaign, 'a', 'attal'), /disponible/);
});

test('Réglages : même candidat seulement avec un autre style, styles verrouillés sauf profil betatest', () => {
  assert.equal(debateSetupError(config, duel()), null);
  assert.equal(debateSetupError(config, duel('remue_menage', fighter('melenchon', 'melenchon_universaliste'), fighter('melenchon', 'melenchon_populiste'))), null);
  assert.match(debateSetupError(config, duel('remue_menage', fighter('melenchon', 'melenchon_universaliste'), fighter('melenchon', 'melenchon_universaliste'))), /autre style/);
  assert.match(debateSetupError(config, { ...duel(), fighters: [duel().fighters[0]] }), /2 combattants/);
  assert.match(debateSetupError(config, { ...duel(), map: 'inconnue' }), /carte/);
  const locked = duel('remue_menage', fighter('melenchon', 'melenchon_populiste'));
  assert.match(debateSetupError(config, locked, fresh), /débloqué/);
  assert.equal(debateStyleAvailable(config, { nickname: ' BetaTest ' }, 'melenchon', 'melenchon_populiste'), true);
  assert.equal(debateSetupError(config, locked, { nickname: 'betatest' }), null);
  // En solo, l’IA non plus ne peut pas jouer un candidat que le joueur n’a pas débloqué.
  assert.match(debateSetupError(config, duel('remue_menage', fighter('melenchon', 'melenchon_universaliste'), fighter('le_pen', 'le_pen_gouvernement')), fresh), /IA/);
  assert.equal(debateSetupError(config, duel('remue_menage', fighter('melenchon', 'melenchon_universaliste'), fighter('le_pen', 'le_pen_souverainiste')), fresh), null);
  assert.match(debateSetupError(config, duel('remue_menage', fighter('melenchon', 'melenchon_universaliste'), fighter('attal', 'attal_standard')), fresh), /IA/);
  // Multijoueur (pas de profil) : chacun a été vérifié sur son appareil, l’IA peut tout jouer.
  assert.equal(debateSetupError(config, duel('remue_menage', fighter('melenchon', 'melenchon_universaliste'), fighter('le_pen', 'le_pen_gouvernement'))), null);
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
  const match = started(duel('remue_menage', fighter('melenchon', 'melenchon_universaliste'), fighter('melenchon', 'melenchon_populiste')));
  const [a, b] = match.state.candidates;
  assert.deepEqual([a.id, b.id], ['candidate:melenchon', 'candidate:melenchon:2']);
  const debate = new DebateSimulation(config, match.state);
  b.x = a.x + 0.5; a.facing = 1;
  assert.ok(hit(debate, a, b, { kind: 'CANDIDATE', step: 1, damage: 1, knockback: 0, direction: 1 }, 'test'));
  assert.ok(b.debate_hp < 100);
});

test('Studio : on monte sur un pupitre, le sol ne touche pas un candidat perché, marcher dans le vide fait redescendre', () => {
  const match = started(duel('pupitres_test'));
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
  const match = started(duel('pupitres_test'));
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
  const match = started(duel('pupitres_test'));
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
  const match = started(duel('pupitres_test'));
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

test('1 contre 1 contre 1 : le round continue après le premier K.O., dernier debout le gagne', () => {
  for (const map of [...Object.keys(DEBATE_ARENAS)]) {
    const match = started(trio(map));
    const limit = 30 * 400;
    while (match.state.phase !== 'OVER' && match.state.tick < limit) match.step(match.state.candidates.flatMap(c => debateModeAICommands(match.state, config, c.id)));
    const s = match.state;
    assert.equal(s.phase, 'OVER', map);
    assert.equal(s.events.at(-1).type, 'DebateFinished');
    // Dernier round : le dernier debout le remporte.
    const last = s.rounds.at(-1).winner_id;
    if (last) {
      assert.equal(s.ko_order.length, 2);
      assert.ok(!s.candidates.find(c => c.id === last).is_ko && !s.ko_order.includes(last));
    }
    // Le débat revient à celui qui a gagné le plus de rounds.
    const winner = s.candidates.find(c => c.id === s.standings[0]);
    assert.equal(winner.rounds_won, Math.max(...s.candidates.map(c => c.rounds_won)));
    // Après la fin, la simulation finit les animations mais ne rejoue plus le combat.
    const hp = s.candidates.map(c => c.debate_hp);
    run(match, () => [{ type: 'Attack', candidateId: winner.id }], 60);
    assert.deepEqual(match.state.candidates.map(c => c.debate_hp), hp);
  }
});

test('Même graine, mêmes commandes : combat identique', () => {
  for (const map of [...Object.keys(DEBATE_ARENAS)]) {
    const play = () => { const m = started(duel(map)); for (let i = 0; i < 600; i++) m.step(m.state.candidates.flatMap(c => debateModeAICommands(m.state, config, c.id))); return JSON.stringify(m.getState()); };
    assert.equal(play(), play(), map);
  }
});

test('Débat multijoueur : un combattant par joueur, une IA libre pour compléter le 1 contre 1 contre 1', () => {
  const room = { players: [{ id: 'b', slot: 2, faction: 'melenchon', style: 'melenchon_populiste' }, { id: 'a', slot: 1, faction: 'melenchon', style: 'melenchon_universaliste' }] };
  const duo = multiplayerDebateSetup(config, room, { format: '1v1', map: 'remue_menage' });
  assert.deepEqual(duo.fighters.map(f => f.player), ['a', 'b']);
  assert.equal(duo.format, '1v1');
  assert.equal(debateSetupError(config, duo), null);
  const withAI = multiplayerDebateSetup(config, room, { format: '1v1v1', map: 'elysee' });
  assert.equal(withAI.format, '1v1v1');
  assert.equal(withAI.fighters[2].player, null);
  assert.notEqual(withAI.fighters[2].faction, 'melenchon', 'l’IA prend un candidat absent');
  assert.equal(debateSetupError(config, withAI), null);
  assert.deepEqual(debateFighterIds(withAI.fighters), ['candidate:melenchon', 'candidate:melenchon:2', `candidate:${withAI.fighters[2].faction}`]);
  const match = new DebateMatch(config, { ...withAI, seed: 3 });
  assert.deepEqual(match.state.candidates.map(c => c.id), debateFighterIds(withAI.fighters));
});

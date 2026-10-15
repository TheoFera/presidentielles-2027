import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { activateUltimate, beginCombatTick, updateCombat, requestAttack, cancelCurrentAttack, wallBlockedPosition, ultimateBlockedReason, separateCandidates } from '../src/simulation/combat.js';
import { nearestEnemy, hit, combatState } from '../src/simulation/combat-state.js';
import { MINOR_ULTIMATES, pendingSatchel } from '../src/simulation/minor-ultimate-catalog.js';
import { barrierBlockedPosition } from '../src/simulation/minor-ultimates.js';
import { aiCombatCommands } from '../src/simulation/ai-combat.js';
import { debateModeTarget } from '../src/simulation/debate-mode.js';
import { candidateOpacity, flattenScale } from '../src/presentation/personnages/candidate-visibility.js';
import { minorUltimateAtlases } from '../src/presentation/effets/minor-ultimate-art.js';
import { visualManifest } from '../src/presentation/rendu/visual-manifest.js';
import { readPng } from '../scripts/lib/png.mjs';
import { CampaignPrediction } from '../src/network/campaign-prediction.js';
import { encodePresentationState } from '../src/network/state-stream.js';
import { retireMinorsForSecondRound } from '../src/simulation/minor-candidates.js';

const config = campaignConfig();
function setup(faction) {
  const sim = new GameSimulation(config, 42), owner = sim.state.candidates.find(c => c.faction_id === faction);
  const target = sim.state.candidates.find(c => c.faction_id === 'philippe');
  sim.state.tick = 120; sim.state.npcs = [];
  for (const c of sim.state.candidates) { c.x = 200; c.campaign_active = true; }
  owner.x = 100; owner.facing = 1; owner.special_charge = config.balance.special_charge.required_points;
  target.x = 104; target.resistance = 100;
  sim.state.local_candidate_id = owner.id;
  return { sim, owner, target };
}
function tick(sim, count = 1) {
  for (let n = 0; n < count; n++) { sim.state.tick++; beginCombatTick(sim); updateCombat(sim); }
}

for (const [faction, ultimate] of Object.entries(MINOR_ULTIMATES)) {
  test(`${faction} : ultime personnel, consommation unique et sauvegarde reproductible`, () => {
    const sim = new GameSimulation(config, 42), owner = sim.state.candidates.find(c => c.faction_id === faction);
    owner.special_charge = config.balance.special_charge.required_points;
    assert.equal(ultimateBlockedReason(sim, owner), null);
    activateUltimate(sim, owner); tick(sim, 3);
    assert.equal(owner.special_charge, 0);
    assert.equal(sim.state.powers.at(-1)?.kind, ultimate.kind);
    const copy = new GameSimulation(config, 42); copy.importSnapshot(sim.exportSnapshot());
    assert.deepEqual(copy.state, sim.state);
    tick(sim, 30); tick(copy, 30); assert.deepEqual(copy.state, sim.state);
  });
}

test('Roussel : pousse à l’aller, touche une fois par trajet et ramène au retour', () => {
  const { sim, owner, target } = setup('roussel'); target.x = 102;
  activateUltimate(sim, owner);
  while (!sim.state.hit_results.length) tick(sim);
  assert.ok(target.combat.knockback_velocity > 0);
  const firstHp = target.resistance; tick(sim, 4); assert.equal(target.resistance, firstHp);
  while (!sim.state.powers[0].returning) tick(sim);
  target.x = 105; const before = target.x;
  while (sim.state.powers.length) tick(sim);
  assert.equal(sim.state.hit_results.filter(h => h.target_id === target.id).length, 2);
  assert.ok(target.x < before && Math.abs(target.x - owner.x) <= 1.1);
});

test('NDA : disparition progressive, joueur visible, IA aveugle et attaques de zone toujours possibles', () => {
  const { sim, owner, target } = setup('dupont_aignan'); target.x = 101;
  target.combat.target_id = owner.id; activateUltimate(sim, owner);
  assert.equal(target.combat.target_id, null);
  assert.equal(candidateOpacity(owner, sim.state, config), 1);
  tick(sim, sim.secondsToTicks(.35));
  assert.equal(candidateOpacity(owner, sim.state, config), .28);
  const otherView = { ...sim.state, local_candidate_id: target.id };
  assert.equal(candidateOpacity(owner, otherView, config), 0);
  assert.equal(nearestEnemy(sim.state, target, 3), null);
  assert.equal(debateModeTarget(sim.state, config, target)?.id === owner.id, false);
  const bubble = { id: 'projectile:test', kind: 'BUBBLE', owner_id: target.id, faction_id: target.faction_id,
    target_id: owner.id, x: 97, direction: -1, speed: 8, remaining_range: 5, hit_ids: [], damage: 1, knockback: 0, electoral_damage: 0 };
  sim.state.projectiles.push(bubble); tick(sim);
  assert.equal(bubble.direction, -1, 'Une bulle déjà lancée cesse de suivre une cible devenue invisible.');
  assert.ok(hit(sim, target, owner, { damage: 1, knockback: 0, area_height: .5, area_radius: 1 }, 'zone'));
  owner.combat = combatState(); cancelCurrentAttack(sim, owner); requestAttack(sim, owner); tick(sim);
  assert.equal(owner.ultimate_effect, null);
  assert.equal(candidateOpacity(owner, { ...sim.state, local_candidate_id: target.id }, config), 0);
  tick(sim, sim.secondsToTicks(.35));
  assert.equal(candidateOpacity(owner, { ...sim.state, local_candidate_id: target.id }, config), 1);
});

test('NDA : réapparition après cinq secondes, même sans attaque', () => {
  const { sim, owner } = setup('dupont_aignan'); activateUltimate(sim, owner);
  tick(sim, sim.secondsToTicks(5)); assert.equal(owner.ultimate_effect, null);
  assert.equal(owner.reveal_tick, sim.state.tick);
});

test('Glucksmann : appel sans dégâts puis trois livraisons annoncées, chacune une seule fois', () => {
  const { sim, owner, target } = setup('glucksmann'); activateUltimate(sim, owner);
  const power = sim.state.powers[0];
  tick(sim, sim.secondsToTicks(config.balance.minor_ultimates.delivery.call_seconds));
  assert.equal(target.resistance, 100);
  for (const drop of power.impacts) {
    target.x = drop.x; target.combat = combatState();
    while (sim.state.tick < drop.tick) tick(sim);
    assert.equal(drop.done, true);
  }
  assert.equal(sim.state.hit_results.filter(h => h.target_id === target.id).length, 3);
  assert.equal(target.resistance, 61);
});

test('Arthaud : portée accrue, faucille qui attire, marteau qui aplatit plusieurs adversaires', () => {
  const { sim, owner, target } = setup('arthaud'); target.x = 102;
  activateUltimate(sim, owner); cancelCurrentAttack(sim, owner); requestAttack(sim, owner);
  while (!sim.state.hit_results.length) tick(sim);
  assert.ok(target.combat.knockback_velocity < 0);
  assert.equal(sim.state.attacks[0].tool, 'SICKLE');
  cancelCurrentAttack(sim, owner); owner.combat.hitstop_ticks = 0;
  target.combat = combatState(); target.x = 102;
  const other = sim.state.candidates.find(c => c.faction_id === 'le_pen'); other.x = 102.1;
  requestAttack(sim, owner);
  while (target.combat.flatten_tick == null) tick(sim);
  assert.equal(other.combat.flatten_tick, target.combat.flatten_tick);
  tick(sim, 4); assert.ok(flattenScale(target, sim.state.tick).y < .4);
  tick(sim, sim.secondsToTicks(config.balance.minor_ultimates.tools.flatten_seconds));
  assert.deepEqual(flattenScale(target, sim.state.tick), { x: 1, y: 1 });
});

test('Retailleau : mur entre les candidats, obstacle dans les deux sens et saut suffisamment haut', () => {
  const { sim, owner, target } = setup('retailleau'); activateUltimate(sim, owner);
  const wall = sim.state.powers[0]; assert.ok(wall.x > owner.x && wall.x < target.x);
  assert.ok(wallBlockedPosition(sim, owner, 106) < wall.x);
  assert.ok(barrierBlockedPosition(sim, target, 100) > wall.x);
  const rival = sim.state.candidates.find(c => c.faction_id === 'le_pen');
  cancelCurrentAttack(sim, owner); owner.x = wall.x - .76; rival.x = owner.x - .2;
  separateCandidates(sim); assert.ok(owner.x <= wall.x - .75);
  rival.x = 200; owner.x = 100;
  owner.combat.height = config.balance.minor_ultimates.barrier.height - .01;
  assert.ok(wallBlockedPosition(sim, owner, 106) < wall.x);
  owner.combat.height += .02;
  assert.equal(wallBlockedPosition(sim, owner, 106), 106);
  owner.combat.height = 0; target.x = wall.x + 1;
  while (sim.state.tick < wall.fall_tick) tick(sim);
  assert.equal(wallBlockedPosition(sim, owner, 106), 106);
  tick(sim, sim.secondsToTicks(.65));
  assert.equal(sim.state.hit_results.filter(h => h.target_id === target.id).length, 1);
  assert.ok(target.combat.knockback_velocity > 0);
});

test('Attal : priorité au candidat, aucun dégât à l’atterrissage, second appui manuel ou IA', () => {
  const { sim, owner, target } = setup('attal');
  sim.state.npcs = [{ id: 'npc:proche', role: 'MILITANT', faction_id: 'philippe', x: 101, combat: combatState(), hidden_durability: 100 }];
  activateUltimate(sim, owner); const bag = pendingSatchel(sim.state, owner);
  assert.equal(bag.target_id, target.id); activateUltimate(sim, owner); assert.equal(bag.detonated_tick, undefined);
  while (!bag.landed) tick(sim);
  assert.equal(target.resistance, 100); assert.equal(owner.special_charge, 0);
  assert.equal(ultimateBlockedReason(sim, owner), null);
  cancelCurrentAttack(sim, owner);
  assert.ok(aiCombatCommands(sim.state, config, owner, target).some(c => c.type === 'ActivateUltimate'));
  activateUltimate(sim, owner);
  assert.equal(target.resistance, 75); const hp = target.resistance;
  activateUltimate(sim, owner); tick(sim, 5); assert.equal(target.resistance, hp);
});

test('Vague : le corps derrière le front touche dans les deux directions, sans double dégât', () => {
  for (const direction of [-1, 1]) {
    const { sim, target } = setup('roussel');
    const owner = sim.state.candidates.find(c => c.faction_id === 'le_pen');
    owner.x = 100; owner.facing = direction; owner.current_campaign_style = 'le_pen_souverainiste'; owner.special_charge = 100;
    activateUltimate(sim, owner); const wave = sim.state.projectiles[0];
    sim.state.tick = wave.launch_tick; wave.launched = true; wave.x = 105;
    target.x = 105 - direction * 1.8;
    updateCombat(sim); assert.ok(target.resistance < 100);
    const hp = target.resistance; tick(sim, 5); assert.equal(target.resistance, hp);
  }
});

test('Images des ultimes : transparence, découpes complètes et costume de Philippe cohérent', () => {
  for (const atlas of Object.values(minorUltimateAtlases)) {
    const image = readPng(new URL(visualManifest[atlas.sprite].file));
    assert.ok(image.data.some((value, index) => index % 4 === 3 && value === 0));
    for (const [x,y,w,h] of atlas.frames) assert.ok(x >= 0 && y >= 0 && x+w <= image.width && y+h <= image.height);
  }
  assert.equal(visualManifest['character-style-philippe-gestionnaire'].file, visualManifest['character-philippe'].file);
});

test('Invité : le mur bloque aussi les déplacements prédits et l’invisibilité traverse le réseau', () => {
  const { sim, owner, target } = setup('retailleau'); activateUltimate(sim, owner);
  const wall = sim.state.powers[0], prediction = new CampaignPrediction(config, target.id);
  target.x = wall.x + 1; sim.state.input_acks = { [target.id]: 0 };
  prediction.authoritative(encodePresentationState(sim.state));
  for (let i = 0; i < 20; i++) prediction.step([{ type: 'Move', axis: -1 }]);
  assert.ok(prediction.x > wall.x);
  const hidden = setup('dupont_aignan'); activateUltimate(hidden.sim, hidden.owner); tick(hidden.sim, 15);
  const network = encodePresentationState(hidden.sim.state); network.local_candidate_id = hidden.target.id;
  assert.equal(candidateOpacity(network.candidates.find(c => c.id === hidden.owner.id), network, config), 0);
});

test('Retrait au second tour : aucun cartable, mur ou effet temporaire orphelin', () => {
  const sim = new GameSimulation(config, 42);
  for (const owner of sim.state.candidates.filter(c => c.minor)) { owner.special_charge = 100; activateUltimate(sim, owner); }
  assert.equal(sim.state.powers.length, 6);
  retireMinorsForSecondRound(sim);
  assert.equal(sim.state.powers.length, 0);
  assert.ok(sim.state.candidates.filter(c => c.minor).every(c => !c.ultimate_effect && !c.combat.attack_id));
});

test('Sauvegarde de cartable malformée : rejet atomique', () => {
  const sim = new GameSimulation(config, 42), owner = sim.state.candidates.find(c => c.faction_id === 'attal');
  owner.special_charge = 100; activateUltimate(sim, owner); tick(sim, 12);
  const before = sim.exportSnapshot(), invalid = JSON.parse(before);
  invalid.powers.find(p => p.kind === 'SATCHEL').height = -1;
  assert.throws(() => sim.importSnapshot(invalid));
  assert.equal(sim.exportSnapshot(), before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { ArenaSimulation } from '../src/simulation/arena-simulation.js';
import { CampaignStyleSystem, CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';
import { attackInput, beginCombatTick, updateCombat, activateUltimate, ultimateBlockedReason } from '../src/simulation/combat.js';
import { armored, verticalHit } from '../src/simulation/combat-actions.js';
import { hit, movementBlocked } from '../src/simulation/combat-state.js';
import { requestDash } from '../src/simulation/mobile-combat.js';
import { LocalHumanController } from '../src/simulation/controllers.js';
import { sanitizeCommands } from '../src/network/shared-commands.js';
import { aiCombatCommands } from '../src/simulation/ai-combat.js';

function setup(arena = false) {
  let sim = new GameSimulation(campaignConfig(), 42);
  sim.state.npcs = []; sim.state.ai_enabled = false;
  sim.state.candidates.forEach((c, i) => { c.x = 100 + 100 * i; c.axis = 0; c.money = 0; });
  CampaignStyleSystem.select(sim, sim.state.candidates[0], CAMPAIGN_STYLES[sim.state.candidates[0].faction_id][0].id, true);
  if (arena) sim = new ArenaSimulation(sim.config, ArenaSimulation.create(sim.config, sim.state));
  const [c, enemy] = sim.state.candidates;
  c.x = arena ? 8 : 100; enemy.x = c.x + 1; c.facing = 1;
  return { sim, c, enemy };
}
function ticks(sim, count, combat = false) {
  for (let i = 0; i < count; i++) { sim.state.tick++; beginCombatTick(sim); if (combat) updateCombat(sim); }
}
const input = (sim, c, type) => sim.applyCommand({ type, candidateId: c.id });

test('Charge : seuils configurés à la tick près, aucun coup avant relâchement', () => {
  const baseline = setup().sim;
  const activation = baseline.secondsToTicks(baseline.config.balance.candidate_combat.charge_activation_seconds);
  const ready = baseline.secondsToTicks(baseline.config.balance.candidate_combat.charge_ready_seconds);
  for (const duration of [0, activation - 1, activation, ready - 1, ready, ready + 60]) {
    const { sim, c } = setup();
    input(sim, c, 'PressAttack'); ticks(sim, duration);
    assert.equal(c.combat.charge_active, duration >= activation);
    assert.equal(movementBlocked(c), duration >= activation);
    assert.equal(sim.state.attacks.length, 0);
    input(sim, c, 'ReleaseAttack'); updateCombat(sim);
    assert.equal(sim.state.attacks[0]?.kind, duration >= ready ? 'CHARGED' : 'CANDIDATE');
    assert.equal(c.combat.press_tick, null);
  }
});

test('Protection : dégâts reçus, aucun recul/stun, seul le troisième coup brise la charge', () => {
  const { sim, c, enemy } = setup();
  input(sim, c, 'PressAttack'); ticks(sim, 6);
  for (const spec of [{ kind: 'CANDIDATE', step: 1 }, { kind: 'CHARGED', strong: true }, { kind: 'WAVE', strong: true }]) {
    hit(sim, enemy, c, { ...spec, damage: 3, knockback: 5 }, 'test');
    assert.equal(c.combat.stun_ticks, 0); assert.equal(c.combat.knockback_velocity, 0);
    assert.equal(c.combat.hitstop_ticks, 0); assert.equal(c.combat.charge_active, true);
  }
  assert.equal(c.resistance, 91);
  hit(sim, enemy, c, { kind: 'CANDIDATE', step: 3, strong: true, damage: 14, knockback: 18 }, 'third');
  assert.equal(c.combat.press_tick, null); assert.ok(c.combat.stun_ticks > 0); assert.equal(Math.abs(c.combat.knockback_velocity), 18);
  input(sim, c, 'ReleaseAttack'); assert.equal(c.combat.buffer_until_tick, -1);
});

test('La frappe chargée reste protégée jusqu’à sa récupération ; un KO reste possible', () => {
  const { sim, c, enemy } = setup(); input(sim, c, 'PressAttack'); ticks(sim, sim.secondsToTicks(sim.config.balance.candidate_combat.charge_ready_seconds)); input(sim, c, 'ReleaseAttack');
  const attack = sim.state.attacks[0];
  assert.equal(armored(sim.state, c), true);
  attack.elapsed_ticks = attack.windup_ticks + attack.active_ticks;
  assert.equal(armored(sim.state, c), false);
  hit(sim, enemy, c, { kind: 'CANDIDATE', damage: 1, knockback: 0 }, 'recovery');
  assert.equal(c.combat.attack_id, null);
  ticks(sim, 10); input(sim, c, 'PressAttack'); ticks(sim, 6);
  hit(sim, enemy, c, { damage: 200, knockback: 0 }, 'ko');
  assert.equal(c.is_ko, true); assert.equal(c.combat.charge_active, false);
});

for (const arena of [false, true]) test(`Coup chargé : dégâts, zéro recul, neuf ticks de stun et deux points d’ultime (${arena ? 'arène' : 'campagne'})`, () => {
  const { sim, c, enemy } = setup(arena);
  const before = arena ? enemy.arena_hp : enemy.resistance;
  input(sim, c, 'PressAttack'); ticks(sim, sim.secondsToTicks(sim.config.balance.candidate_combat.charge_ready_seconds)); input(sim, c, 'ReleaseAttack'); ticks(sim, 4, true);
  assert.ok(Math.abs(before - (arena ? enemy.arena_hp : enemy.resistance) - (arena ? 1.65 : 21)) < 1e-9);
  assert.equal(enemy.combat.knockback_velocity, 0); assert.equal(enemy.combat.stun_ticks, 9);
  assert.equal(c.special_charge, 2); assert.equal(c.combat.combo_step, 0);
});

test('Dash : annule seulement s’il peut partir, sans frappe fantôme au relâchement', () => {
  const { sim, c } = setup(); input(sim, c, 'PressAttack'); ticks(sim, sim.secondsToTicks(sim.config.balance.candidate_combat.charge_ready_seconds));
  c.dash_charges = 0; requestDash(sim, c, 1); assert.equal(c.combat.charge_active, true);
  c.dash_charges = 1; requestDash(sim, c, 1); assert.equal(c.combat.charge_active, false); assert.equal(c.dash_active, true);
  input(sim, c, 'ReleaseAttack'); ticks(sim, 20, true); assert.equal(sim.state.attacks.length, 0);
});

test('Troisième coup : sort de la portée de mêlée ; recul limité aux bords de l’arène', () => {
  for (const arena of [false, true]) {
    const { sim, c, enemy } = setup(arena);
    hit(sim, c, enemy, { kind: 'CANDIDATE', step: 3, strong: true, damage: 14, knockback: sim.config.balance.candidate_combat.finisher_knockback }, 'third');
    ticks(sim, 30);
    assert.ok(enemy.x - c.x > sim.config.balance.candidate_combat.finisher_range + sim.config.balance.candidate_combat.target_radius);
    if (arena) assert.ok(enemy.x <= sim.state.arena_bounds.max);
  }
});

test('Saut : hauteur et durée configurées, attaques possibles, pas de dash ni double saut', () => {
  const { sim, c, enemy } = setup();
  const duration = sim.secondsToTicks(sim.config.balance.candidate_combat.jump_duration_seconds);
  const half = Math.floor(duration / 2);
  input(sim, c, 'Jump'); ticks(sim, half);
  const expected = sim.config.balance.candidate_combat.jump_height_ratio * 4 * (half / duration) * (1 - half / duration);
  assert.equal(c.combat.height, expected);
  input(sim, c, 'Jump'); assert.equal(c.combat.jump_tick, 0);
  requestDash(sim, c, 1); assert.equal(c.dash_active, false);
  assert.equal(verticalHit(sim.config, enemy, c, { kind: 'CANDIDATE' }), false);
  assert.equal(verticalHit(sim.config, enemy, c, { kind: 'WAVE' }), expected <= 1.65);
  assert.equal(hit(sim, enemy, c, { kind: 'VERBAL', damage: 8, knockback: 0 }, 'miss'), null);
  input(sim, c, 'PressAttack'); input(sim, c, 'ReleaseAttack'); updateCombat(sim);
  assert.equal(sim.state.attacks[0].kind, 'CANDIDATE'); assert.equal(movementBlocked(c), false);
  ticks(sim, duration - half); assert.equal(c.combat.height, 0); assert.equal(c.combat.jump_tick, null);
  assert.equal(verticalHit(sim.config, enemy, c, { kind: 'VERBAL' }), true);
});

test('Maintien commencé en vol : ne devient pas une charge à l’atterrissage', () => {
  const { sim, c } = setup(); input(sim, c, 'Jump'); input(sim, c, 'PressAttack'); updateCombat(sim);
  assert.equal(sim.state.attacks[0].windup_ticks, 0);
  ticks(sim, 60, true);
  assert.equal(c.combat.charge_active, false); input(sim, c, 'ReleaseAttack'); updateCombat(sim);
  assert.equal(sim.state.attacks.length, 0);
});

for (const arena of [false, true]) test(`Saut prioritaire et frappe aérienne immédiate (${arena ? 'arène' : 'campagne'})`, () => {
  for (const phase of ['windup','active','recovery','charge','dash']) {
    const { sim, c, enemy } = setup(arena); enemy.x = c.x + 10;
    if (phase === 'dash') requestDash(sim,c,1);
    else {
      input(sim,c,'PressAttack');
      if (phase === 'charge') ticks(sim,6);
      else {
        input(sim,c,'ReleaseAttack'); updateCombat(sim);
        const a=sim.state.attacks[0]; a.elapsed_ticks=phase==='windup'?0:phase==='active'?a.windup_ticks:a.windup_ticks+a.active_ticks;
        c.combat.hitstop_ticks=2;
      }
    }
    input(sim,c,'Jump');
    assert.equal(c.combat.jump_tick,sim.state.tick,phase);
    assert.equal(c.combat.attack_id,null); assert.equal(sim.state.attacks.length,0);
    assert.equal(c.dash_active,false); assert.equal(c.combat.hitstop_ticks,0);
    input(sim,c,'ReleaseAttack'); assert.equal(c.combat.buffer_until_tick,-1);
    input(sim,c,'PressAttack'); updateCombat(sim);
    assert.equal(sim.state.attacks.length,1); assert.equal(sim.state.attacks[0].windup_ticks,0);
    input(sim,c,'ReleaseAttack'); assert.equal(c.combat.buffer_until_tick,-1);
  }
});

test('Dash immédiat en récupération : annulation atomique, refus sans réserve ou pendant un stun', () => {
  for (const arena of [false,true]) {
    const {sim,c}=setup(arena);
    input(sim,c,'PressAttack');input(sim,c,'ReleaseAttack');updateCombat(sim);
    const a=sim.state.attacks[0];a.elapsed_ticks=a.windup_ticks+a.active_ticks;c.combat.hitstop_ticks=2;
    c.dash_charges=0;requestDash(sim,c,1);assert.equal(c.combat.attack_id,a.id);
    c.dash_charges=1;c.combat.stun_ticks=3;requestDash(sim,c,1);assert.equal(c.combat.attack_id,a.id);
    input(sim,c,'Jump');assert.equal(c.combat.jump_tick,null);
    c.combat.stun_ticks=0;requestDash(sim,c,1);assert.equal(c.dash_active,true);
    assert.equal(c.combat.attack_id,null);assert.equal(sim.state.attacks.length,0);assert.equal(c.combat.hitstop_ticks,0);
  }
});

test('Ultime : annule charge, dash, recul, interaction et hitstop ; préserve le saut', () => {
  for (const action of ['charge', 'dash', 'recul', 'interaction', 'hitstop', 'saut']) {
    const { sim, c } = setup(); c.special_charge = 10;
    if (action === 'charge') { input(sim, c, 'PressAttack'); ticks(sim, 6); }
    if (action === 'dash') requestDash(sim, c, 1);
    if (action === 'recul') c.combat.knockback_velocity = 4;
    if (action === 'interaction') c.purchase_hold = {};
    if (action === 'hitstop') c.combat.hitstop_ticks = 3;
    if (action === 'saut') { input(sim, c, 'Jump'); ticks(sim, 6); }
    assert.equal(ultimateBlockedReason(sim, c), null, action); activateUltimate(sim, c);
    assert.equal(c.special_charge, 0); assert.equal(c.combat.press_tick, null); assert.equal(c.dash_active, false);
    assert.equal(c.combat.knockback_velocity, 0); assert.equal(c.purchase_hold, null);
    if (action === 'saut') assert.ok(c.combat.height > 0);
  }
});

test('Sauvegarde : charge et saut reprennent à l’identique ; ancien format refusé', () => {
  const { sim, c, enemy } = setup(); input(sim, c, 'PressAttack'); input(sim, enemy, 'Jump'); ticks(sim, 8);
  const restored = new GameSimulation(sim.config, 42); restored.importSnapshot(sim.exportSnapshot());
  ticks(sim, 40, true); ticks(restored, 40, true); assert.deepEqual(sim.state, restored.state);
  const snapshot = JSON.parse(sim.exportSnapshot()); snapshot.snapshot_version = 8;
  assert.throws(() => restored.importSnapshot(snapshot), /version/);
});

test('Réseau : appui/relâchement autorisés et attribués au bon candidat ; priorité ultime locale', () => {
  const human = new LocalHumanController(); human.pressAttack(); human.releaseAttack();
  let commands = sanitizeCommands(human.commands({}, 'candidate:intrus'), 'melenchon');
  assert.deepEqual(commands.slice(-2).map(c => c.type), ['PressAttack', 'ReleaseAttack']);
  assert.ok(commands.every(c => c.candidateId === 'candidate:melenchon'));
  human.pressAttack(); human.jump(); human.dash(1); human.ultimate(); human.releaseAttack();
  commands = human.commands({}, 'candidate:melenchon');
  assert.deepEqual(commands.slice(3).map(c => c.type), ['ActivateUltimate']);
  human.reset(); assert.equal(human.commands({}, 'candidate:melenchon').at(-1).type, 'CancelAttack');
});

test('IA : termine sa charge et privilégie le combo contre une charge adverse', () => {
  const { sim, c, enemy } = setup(); input(sim, c, 'PressAttack'); ticks(sim, sim.secondsToTicks(sim.config.balance.candidate_combat.charge_ready_seconds));
  assert.ok(aiCombatCommands(sim.state, sim.config, c, enemy).some(c => c.type === 'ReleaseAttack'));
  attackInput(sim, c, 'CancelAttack'); enemy.combat.charge_active = true; c.combat.combo_step = 2;
  sim.state.tick = 49;
  assert.ok(aiCombatCommands(sim.state, sim.config, c, enemy).some(c => c.type === 'Attack'));
});

test('Réglages modifiables : plusieurs hauteurs et durées sans dépendance aux anciennes valeurs', () => {
  for (const [height, seconds] of [[1, 1], [1.8, 1.5], [0.6, 0.4]]) {
    const { sim, c } = setup();
    Object.assign(sim.config.balance.candidate_combat, { jump_height_ratio: height, charge_ready_seconds: seconds });
    input(sim, c, 'Jump'); ticks(sim, 12); assert.equal(c.combat.height, height);
    ticks(sim, 12); input(sim, c, 'PressAttack'); ticks(sim, sim.secondsToTicks(seconds) - 1);
    input(sim, c, 'ReleaseAttack'); updateCombat(sim); assert.equal(sim.state.attacks[0].kind, 'CANDIDATE');
    ticks(sim, 30, true);
    input(sim, c, 'PressAttack'); ticks(sim, sim.secondsToTicks(seconds)); input(sim, c, 'ReleaseAttack');
    assert.equal(sim.state.attacks[0].kind, 'CHARGED');
  }
});

test('Un projectile passe sous un sauteur sans disparaître ; une frappe aérienne peut toucher un autre sauteur', () => {
  const { sim, c, enemy } = setup(); c.combat.height = 1; c.combat.jump_tick = sim.state.tick;
  sim.state.projectiles.push({ id: 'projectile:1', owner_id: enemy.id, faction_id: enemy.faction_id,
    kind: 'VERBAL', x: c.x + 0.1, direction: -1, speed: 10, remaining_range: 5, hit_ids: [], damage: 8, knockback: 0 });
  updateCombat(sim); assert.equal(sim.state.projectiles.length, 1); assert.equal(c.resistance, 100);
  enemy.combat.height = 1;
  assert.equal(verticalHit(sim.config, c, enemy, { kind: 'CANDIDATE' }), true);
  assert.ok(hit(sim, c, enemy, { kind: 'CANDIDATE', damage: 8, knockback: 0 }, 'air'));
});

test('Le feu au sol ne démarre pas de brûlure en saut ; une brûlure existante continue', () => {
  const { sim, c, enemy } = setup();
  sim.state.powers.push({ id: 'power:1', owner_id: enemy.id, faction_id: enemy.faction_id, kind: 'FIRE',
    expires_tick: 100, fire_zone: { x: c.x, expires_tick: 100 }, burns: {} });
  c.combat.height = 1; updateCombat(sim); assert.equal(c.resistance, 100);
  c.combat.height = 0; updateCombat(sim); assert.ok(c.resistance < 100);
  const before = c.resistance; c.combat.height = 1; sim.state.tick += 30; updateCombat(sim);
  assert.ok(c.resistance < before);
});

test('Commandes réseau : maintien chronométré par l’hôte et relâchement chargé', () => {
  const { sim, c } = setup();
  const send = type => sanitizeCommands([{ type }], c.faction_id).forEach(command => sim.applyCommand(command));
  send('PressAttack'); ticks(sim, sim.secondsToTicks(sim.config.balance.candidate_combat.charge_ready_seconds));
  const copy = new GameSimulation(sim.config, 42); copy.importSnapshot(sim.exportSnapshot());
  send('ReleaseAttack'); copy.applyCommand({ type: 'ReleaseAttack', candidateId: c.id });
  ticks(sim, 10, true); ticks(copy, 10, true); assert.deepEqual(sim.state, copy.state);
});

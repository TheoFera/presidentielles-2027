import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { DebateSimulation } from '../src/simulation/debate-simulation.js';
import { CampaignStyleSystem, CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';
import { attackInput, beginCombatTick, updateCombat, activateUltimate, ultimateBlockedReason } from '../src/simulation/combat.js';
import { armored, verticalHit } from '../src/simulation/combat-actions.js';
import { hit, knockdownTicks, movementBlocked } from '../src/simulation/combat-state.js';
import { requestDash } from '../src/simulation/mobile-combat.js';
import { LocalHumanController } from '../src/simulation/controllers.js';
import { sanitizeCommands } from '../src/network/shared-commands.js';
import { aiCombatCommands } from '../src/simulation/ai-combat.js';
import { updateCandidateResistance } from '../src/simulation/candidate-resistance.js';

function setup(debate = false) {
  let sim = new GameSimulation((() => { const config = campaignConfig(); config.balance.minor_candidates.enabled = false; return config; })(), 42);
  sim.state.npcs = []; sim.state.ai_enabled = false;
  sim.state.candidates.forEach((c, i) => { c.x = 100 + 100 * i; c.axis = 0; c.money = 0; });
  CampaignStyleSystem.select(sim, sim.state.candidates[0], CAMPAIGN_STYLES[sim.state.candidates[0].faction_id][0].id, true);
  if (debate) {
    // Ces tests isolent le combat : chaque combattant doit avoir au moins une voix pour entrer dans le débat.
    for (const fighter of sim.state.candidates) sim.state.actualGameState.national_support[fighter.faction_id] = 10;
    sim = new DebateSimulation(sim.config, DebateSimulation.create(sim.config, sim.state));
  }
  const [c, enemy] = sim.state.candidates;
  c.x = debate ? 8 : 100; enemy.x = c.x + 1; c.facing = 1;
  return { sim, c, enemy };
}
function ticks(sim, count, combat = false) {
  for (let i = 0; i < count; i++) { sim.state.tick++; beginCombatTick(sim); if (combat) updateCombat(sim); }
}
const input = (sim, c, type) => sim.applyCommand({ type, candidateId: c.id });

for (const debate of [false,true]) test(`Poings : étourdissement configuré, sans aucun recul (${debate?'débat':'campagne'})`,()=>{
  for(const step of [1,2]){
    const {sim,c,enemy}=setup(debate),x=enemy.x,stun=sim.secondsToTicks(sim.config.balance.candidate_combat.light_stun_seconds);
    c.combat.combo_step=step-1;c.combat.combo_expires_tick=100;
    input(sim,c,'Attack');
    for(let i=0;i<10&&!enemy.combat.stun_ticks;i++)ticks(sim,1,true);
    assert.equal(enemy.combat.stun_ticks,stun);assert.equal(enemy.combat.knockback_velocity,0);
    ticks(sim,stun-1,true);assert.equal(enemy.combat.stun_ticks,1);assert.equal(enemy.x,x);
    ticks(sim,1,true);assert.equal(enemy.combat.stun_ticks,0);assert.equal(enemy.x,x);
  }
});

for (const debate of [false,true]) test(`Combo garanti : réappuyer juste après une touche enchaîne, même si l’adversaire martèle (${debate?'débat':'campagne'})`,()=>{
  const {sim,c,enemy}=setup(debate);enemy.facing=-1;
  const steps=[];let touched=false;
  input(sim,c,'Attack');
  for(let i=0;i<60&&steps.length<3;i++){
    // L’adversaire tente de répliquer à chaque image dès qu’il a été touché.
    if(touched){sim.applyCommand({type:'Attack',candidateId:enemy.id,direction:-1});input(sim,c,'Attack');}
    const before=sim.state.hit_results.length;ticks(sim,1,true);
    for(const h of sim.state.hit_results.slice(before)){assert.equal(h.source_id,c.id);steps.push(h.strong?3:steps.length+1);touched=true;}
  }
  assert.deepEqual(steps,[1,2,3]);
  assert.equal(enemy.combat.knockdown_tick,sim.state.tick);
});

for(const debate of [false,true])for(const kind of [1,2,3,'charged'])test(`Un coup touche plusieurs adversaires une seule fois : ${kind} (${debate?'débat':'campagne'})`,()=>{
  const {sim,c,enemy}=setup(debate),other=sim.state.candidates.find(t=>t.id!==c.id&&t.id!==enemy.id);
  assert.ok(other);other.x=c.x+1.2;
  if(kind==='charged'){input(sim,c,'PressAttack');ticks(sim,sim.secondsToTicks(sim.config.balance.candidate_combat.charge_ready_seconds));input(sim,c,'ReleaseAttack');}
  else{c.combat.combo_step=kind-1;c.combat.combo_expires_tick=100;input(sim,c,'Attack');}
  const hp=t=>debate?t.debate_hp:t.resistance,before=[hp(enemy),hp(other)];
  ticks(sim,1,true);const a=sim.state.attacks.find(a=>a.owner_id===c.id);
  for(let i=0;i<15&&a.hit_ids.length<2;i++)ticks(sim,1,true);
  assert.equal(a.hit_ids.length,2);assert.ok(hp(enemy)<before[0]);assert.ok(hp(other)<before[1]);
  const after=[hp(enemy),hp(other)];ticks(sim,12,true);
  assert.deepEqual([hp(enemy),hp(other)],after);assert.equal(new Set(a.hit_ids).size,2);
});

test('KO : corps visible une demi-seconde supplémentaire, réapparition inchangée et sauvegarde fidèle',()=>{
  const {sim,c,enemy}=setup();hit(sim,enemy,c,{kind:'CANDIDATE',damage:200,knockback:0},'ko');
  assert.equal(c.disappear_tick,36);assert.equal(c.respawn_tick,90);
  const copy=new GameSimulation(sim.config);copy.importSnapshot(sim.exportSnapshot());
  for(const instance of [sim,copy]){
    const actor=instance.state.candidates.find(a=>a.id===c.id);
    instance.state.tick=35;updateCandidateResistance(instance);assert.equal(actor.disappeared,false);assert.equal(actor.is_ko,true);
    instance.state.tick=36;updateCandidateResistance(instance);assert.equal(actor.disappeared,true);
    instance.state.tick=90;updateCandidateResistance(instance);assert.equal(actor.is_ko,false);assert.equal(actor.disappeared,false);
  }
});

test('Charge : coup léger dès l’appui, charge si le bouton reste enfoncé, seuils à la tick près', () => {
  const baseline = setup().sim;
  const activation = baseline.secondsToTicks(baseline.config.balance.candidate_combat.charge_activation_seconds);
  const ready = baseline.secondsToTicks(baseline.config.balance.candidate_combat.charge_ready_seconds);
  // L’appui frappe tout de suite, sans attendre le relâchement.
  const quick = setup(); input(quick.sim, quick.c, 'PressAttack'); updateCombat(quick.sim);
  assert.equal(quick.sim.state.attacks[0]?.kind, 'CANDIDATE');
  input(quick.sim, quick.c, 'ReleaseAttack'); updateCombat(quick.sim); assert.equal(quick.sim.state.attacks.length, 1);
  // Seuils de charge (coup léger mis de côté pour isoler la charge).
  for (const duration of [0, activation - 1, activation, ready - 1, ready, ready + 60]) {
    const { sim, c } = setup();
    input(sim, c, 'PressAttack'); c.combat.buffer_until_tick = -1; ticks(sim, duration);
    assert.equal(c.combat.charge_active, duration >= activation);
    assert.equal(movementBlocked(c), duration >= activation);
    input(sim, c, 'ReleaseAttack'); updateCombat(sim);
    assert.equal(sim.state.attacks[0]?.kind, duration >= activation ? 'CHARGED' : undefined);
    // Relâché tôt : dégâts proportionnels, sans chute ; charge complète : bonus.
    if (duration >= activation) assert.equal(sim.state.attacks[0].partial, duration < ready);
    if (duration >= activation && duration < ready) assert.ok(sim.state.attacks[0].damage < sim.config.balance.candidate_combat.charged_damage * 0.8);
    if (duration >= ready) assert.equal(sim.state.attacks[0].damage, sim.config.balance.candidate_combat.charged_damage);
    assert.equal(c.combat.press_tick, null);
  }
  // La charge ne commence qu’une fois le coup léger terminé, bouton toujours enfoncé.
  const { sim, c } = setup(); input(sim, c, 'PressAttack'); ticks(sim, 1, true);
  const light = sim.state.attacks[0];
  ticks(sim, light.windup_ticks + light.active_ticks + light.recovery_ticks - 2, true);
  assert.equal(c.combat.charge_active, false, 'pas de charge pendant le coup léger');
  ticks(sim, 3, true);
  assert.equal(c.combat.charge_active, true);
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

for (const debate of [false, true]) test(`Coup chargé : dégâts, zéro recul, renversement et deux points d’ultime (${debate ? 'débat' : 'campagne'})`, () => {
  const { sim, c, enemy } = setup(debate);
  const before = debate ? enemy.debate_hp : enemy.resistance;
  input(sim, c, 'PressAttack'); c.combat.buffer_until_tick = -1; ticks(sim, sim.secondsToTicks(sim.config.balance.candidate_combat.charge_ready_seconds)); input(sim, c, 'ReleaseAttack'); ticks(sim, 4, true);
  assert.ok(Math.abs(before - (debate ? enemy.debate_hp : enemy.resistance) - (debate ? 1.65 : 21)) < 1e-9);
  assert.equal(enemy.combat.knockback_velocity, 0);
  // Renversé : au sol le temps de la chute et du relevé, puis encore intouchable un instant.
  const down = knockdownTicks(sim), hitTick = enemy.combat.knockdown_tick;
  assert.equal(enemy.combat.stun_ticks, down - (sim.state.tick - hitTick));
  assert.equal(enemy.combat.invulnerable_until_tick, hitTick + down + sim.secondsToTicks(sim.config.balance.candidate_combat.wakeup_invulnerability_seconds));
  assert.equal(hit(sim, c, enemy, { kind: 'CANDIDATE', step: 1, damage: 8, knockback: 0 }, 'au sol'), null);
  assert.equal(c.special_charge, 2); assert.equal(c.combat.combo_step, 0);
  // Encaisser remplit aussi l’ultime de la victime quand elle a un style.
  CampaignStyleSystem.select(sim, enemy, CAMPAIGN_STYLES[enemy.faction_id][0].id, true);
  sim.state.tick = enemy.combat.invulnerable_until_tick;
  hit(sim, c, enemy, { kind: 'CANDIDATE', step: 1, damage: 8, knockback: 0 }, 'encaissé');
  assert.equal(enemy.special_charge, sim.config.balance.special_charge.points_per_hit_taken);
});

test('Dash : annule seulement s’il peut partir, sans frappe fantôme au relâchement', () => {
  const { sim, c } = setup(); input(sim, c, 'PressAttack'); ticks(sim, sim.secondsToTicks(sim.config.balance.candidate_combat.charge_ready_seconds));
  c.dash_charges = 0; requestDash(sim, c, 1); assert.equal(c.combat.charge_active, true);
  c.dash_charges = 1; requestDash(sim, c, 1); assert.equal(c.combat.charge_active, false); assert.equal(c.dash_active, true);
  input(sim, c, 'ReleaseAttack'); ticks(sim, 20, true); assert.equal(sim.state.attacks.length, 0);
});

test('Troisième coup : sort de la portée de mêlée ; recul limité aux bords du débat', () => {
  for (const debate of [false, true]) {
    const { sim, c, enemy } = setup(debate);
    hit(sim, c, enemy, { kind: 'CANDIDATE', step: 3, strong: true, damage: 14, knockback: sim.config.balance.candidate_combat.finisher_knockback }, 'third');
    ticks(sim, 30);
    assert.ok(enemy.x - c.x > sim.config.balance.candidate_combat.finisher_range + sim.config.balance.candidate_combat.target_radius);
    if (debate) assert.ok(enemy.x <= sim.state.debate_bounds.max);
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
  // En l’air, Frapper déclenche le coup plongeant : descente engagée, sans contrôle.
  input(sim, c, 'PressAttack'); input(sim, c, 'ReleaseAttack'); updateCombat(sim);
  assert.equal(sim.state.attacks[0].kind, 'DIVE'); assert.equal(movementBlocked(c), true);
  const x = c.x; ticks(sim, 2); assert.ok(c.x > x); assert.ok(c.combat.height < expected);
  ticks(sim, duration - half); assert.equal(c.combat.height, 0); assert.equal(c.combat.jump_tick, null); assert.equal(c.combat.dive_tick, null);
  // Réception : temps de récupération, et pas de saut pour l’annuler.
  input(sim, c, 'Jump'); assert.equal(c.combat.jump_tick, null);
  assert.equal(verticalHit(sim.config, enemy, c, { kind: 'VERBAL' }), true);
});

test('Maintien commencé en vol : ne devient pas une charge à l’atterrissage', () => {
  const { sim, c } = setup(); input(sim, c, 'Jump'); input(sim, c, 'PressAttack'); updateCombat(sim);
  // Au ras du sol, le plongeon attend la hauteur minimale (l’appui reste en mémoire).
  assert.equal(sim.state.attacks.length, 0);
  for (let i = 0; i < 10 && !sim.state.attacks.length; i++) ticks(sim, 1, true);
  assert.equal(sim.state.attacks[0].kind, 'DIVE'); assert.equal(sim.state.attacks[0].windup_ticks, 0);
  assert.ok(c.combat.height >= sim.config.balance.candidate_combat.dive_min_height);
  ticks(sim, 60, true);
  assert.equal(c.combat.charge_active, false); input(sim, c, 'ReleaseAttack'); updateCombat(sim);
  assert.equal(sim.state.attacks.length, 0);
});

for (const debate of [false, true]) test(`Saut prioritaire et coup plongeant dès la hauteur minimale (${debate ? 'débat' : 'campagne'})`, () => {
  for (const phase of ['windup','active','recovery','charge','dash']) {
    const { sim, c, enemy } = setup(debate); enemy.x = c.x + 10;
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
    input(sim,c,'PressAttack');
    for (let i = 0; i < 10 && !sim.state.attacks.length; i++) ticks(sim,1,true);
    assert.equal(sim.state.attacks.length,1); assert.equal(sim.state.attacks[0].kind,'DIVE'); assert.equal(sim.state.attacks[0].windup_ticks,0);
    input(sim,c,'ReleaseAttack'); assert.equal(c.combat.buffer_until_tick,-1);
  }
});

test('Dash immédiat en récupération : annulation atomique, refus sans réserve ou pendant un stun', () => {
  for (const debate of [false,true]) {
    const {sim,c}=setup(debate);
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
  assert.throws(() => restored.importSnapshot(snapshot), /ancienne sauvegarde/);
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
  let attacks=0;
  for(let tick=49;tick<109;tick++) {
    sim.state.tick=tick;
    const commands=aiCombatCommands(sim.state,sim.config,c,enemy);
    assert.ok(!commands.some(c=>c.type==='PressAttack'));
    attacks+=commands.some(c=>c.type==='Attack');
  }
  assert.ok(attacks>0);
});

test('Réglages modifiables : plusieurs hauteurs et durées sans dépendance aux anciennes valeurs', () => {
  for (const [height, seconds] of [[1, 1], [1.8, 1.5], [0.6, 0.4]]) {
    const { sim, c } = setup();
    Object.assign(sim.config.balance.candidate_combat, { jump_height_ratio: height, jump_duration_seconds: seconds, charge_ready_seconds: seconds });
    const duration = sim.secondsToTicks(seconds), half = Math.floor(duration / 2);
    input(sim, c, 'Jump'); ticks(sim, half); assert.ok(Math.abs(c.combat.height - height) < 0.01);
    ticks(sim, duration - half); input(sim, c, 'PressAttack'); c.combat.buffer_until_tick = -1; ticks(sim, sim.secondsToTicks(seconds) - 1);
    input(sim, c, 'ReleaseAttack'); updateCombat(sim); assert.equal(sim.state.attacks[0].partial, true);
    ticks(sim, 60, true);
    input(sim, c, 'PressAttack'); c.combat.buffer_until_tick = -1; ticks(sim, sim.secondsToTicks(seconds)); input(sim, c, 'ReleaseAttack');
    assert.equal(sim.state.attacks[0].kind, 'CHARGED'); assert.equal(sim.state.attacks[0].partial, false);
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

for (const debate of [false, true]) test(`Corps : deux candidats adverses se repoussent au sol, le saut passe par-dessus, le dash traverse (${debate ? 'débat' : 'campagne'})`, () => {
  const width = setup().sim.config.balance.candidate_combat.body_width;
  const walk = (sim, moves, count) => { for (let i = 0; i < count; i++) { for (const [actor, axis] of moves) sim.applyCommand({ type: 'Move', candidateId: actor.id, axis }); sim.step(); } };
  // Marcher l’un vers l’autre : ils se touchent sans se superposer, et avancer pousse l’autre.
  { const { sim, c, enemy } = setup(debate); enemy.x = c.x + 2; enemy.facing = -1;
    walk(sim, [[c, 1], [enemy, -1]], 30);
    assert.ok(enemy.x - c.x >= width - 1e-9, `${enemy.x - c.x}`);
    const start = enemy.x; walk(sim, [[c, 1], [enemy, 0]], 10);
    assert.ok(enemy.x > start); assert.ok(enemy.x - c.x >= width - 1e-9); }
  // Sauter en avançant : on atterrit de l’autre côté.
  { const { sim, c, enemy } = setup(debate); enemy.x = c.x + 0.95;
    sim.applyCommand({ type: 'Jump', candidateId: c.id }); walk(sim, [[c, 1]], 26);
    assert.ok(c.x > enemy.x, 'passage par-dessus'); }
  // Le dash est une esquive : il traverse.
  { const { sim, c, enemy } = setup(debate); enemy.x = c.x + 0.95;
    sim.applyCommand({ type: 'Dash', candidateId: c.id, direction: 1 }); walk(sim, [], 10);
    assert.ok(c.x > enemy.x, 'dash traversant'); }
});

test('Corps : contre le bord du débat, seul le candidat qui pousse est arrêté', () => {
  const { sim, c, enemy } = setup(true);
  const width = sim.config.balance.candidate_combat.body_width;
  enemy.x = sim.state.debate_bounds.max; c.x = enemy.x - 2;
  for (let i = 0; i < 30; i++) { sim.applyCommand({ type: 'Move', candidateId: c.id, axis: 1 }); sim.step(); }
  assert.equal(enemy.x, sim.state.debate_bounds.max);
  assert.ok(Math.abs(enemy.x - c.x - width) < 1e-9);
});

test('Charge : un coup léger reçu ne l’interrompt pas, le coup 3 si', () => {
  for (const [step, kept] of [[1, true], [2, true], [3, false]]) {
    const { sim, c, enemy } = setup();
    input(sim, c, 'PressAttack'); c.combat.buffer_until_tick = -1; ticks(sim, sim.secondsToTicks(sim.config.balance.candidate_combat.charge_activation_seconds));
    hit(sim, enemy, c, { kind: 'CANDIDATE', step, strong: step === 3, damage: 1, knockback: step === 3 ? 1 : 0.2, range: 1 }, 'x');
    assert.equal(c.combat.press_tick != null, kept);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { ArenaSimulation } from '../src/simulation/arena-simulation.js';
import { CAMPAIGN_STYLES, CampaignStyleSystem } from '../src/simulation/campaign-styles.js';
import { beginCombatTick, requestAttack, activateUltimate, updateCombat, ultimateBlockedReason } from '../src/simulation/combat.js';
import { hit, combatState } from '../src/simulation/combat-state.js';
import { requestDash, successfulNormalHit } from '../src/simulation/mobile-combat.js';

function setup(faction = 'melenchon', index = 0) {
  const sim = new GameSimulation(campaignConfig(), 42);
  sim.state.npcs = []; sim.state.ai_enabled = false;
  const c = sim.state.candidates.find(c => c.faction_id === faction);
  CampaignStyleSystem.select(sim, c, CAMPAIGN_STYLES[faction][index].id, true);
  sim.state.candidates.forEach((a, i) => { a.x = 100 + i * 100; a.axis = 0; a.money = 0; });
  return { sim, c, enemy: sim.state.candidates.find(a => a !== c) };
}
function ticks(sim, n, attacks = false) { for (let i = 0; i < n; i++) { sim.state.tick++; beginCombatTick(sim); if (attacks) updateCombat(sim); } }
for (const faction of Object.keys(CAMPAIGN_STYLES)) {
  test(`${faction} : 3 esquives, distance et recharge séquentielle exacte`, () => {
    const { sim, c } = setup(faction), start = c.x;
    assert.equal(c.dash_charges, 3);
    for (const direction of [-1, 1, -1]) { requestDash(sim, c, direction); assert.equal(c.dash_active, true); ticks(sim, 9); }
    assert.ok(Math.abs(c.x - start + sim.config.balance.dash.distance) < 1e-9); assert.equal(c.dash_charges, 0);
    requestDash(sim, c, 1); assert.equal(c.dash_active, false);
    ticks(sim, 92); assert.equal(c.dash_charges, 0); ticks(sim, 1); assert.equal(c.dash_charges, 1);
    ticks(sim, 120); assert.equal(c.dash_charges, 2); ticks(sim, 120); assert.equal(c.dash_charges, 3);
  });
  test(`${faction} : invulnérabilité 4 ticks, puis dégâts pendant la fin du dash`, () => {
    const { sim, c, enemy } = setup(faction); requestDash(sim, c, 1);
    for (let i = 1; i <= 4; i++) { ticks(sim, 1); assert.equal(hit(sim, enemy, c, { damage: 10, knockback: 4 }, `test:${i}`), null); }
    assert.equal(c.resistance, sim.config.balance.candidate_combat.resistance_max); assert.equal(c.combat.stun_ticks, 0);
    ticks(sim, 1); assert.ok(hit(sim, enemy, c, { damage: 10, knockback: 4 }, 'test:5')); assert.equal(Math.abs(c.combat.knockback_velocity), 4);
  });
}
test('Restrictions : KO, stun, attaque, Meeting, interaction, sélection et arène interdite', () => {
  for (const reason of ['ko','stun','attack','meeting','hold','style','arena']) {
    const { sim, c } = setup();
    if (reason === 'ko') c.is_ko = true;
    if (reason === 'stun') c.combat.stun_ticks = 5;
    if (reason === 'attack') c.combat.attack_id = 'test';
    if (reason === 'meeting') c.crisis_meeting_id = 'test';
    if (reason === 'hold') c.purchase_hold = {};
    if (reason === 'style') sim.state.campaign_style_selection = {};
    if (reason === 'arena') { sim.state.arena_bounds = {}; sim.config.balance.dash.allowed_in_arena = false; }
    requestDash(sim, c, 1); assert.equal(c.dash_charges, 3, reason);
  }
});
test('Décharge linéaire : 100 ou 60 %, stable 10 s, zéro à 15 s ; nouveau hit interrompt', () => {
  for (const value of [10, 6]) {
    const { sim, c, enemy } = setup(); sim.applyCommand({ type:'DebugSetUltimateCharge', candidateId:c.id, value });
    ticks(sim, 300); assert.equal(c.special_charge, value);
    ticks(sim, 60); assert.ok(Math.abs(c.special_charge - value * .6) < 1e-10);
    const restored = setup().sim; restored.importSnapshot(sim.exportSnapshot()); ticks(restored, 90); ticks(sim, 90);
    assert.deepEqual(restored.state, sim.state); assert.equal(c.special_charge, 0);
    sim.applyCommand({ type:'DebugFillSpecial', candidateId:c.id }); ticks(sim, 360);
    successfulNormalHit(sim, c, enemy, { step:1 }); assert.equal(c.special_charge, 7);
    ticks(sim, 300); assert.equal(c.special_charge, 7); ticks(sim, 150); assert.equal(c.special_charge, 0);
  }
});
test('Combo : 1, 2, finisher fort puis retour au premier coup', () => {
  const { sim, c, enemy } = setup(); const knockbacks = [];
  for (let i = 1; i <= 3; i++) {
    c.combat.attack_id = null; c.combat.hitstop_ticks = 0; c.combat.stun_ticks = 0;
    enemy.x = c.x + 1; enemy.combat = combatState();
    requestAttack(sim, c); ticks(sim, 1, true);
    const attack = sim.state.attacks.find(a => a.owner_id === c.id); assert.equal(attack.step, i); knockbacks.push(attack.knockback);
    ticks(sim, 17, true);
  }
  assert.ok(knockbacks[2] > knockbacks[1] * 2); assert.equal(c.special_charge, 4);
  ticks(sim, sim.secondsToTicks(sim.config.balance.candidate_combat.combo_reset_seconds) + 2, true);
  requestAttack(sim, c); ticks(sim, 1, true); assert.equal(c.combat.combo_step, 1);
});
test('Bardella : charge pleine sans activation = KO ; armé 30 s = relève ; changement annule', () => {
  const a = setup('le_pen',2); a.c.special_charge = 10;
  hit(a.sim,a.enemy,a.c,{damage:999,knockback:0},'test:ko'); assert.equal(a.c.is_ko,true); assert.equal(a.c.bardella_form,false);
  const b = setup('le_pen',2); b.c.special_charge = 10; activateUltimate(b.sim,b.c); ticks(b.sim,900,true);
  assert.equal(b.c.bardella_guardian_armed,true); assert.equal(b.c.special_charge,0);
  hit(b.sim,b.enemy,b.c,{damage:999,knockback:0},'test:ko'); assert.equal(b.c.bardella_form,true); assert.equal(b.c.is_ko,false);
  const c = setup('le_pen',2); c.c.special_charge = 10; activateUltimate(c.sim,c.c);
  CampaignStyleSystem.select(c.sim,c.c,CAMPAIGN_STYLES.le_pen[0].id,true); assert.equal(c.c.bardella_guardian_armed,false);
});
for (const [faction, styles] of Object.entries(CAMPAIGN_STYLES)) for (let i=0;i<styles.length;i++) {
  test(`${styles[i].ultimate.name} : commande R prioritaire pendant un coup, refus pendant le stun`, () => {
    const { sim, c } = setup(faction, i); c.special_charge = 10;
    requestAttack(sim, c); ticks(sim, 1, true);
    c.combat.stun_ticks = 2;
    assert.match(ultimateBlockedReason(sim, c), /étourdi/);
    sim.applyCommand({ type: 'ActivateUltimate', candidateId: c.id });
    assert.equal(c.special_charge, 10);
    c.combat.stun_ticks = 0;
    assert.ok(c.combat.attack_id);
    assert.equal(ultimateBlockedReason(sim, c), null);
    sim.applyCommand({ type: 'ActivateUltimate', candidateId: c.id });
    assert.equal(c.special_charge, 0);
    if (styles[i].ultimate.kind === 'BARDELLA') assert.equal(c.bardella_guardian_armed, true);
    else assert.ok(sim.state.powers.some(p => p.kind === styles[i].ultimate.kind));
  });
  test(`${styles[i].ultimate.name} : aucune activation sur attaque, commande manuelle en arène`, () => {
    const { sim, c } = setup(faction,i); c.special_charge=10;
    requestAttack(sim,c); ticks(sim,30,true); assert.equal(c.special_charge,10); assert.equal(sim.state.powers.length,0); assert.equal(c.bardella_guardian_armed,false);
    const arena = new ArenaSimulation(sim.config,ArenaSimulation.create(sim.config,sim.state)); const actor = arena.state.candidates.find(a=>a.id===c.id);
    arena.applyCommand({type:'ActivateUltimate',candidateId:c.id}); assert.equal(actor.special_charge,0);
    assert.equal(actor.bardella_guardian_armed,styles[i].ultimate.kind==='BARDELLA');
  });
}
test('Sauvegarde de dash et validation atomique des champs', () => {
  const { sim, c } = setup(); requestDash(sim,c,-1); ticks(sim,2);
  const restored = setup().sim; restored.importSnapshot(sim.exportSnapshot()); ticks(sim,140); ticks(restored,140); assert.deepEqual(restored.state,sim.state);
  const invalid=sim.getState(); invalid.candidates[0].dash_charges=99; const before=sim.exportSnapshot(); assert.throws(()=>sim.importSnapshot(invalid)); assert.equal(sim.exportSnapshot(),before);
});

test('Cibles valides : unités adverses, invocation configurable ; alliés et décor exclus', () => {
  for (const [role, temporary, allied, enabled, expected] of [
    ['SYMPATHISANT',false,false,true,1], ['MILITANT',false,false,true,1], ['SERVICE_D_ORDRE',false,false,true,1],
    ['ZEMMOUR',true,false,true,1], ['ZEMMOUR',true,false,false,0], ['HOLOGRAMME',true,true,true,0], ['SYMPATHISANT',false,true,true,0],
  ]) {
    const {sim,c}=setup(); sim.config.balance.special_charge.enemy_summons_charge=enabled;
    const target={id:'test:unit',role,faction_id:allied?c.faction_id:'le_pen',temporary,expired:false,x:c.x+1,facing:-1,hidden_durability:100,combat:combatState(),expires_tick:99999,ready_tick:99999,owner_id:c.id};
    (temporary?sim.state.temporary_units:sim.state.npcs).push(target);
    requestAttack(sim,c);ticks(sim,15,true);assert.equal(c.special_charge,expected,role);
  }
});
test('Dash : limites de l’arène conservées et recharge suspendue en debug', () => {
  const {sim,c}=setup(); const arena=new ArenaSimulation(sim.config,ArenaSimulation.create(sim.config,sim.state));
  const actor=arena.state.candidates.find(a=>a.id===c.id);actor.x=arena.state.arena_bounds.max-.2;
  arena.applyCommand({type:'Dash',candidateId:c.id,direction:1});for(let i=0;i<9;i++)arena.step();
  assert.equal(actor.x,arena.state.arena_bounds.max);
  arena.applyCommand({type:'DebugDisableDashRecharge',candidateId:c.id,disabled:true});for(let i=0;i<140;i++)arena.step();assert.equal(actor.dash_charges,2);
  arena.applyCommand({type:'DebugDisableDashRecharge',candidateId:c.id,disabled:false});for(let i=0;i<120;i++)arena.step();assert.equal(actor.dash_charges,3);
});
test('Zone de feu : aucune application pendant les frames, brûlure possible ensuite', async () => {
  const {updateStyleEffects}=await import('../src/simulation/style-ultimates.js');
  const {sim,c,enemy}=setup(); sim.state.powers.push({id:'test:fire',owner_id:enemy.id,expires_tick:1000,fire_zone:{x:c.x,expires_tick:1000},burns:{}});
  requestDash(sim,c,1);
  for(let i=0;i<4;i++){ticks(sim,1);sim.state.powers[0].fire_zone.x=c.x;updateStyleEffects(sim);assert.equal(sim.state.powers[0].burns[c.id],undefined);}
  ticks(sim,1);sim.state.powers[0].fire_zone.x=c.x;updateStyleEffects(sim);assert.ok(sim.state.powers[0].burns[c.id]);assert.ok(c.resistance<sim.config.balance.candidate_combat.resistance_max);assert.equal(enemy.special_charge,0);
});
test('Traverser Super Européiste ne déclenche aucune riposte', () => {
  const {sim,c,enemy}=setup('philippe',2);c.special_charge=10;activateUltimate(sim,c);ticks(sim,30,true);
  enemy.x=c.x-1;requestDash(sim,enemy,1);const hp=enemy.resistance;ticks(sim,9,true);assert.equal(enemy.resistance,hp);
});

test('Bulles des militants : dégâts réels, aucun recul ajouté ni retournement du recul existant', async () => {
  const { updateMilitantCombat } = await import('../src/simulation/combat.js');
  const { sim, c } = setup();
  const militant = sim.spawn(sim.state.world.subzones[0], c.x - 2);
  Object.assign(militant, {role:'MILITANT',faction_id:'le_pen',hidden_durability:100,facing:1});
  const x=c.x, hp=c.resistance;
  updateMilitantCombat(sim,militant); ticks(sim,30,true);
  assert.ok(c.resistance<hp);assert.equal(c.x,x);assert.equal(c.combat.knockback_velocity,0);
  c.combat.knockback_velocity=-3;
  hit(sim,militant,c,{kind:'VERBAL',ranged:true,damage:1,knockback:sim.config.balance.physical_units.militant.verbal_knockback},'test:verbal');
  assert.equal(c.combat.knockback_velocity,-3);
});

test('Bords rouges : dégâts cumulés, impact local, récupération et faible résistance', async () => {
  const { damageFeedbackState } = await import('../src/presentation/damage-feedback.js');
  const {sim,c,enemy}=setup(); const feedback=()=>damageFeedbackState(sim.state,c,sim.config);
  assert.equal(feedback().opacity,0);
  c.resistance=80;const light=feedback().opacity;c.resistance=35;const heavy=feedback().opacity;assert.ok(heavy>light);
  hit(sim,enemy,c,{damage:8,knockback:0},'test:incoming');const impact=feedback();assert.ok(impact.impact>0);
  ticks(sim,30);assert.equal(feedback().impact,0);assert.ok(feedback().opacity<impact.opacity);
  c.resistance=100;assert.equal(feedback().opacity,0);
  hit(sim,c,enemy,{damage:8,knockback:0},'test:outgoing');assert.equal(feedback().opacity,0);
  c.resistance=10;const reducedA=damageFeedbackState(sim.state,c,sim.config,1,true);ticks(sim,9);
  assert.deepEqual(damageFeedbackState(sim.state,c,sim.config,1,true),reducedA);
  assert.ok(damageFeedbackState(sim.state,c,sim.config).opacity>=reducedA.opacity);
});

test('Bords rouges en arène : utilisent les points d’arène, pas la résistance de campagne', async () => {
  const {damageFeedbackState}=await import('../src/presentation/damage-feedback.js');const {sim,c}=setup();
  const arena=ArenaSimulation.create(sim.config,sim.state);const fighter=arena.candidates.find(a=>a.id===c.id);
  fighter.resistance=0;assert.equal(damageFeedbackState(arena,fighter,sim.config).opacity,0);
  fighter.arena_hp=fighter.arena_initial_hp*.5;assert.ok(damageFeedbackState(arena,fighter,sim.config).opacity>0);
});

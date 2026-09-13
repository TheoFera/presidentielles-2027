import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CampaignStyleSystem, CAMPAIGN_STYLES, normalizeCampaignProfile, isCampaignStyleUnlocked, unlockCampaignStyle, styleInfluenceMultiplier, styleTagWeight } from '../src/simulation/campaign-styles.js';
import { captureSite } from '../src/simulation/strategic-sites.js';
import { combatState, hit } from '../src/simulation/combat-state.js';
import { beginCombatTick, activateUltimate, requestAttack, updateCombat } from '../src/simulation/combat.js';
import { updateCandidateResistance } from '../src/simulation/candidate-resistance.js';
import { CampaignEventDirector, resolveCampaignEvent } from '../src/simulation/campaign-events.js';
import { characterAssetId } from '../src/presentation/illustrated-characters.js';
import { saveCampaignProfile, loadCampaignProfile } from '../src/presentation/campaign-profile.js';

const allUnlocked = () => ({ unlocked_campaign_styles: Object.fromEntries(Object.entries(CAMPAIGN_STYLES).map(([f, styles]) => [f, styles.map(s => s.id)])) });
const make = (profile = allUnlocked()) => new GameSimulation(campaignConfig(), 42, 'candidate:melenchon', profile);
function establish(sim, candidate = sim.state.candidates[0]) {
  const hq = sim.state.buildings.find(b => b.type === 'permanence');
  candidate.x = hq.x; captureSite(sim, hq, candidate); return hq;
}
function choose(sim, candidate, id) {
  CampaignStyleSystem.open(sim, candidate, !candidate.current_campaign_style);
  assert.equal(CampaignStyleSystem.select(sim, candidate, id), true);
}
function tickCombat(sim, ticks = 1) {
  for (let i = 0; i < ticks; i++) { sim.state.tick++; beginCombatTick(sim); updateCombat(sim); }
}
function isolate(sim, faction, styleId) {
  sim.state.npcs = []; const actor = sim.state.candidates.find(c => c.faction_id === faction);
  actor.x = 100; actor.facing = 1;
  for (const c of sim.state.candidates) if (c !== actor) c.x = 250 + sim.state.candidates.indexOf(c) * 100;
  choose(sim, actor, styleId); return actor;
}
function supporter(sim, x = 101) {
  const zone = sim.state.world.subzones[0], npc = sim.spawn(zone, x);
  npc.role = 'SYMPATHISANT'; npc.faction_id = 'le_pen'; npc.hidden_durability = sim.config.balance.physical_units.sympathisant.hidden_durability;
  return npc;
}

test('Neuf styles, trois par candidat, trois déblocages persistants par défaut', () => {
  const profile = normalizeCampaignProfile();
  for (const [f, styles] of Object.entries(CAMPAIGN_STYLES)) {
    assert.equal(styles.length, 3); assert.equal(profile.unlocked_campaign_styles[f].length, 1);
    assert.equal(isCampaignStyleUnlocked(profile, f, styles[0].id), true);
    assert.equal(isCampaignStyleUnlocked(profile, f, styles[1].id), false);
  }
  const next = unlockCampaignStyle(profile, 'melenchon', 'melenchon_populiste');
  const storage = { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } };
  saveCampaignProfile(next, storage);
  assert.deepEqual(loadCampaignProfile(storage), next);
  assert.equal(isCampaignStyleUnlocked(profile, 'melenchon', 'melenchon_populiste'), false);
});

test('Premier QG : choix obligatoire, monde figé, styles verrouillés refusés', () => {
  const sim = make({}), c = sim.state.candidates[0];
  assert.equal(c.current_campaign_style, null); establish(sim);
  assert.equal(sim.state.campaign_style_selection.mandatory, true);
  sim.applyCommand({ type: 'CancelCampaignStyle', candidateId: c.id });
  const before = sim.state.tick; sim.step(); assert.equal(sim.state.tick, before);
  sim.applyCommand({ type: 'SelectCampaignStyle', candidateId: c.id, styleId: 'melenchon_populiste' });
  assert.equal(c.current_campaign_style, null);
  sim.applyCommand({ type: 'SelectCampaignStyle', candidateId: c.id, styleId: 'melenchon_universaliste' });
  assert.equal(sim.state.campaign_style_selection, null); assert.equal(c.current_campaign_style, 'melenchon_universaliste');
});

test('Changer remplace le bonus, vide la charge et conserve scores, bâtiments et PNJ', () => {
  const sim = make(), c = sim.state.candidates[0]; establish(sim); choose(sim, c, 'melenchon_universaliste');
  assert.equal(styleInfluenceMultiplier(sim.config, c, 'paris_19e'), 1.1);
  const npcs = structuredClone(sim.state.npcs), buildings = structuredClone(sim.state.buildings), scores = structuredClone(sim.state.electorate);
  const art = sim.state.npcs.map(n => characterAssetId(n, sim.state)); c.special_charge = 100;
  choose(sim, c, 'melenchon_populiste');
  assert.equal(c.special_charge, 0); assert.equal(styleInfluenceMultiplier(sim.config, c, 'paris_19e'), 1);
  assert.equal(styleInfluenceMultiplier(sim.config, c, 'periurbain_usine'), 1.1);
  assert.deepEqual(sim.state.npcs, npcs); assert.deepEqual(sim.state.buildings, buildings); assert.deepEqual(sim.state.electorate, scores);
  assert.deepEqual(sim.state.npcs.map(n => characterAssetId(n, sim.state)), art);
});

test('Maintien au QG : trois secondes, annulation et interruptions', () => {
  for (const reason of ['move', 'attack', 'hit', 'stun', 'ko', 'leave', 'interaction', 'release']) {
    const sim = make(), c = sim.state.candidates[0]; establish(sim); choose(sim, c, 'melenchon_universaliste');
    sim.applyCommand({ type: 'HoldCampaignStyle', candidateId: c.id, active: true }); CampaignStyleSystem.update(sim);
    assert.ok(c.style_hold);
    if (reason === 'move') sim.applyCommand({ type: 'Move', candidateId: c.id, axis: 1 });
    if (reason === 'attack') sim.applyCommand({ type: 'Attack', candidateId: c.id });
    if (reason === 'hit') c.hits_received++;
    if (reason === 'stun') c.combat.stun_ticks = 5;
    if (reason === 'ko') c.is_ko = true;
    if (reason === 'leave') c.x += 20;
    if (reason === 'interaction') c.crisis_meeting_id = 'meeting';
    if (reason === 'release') sim.applyCommand({ type: 'HoldCampaignStyle', candidateId: c.id, active: false });
    sim.state.tick += sim.secondsToTicks(3); CampaignStyleSystem.update(sim);
    assert.equal(c.style_hold, null, reason); assert.equal(sim.state.campaign_style_selection, null, reason);
  }
  const sim = make(), c = sim.state.candidates[0]; establish(sim); choose(sim, c, 'melenchon_universaliste');
  sim.applyCommand({ type: 'HoldCampaignStyle', candidateId: c.id, active: true }); CampaignStyleSystem.update(sim);
  sim.state.tick += sim.secondsToTicks(3) - 1; CampaignStyleSystem.update(sim); assert.equal(sim.state.campaign_style_selection, null);
  sim.state.tick++; CampaignStyleSystem.update(sim); assert.equal(sim.state.campaign_style_selection.mandatory, false);
  sim.applyCommand({ type: 'CancelCampaignStyle', candidateId: c.id }); assert.equal(sim.state.campaign_style_selection, null);
});

test('Un événement garde ses multiplicateurs après changement de style', () => {
  const sim = make(), c = sim.state.candidates[0]; choose(sim, c, 'melenchon_universaliste');
  const event = CampaignEventDirector.start(sim, { family: 'MEETING_DE_CRISE', biomeId: 'paris_19e' }); assert.ok(event);
  const frozen = structuredClone(event.style_snapshot); choose(sim, c, 'melenchon_populiste');
  assert.deepEqual(event.style_snapshot, frozen); assert.equal(frozen.melenchon.biome_multipliers.paris_19e, 1.1);
  assert.equal(styleTagWeight(sim.config, c, ['industry']), 1.5);
  resolveCampaignEvent(sim, event, 'RESOLVED', c.faction_id);
  assert.deepEqual(event.style_snapshot, frozen);
});

test('Coup dans le vide : zéro charge ; contact normal : charge configurée', () => {
  const sim = make(), c = isolate(sim, 'melenchon', 'melenchon_universaliste');
  requestAttack(sim, c); tickCombat(sim, sim.hz); assert.equal(c.special_charge, 0);
  c.combat = combatState(); supporter(sim); requestAttack(sim, c); tickCombat(sim, sim.hz);
  assert.equal(c.special_charge, sim.config.balance.special_charge.points_per_light_hit);
});

for (const [faction, styles] of Object.entries(CAMPAIGN_STYLES)) for (const style of styles) {
  test(`${style.ultimate.name} : activation selon le mode du style`, () => {
    const sim = make(), c = isolate(sim, faction, style.id); c.special_charge = sim.config.balance.special_charge.required_points;
    activateUltimate(sim, c); tickCombat(sim);
    if (style.ultimate.kind === 'BARDELLA') { assert.equal(c.special_charge, 0); assert.equal(c.bardella_guardian_armed, true); assert.equal(sim.state.powers.length, 0); }
    else { assert.equal(c.special_charge, 0); assert.equal(sim.state.powers[0].kind, style.ultimate.kind); }
  });
  test(`${style.ultimate.name} : sauvegarde pendant l’ultime`, () => {
    const sim = make(), c = sim.state.candidates.find(c => c.faction_id === faction);
    choose(sim, c, style.id); c.special_charge = sim.config.balance.special_charge.required_points;
    if (style.ultimate.kind === 'BARDELLA') {
      activateUltimate(sim, c);
      const enemy = sim.state.candidates.find(other => other !== c);
      activateUltimate(sim, c);
  hit(sim, enemy, c, { damage: 999, knockback: 0 }, 'test:save-ko');
    } else { activateUltimate(sim, c); tickCombat(sim); }
    const restored = make(); restored.importSnapshot(sim.exportSnapshot());
    assert.deepEqual(restored.state, sim.state);
    tickCombat(sim, 30); tickCombat(restored, 30);
    assert.deepEqual(restored.state, sim.state);
  });
}

test('Vague : dommages d’ultime sans recharge', () => {
  const sim = make(), c = isolate(sim, 'le_pen', 'le_pen_souverainiste');
  const n = supporter(sim, 102); n.faction_id = 'melenchon'; c.special_charge = sim.config.balance.special_charge.required_points;
  activateUltimate(sim, c); tickCombat(sim, sim.hz); assert.equal(n.role, 'DEMOBILISE'); assert.equal(c.special_charge, 0);
});

test('Déferlante : sept silhouettes, apparition puis disparition complète', () => {
  const sim = make(), c = isolate(sim, 'melenchon', 'melenchon_communautariste');
  c.special_charge = sim.config.balance.special_charge.required_points; activateUltimate(sim, c); tickCombat(sim);
  assert.equal(sim.state.temporary_units.length, 7);
  const first = sim.state.temporary_units[0], x = first.x;
  tickCombat(sim); assert.equal(first.x, x);
  tickCombat(sim, sim.secondsToTicks(5)); assert.equal(sim.state.temporary_units.length, 0); assert.equal(c.special_charge, 0);
});

test('Écharpe : allonge, plusieurs cibles et retour au mouvement normal', () => {
  const sim = make(), c = isolate(sim, 'philippe', 'philippe_notable');
  c.special_charge = sim.config.balance.special_charge.required_points; activateUltimate(sim, c); tickCombat(sim, sim.hz);
  const a = supporter(sim, 102.4), b = supporter(sim, 103.1);
  const before = a.hidden_durability;
  c.combat = combatState(); requestAttack(sim, c); tickCombat(sim, sim.hz);
  assert.ok(a.hidden_durability < before); assert.ok(b.hidden_durability < before); assert.equal(c.special_charge, 0);
  tickCombat(sim, sim.secondsToTicks(4)); assert.equal(c.ultimate_effect, null);
  c.combat = combatState(); requestAttack(sim, c); tickCombat(sim); assert.equal(sim.state.attacks.find(a => a.owner_id === c.id).kind, 'CANDIDATE');
});

test('Feu : zone temporaire, brûlure rafraîchie et nettoyage au changement', () => {
  const sim = make(), c = isolate(sim, 'melenchon', 'melenchon_populiste'), enemy = sim.state.candidates[1]; enemy.x = 103;
  c.special_charge = sim.config.balance.special_charge.required_points; activateUltimate(sim, c); tickCombat(sim, sim.hz);
  const power = sim.state.powers.find(p => p.kind === 'FIRE'); assert.ok(power.fire_zone);
  const firstExpiry = power.burns[enemy.id].expires_tick;
  tickCombat(sim, sim.hz); assert.ok(power.burns[enemy.id].expires_tick > firstExpiry); assert.equal(c.special_charge, 0);
  choose(sim, c, 'melenchon_universaliste'); assert.equal(sim.state.powers.length, 0); assert.equal(sim.state.projectiles.length, 0); assert.equal(c.ultimate_effect, null);
});

test('Zemmour : un PNJ intercepte la bulle et deux coups suffisent', () => {
  const sim = make(), c = isolate(sim, 'le_pen', 'le_pen_zemmouriste'); c.special_charge = sim.config.balance.special_charge.required_points;
  const target = sim.state.candidates[0]; target.x = 110;
  const n = supporter(sim, 103); n.faction_id = 'melenchon'; const hp = target.resistance;
  activateUltimate(sim, c); tickCombat(sim, sim.hz); assert.ok(n.hidden_durability < sim.config.balance.physical_units.sympathisant.hidden_durability); assert.equal(target.resistance, hp);
  const summon = sim.state.temporary_units.find(t => t.role === 'ZEMMOUR');
  for (let i = 0; i < 2; i++) hit(sim, target, summon, { damage: sim.config.balance.candidate_combat.light_hit_hidden_damage, knockback: 0 }, `test:${i}`);
  assert.equal(summon.expired, true);
});

test('Bardellisation : une seule relève ; KO suivant et respawn sous forme Marine', () => {
  const sim = make(), c = isolate(sim, 'le_pen', 'le_pen_gouvernement'), enemy = sim.state.candidates[0];
  c.special_charge = sim.config.balance.special_charge.required_points;
  activateUltimate(sim, c);
  hit(sim, enemy, c, { damage: 999, knockback: 1 }, 'test:ko');
  assert.equal(c.is_ko, false); assert.equal(c.bardella_form, true); assert.equal(c.resistance, sim.config.balance.candidate_combat.resistance_max); assert.equal(c.special_charge, 0);
  choose(sim, c, 'le_pen_souverainiste'); choose(sim, c, 'le_pen_gouvernement'); c.special_charge = sim.config.balance.special_charge.required_points;
  activateUltimate(sim, c);
  hit(sim, enemy, c, { damage: 999, knockback: 1 }, 'test:second-ko'); assert.equal(c.is_ko, true);
  sim.state.tick = c.respawn_tick; updateCandidateResistance(sim); assert.equal(c.is_ko, false); assert.equal(c.bardella_form, false);
});

test('Super Européiste : riposte en mêlée, aucun renvoi à distance, nettoyage au KO', () => {
  const sim = make(), c = isolate(sim, 'philippe', 'philippe_europeiste'), enemy = sim.state.candidates[0];
  c.special_charge = sim.config.balance.special_charge.required_points; activateUltimate(sim, c); tickCombat(sim);
  const before = enemy.resistance; hit(sim, enemy, c, { damage: 1, knockback: 1 }, 'test:melee'); assert.ok(enemy.resistance < before); assert.ok(c.resistance < sim.config.balance.candidate_combat.resistance_max);
  const after = enemy.resistance; hit(sim, enemy, c, { ranged: true, damage: 1, knockback: 1 }, 'test:ranged'); assert.equal(enemy.resistance, after);
  hit(sim, enemy, c, { ranged: true, damage: 999, knockback: 1 }, 'test:ko'); assert.equal(c.ultimate_effect, null); assert.equal(sim.state.powers.length, 0);
});

test('Le maintien et les styles se sauvegardent ; une sauvegarde invalide est atomiquement rejetée', () => {
  const a = make(), c = a.state.candidates[0]; choose(a, c, 'melenchon_universaliste');
  const b = make(); b.importSnapshot(a.exportSnapshot()); assert.deepEqual(a.state, b.state);
  const bad = JSON.parse(a.exportSnapshot()); bad.candidates[0].current_campaign_style = 'le_pen_souverainiste';
  assert.throws(() => a.importSnapshot(bad)); assert.deepEqual(a.state, b.state);
});

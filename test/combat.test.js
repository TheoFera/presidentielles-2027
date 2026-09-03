import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { validateConfig } from '../src/config.js';
import { attack, fillSpecial, move, setCampaignActive, spawnUnit } from '../src/simulation/commands.js';
import { combatState, controlledZones, electoralDamage, hit, demobilizeUnit } from '../src/simulation/combat-state.js';
import { factionOffers, cabinetTarget } from '../src/simulation/faction-buildings.js';
import { nearestOffer } from '../src/simulation/economy.js';
import { incomePerSecond } from '../src/simulation/territory.js';
import { AIController, LocalHumanController } from '../src/simulation/controllers.js';
import { FixedClock } from '../src/simulation/fixed-clock.js';
import { ringDelta, zoneAt } from '../src/simulation/world.js';
import { moveNpcTowards } from '../src/simulation/tasks.js';

const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'].map(async f => JSON.parse(await readFile(new URL(f, base), 'utf8'))));
const config = validateConfig({ balance, layout, buildings, prototype });
const advance = (sim, n) => { for (let i = 0; i < n; i++) sim.step(); };
function setup(faction = 'melenchon') {
  const cfg = structuredClone(config);
  for (const b of cfg.layout.biomes) for (const z of b.subzones) z.mean_spawn_days = 10000;
  const sim = new GameSimulation(cfg);
  sim.state.npcs = []; sim.state.ai_enabled = false;
  sim.state.candidates.forEach((c, i) => { c.x = 230 + i * 60; c.campaign_active = false; c.interaction_active = false; c.money = 2000; });
  const actor = sim.state.candidates.find(c => c.faction_id === faction);
  actor.x = 110; actor.campaign_active = true; sim.state.local_candidate_id = actor.id;
  return { sim, actor };
}
function unit(sim, role, faction, x, origin = 'campagne_b') {
  const zone = sim.state.world.subzones.find(z => z.id === origin);
  const npc = sim.spawn(zone, x, false);
  npc.role = role; npc.faction_id = faction;
  npc.hidden_durability = config.balance.physical_units[role === 'SERVICE_D_ORDRE' ? 'service_ordre' : role.toLowerCase()].hidden_durability;
  npc.roam_target_x = x; npc.roam_wait_ticks = 100000;
  if (role === 'MILITANT') npc.task = { kind: 'EXPAND', phase: 'WAIT', target_id: null, destination_x: x, destination_subzone_id: zoneAt(sim.state.world, x).id, next_decision_tick: 100000 };
  if (role === 'SERVICE_D_ORDRE') { npc.guard_biome_id = zoneAt(sim.state.world, x).biome_id; npc.guard_anchor_x = x; npc.combat.cooldown_ticks = 100000; }
  return npc;
}
const strike = (sim, actor, ticks = 15) => { sim.step([attack(actor.id)]); advance(sim, ticks - 1); };
const building = (sim, type, zone = 'banlieue_b') => sim.state.buildings.find(b => b.id === `building:${zone}:${type}`);
function own(sim, b, faction, level = 1) { b.owner_id = faction; b.state = 'ACTIVE'; b.level = level; if (b.type === 'faction') b.variant = faction === 'philippe' ? 'cabinet_administratif' : 'service_ordre'; return b; }
function stand(sim, actor, x, ticks = 60) { actor.x = x; actor.axis = 0; actor.interaction_active = true; advance(sim, ticks); }

test('Combo : 8 + 8 + 14 démobilise un S et un M, sans mort ni perte des origines', () => {
  for (const role of ['SYMPATHISANT', 'MILITANT']) {
    const { sim, actor } = setup(); sim.config.balance.physical_units.militant.detection_range = 0;
    const target = unit(sim, role, 'le_pen', actor.x + 1.2);
    const origins = [target.origin_biome_id, target.origin_subzone_id, target.origin_social_point_id];
    strike(sim, actor); assert.equal(target.hidden_durability, 22);
    strike(sim, actor); assert.equal(target.hidden_durability, 14);
    strike(sim, actor); assert.equal(target.role, 'DEMOBILISE'); assert.equal(target.faction_id, null);
    assert.deepEqual(sim.state.hit_results.map(h => h.damage), [8, 8, 14]);
    assert.equal(actor.special_charge, 4);
    assert.deepEqual([target.origin_biome_id, target.origin_subzone_id, target.origin_social_point_id], origins);
    actor.campaign_active = false;
    for (let tick = 0; tick < 3000 && target.role === 'DEMOBILISE'; tick++) sim.step();
    assert.equal(target.role, 'NEUTRE'); assert.equal(target.x, sim.state.world.socialPoints.find(p => p.id === target.origin_social_point_id).x);
  }
});

test('Une attente annule le combo ; le coup manqué ne charge rien ; anticipation et recul sont simulés', () => {
  const { sim, actor } = setup();
  strike(sim, actor); assert.equal(actor.special_charge, 0);
  advance(sim, 30); sim.step([attack(actor.id)]);
  assert.equal(actor.combat.combo_step, 1);
  const target = unit(sim, 'SYMPATHISANT', 'le_pen', actor.x + 1);
  assert.equal(target.hidden_durability, 30); advance(sim, 1); assert.equal(target.hidden_durability, 30);
  advance(sim, 2); assert.equal(target.hidden_durability, 22); assert.ok(target.combat.hitstop_ticks > 0);
  const x = target.x; advance(sim, 5); assert.ok(target.x > x); assert.ok(target.combat.stun_ticks >= 0);
});

test('Les Neutres, alliés et démobilisés sont exclus des impacts ; le SO possède 90 de résistance', () => {
  const { sim, actor } = setup();
  const ally = unit(sim, 'SYMPATHISANT', 'melenchon', actor.x + 0.5);
  const so = unit(sim, 'SERVICE_D_ORDRE', 'le_pen', actor.x + 1.3);
  assert.equal(so.hidden_durability, 3 * config.balance.physical_units.militant.hidden_durability);
  strike(sim, actor); assert.equal(ally.hidden_durability, 30); assert.equal(so.hidden_durability, 82);
  demobilizeUnit(sim, ally); strike(sim, actor); assert.equal(ally.faction_id, null);
});

test('Dégâts électoraux proportionnels uniquement dans les territoires contrôlés, vers les Neutres', () => {
  const { sim, actor } = setup();
  const [a, b, excluded] = sim.state.electorate;
  a.support = { melenchon: 50, le_pen: 15, philippe: 15, neutral: 20 };
  b.support = { melenchon: 40, le_pen: 20, philippe: 20, neutral: 20 };
  const before = structuredClone(excluded.support);
  assert.equal(controlledZones(sim.state, sim.config, 'melenchon').length, 2);
  assert.ok(Math.abs(electoralDamage(sim, 'melenchon', 0.09) - 0.09) < 1e-8);
  assert.equal(a.support.melenchon, 49.95); assert.equal(b.support.melenchon, 39.96);
  assert.deepEqual(excluded.support, before);
  const enemy = sim.state.candidates[1];
  hit(sim, enemy, actor, { damage: 9, electoral_damage: 0.03, knockback: 2 }, 'attack:test');
  assert.equal(actor.electoral_damage_received, 0.03); assert.equal(actor.hits_received, 1);
  assert.equal(actor.hidden_durability, undefined);
  for (const e of sim.state.electorate) assert.ok(Math.abs(Object.values(e.support).reduce((s, v) => s + v, 0) - 100) < 1e-8);
});

test('Un Militant attaque à distance, ignore les S comme cible prioritaire et reprend sa prospection', () => {
  const { sim, actor } = setup();
  const militant = unit(sim, 'MILITANT', 'le_pen', actor.x + 4);
  const s = unit(sim, 'SYMPATHISANT', 'melenchon', militant.x + 0.5);
  advance(sim, 80);
  assert.ok(actor.hits_received > 0); assert.equal(s.hidden_durability, 30);
  assert.equal(militant.combat.target_id, actor.id);
  actor.x = 180; advance(sim, 15); assert.equal(militant.combat.engaged, false); assert.equal(militant.task.kind, 'EXPAND');
});

test('Vitesse des Militants réduite et plafonnée à deux fois celle du joueur', () => {
  assert.equal(config.balance.physical_units.militant.move_speed, 2.4);
  const { sim } = setup(); const n = unit(sim, 'MILITANT', 'melenchon', 100);
  const before = n.x; moveNpcTowards(sim, n, 130, 999);
  assert.ok(n.x - before <= config.prototype.movement.candidate_speed_units_per_second * 2 / 30 + 1e-9);
});

test('Local SO : seuil de 5 S, débit de 70, aucun S consommé ; Philippe obtient un Cabinet', () => {
  for (const faction of ['melenchon', 'le_pen', 'philippe']) {
    const { sim, actor } = setup(faction); const b = building(sim, 'faction');
    for (let i = 0; i < 4; i++) unit(sim, 'SYMPATHISANT', faction, 111 + i, 'banlieue_b');
    stand(sim, actor, b.x); assert.equal(b.state, 'EMPTY');
    unit(sim, 'SYMPATHISANT', faction, 115, 'banlieue_b');
    stand(sim, actor, b.x);
    assert.equal(b.state, 'ACTIVE'); assert.equal(b.variant, faction === 'philippe' ? 'cabinet_administratif' : 'service_ordre');
    assert.equal(actor.spending.BUILD, faction === 'philippe' ? 80 : 70);
    assert.equal(sim.state.npcs.length, 5);
    if (faction === 'philippe') assert.ok(factionOffers(sim.state, sim.config, actor, b).every(o => o.kind !== 'EQUIP'));
  }
});

test('Équipement SO : plus proche Militant du biome, collecte physique, origines conservées, file sérialisée', () => {
  const { sim, actor } = setup(); const b = own(sim, building(sim, 'faction'), actor.faction_id);
  const s = unit(sim, 'SYMPATHISANT', actor.faction_id, b.x + 0.1, 'banlieue_b');
  const m = unit(sim, 'MILITANT', actor.faction_id, b.x + 5, 'paris_b');
  const far = unit(sim, 'MILITANT', actor.faction_id, 140, 'banlieue_c');
  stand(sim, actor, b.x); actor.interaction_active = false;
  assert.equal(actor.spending.EQUIP, 20); assert.equal(b.queue[0].assigned_npc_id, m.id);
  assert.equal(m.task.kind, 'COLLECT_EQUIPMENT'); assert.equal(s.role, 'SYMPATHISANT'); assert.equal(far.role, 'MILITANT');
  const x = m.x; advance(sim, 15); assert.ok(m.x < x);
  const restored = new GameSimulation(sim.config); restored.importSnapshot(sim.exportSnapshot());
  advance(sim, 220); advance(restored, 220);
  assert.deepEqual(restored.state, sim.state); assert.equal(m.role, 'SERVICE_D_ORDRE');
  assert.equal(m.guard_biome_id, 'banlieue'); assert.equal(m.origin_biome_id, 'paris_19e'); assert.equal(m.hidden_durability, 90);
});

test('Amélioration des bâtiments factionnels : repère distinct, trois niveaux, coûts et services par niveau', () => {
  for (const faction of ['melenchon', 'philippe']) {
    const { sim, actor } = setup(faction); const b = own(sim, building(sim, 'faction'), faction);
    stand(sim, actor, b.x + config.balance.faction_interactions.upgrade_offset);
    assert.equal(b.level, 2); assert.equal(actor.spending.UPGRADE, faction === 'philippe' ? 110 : 95);
    stand(sim, actor, b.x + 3.1, 1);
    stand(sim, actor, b.x + config.balance.faction_interactions.upgrade_offset);
    assert.equal(b.level, 3); assert.equal(actor.spending.UPGRADE, faction === 'philippe' ? 270 : 235);
    const offers = factionOffers(sim.state, sim.config, actor, b);
    assert.ok(offers.every(o => o.kind !== 'UPGRADE'));
    assert.equal(offers.find(o => o.kind === (faction === 'philippe' ? 'CLOSE' : 'EQUIP')).cost, faction === 'philippe' ? 90 : 15);
  }
});

test('Défense SO : intercepte un candidat dans son biome, cesse la poursuite à sa sortie', () => {
  const { sim, actor } = setup('le_pen'); const guard = unit(sim, 'SERVICE_D_ORDRE', 'melenchon', 100);
  actor.x = 115; guard.combat.cooldown_ticks = 0;
  advance(sim, 180); assert.ok(guard.x > 100); assert.ok(actor.hits_received > 0);
  actor.x = 160; advance(sim, 1); assert.equal(guard.combat.target_id, null);
  advance(sim, 300); assert.equal(zoneAt(sim.state.world, guard.x).biome_id, 'banlieue');
});

test('Raid directionnel : paiement 45, départ groupé, délai anti-spam, expiration et retour au biome', () => {
  const { sim, actor } = setup(); const b = own(sim, building(sim, 'faction'), actor.faction_id);
  const guards = [unit(sim, 'SERVICE_D_ORDRE', 'melenchon', 140), unit(sim, 'SERVICE_D_ORDRE', 'melenchon', 141)];
  stand(sim, actor, b.x + config.balance.faction_interactions.side_offset);
  actor.interaction_active = false;
  assert.equal(actor.spending.RAID, 45); assert.ok(guards.every(g => g.raid?.direction === 1));
  assert.equal(factionOffers(sim.state, sim.config, actor, b).find(o => o.kind === 'RAID').reason, 'COOLDOWN');
  advance(sim, 250); assert.ok(guards.every(g => zoneAt(sim.state.world, g.x).biome_id !== 'banlieue'));
  const resumed = new GameSimulation(sim.config); resumed.importSnapshot(sim.exportSnapshot());
  advance(sim, 1100); advance(resumed, 1100); assert.deepEqual(resumed.state, sim.state);
  assert.ok(guards.every(g => !g.raid && zoneAt(sim.state.world, g.x).biome_id === 'banlieue'));
});

test('Cabinet : cible directionnelle éligible, fermeture avec perte de niveaux et effets ; reconstruction payante', () => {
  const { sim, actor } = setup('philippe'); const cabinet = own(sim, building(sim, 'faction'), 'philippe');
  const target = own(sim, building(sim, 'financement'), 'melenchon', 3);
  assert.equal(cabinetTarget(sim.state, sim.config, cabinet, 1).id, target.id);
  assert.ok(incomePerSecond(sim.state, sim.config, 'melenchon') > 0.12);
  stand(sim, actor, cabinet.x + config.balance.faction_interactions.side_offset);
  actor.interaction_active = false;
  assert.equal(actor.spending.CLOSE, 120); assert.equal(target.state, 'CLOSED'); assert.equal(target.level, 0);
  assert.equal(target.owner_id, 'melenchon'); assert.equal(incomePerSecond(sim.state, sim.config, 'melenchon'), 0.12);
  assert.ok(sim.state.buildings.filter(b => b.type === 'imprimerie').every(b => b.state === 'ACTIVE' && b.owner_id === null));
  const rival = sim.state.candidates.find(c => c.faction_id === 'melenchon'); rival.campaign_active = true;
  stand(sim, rival, target.x);
  assert.equal(target.level, 1); assert.equal(target.state, 'ACTIVE'); assert.equal(rival.spending.REBUILD, 55);
});

test('Fermeture d’un Local SO : annule les équipements, rembourse les commandes non livrées, libère le Militant', () => {
  const { sim, actor } = setup('melenchon'); const local = own(sim, building(sim, 'faction'), actor.faction_id);
  const m = unit(sim, 'MILITANT', 'melenchon', 120);
  stand(sim, actor, local.x); actor.interaction_active = false;
  const philippe = sim.state.candidates.find(c => c.faction_id === 'philippe'); philippe.campaign_active = true;
  const cabinet = own(sim, building(sim, 'faction', 'banlieue_a'), 'philippe');
  stand(sim, philippe, cabinet.x + config.balance.faction_interactions.side_offset);
  assert.equal(local.state, 'CLOSED'); assert.equal(local.queue.length, 0); assert.equal(actor.refunds_received, 20);
  assert.equal(m.role, 'MILITANT'); assert.notEqual(m.task?.kind, 'COLLECT_EQUIPMENT');
});

test('Les trois spéciaux utilisent le même Attack, consomment la charge et expirent sans unités permanentes', () => {
  for (const faction of ['melenchon', 'le_pen', 'philippe']) {
    const { sim, actor } = setup(faction);
    sim.step([fillSpecial(actor.id)]); assert.equal(actor.special_charge, 10); assert.equal(sim.state.powers.length, 0);
    sim.step([attack(actor.id)]); assert.equal(actor.special_charge, 0); assert.equal(sim.state.powers.length, 1);
    if (faction === 'melenchon') assert.equal(sim.state.temporary_units.length, 5);
    if (faction === 'philippe') assert.equal(sim.state.temporary_units.length, 2);
    if (faction === 'le_pen') assert.equal(sim.state.projectiles[0].kind, 'WAVE');
    const restored = new GameSimulation(sim.config); restored.importSnapshot(sim.exportSnapshot());
    advance(sim, 300); advance(restored, 300); assert.deepEqual(restored.state, sim.state);
    assert.equal(sim.state.temporary_units.length, 0); assert.equal(sim.state.powers.length, 0); assert.equal(sim.state.npcs.length, 0);
  }
});

test('Vague : S démobilisé, M perd 85 %, SO perd 35 %, pas de déplacement de Le Pen', () => {
  const { sim, actor } = setup('le_pen');
  const s = unit(sim, 'SYMPATHISANT', 'melenchon', 112);
  const m = unit(sim, 'MILITANT', 'melenchon', 116); m.combat.stun_ticks = 1000;
  const so = unit(sim, 'SERVICE_D_ORDRE', 'melenchon', 120); so.combat.stun_ticks = 1000;
  const rival = sim.state.candidates.find(c => c.faction_id === 'melenchon'); rival.x = 124;
  sim.state.electorate[0].support = { melenchon: 50, le_pen: 15, philippe: 15, neutral: 20 };
  const x = actor.x;
  sim.step([fillSpecial(actor.id), attack(actor.id)]); advance(sim, 35);
  assert.equal(s.role, 'DEMOBILISE'); assert.equal(m.hidden_durability, 4.5); assert.equal(so.hidden_durability, 58.5);
  assert.equal(actor.x, x); assert.equal(actor.special_charge, 0);
  assert.equal(rival.electoral_damage_received, 0.3); assert.ok(rival.x > 124);
});

test('Plusieurs SO augmentent la pression par leurs attaques, sans ajouter de PV au candidat', () => {
  const pressure = count => {
    const { sim, actor } = setup();
    for (let i = 0; i < count; i++) { const so = unit(sim, 'SERVICE_D_ORDRE', 'le_pen', actor.x + 1.2 + i); so.combat.cooldown_ticks = i * 5; }
    advance(sim, 240); return actor.hits_received;
  };
  assert.ok(pressure(3) > pressure(1));
});

test('Hologrammes : se ruent sur les adversaires et frappent sans produire d’influence', () => {
  const { sim, actor } = setup(); const target = unit(sim, 'SERVICE_D_ORDRE', 'le_pen', 115); target.combat.stun_ticks = 1000;
  sim.step([fillSpecial(actor.id), attack(actor.id)]);
  advance(sim, 90);
  assert.ok(sim.state.hit_results.some(h => h.source_id.startsWith('temporary:')));
  assert.ok(target.hidden_durability < 90);
  assert.equal(sim.state.electorate.find(e => e.subzone_id === 'banlieue_b').influence_per_second.melenchon, config.balance.influence.candidate_presence_per_second);
});

test('CRS : suivent Philippe, bloquent l’approche et interceptent les projectiles', () => {
  const { sim, actor } = setup('philippe');
  unit(sim, 'MILITANT', 'melenchon', 105);
  sim.step([fillSpecial(actor.id), attack(actor.id)]); advance(sim, 80);
  assert.equal(actor.hits_received, 0);
  assert.ok(sim.state.temporary_units.some(t => t.hidden_durability < 120));
  sim.step([move(actor.id, 1)]); advance(sim, 30); sim.step([move(actor.id, 0)]);
  assert.ok(sim.state.temporary_units.every(t => Math.abs(ringDelta(actor.x, t.x, sim.state.world.length)) < 3));
  const enemy = sim.state.candidates[0]; enemy.x = actor.x - 3;
  sim.step([move(enemy.id, 1)]); advance(sim, 40); sim.step([move(enemy.id, 0)]);
  assert.ok(ringDelta(enemy.x, actor.x, sim.state.world.length) > 0.5);
});

test('Snapshot corrompu : charge, attaque, temporaire permanent et SO de Philippe refusés atomiquement', () => {
  const { sim, actor } = setup('philippe'); sim.step([fillSpecial(actor.id), attack(actor.id)]);
  const initial = sim.exportSnapshot();
  for (const mutate of [s => { s.candidates[2].special_charge = 999; }, s => { s.temporary_units[0].expires_tick = -1; }, s => { s.temporary_units[0].temporary = false; }, s => { s.attacks[0].damage = -10; }]) {
    const s = JSON.parse(initial); mutate(s); assert.throws(() => sim.importSnapshot(s), /incompatible/); assert.equal(sim.exportSnapshot(), initial);
  }
  const count = sim.state.npcs.length; sim.step([spawnUnit(actor.id, 'SERVICE_D_ORDRE', 'philippe')]); assert.equal(sim.state.npcs.length, count);
});

test('Humain et IA passent par Attack ; l’appui bref est conservé et ne se répète pas', () => {
  const { sim, actor } = setup();
  const human = new LocalHumanController(); human.attack();
  assert.ok(human.commands(sim.state, actor.id).some(c => c.type === 'Attack'));
  assert.ok(human.commands(sim.state, actor.id).every(c => c.type !== 'Attack'));
  sim.state.ai_enabled = true; const opponent = sim.state.candidates[1]; opponent.x = actor.x + 1;
  const commands = new AIController(sim.config).commands(sim.state, opponent.id);
  assert.ok(commands.some(c => c.type === 'Attack'));
  sim.step(commands); advance(sim, 8); assert.ok(actor.hits_received > 0);
});

test('Combat déterministe à plusieurs FPS, y compris projectiles et unités temporaires', () => {
  const play = fps => {
    const { sim, actor } = setup('le_pen'); unit(sim, 'MILITANT', 'melenchon', 114);
    const clock = new FixedClock(30);
    for (let frame = 0; frame < fps * 4; frame++) clock.advance(1 / fps, () => sim.step(sim.state.tick === 0 ? [fillSpecial(actor.id), attack(actor.id)] : []));
    return sim.state;
  };
  assert.deepEqual(play(30), play(144)); assert.deepEqual(play(30), play(10));
});

test('L’attaque et la vague traversent correctement la jonction du monde', () => {
  const { sim, actor } = setup('le_pen'); actor.x = sim.state.world.length - 1;
  const target = unit(sim, 'SYMPATHISANT', 'melenchon', 0.5);
  sim.step([fillSpecial(actor.id), attack(actor.id)]); advance(sim, 5);
  assert.equal(target.role, 'DEMOBILISE');
});

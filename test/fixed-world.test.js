import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config as base } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { captureSite, neutralizeSite, localUnitDamageMultiplier, updateStrategicSites } from '../src/simulation/strategic-sites.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { convertNeutral } from '../src/simulation/npc-votes.js';
import { updateVehicles, candidateTravelSpeed } from '../src/simulation/vehicles.js';
import { prepareDonations, updateDonationCourier, settleMoney } from '../src/simulation/money.js';
import { buildingOffers, updateEconomy } from '../src/simulation/economy.js';
import { drawVehiclePrompts } from '../src/presentation/carte/vehicles.js';
import { drawBanknote } from '../src/presentation/carte/infrastructure.js';
import { completePopulation } from '../src/simulation/spawns.js';
import { hit } from '../src/simulation/combat-state.js';
import { startDebate } from '../src/simulation/match-lifecycle.js';

const make = () => { const config = structuredClone(base); config.balance.campaign_events.event_enabled = false; const sim = new GameSimulation(config, 42); sim.state.ai_enabled = false; return sim; };
const own = (sim, site, c = sim.state.candidates[0]) => { captureSite(sim, site, c); sim.state.campaign_style_selection = null; return c; };

function promptRenderer(sim) {
  const texts = [], fills = [];
  const ctx = new Proxy({}, { get: (target, key) => {
    if (key === 'measureText') return text => ({ width: text.length * 6 });
    if (key === 'fillText') return text => texts.push(text);
    if (key === 'fill') return () => fills.push(target.fillStyle);
    return target[key] ?? (() => {});
  } });
  return { ctx, texts, fills, config: sim.config, p: sim.config.prototype.presentation,
    width: 1000, metrics: { groundY: 700, characterHeight: 100, pixelsPerUnit: 50 },
    fixedWorldActive: true, fixedWorldState: sim.state, screenX: () => 500 };
}

test('Les jauges de vélo et scooter apparaissent seulement pendant une montée effective', () => {
  for (const type of ['garage_velo', 'garage_scooter']) {
    const sim = make(), site = sim.state.buildings.find(b => b.type === type), c = own(sim, site);
    c.x = site.x;
    const initial = structuredClone(c);
    const blocked = [
      () => { c.x += sim.config.balance.vehicles.garage_radius_units + 0.01; },
      () => { c.axis = 1; }, () => { c.interaction_active = false; },
      () => { c.combat.jump_tick = sim.state.tick; }, () => { c.combat.height = 0.5; },
      () => { c.combat.attack_id = 'attaque'; }, () => { c.combat.stun_ticks = 3; },
      () => { c.combat.hitstop_ticks = 2; }, () => { c.combat.engaged = true; },
      () => { c.dash_active = true; }, () => { c.style_interaction_held = true; },
      () => { c.is_ko = true; }, () => { c.eliminated = true; },
      () => { c.campaign_debate_id = 'débat'; }, () => { c.crisis_meeting_id = 'crise'; },
      () => { sim.state.campaign_style_selection = {}; }, () => { sim.state.phase = 'DEBATE'; },
      () => { site.owner_id = 'autre'; }, () => { site.state = 'NEUTRAL'; },
    ];
    for (const block of blocked) {
      Object.assign(c, structuredClone(initial));
      sim.state.phase = 'CAMPAIGN'; sim.state.campaign_style_selection = null;
      site.owner_id = c.faction_id; site.state = 'ACTIVE';
      // Même une ancienne attente reçue par le réseau ne doit pas afficher une fausse jauge.
      c.vehicle_hold = { site_id: site.id, elapsed_ticks: 5 };
      block();
      const renderer = promptRenderer(sim);
      drawVehiclePrompts(renderer, sim.state);
      assert.deepEqual(renderer.texts, []);
      updateVehicles(sim);
      assert.equal(c.vehicle_hold, null);
    }
    Object.assign(c, structuredClone(initial));
    sim.state.phase = 'CAMPAIGN'; sim.state.campaign_style_selection = null;
    site.owner_id = c.faction_id; site.state = 'ACTIVE';
    const renderer = promptRenderer(sim);
    drawVehiclePrompts(renderer, sim.state);
    assert.deepEqual(renderer.texts, [], 'Pas de jauge sans attente démarrée');
    updateVehicles(sim);
    drawVehiclePrompts(renderer, sim.state);
    assert.deepEqual(renderer.texts, [type === 'garage_velo' ? 'Monter sur le vélo' : 'Monter sur le scooter']);
    assert.ok(renderer.fills.includes('#b9d0a4'), 'La jauge affichée se remplit');
  }
});

test('Les indications d’achat suivent la disponibilité réelle du candidat', () => {
  const sim = make(), c = sim.state.candidates[0];
  c.x = sim.state.buildings.find(b => b.type === 'institut_sondage').x;
  c.money = 100;
  sim.state.campaign_style_selection = null;
  updateEconomy(sim);
  assert.ok(c.purchase_hold);
  const initial = structuredClone(c);
  for (const block of [
    () => { c.vehicle = { type: 'velo' }; }, () => { c.interaction_active = false; },
    () => { c.campaign_active = false; }, () => { c.style_interaction_held = true; },
    () => { c.combat.attack_id = 'attaque'; }, () => { c.combat.jump_tick = 1; },
    () => { c.combat.stun_ticks = 3; }, () => { c.is_ko = true; },
    () => { c.interaction_pause_until_tick = sim.state.tick + 2; },
    () => { sim.state.campaign_style_selection = {}; },
  ]) {
    Object.assign(c, structuredClone(initial)); sim.state.campaign_style_selection = null;
    block();
    const renderer = promptRenderer(sim);
    drawBanknote(renderer, sim.state);
    assert.deepEqual(renderer.texts, []);
    updateEconomy(sim);
    assert.equal(c.purchase_hold, null);
  }
  Object.assign(c, structuredClone(initial)); sim.state.campaign_style_selection = null;
  const renderer = promptRenderer(sim);
  drawBanknote(renderer, sim.state);
  assert.ok(renderer.fills.includes('#b9d0a4'), 'Un achat en cours affiche sa progression');
  c.money = 0;
  updateEconomy(sim);
  const unfunded = promptRenderer(sim);
  drawBanknote(unfunded, sim.state);
  assert.ok(unfunded.texts.some(text => text.startsWith('✗')), 'Le manque d’argent reste expliqué');
  assert.ok(!unfunded.fills.includes('#b9d0a4'), 'Aucune progression pour un achat bloqué');
});

test('Le tableau définit 18 contrôles, 6 meetings centraux et 3 instituts, sans hasard', () => {
  const sim = make(), other = new GameSimulation(sim.config, 91);
  assert.deepEqual(sim.state.buildings, other.state.buildings); assert.equal(sim.state.buildings.length, 27);
  for (const zone of sim.state.world.subzones) {
    const sites = sim.state.buildings.filter(b => b.subzone_id === zone.id);
    assert.equal(sites.filter(b => b.controls_zone).length, 1); assert.ok(sites.every(b => b.x > zone.start && b.x < zone.end));
    if (zone.local_index === 1) assert.equal(sites.find(b => b.type === 'meeting').x, zone.center);
  }
  assert.equal(sim.state.buildings.filter(b => b.type === 'permanence').length, 9);
  assert.equal(sim.state.buildings.filter(b => b.type.startsWith('garage_')).length, 3);
  assert.equal(sim.state.buildings.filter(b => b.type === 'imprimerie').length, 0);
});
test('Les zones d’achat des façades restaurées couvrent leurs entrées peintes', () => {
  const sim = make();
  // Intervalles relevés sur les tuiles de 1 920 px, indépendamment des coordonnées du jeu.
  const entrances = [
    ['site:paris_b', 510, 700],
    ['site:banlieue_b', 375, 460],
    ['site:retraites_c', 1235, 1325],
    ['site:riches_a', 975, 1055],
    ['site:riches_b', 365, 450],
    ['site:riches_c', 240, 620],
    ['site:riches_c:institut_sondage', 1025, 1115],
    ['site:campagne_a', 1435, 1670],
    ['site:periurbain_b', 175, 455],
    ['site:retraites_b', 330, 405],
  ];
  for (const [id, left, right] of entrances) {
    const site = sim.state.buildings.find(b => b.site_id === id);
    const zone = sim.state.world.subzones.find(z => z.id === site.subzone_id);
    // La zone d'achat couvre la façade : l'entrée peinte doit y être entièrement.
    const pixelX = (site.x - zone.start) / zone.width * 1920, faction = base.balance.faction_interactions;
    // Bâtiment de faction : achats au centre, actions sur les côtés.
    const half = (site.type === 'faction' ? faction.side_offset + faction.side_radius : site.interaction_radius || base.balance.interaction.radius_units) * 80;
    assert.ok(pixelX - half <= left && pixelX + half >= right, `${id} : entrée hors de la zone d’achat (${pixelX} px)`);
  }
});

test('Le vélo se récupère devant le garage peint et plus à son ancien emplacement', () => {
  const sim = make(), site = sim.state.buildings.find(b => b.type === 'garage_velo'), c = own(sim, site);
  const zone = sim.state.world.subzones.find(z => z.id === site.subzone_id);
  c.interaction_active = true;
  c.x = zone.start + zone.width * 445 / 1920;
  updateVehicles(sim);
  assert.equal(c.vehicle_hold, null);
  c.x = zone.start + zone.width * 603 / 1920;
  for (let i = 0; i < sim.secondsToTicks(sim.config.balance.vehicles.mount_seconds); i++) updateVehicles(sim);
  assert.equal(c.vehicle?.type, 'velo');
  assert.equal(c.vehicle.site_id, site.id);
});

test('Le local détermine le contrôle malgré une majorité adverse ; un institut ne contrôle pas', () => {
  const sim = make(); completePopulation(sim);
  const site = sim.state.buildings.find(b => b.type === 'garage_velo'), c = own(sim, site);
  sim.state.npcs.filter(n => n.origin_subzone_id === site.subzone_id).forEach(n => convertNeutral(sim, n, 'le_pen'));
  refreshElectoralState(sim.state); const zone = sim.state.electorate.find(z => z.subzone_id === site.subzone_id);
  assert.equal(zone.leader, 'le_pen'); assert.equal(zone.controller, c.faction_id);
  neutralizeSite(sim, site); refreshElectoralState(sim.state); assert.equal(zone.controller, null);
  const institute = sim.state.buildings.find(b => b.type === 'institut_sondage'); own(sim, institute);
  refreshElectoralState(sim.state); assert.notEqual(sim.state.electorate.find(z => z.subzone_id === institute.subzone_id).controller, c.faction_id);
});
test('Résistance et difficulté de persuasion restent limitées à la sous-zone contrôlée', () => {
  const sim = make(), site = sim.state.buildings.find(b => b.type === 'garage_velo'), c = own(sim, site);
  const target = sim.state.npcs.find(n => n.origin_subzone_id === site.subzone_id); target.x = site.x;
  const enemy = sim.state.candidates[1]; enemy.x = site.x; const controlledTime = sim.persuasionTicks(enemy, target);
  convertNeutral(sim, target, c.faction_id); assert.equal(localUnitDamageMultiplier(sim.state, sim.config, target), 1 / 1.5);
  target.x += 24; assert.equal(localUnitDamageMultiplier(sim.state, sim.config, target), 1);
  target.x = site.x; neutralizeSite(sim, site); assert.ok(controlledTime >= sim.persuasionTicks(enemy, target) * 1.59);
});
test('Les quartiers tenus par Philippe protègent davantage ses soutiens', () => {
  const sim = make(), site = sim.state.buildings.find(b => b.type === 'garage_velo');
  const c = own(sim, site, sim.state.candidates.find(x => x.faction_id === 'philippe'));
  const target = sim.state.npcs.find(n => n.origin_subzone_id === site.subzone_id); target.x = site.x;
  convertNeutral(sim, target, c.faction_id);
  assert.equal(localUnitDamageMultiplier(sim.state, sim.config, target), 1 / sim.config.balance.zone_control.philippe_supporter_health_multiplier);
  assert.ok(localUnitDamageMultiplier(sim.state, sim.config, target) < 1 / 1.5);
});
test('Le contrôle persiste sans soutiens ; une pression hostile peut le neutraliser', () => {
  const sim = make(), site = sim.state.buildings.find(b => b.type === 'garage_velo'); own(sim, site);
  for (let i = 0; i < 600; i++) updateStrategicSites(sim); assert.equal(site.state, 'ACTIVE');
  const guard = sim.state.npcs[0]; guard.role='SERVICE_D_ORDRE'; guard.faction_id='le_pen'; guard.pressure_target_id=site.id;
  guard.raid = { id: 'test' };
  for (let i = 0; i < 600; i++) updateStrategicSites(sim); assert.equal(site.state, 'NEUTRAL');
});
test('Les dons vont à la permanence et sa cagnotte tombe au sol si elle est perdue', () => {
  const sim=make(), site=sim.state.buildings.find(b=>b.type==='permanence'), c=own(sim,site);
  const npc=sim.state.npcs.find(n=>n.origin_subzone_id===site.subzone_id); convertNeutral(sim,npc,c.faction_id);
  npc.x=site.x;npc.next_donation_tick=0;c.x=site.x+10;
  prepareDonations(sim);assert.equal(npc.task.service_id,site.id);updateDonationCourier(sim,npc);
  assert.ok(site.stored_money_cents>0);const sum=site.stored_money_cents;
  const before=sim.state.money_pickups.reduce((n,p)=>n+p.amount_cents,0);neutralizeSite(sim,site);
  assert.equal(sim.state.money_pickups.reduce((n,p)=>n+p.amount_cents,0)-before,sum);
});
test('Tracts à la permanence ; aucun bâtiment de financement sur la carte', () => {
  const sim=make(), site=sim.state.buildings.find(b=>b.type==='permanence'), c=own(sim,site);
  c.money=10;const npc=sim.state.npcs.find(n=>n.origin_subzone_id===site.subzone_id);convertNeutral(sim,npc,c.faction_id);
  assert.equal(buildingOffers(sim.state,sim.config,c,site)[0].kind,'PRINT');
  assert.equal(sim.state.buildings.filter(b=>b.type==='financement').length,0);
});
test('Vélo et scooter : propriétaire, attente continue, vitesse accrue et abandon sur action', () => {
  for (const type of ['garage_velo','garage_scooter']) {
    const sim=make(),site=sim.state.buildings.find(b=>b.type===type),c=sim.state.candidates[0];c.x=site.x;
    for(let i=0;i<100;i++)updateVehicles(sim);assert.equal(c.vehicle,null);
    own(sim,site);const duration=sim.secondsToTicks(sim.config.balance.vehicles.mount_seconds);
    for(let i=0;i<duration-1;i++)updateVehicles(sim);assert.equal(c.vehicle,null);
    c.axis=1;updateVehicles(sim);assert.equal(c.vehicle_hold,null);c.axis=0;
    for(let i=0;i<duration;i++)updateVehicles(sim);
    assert.equal(c.vehicle.type,type==='garage_velo'?'velo':'scooter');assert.ok(candidateTravelSpeed(sim.config,c)>sim.config.prototype.movement.candidate_speed_units_per_second);
    for(const action of ['Jump','Attack','PressAttack','Dash','ActivateUltimate','HoldCampaignStyle']) {
      c.vehicle={type:'velo',site_id:site.id};sim.applyCommand({type:action,candidateId:c.id,active:true});assert.equal(c.vehicle,null,action);
    }
  }
});
test('Une attente de garage et un véhicule reprennent à l’identique après sauvegarde', () => {
  const sim = make(), site = sim.state.buildings.find(b => b.type === 'garage_scooter'), c = own(sim, site);
  c.x = site.x;
  for (let i = 0; i < sim.secondsToTicks(sim.config.balance.vehicles.mount_seconds) / 2; i++) sim.step();
  assert.ok(c.vehicle_hold);
  const restored = make(); restored.importSnapshot(sim.exportSnapshot());
  for (let i = 0; i < 50; i++) { sim.step(); restored.step(); }
  assert.ok(c.vehicle); assert.deepEqual(restored.state, sim.state);
  const saved = JSON.parse(sim.exportSnapshot()); saved.candidates[0].vehicle.type = 'voiture';
  assert.throws(() => restored.importSnapshot(saved), /véhicule invalide/);
  assert.deepEqual(restored.state, sim.state, 'Une sauvegarde refusée ne modifie pas la partie');
});

test('Un coup reçu et la soirée électorale font disparaître le véhicule', () => {
  const sim = make(), site = sim.state.buildings.find(b => b.type === 'garage_velo'), c = own(sim, site);
  c.x = site.x; c.vehicle = { type: 'velo', site_id: site.id };
  const rival = sim.state.candidates[1]; rival.x = c.x;
  hit(sim, rival, c, { damage: 5, knockback: 0, electoral_damage: 0 }, 'test:velo');
  assert.equal(c.vehicle, null);
  c.vehicle = { type: 'velo', site_id: site.id }; startDebate(sim);
  assert.equal(c.vehicle, null);
});

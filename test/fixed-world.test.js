import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config as base } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { captureSite, neutralizeSite, localUnitDamageMultiplier, updateStrategicSites } from '../src/simulation/strategic-sites.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { convertNeutral } from '../src/simulation/npc-votes.js';
import { updateVehicles, candidateTravelSpeed } from '../src/simulation/vehicles.js';
import { prepareDonations, updateDonationCourier, settleMoney } from '../src/simulation/money.js';
import { buildingOffers } from '../src/simulation/economy.js';
import { completePopulation } from '../src/simulation/spawns.js';
import { panoramaFrame } from '../src/presentation/fixed-world.js';
import { hit } from '../src/simulation/combat-state.js';
import { startDebate } from '../src/simulation/match-lifecycle.js';

const make = () => { const config = structuredClone(base); config.balance.campaign_events.event_enabled = false; const sim = new GameSimulation(config, 42); sim.state.ai_enabled = false; return sim; };
const own = (sim, site, c = sim.state.candidates[0]) => { captureSite(sim, site, c); sim.state.campaign_style_selection = null; return c; };

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
test('Le contrôle persiste sans soutiens ; une pression hostile peut le neutraliser', () => {
  const sim = make(), site = sim.state.buildings.find(b => b.type === 'garage_velo'); own(sim, site);
  for (let i = 0; i < 600; i++) updateStrategicSites(sim); assert.equal(site.state, 'ACTIVE');
  const guard = sim.state.npcs[0]; guard.role='SERVICE_D_ORDRE'; guard.faction_id='le_pen'; guard.pressure_target_id=site.id;
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
test('Proportions conservées et projection périodique au raccord de la carte', () => {
  const sim=make(),world=sim.state.world;
  for(const ppu of [15,35,70])for(const biome of base.layout.biomes){
    const renderer={cameraX:0,metrics:{groundY:600,anchorX:500,pixelsPerUnit:ppu}};
    const image={naturalWidth:2172,naturalHeight:724}; const a=panoramaFrame(renderer,world,biome.id,image);renderer.cameraX=world.length;
    const b=panoramaFrame(renderer,world,biome.id,image); assert.ok(Math.abs(a.width/a.height-3)<1e-12);assert.deepEqual(a,b);
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

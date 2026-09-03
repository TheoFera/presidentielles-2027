import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { buildingOffers, updateEconomy } from '../src/simulation/economy.js';
import { remainingCampaignBudget } from '../src/simulation/campaign-budget.js';
import { populationByOrigin } from '../src/simulation/territory.js';
import { demobilizeUnit } from '../src/simulation/combat-state.js';
import { startArena, finishArena } from '../src/simulation/match-lifecycle.js';

function quiet(limit = 16800) {
  const cfg = structuredClone(config);
  cfg.balance.money.campaign_spending_limit = limit;
  for (const biome of cfg.layout.biomes) for (const zone of biome.subzones) zone.mean_spawn_days = 10000;
  const sim = new GameSimulation(cfg);
  sim.state.npcs = []; sim.state.ai_enabled = false;
  sim.state.candidates.forEach(c => { c.campaign_active = false; c.interaction_active = false; c.money = 20000; });
  return sim;
}

function recruit(sim, role = 'SYMPATHISANT', faction = 'melenchon', origin = 'banlieue_b', x = 108) {
  const zone = sim.state.world.subzones.find(z => z.id === origin);
  const npc = sim.spawn(zone, x, false);
  assert.ok(npc, `Le scénario doit respecter le plafond de ${origin}`);
  Object.assign(npc, { role, faction_id: faction, hidden_durability: role === 'SERVICE_D_ORDRE' ? 90 : 30,
    roam_target_x: x, roam_wait_ticks: 100000 });
  if (role === 'SERVICE_D_ORDRE') { npc.guard_biome_id = 'banlieue'; npc.guard_anchor_x = x; }
  return npc;
}

test('Budget : tous les achats refusent le dépassement, mais autorisent la limite exacte', () => {
  const kinds = new Set();
  for (const faction of ['melenchon', 'philippe']) {
    const sim = quiet(); const c = sim.state.candidates.find(c => c.faction_id === faction);
    for (let i = 0; i < 9; i++) recruit(sim, 'SYMPATHISANT', faction);
    recruit(sim, 'MILITANT', faction, 'banlieue_a');
    if (faction === 'melenchon') recruit(sim, 'SERVICE_D_ORDRE', faction, 'banlieue_a');
    const rival = sim.state.buildings.find(b => b.type === 'financement' && b.subzone_id === 'paris_b');
    Object.assign(rival, { state: 'ACTIVE', owner_id: 'le_pen', level: 1 });
    for (const building of sim.state.buildings.filter(b => b.subzone_id === 'banlieue_b')) {
      for (const status of building.type === 'imprimerie' ? ['ACTIVE'] : ['EMPTY', 'ACTIVE', 'CLOSED']) {
        building.state = status; building.level = status === 'ACTIVE' ? 1 : 0;
        building.owner_id = building.type === 'imprimerie' || status === 'EMPTY' ? null : faction;
        if (building.type === 'faction') building.variant = faction === 'philippe' ? 'cabinet_administratif' : 'service_ordre';
        c.total_spent = 0;
        for (const offer of buildingOffers(sim.state, sim.config, c, building).filter(o => o.enabled)) {
          kinds.add(offer.kind);
          c.total_spent = 16800 - offer.cost + 1;
          const blocked = buildingOffers(sim.state, sim.config, c, building).find(o => o.key === offer.key);
          assert.equal(blocked.enabled, false, offer.kind);
          assert.equal(blocked.reason, 'CAMPAIGN_BUDGET_EXCEEDED');
          assert.equal(blocked.affordable, true);
          c.total_spent = 16800 - offer.cost;
          assert.equal(buildingOffers(sim.state, sim.config, c, building).find(o => o.key === offer.key).enabled, true);
        }
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ['BUILD', 'UPGRADE', 'REBUILD', 'PRINT', 'EQUIP', 'RAID', 'CLOSE', 'MEETING'].sort());
});

test('Budget : les paiements répétés s’arrêtent au plafond malgré les revenus et fonds de test', () => {
  const sim = quiet(24); const c = sim.state.candidates[0];
  recruit(sim);
  const printer = sim.state.buildings.find(b => b.id === 'service:banlieue:imprimerie');
  c.x = printer.x; c.campaign_active = true; c.interaction_active = true;
  for (let i = 0; i < 240; i++) sim.step();
  assert.equal(c.total_spent, 24); assert.equal(c.spending.PRINT, 24);
  assert.equal(sim.state.transactions.length, 2);
  assert.equal(remainingCampaignBudget(c, sim.config), 0);
  assert.equal(c.purchase_hold, null); assert.ok(c.money > 10000);
  sim.applyCommand({ type: 'DebugGrantMoney', candidateId: c.id });
  for (let i = 0; i < 60; i++) sim.step();
  assert.equal(c.total_spent, 24); assert.equal(sim.state.transactions.length, 2);
  const restored = new GameSimulation(sim.config); restored.importSnapshot(sim.exportSnapshot());
  assert.equal(remainingCampaignBudget(restored.state.candidates[0], sim.config), 0);
  startArena(sim); finishArena(sim, 'le_pen');
  assert.equal(remainingCampaignBudget(sim.state.candidates[0], sim.config), 0);
  for (let i = 0; i < 60; i++) sim.step();
  assert.equal(sim.state.candidates[0].total_spent, 24);
});

test('Budget : un plafond atteint pendant une présence annule le paiement en cours', () => {
  const sim = quiet(35); const c = sim.state.candidates[0]; recruit(sim); recruit(sim);
  const building = sim.state.buildings.find(b => b.id === 'building:banlieue_b:permanence');
  c.x = building.x; c.campaign_active = true; c.interaction_active = true;
  updateEconomy(sim); assert.ok(c.purchase_hold);
  c.total_spent = 1; c.spending.PRINT = 1;
  updateEconomy(sim);
  assert.equal(c.purchase_hold, null); assert.equal(building.state, 'EMPTY');
  assert.equal(sim.state.transactions.length, 0);
});

test('Population : tous les rôles et camps restent comptés à leur naissance, même en déplacement', () => {
  const sim = quiet(); const zone = sim.state.world.subzones.find(z => z.id === 'campagne_c');
  const roles = ['NEUTRE', 'SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE', 'DEMOBILISE'];
  for (const [i, role] of roles.entries()) {
    const n = recruit(sim, role, i % 2 ? 'le_pen' : 'melenchon', zone.id, 108);
    if (['NEUTRE', 'DEMOBILISE'].includes(role)) n.faction_id = null;
  }
  assert.equal(zone.max_npcs_by_origin, 5);
  assert.equal(populationByOrigin(sim.state, zone.id), 5);
  assert.equal(populationByOrigin(sim.state, 'banlieue_b'), 0);
  const before = sim.exportSnapshot();
  assert.equal(sim.spawn(zone), null);
  assert.equal(sim.exportSnapshot(), before); // No ID or random draw consumed by a refused spawn.
  const n = sim.state.npcs[1];
  const identity = [n.id, n.origin_biome_id, n.origin_subzone_id, n.origin_social_point_id];
  demobilizeUnit(sim, n);
  n.x = sim.state.world.socialPoints.find(p => p.id === n.origin_social_point_id).x;
  sim.updateNpcs();
  assert.equal(n.role, 'NEUTRE'); assert.equal(sim.spawn(zone), null);
  assert.deepEqual([n.id, n.origin_biome_id, n.origin_subzone_id, n.origin_social_point_id], identity);
});

test('Population : le débogage respecte aussi le plafond et une vraie suppression libère une place', () => {
  const sim = quiet(); const zone = sim.state.world.subzones.find(z => z.id === 'banlieue_b');
  for (let i = 0; i < zone.max_npcs_by_origin + 3; i++) sim.applyCommand({ type: 'DebugSpawnUnit', candidateId: 'candidate:melenchon', factionId: 'melenchon', role: 'MILITANT' });
  assert.equal(populationByOrigin(sim.state, zone.id), zone.max_npcs_by_origin);
  assert.equal(sim.state.events.at(-1).type, 'DebugSpawnCapacityReached');
  sim.state.npcs.pop();
  const timer = sim.state.spawn_timers.find(t => t.subzone_id === zone.id);
  timer.elapsed_ticks = timer.interval_ticks - 2;
  sim.step(); assert.equal(populationByOrigin(sim.state, zone.id), zone.max_npcs_by_origin - 1);
  sim.step(); assert.equal(populationByOrigin(sim.state, zone.id), zone.max_npcs_by_origin);
});

test('Sauvegardes : dépassements de budget et de population refusés sans modifier la partie', () => {
  const sim = quiet(); const zone = sim.state.world.subzones.find(z => z.id === 'banlieue_b');
  for (let i = 0; i < zone.max_npcs_by_origin; i++) recruit(sim);
  const before = sim.exportSnapshot();
  const tooMany = JSON.parse(before); const extra = structuredClone(tooMany.npcs[0]);
  extra.id = `npc:${tooMany.next_npc_id++}`; tooMany.npcs.push(extra);
  assert.throws(() => sim.importSnapshot(tooMany), /population d’origine/);
  const tooSpent = JSON.parse(before); tooSpent.candidates[0].total_spent = 16801;
  assert.throws(() => sim.importSnapshot(tooSpent), /plafond de dépenses/);
  assert.equal(sim.exportSnapshot(), before);
});

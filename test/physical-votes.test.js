import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { convertNeutral, neutralizeSupporter } from '../src/simulation/npc-votes.js';
import { triggerMeeting, updateElectoralBuildings } from '../src/simulation/electoral-buildings.js';
import { startDebate, finishDebate } from '../src/simulation/match-lifecycle.js';
import { aiEconomicTarget, buildingOffers, nearestOffer } from '../src/simulation/economy.js';
import { commitFactionAction } from '../src/simulation/faction-buildings.js';
import { strategicAICommands } from '../src/simulation/ai-strategy.js';
import { zoneAt } from '../src/simulation/world.js';
import { captureSite, updateStrategicSites } from '../src/simulation/strategic-sites.js';

const base = new URL('../donnees-jeu/', import.meta.url);
const [balance, layout, buildings, prototype, campaignCatalog] = await Promise.all(
  ['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json', 'campaign_events.json']
    .map(async name => JSON.parse(await readFile(new URL(name, base), 'utf8'))),
);
const config = validateConfig({ balance, layout, buildings, prototype, campaignCatalog });
const make = () => {
  const sim = new GameSimulation(config);
  sim.state.ai_enabled = false;
  for (const candidate of sim.state.candidates) candidate.campaign_active = false;
  return sim;
};
const advance = (sim, ticks) => { for (let tick = 0; tick < ticks; tick++) sim.step(); };

test('200 électeurs exacts au premier tour, aucun PNJ ajouté au second', () => {
  const sim = make();
  assert.equal(sim.state.npcs.length, 25);
  assert.deepEqual(config.layout.biomes.map(biome => biome.subzones.reduce((sum, zone) => sum + zone.max_npcs_by_origin, 0)), [34, 34, 34, 34, 34, 30]);
  startDebate(sim);
  assert.equal(sim.state.npcs.length, 200);
  assert.equal(sim.state.actualGameState.national_counts.pending, 0);
  finishDebate(sim, 'philippe');
  advance(sim, 90);
  assert.equal(sim.state.npcs.length, 200);
  assert.equal(sim.spawn(sim.state.world.subzones[0]), null);
});

test('une conversion vaut exactement une voix, une promotion ne crée pas de voix', () => {
  const sim = make();
  const npc = sim.state.npcs[0];
  convertNeutral(sim, npc, 'melenchon');
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  assert.equal(sim.state.actualGameState.national_support.melenchon, 0.5);
  npc.role = 'MILITANT';
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  npc.role = 'SERVICE_D_ORDRE';
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  npc.role = 'SYMPATHISANT';
  neutralizeSupporter(sim, npc, 'TEST');
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 0);
  assert.equal(sim.state.actualGameState.national_counts.neutral, 25);
});

test('la tour change un seul PNJ admissible à chaque diffusion', () => {
  const sim = make();
  const interval = sim.secondsToTicks(sim.config.balance.buildings.tour_communication.broadcast_interval_seconds);
  const tower = sim.state.buildings.find(building => building.type === 'tour_communication');
  Object.assign(tower, { owner_id: 'melenchon', state: 'ACTIVE', active: true, neutral: false, level: 1 });
  for (let tick = 1; tick <= interval; tick++) { sim.state.tick = tick; updateElectoralBuildings(sim); }
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 0);
  sim.state.tick++; updateElectoralBuildings(sim); refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  for (let tick = 0; tick < interval - 1; tick++) { sim.state.tick++; updateElectoralBuildings(sim); }
  refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 1);
  sim.state.tick++; updateElectoralBuildings(sim); refreshElectoralState(sim.state);
  assert.equal(sim.state.actualGameState.national_counts.melenchon, 2);
});

test('le meeting exige le promontoire et son onde reste dans la sous-zone', () => {
  const sim = make();
  const podium = sim.state.buildings.find(building => building.type === 'meeting');
  const candidate = sim.state.candidates[0];
  candidate.x = podium.x;
  const local = sim.state.npcs.filter(npc => zoneAt(sim.state.world, npc.x).id === podium.subzone_id);
  assert.ok(local.length >= 1);
  local[0].role = 'SYMPATHISANT'; local[0].faction_id = 'le_pen';
  const outside = sim.state.npcs.find(npc => zoneAt(sim.state.world, npc.x).id !== podium.subzone_id);
  outside.role = 'SYMPATHISANT'; outside.faction_id = 'le_pen';
  // Le témoin reste loin du meeting et des candidats pendant toute la propagation.
  outside.x = sim.state.world.subzones.find(z => z.id === 'periurbain_a').center;
  outside.roam_target_x = outside.x;
  candidate.podium_site_id = podium.id; candidate.combat.height = config.balance.buildings.meeting.podium_height;
  assert.equal(triggerMeeting(sim, podium, 'melenchon', candidate.id), true);
  advance(sim, sim.secondsToTicks(15));
  assert.equal(podium.meetings_held, 1);
  advance(sim, sim.secondsToTicks(config.balance.buildings.meeting.wave_visual_seconds) + 1);
  assert.equal(local[0].role, 'NEUTRE');
  assert.equal(outside.faction_id, 'le_pen');
  assert.equal(sim.state.npcs.filter(npc => zoneAt(sim.state.world, npc.x).id === podium.subzone_id && npc.role === 'NEUTRE').length, 1);
});

test('l’onde de fin de meeting convertit chaque PNJ quand le cercle l’atteint', () => {
  const sim = make();
  const podium = sim.state.buildings.find(building => building.type === 'meeting');
  const zone = sim.state.world.subzones.find(item => item.id === podium.subzone_id);
  const candidate = sim.state.candidates[0];
  for (const other of sim.state.candidates.slice(1)) other.campaign_active = false;
  candidate.x = podium.x; candidate.axis = 0;
  const near = sim.state.npcs.find(npc => npc.role === 'NEUTRE');
  const far = sim.state.npcs.find(npc => npc !== near && npc.role === 'NEUTRE');
  candidate.podium_site_id = podium.id; candidate.combat.height = config.balance.buildings.meeting.podium_height;
  assert.equal(triggerMeeting(sim, podium, 'melenchon', candidate.id), true);
  advance(sim, sim.secondsToTicks(config.balance.buildings.meeting.hold_seconds) - 1);
  // Les PNJ restent en place pendant l’onde pour mesurer l’instant de la conversion.
  const freeze = () => { near.x = podium.x + 0.05; far.x = zone.start + 0.05; near.roam_wait_ticks = far.roam_wait_ticks = 999; };
  freeze(); sim.step(); freeze();
  assert.equal(podium.meetings_held, 1);
  assert.equal(podium.meeting_wave_faction_id, 'melenchon');
  sim.step(); freeze();
  assert.equal(near.role, 'SYMPATHISANT');
  assert.equal(far.role, 'NEUTRE');
  for (let i = 0; i < sim.secondsToTicks(config.balance.buildings.meeting.wave_visual_seconds); i++) { sim.step(); freeze(); }
  assert.equal(far.role, 'SYMPATHISANT');
  assert.equal(podium.meeting_wave_faction_id, null);
});

test('le meeting garde sa progression cinq secondes puis s’annule', () => {
  const sim = make();
  const podium = sim.state.buildings.find(building => building.type === 'meeting');
  const candidate = sim.state.candidates[0];
  candidate.x = podium.x;
  candidate.podium_site_id = podium.id; candidate.combat.height = config.balance.buildings.meeting.podium_height;
  triggerMeeting(sim, podium, 'melenchon', candidate.id);
  advance(sim, 60);
  assert.equal(podium.meeting_hold_ticks, 60);
  candidate.podium_site_id = null; candidate.combat.height = 0;
  advance(sim, 120);
  assert.equal(podium.meeting_hold_ticks, 60);
  candidate.podium_site_id = podium.id; candidate.combat.height = config.balance.buildings.meeting.podium_height;
  sim.step();
  assert.equal(podium.meeting_hold_ticks, 61);
  candidate.podium_site_id = null; candidate.combat.height = 0;
  advance(sim, 151);
  assert.equal(podium.meeting_candidate_id, null);
  assert.equal(podium.meetings_held, 0);
});

test('l’IA remonte sur le promontoire si elle tombe pendant son meeting', () => {
  const sim = make();
  const podium = sim.state.buildings.find(building => building.type === 'meeting');
  const candidate = sim.state.candidates.find(item => item.faction_id === 'le_pen');
  candidate.x = podium.x;
  sim.state.ai_enabled = true;
  candidate.podium_site_id = podium.id; candidate.combat.height = config.balance.buildings.meeting.podium_height;
  assert.equal(triggerMeeting(sim, podium, candidate.faction_id, candidate.id), true);
  candidate.podium_site_id = null; candidate.combat.height = 0;
  assert.ok(strategicAICommands(sim.state, config, candidate).some(command => command.type === 'Jump'));
});

test('depuis le sol, le meeting ne s’affiche pas et ne peut pas être payé ; sur scène, il devient disponible', () => {
  const cfg = structuredClone(config);
  cfg.balance.buildings.meeting.required_presence_N1 = 0;
  const sim = new GameSimulation(cfg, 42);
  sim.state.ai_enabled = false;
  const podium = sim.state.buildings.find(building => building.type === 'meeting');
  const candidate = sim.state.candidates[0];
  candidate.x = podium.x; candidate.axis = 0; candidate.money = 1000;
  assert.equal(buildingOffers(sim.state, cfg, candidate, podium)[0].reason, 'NOT_ON_STAGE');
  assert.notEqual(nearestOffer(sim.state, cfg, candidate)?.kind, 'MEETING');
  assert.equal(triggerMeeting(sim, podium, candidate.faction_id, candidate.id), false);
  const before = candidate.money;
  advance(sim, sim.secondsToTicks(3));
  assert.equal(candidate.money, before);
  assert.equal(podium.meeting_candidate_id, null);
  candidate.podium_site_id = podium.id;
  candidate.combat.height = cfg.balance.buildings.meeting.podium_height;
  assert.equal(nearestOffer(sim.state, cfg, candidate)?.kind, 'MEETING');
  advance(sim, sim.secondsToTicks(2));
  assert.equal(podium.meeting_candidate_id, candidate.id);
  assert.equal(candidate.money, before - cfg.balance.buildings.meeting.activation_cost);
});

test('le meeting se charge aux deux bords de la scène et rassemble les électeurs', () => {
  const cfg = structuredClone(config);
  cfg.balance.buildings.meeting.required_presence_N1 = 0;
  for (const side of [-1, 1]) {
    const sim = new GameSimulation(cfg, 42);
    sim.state.ai_enabled = false;
    const podium = sim.state.buildings.find(building => building.type === 'meeting');
    sim.state.buildings = [podium];
    const candidate = sim.state.candidates[0];
    for (const other of sim.state.candidates.slice(1)) other.campaign_active = false;
    candidate.x = podium.x + side * (cfg.balance.buildings.meeting.podium_half_width - 0.05);
    candidate.axis = 0;
    candidate.money = 1000;
    candidate.podium_site_id = podium.id;
    candidate.combat.height = cfg.balance.buildings.meeting.podium_height;
    assert.equal(nearestOffer(sim.state, cfg, candidate)?.kind, 'MEETING');
    sim.step();
    assert.equal(candidate.purchase_hold?.elapsed_ticks, 1);
    advance(sim, candidate.purchase_hold.required_ticks - 1);
    assert.equal(podium.meeting_candidate_id, candidate.id);
    assert.ok(sim.state.npcs.some(npc => npc.meeting_target_id === podium.id));
    advance(sim, sim.secondsToTicks(cfg.balance.buildings.meeting.hold_seconds));
    assert.equal(podium.meetings_held, 1);
  }
});

test('l’IA conserve un meeting disponible comme objectif même avant de monter sur scène', () => {
  const cfg = structuredClone(config);
  cfg.balance.buildings.meeting.required_presence_N1 = 0;
  const sim = new GameSimulation(cfg, 42);
  const podium = sim.state.buildings.find(building => building.type === 'meeting');
  sim.state.buildings = [podium];
  const candidate = sim.state.candidates[1];
  candidate.x = podium.x; candidate.money = 1000;
  const target = aiEconomicTarget(sim.state, cfg, candidate);
  assert.equal(target?.id, podium.id);
  assert.equal(target.offer.reason, 'NOT_ON_STAGE');
});

test('les bâtiments n’offrent plus d’amélioration', () => {
  const sim = make();
  for (const settings of Object.values(config.balance.buildings)) {
    assert.equal(settings.max_level, 1);
    assert.deepEqual(settings.upgrade_costs, []);
  }
  for (const building of sim.state.buildings.filter(item => item.ownership_model === 'capturable')) {
    const candidate = sim.state.candidates[0];
    Object.assign(building, { owner_id: candidate.faction_id, level: 1, state: 'ACTIVE', active: true, neutral: false });
    if (building.type === 'faction') building.variant = building.fixed_variant;
    assert.ok(buildingOffers(sim.state, config, candidate, building).every(offer => offer.kind !== 'UPGRADE'));
  }
});

test('raid : 3 sympathisants entrent au local, ressortent en SO côte à côte, puis partent sans jamais revenir', () => {
  const sim = make();
  const site = sim.state.buildings.find(building => building.type === 'faction');
  const actor = sim.state.candidates.find(candidate => candidate.faction_id === 'melenchon');
  captureSite(sim, site, actor); actor.money = 1000;
  const recruits = sim.state.npcs.slice(0, 4);
  recruits.forEach((npc, index) => Object.assign(npc, { role: 'SYMPATHISANT', faction_id: 'melenchon', task: null, x: site.x + 1 + index }));
  const offer = buildingOffers(sim.state, sim.config, actor, site).find(o => o.kind === 'RAID' && o.direction === 1);
  assert.equal(offer.enabled, true);
  assert.ok(commitFactionAction(sim, actor, site, offer));
  const joining = recruits.filter(npc => npc.task?.kind === 'JOIN_RAID');
  assert.equal(joining.length, 3, 'les 3 plus proches seulement');
  let seenInside = false, gaps = [];
  for (let tick = 0; tick < sim.secondsToTicks(8); tick++) {
    sim.step();
    seenInside ||= joining.some(npc => npc.task?.phase === 'INSIDE');
    if (joining.every(npc => npc.raid?.phase === 'GATHER')) {
      const xs = joining.map(npc => npc.x).sort((a, b) => a - b);
      gaps = xs.slice(1).map((x, index) => x - xs[index]);
    }
  }
  assert.ok(seenInside, 'chaque recrue passe par le local');
  assert.ok(gaps.length && Math.min(...gaps) >= 0.7, `écarts trop faibles : ${gaps.map(gap => gap.toFixed(2)).join(', ')}`);
  assert.ok(joining.every(npc => npc.role === 'SERVICE_D_ORDRE' && npc.raid.phase === 'OUTBOUND'));
  advance(sim, sim.secondsToTicks(60));
  assert.ok(joining.every(npc => npc.role === 'SERVICE_D_ORDRE' && npc.raid), 'le raid ne s’arrête pas de lui-même');
});

test('un bâtiment sans partisans reste à son propriétaire ; seul un raid plus nombreux le ferme', () => {
  const sim = make();
  const site = sim.state.buildings.find(building => building.type === 'tour_communication');
  captureSite(sim, site, sim.state.candidates.find(candidate => candidate.faction_id === 'le_pen'));
  for (const npc of sim.state.npcs) if (npc.faction_id === 'le_pen') npc.role = 'NEUTRE', npc.faction_id = null;
  advance(sim, sim.secondsToTicks(20));
  assert.equal(site.owner_id, 'le_pen');
  // Un garde adverse en raid fait pression sur le bâtiment, plus fort que la présence locale (nulle).
  Object.assign(sim.state.npcs[0], { role: 'SERVICE_D_ORDRE', faction_id: 'melenchon', pressure_target_id: site.id });
  for (let tick = 0; tick <= sim.secondsToTicks(sim.config.balance.buildings.tour_communication.closure_delay_seconds); tick++) updateStrategicSites(sim);
  assert.equal(site.owner_id, null);
});

test('raid : les gardes prennent en chasse un candidat adverse à environ un tiers de sous-zone', () => {
  const sim = make();
  const s = sim.config.balance.physical_units.service_ordre;
  const guard = sim.state.npcs[0];
  Object.assign(guard, { role: 'SERVICE_D_ORDRE', faction_id: 'melenchon', guard_biome_id: sim.state.world.subzones[0].biome_id,
    guard_anchor_x: guard.x, task: null, facing: 1, hidden_durability: s.hidden_durability, next_donation_tick: null, donation_cents: 0 });
  const rival = sim.state.candidates.find(candidate => candidate.faction_id === 'le_pen');
  for (const candidate of sim.state.candidates) if (candidate !== rival) candidate.x = (guard.x + sim.state.world.length / 2) % sim.state.world.length;
  rival.x = (guard.x + s.candidate_focus_range + 4) % sim.state.world.length;
  sim.step();
  assert.notEqual(guard.combat.target_id, rival.id, 'trop loin : le garde continue son raid');
  rival.x = (guard.x - (s.candidate_focus_range - 2) + sim.state.world.length) % sim.state.world.length;
  const before = guard.x;
  sim.step();
  assert.equal(guard.combat.target_id, rival.id);
  assert.ok(Math.abs(guard.x - before) > 0 && guard.task.phase === 'DEFEND', 'il marche vers le candidat');
});

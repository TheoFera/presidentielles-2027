import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { GamePhase as P, commandAllowed } from '../src/simulation/phases.js';
import { ArenaSimulation, arenaAICommands } from '../src/simulation/arena-simulation.js';
import { AIController, LocalHumanController, collectCommands } from '../src/simulation/controllers.js';
import { startArena, finishArena, finishSprint } from '../src/simulation/match-lifecycle.js';
import { refreshElectoralState, updatePolls } from '../src/simulation/electoral-state.js';
import { refreshInfluenceSources } from '../src/simulation/territory.js';
import { combatState, hit } from '../src/simulation/combat-state.js';
import { buildingOffer } from '../src/simulation/economy.js';
import { triggerMeeting } from '../src/simulation/electoral-buildings.js';
import { FixedClock } from '../src/simulation/fixed-clock.js';
import { FACTIONS, zoneAt } from '../src/simulation/world.js';

const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≠ ${b}`);
const advance = (sim, ticks, ai = null) => { for (let i = 0; i < ticks; i++) sim.step(ai ? sim.state.candidates.filter(c => !c.eliminated).flatMap(c => ai.commands(sim.state, c.id)) : []); };
const refresh = sim => { refreshElectoralState(sim.state, sim.config); refreshInfluenceSources(sim.state, sim.config); updatePolls(sim); };
function quiet(seed = 2027) {
  const sim = new GameSimulation(config, seed);
  for (const c of sim.state.candidates) { c.campaign_active = false; c.interaction_active = false; }
  sim.state.ai_enabled = false; refresh(sim); return sim;
}
function own(sim, type, faction, zone = 'banlieue_b', level = 1) {
  const b = sim.state.buildings.find(b => b.type === type && b.subzone_id === zone);
  Object.assign(b, { state: 'ACTIVE', owner_id: faction, level, variant: type === 'faction' ? faction === 'philippe' ? 'cabinet_administratif' : 'service_ordre' : null }); return b;
}
function npc(sim, role, faction, x, origin = 'banlieue_b') {
  const n = sim.spawn(sim.state.world.subzones.find(z => z.id === origin), x, false);
  Object.assign(n, { role, faction_id: faction, hidden_durability: role === 'SERVICE_D_ORDRE' ? 90 : 30, roam_wait_ticks: 100000 });
  if (role === 'SERVICE_D_ORDRE') { n.guard_biome_id = zoneAt(sim.state.world, x).biome_id; n.guard_anchor_x = x; }
  return n;
}
function sprint(sim, eliminated = 'philippe') { startArena(sim); finishArena(sim, eliminated); return sim; }
function actual(sim, scores) { for (const e of sim.state.electorate) e.support = { ...scores }; refresh(sim); }
function reload(sim) { const next = new GameSimulation(sim.config); next.importSnapshot(sim.exportSnapshot()); return next; }

test('J0 au tick prévu : gel du monde complet, jauges nationales réelles, reprise exacte des finalistes', () => {
  const cfg = structuredClone(config); cfg.balance.time.starting_days_before_first_round = 1; cfg.balance.time.real_seconds_per_game_day = 1;
  const sim = new GameSimulation(cfg);
  own(sim, 'financement', 'melenchon'); own(sim, 'institut_sondage', 'melenchon');
  advance(sim, 29); assert.equal(sim.state.phase, P.CAMPAIGN);
  advance(sim, 1); assert.equal(sim.state.phase, P.FIRST_ROUND_ARENA); assert.equal(sim.state.result, null);
  const world = structuredClone(sim.state.campaign_snapshot); const frozen = JSON.stringify(world);
  for (const c of sim.state.arena.candidates) close(c.arena_hp, world.actualGameState.national_support[c.faction_id]);
  advance(sim, 180);
  assert.equal(JSON.stringify(sim.state.campaign_snapshot), frozen);
  for (const key of ['tick', 'rng_state', 'candidates', 'npcs', 'buildings', 'electorate', 'spawn_timers', 'polls', 'powers', 'attacks']) assert.deepEqual(sim.state[key], world[key]);
  finishArena(sim, 'philippe');
  for (const f of ['melenchon', 'le_pen']) assert.deepEqual(sim.state.candidates.find(c => c.faction_id === f), world.candidates.find(c => c.faction_id === f));
  assert.equal(sim.state.tick, world.tick); assert.equal(sim.state.sprint_remaining_ticks, sim.secondsToTicks(60));
  reload(sim);
});

test('Commandes validées selon la phase, aucun achat/Meeting/téléportation de monde dans l’arène', () => {
  const sim = quiet(); startArena(sim); const snapshot = JSON.stringify(sim.state.campaign_snapshot);
  for (const type of ['Build', 'Meeting', 'InteractionPresence', 'DebugTeleport', 'DebugBuildElectoral', 'DebugMeeting', 'DebugNeutral50All']) {
    assert.equal(commandAllowed(sim.state, { type }, true), false);
    sim.applyCommand({ type, candidateId: sim.state.local_candidate_id, subzoneId: 'paris_a', buildingType: 'meeting' });
  }
  assert.equal(JSON.stringify(sim.state.campaign_snapshot), snapshot);
  sim.applyCommand({ type: 'Move', candidateId: sim.state.local_candidate_id, axis: 1 });
  assert.equal(sim.state.arena.candidates[0].axis, 1); assert.equal(sim.state.candidates[0].axis, 0);
  assert.equal(commandAllowed(sim.state, { type: 'DebugFillSpecial' }, false), false);
});

test('Dégâts d’arène des six attaques : jauge directe, support du monde inchangé, premier KO seul', () => {
  const entries = [['light_1', 'CANDIDATE', 1, false], ['light_2', 'CANDIDATE', 2, false], ['heavy', 'CANDIDATE', 3, true], ['hologram', 'HOLOGRAM', 0, false], ['wave', 'WAVE', 0, true], ['crs', 'CRS', 0, false]];
  for (const [key, kind, step, strong] of entries) {
    const sim = quiet(); startArena(sim); const arena = new ArenaSimulation(sim.config, sim.state.arena);
    const [source, target, third] = arena.state.candidates;
    const hp = target.arena_hp; const world = JSON.stringify(sim.state.electorate);
    const result = hit(arena, source, target, { kind, step, strong, damage: 500, electoral_damage: 50, knockback: 2, direction: 1 }, 'test');
    close(target.arena_hp, hp - config.balance.first_round_arena.damage[key]); assert.equal(result.electoral_damage, 0);
    assert.equal(JSON.stringify(sim.state.electorate), world);
    target.arena_hp = 0.01;
    hit(arena, source, target, { kind, step, strong, damage: 500, knockback: 1 }, 'test');
    const untouched = third.arena_hp;
    assert.equal(hit(arena, source, third, { kind, damage: 500, knockback: 1 }, 'test'), null);
    assert.equal(third.arena_hp, untouched); assert.equal(arena.state.eliminated_faction, target.faction_id);
    sim.step(); assert.equal(sim.state.eliminated_faction, target.faction_id); assert.equal(sim.state.phase, P.SECOND_ROUND_SPRINT);
  }
});

test('Les vrais Attack déclenchent chaque spécial et infligent des dégâts d’arène autoritaires', () => {
  for (const f of FACTIONS) {
    const sim = quiet(); startArena(sim);
    const arena = sim.state.arena; const actor = arena.candidates.find(c => c.faction_id === f); const target = arena.candidates.find(c => c.id !== actor.id);
    actor.x = 12; target.x = 13.3; arena.candidates.find(c => c !== actor && c !== target).x = 24;
    actor.facing = 1; const hp = target.arena_hp;
    sim.applyCommand({ type: 'DebugFillSpecial', candidateId: actor.id }); sim.applyCommand({ type: 'Attack', candidateId: actor.id, direction: 1 });
    advance(sim, 1); assert.ok(arena.events.some(e => e.type === 'SpecialTriggered'));
    advance(sim, 54);
    assert.equal(actor.special_charge, 0); assert.ok(target.arena_hp < hp, f);
    assert.ok(arena.hit_results.some(h => h.score_damage > 0));
  }
});

test('Bords de plateau solides : marche, recul et projectile ne bouclent pas, pas de ring-out', () => {
  const sim = quiet(); startArena(sim); const a = sim.state.arena;
  const c = a.candidates[0]; c.x = a.arena_bounds.min; c.axis = -1; c.combat.knockback_velocity = -40;
  advance(sim, 120); assert.equal(c.x, a.arena_bounds.min); assert.equal(sim.state.phase, P.FIRST_ROUND_ARENA);
  const lp = a.candidates[1]; lp.x = a.arena_bounds.max; lp.facing = 1; lp.special_charge = 10;
  sim.applyCommand({ type: 'Attack', candidateId: lp.id, direction: 1 }); advance(sim, 3);
  assert.equal(a.projectiles.length, 0); assert.equal(c.arena_hp, c.arena_initial_hp);
});

test('Neutralisation : S/M/SO rentrent à leur origine, bâtiments libérés, Neutres préservés et voix sans transfert', () => {
  const sim = quiet();
  const former = ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].map((role, i) => npc(sim, role, 'le_pen', 113 + i));
  const ally = npc(sim, 'SYMPATHISANT', 'melenchon', 103);
  for (const type of ['permanence', 'financement', 'faction', 'tour_communication', 'institut_sondage', 'meeting']) own(sim, type, 'le_pen');
  const meeting = sim.state.buildings.find(b => b.type === 'meeting' && b.owner_id === 'le_pen'); triggerMeeting(sim, meeting);
  const printer = sim.state.buildings.find(b => b.type === 'imprimerie'); const printerBefore = structuredClone(printer);
  refresh(sim); const supportBefore = sim.state.electorate.map(e => ({ ...e.support }));
  sprint(sim, 'le_pen');
  for (const n of former) {
    const after = sim.state.npcs.find(x => x.id === n.id);
    assert.equal(after.role, 'DEMOBILISE'); assert.equal(after.faction_id, null); assert.equal(after.task, null); assert.equal(after.raid, null);
    for (const key of ['x', 'origin_biome_id', 'origin_subzone_id', 'origin_social_point_id']) assert.equal(after[key], n[key]);
  }
  assert.deepEqual(sim.state.npcs.find(n => n.id === ally.id), ally);
  assert.deepEqual(sim.state.buildings.find(b => b.id === printer.id), printerBefore);
  assert.equal(sim.state.buildings.filter(b => b.owner_id === 'le_pen').length, 0);
  assert.equal(sim.state.buildings.filter(b => b.abandoned_by === 'le_pen').length, 6);
  sim.state.electorate.forEach((e, i) => { close(e.support.melenchon, supportBefore[i].melenchon); close(e.support.philippe, supportBefore[i].philippe); close(e.support.neutral, supportBefore[i].neutral + supportBefore[i].le_pen); assert.equal(e.support.le_pen, 0); });
  reload(sim); advance(sim, 250);
  for (const n of former) { const after = sim.state.npcs.find(x => x.id === n.id); assert.equal(after.role, 'NEUTRE'); assert.equal(after.origin_social_point_id, n.origin_social_point_id); }
  assert.ok(!collectCommands(sim.state, new LocalHumanController(), new AIController(config)).some(c => c.candidateId === 'candidate:le_pen'));
});

test('Imprimerie partagée : commandes du troisième annulées, celles du finaliste conservées', () => {
  const sim = quiet(); const b = sim.state.buildings.find(b => b.type === 'imprimerie');
  for (const faction of ['le_pen', 'melenchon', 'le_pen']) b.queue.push({ id: `order:${sim.state.next_order_id++}`, service_id: b.id, faction_id: faction, purchased_tick: 0, cost: 12, assigned_npc_id: null, state: 'QUEUED', production_elapsed_ticks: 0 });
  const keep = structuredClone(b.queue[1]); sprint(sim, 'le_pen');
  const after = sim.state.buildings.find(x => x.id === b.id);
  assert.deepEqual(after.queue, [keep]); assert.equal(after.owner_id, null); assert.equal(after.state, 'ACTIVE'); reload(sim);
});

test('Anciens PNJ : aucune conversion gratuite, retour puis persuasion des deux finalistes et télémétrie unique', () => {
  for (const faction of ['melenchon', 'le_pen']) {
    const sim = quiet(); sim.state.npcs = [];
    const former = npc(sim, 'MILITANT', 'philippe', 112); sprint(sim);
    const c = sim.state.candidates.find(c => c.faction_id === faction); c.x = 108; c.campaign_active = true;
    advance(sim, 20); assert.equal(sim.state.npcs[0].role, 'DEMOBILISE'); assert.equal(sim.state.telemetry.reconverted_npc_ids.length, 0);
    advance(sim, 240); assert.equal(sim.state.npcs[0].faction_id, faction); assert.deepEqual(sim.state.telemetry.reconverted_npc_ids, [former.id]);
    assert.equal(sim.state.npcs[0].origin_subzone_id, 'banlieue_b'); reload(sim);
  }
});

test('Emplacement abandonné : seuil local et paiement restent requis, aucun transfert automatique', () => {
  const sim = quiet(); own(sim, 'permanence', 'philippe'); sprint(sim);
  const b = sim.state.buildings.find(b => b.type === 'permanence' && b.subzone_id === 'banlieue_b'); const c = sim.state.candidates[0];
  assert.equal(buildingOffer(sim.state, sim.config, c, b), null);
  npc(sim, 'SYMPATHISANT', 'melenchon', 104); npc(sim, 'SYMPATHISANT', 'melenchon', 105);
  c.x = b.x; c.campaign_active = true; c.interaction_active = true; const before = c.money;
  const offer = buildingOffer(sim.state, sim.config, c, b); assert.equal(offer.kind, 'BUILD'); assert.equal(offer.cost, 35);
  const income = config.balance.money.base_passive_income_per_second + 2 * config.balance.money.supporter_income_per_second_by_origin_biome.banlieue;
  advance(sim, 60); assert.equal(b.owner_id, 'melenchon'); close(c.money, before - 35 + 60 / sim.hz * income);
});

test('Sprint : multiplicateur global unique, Tour atténuée, Meeting ×10 payé et délai raccourci', () => {
  const sim = quiet(); sim.state.npcs = [];
  const c = sim.state.candidates[0]; c.campaign_active = true;
  npc(sim, 'SYMPATHISANT', 'melenchon', 105); npc(sim, 'MILITANT', 'melenchon', 106);
  own(sim, 'permanence', 'melenchon'); const tower = own(sim, 'tour_communication', 'melenchon'); const meeting = own(sim, 'meeting', 'melenchon');
  refresh(sim); const before = sim.state.electorate.find(e => e.subzone_id === 'banlieue_b');
  const rate = before.influence_per_second.melenchon; const towerRate = before.influence_sources.melenchon.tower;
  sprint(sim); const after = sim.state.electorate.find(e => e.subzone_id === 'banlieue_b');
  close(after.influence_per_second.melenchon, (rate - towerRate + towerRate * config.balance.second_round.tower_influence_multiplier) * 10);
  const actor = sim.state.candidates[0]; const podium = sim.state.buildings.find(b => b.id === meeting.id);
  actor.x = podium.x; actor.interaction_active = true; actor.money = 200; sim.state.npcs = []; // Keep the timed purchase isolated.
  advance(sim, 60);
  const event = sim.state.events.find(e => e.type === 'MeetingStarted'); assert.ok(event); assert.equal(event.influence_budget, 120);
  assert.equal(actor.spending.MEETING, 30); assert.equal(podium.meeting_ready_tick - sim.state.tick, 22 * sim.hz);
  assert.equal(sim.state.telemetry.sprint_meetings, 1); assert.ok(sim.state.buildings.find(b => b.id === tower.id).state === 'ACTIVE');
});

test('Une Tour seule ne fait pas exploser une zone sans présence en deux secondes', () => {
  const sim = quiet(); sim.state.npcs = []; own(sim, 'tour_communication', 'melenchon', 'banlieue_b', 3);
  actual(sim, { melenchon: 10, le_pen: 10, philippe: 0, neutral: 80 }); sprint(sim);
  advance(sim, 60);
  for (const e of sim.state.electorate) assert.ok(e.support.melenchon < 10.1, e.support.melenchon);
});

test('Sondages du sprint à 2,5 s ; Institut fermé garde sa dernière mesure ; résultat utilise le réel', () => {
  const sim = quiet(); own(sim, 'institut_sondage', 'melenchon'); refresh(sim); sprint(sim);
  const poll = sim.state.polls.melenchon; const measured = poll.lastPollSnapshot.measured_tick;
  advance(sim, 74); assert.equal(poll.lastPollSnapshot.measured_tick, measured); advance(sim, 1); assert.equal(poll.lastPollSnapshot.measured_tick, 75);
  const institute = sim.state.buildings.find(b => b.owner_id === 'melenchon' && b.type === 'institut_sondage'); institute.state = 'CLOSED'; institute.level = 0;
  refresh(sim); const stale = structuredClone(poll.lastPollSnapshot);
  actual(sim, { melenchon: 20, le_pen: 71, philippe: 0, neutral: 9 });
  sim.state.sprint_remaining_ticks = 1; sim.step();
  assert.equal(sim.state.result.winner, 'le_pen'); assert.deepEqual(poll.lastPollSnapshot, stale); assert.equal(sim.state.result.scores.neutral, 9);
  reload(sim);
});

test('Combat du monde actif au sprint : recul, soutien vers les Neutres, aucun PV d’arène', () => {
  const sim = quiet(); actual(sim, { melenchon: 48, le_pen: 43, philippe: 0, neutral: 9 }); sprint(sim);
  const [m, lp] = sim.state.candidates;
  const before = sim.state.actualGameState.national_support.melenchon;
  const result = hit(sim, lp, m, { damage: 8, electoral_damage: 0.03, knockback: 2.2 }, 'test');
  assert.ok(result.electoral_damage > 0); assert.equal(result.damage, 0); assert.equal(m.arena_hp, undefined); assert.ok(m.combat.knockback_velocity !== 0);
  assert.ok(sim.state.actualGameState.national_support.melenchon < before);
});

test('60 secondes exactes, égalités répétées +15 s et fin autoritaire figée', () => {
  const sim = quiet(); actual(sim, { melenchon: 45, le_pen: 45, philippe: 0, neutral: 10 }); sprint(sim); sim.state.npcs = [];
  advance(sim, 1799); assert.equal(sim.state.sprint_remaining_ticks, 1); advance(sim, 1);
  assert.equal(sim.state.extensions, 1); assert.equal(sim.state.sprint_remaining_ticks, 450);
  advance(sim, 450); assert.equal(sim.state.extensions, 2); assert.equal(sim.state.phase, P.SECOND_ROUND_SPRINT);
  actual(sim, { melenchon: 48, le_pen: 43, philippe: 0, neutral: 9 }); sim.state.sprint_remaining_ticks = 1; sim.step();
  assert.equal(sim.state.phase, P.RESULTS); assert.equal(sim.state.result.winner, 'melenchon');
  const frozen = sim.exportSnapshot(); advance(sim, 60, new AIController(sim.config));
  sim.applyCommand({ type: 'DebugGrantMoney', candidateId: 'candidate:melenchon' }); assert.equal(sim.exportSnapshot(), frozen); reload(sim);
});

test('Égalité : règle configurable J0 puis graine, et commande debug de prolongation', () => {
  const cfg = structuredClone(config); cfg.balance.second_round.tie_rule = 'J0_THEN_SEED';
  const sim = new GameSimulation(cfg); actual(sim, { melenchon: 34, le_pen: 30, philippe: 26, neutral: 10 }); sprint(sim);
  actual(sim, { melenchon: 45, le_pen: 45, philippe: 0, neutral: 10 }); sim.state.sprint_remaining_ticks = 0; finishSprint(sim);
  assert.equal(sim.state.result.winner, 'melenchon'); assert.equal(sim.state.result.tie_break, true);
  const other = sprint(quiet()); other.step([{ type: 'DebugForceTie' }]); assert.equal(other.state.extensions, 1);
});

test('Snapshot d’arène et de sprint : rechargement déterministe, coups, pouvoirs et RNG compris', () => {
  const sim = quiet(73); sim.state.ai_enabled = true; startArena(sim); const ai = new AIController(config);
  advance(sim, 80, ai); const copy = reload(sim); assert.deepEqual(copy.getState(), sim.getState());
  advance(sim, 600, ai); advance(copy, 600, ai); assert.deepEqual(copy.getState(), sim.getState());
  if (sim.state.phase === P.FIRST_ROUND_ARENA) finishArena(sim, 'philippe');
  advance(sim, 70, ai); const sprintCopy = reload(sim);
  advance(sim, 150, ai); advance(sprintCopy, 150, ai); assert.deepEqual(sprintCopy.getState(), sim.getState());
});

test('Snapshots corrompus : jauges, monde gelé, élimination, horloge et résultat refusés atomiquement', () => {
  const sim = quiet(); startArena(sim); const clean = sim.exportSnapshot();
  for (const mutate of [s => s.arena.candidates[0].arena_hp = -1, s => s.campaign_snapshot.candidates[0].money++, s => s.arena.candidates[0].x = -1,
    s => s.phase = P.RESULTS, s => s.campaign_snapshot.campaign_snapshot = {}, s => s.arena.candidates[1].id = s.arena.candidates[0].id,
    s => s.next_npc_id++, s => s.arena.candidates[0].special_charge = null, s => s.arena.candidates[0].arena_hp = 0]) {
    const bad = JSON.parse(clean); mutate(bad); assert.throws(() => sim.importSnapshot(bad)); assert.equal(sim.exportSnapshot(), clean);
  }
  finishArena(sim, 'philippe'); const saved = sim.exportSnapshot(); const bad = JSON.parse(saved); bad.candidates[2].campaign_active = true;
  assert.throws(() => sim.importSnapshot(bad)); assert.equal(sim.exportSnapshot(), saved);
});

test('Les pouvoirs et attaques déjà actifs dans le monde reprennent avec leurs délais exacts', () => {
  const sim = quiet(); const m = sim.state.candidates[0]; m.campaign_active = true; m.special_charge = 10;
  sim.step([{ type: 'Attack', candidateId: m.id }]);
  assert.equal(sim.state.temporary_units.length, 5); assert.ok(sim.state.attacks.length);
  startArena(sim); const world = structuredClone(sim.state.campaign_snapshot);
  advance(sim, 180); const copy = reload(sim); finishArena(copy, 'philippe');
  for (const key of ['attacks', 'powers', 'temporary_units', 'tick', 'rng_state']) assert.deepEqual(copy.state[key], world[key]);
  copy.step(); assert.equal(copy.state.tick, world.tick + 1); assert.equal(copy.state.temporary_units.length, 5);
});

test('Un candidat à 0 % à J0 est éliminé sans blocage et le debug ne peut ressusciter son camp', () => {
  const sim = quiet(); actual(sim, { melenchon: 45, le_pen: 0, philippe: 40, neutral: 15 }); startArena(sim); sim.step();
  assert.equal(sim.state.eliminated_faction, 'le_pen');
  const defeated = structuredClone(sim.state.candidates[1]);
  for (const type of ['SetCampaignActive', 'InteractionPresence', 'Move', 'Attack', 'DebugGrantMoney', 'DebugFillSpecial']) sim.applyCommand({ type, candidateId: 'candidate:le_pen', active: true, axis: 1 });
  sim.applyCommand({ type: 'DebugAddInfluence', candidateId: 'candidate:melenchon', factionId: 'le_pen' });
  sim.applyCommand({ type: 'DebugControlZone', candidateId: 'candidate:melenchon' });
  assert.deepEqual(sim.state.candidates[1], defeated); assert.ok(sim.state.electorate.every(e => e.support.le_pen === 0)); reload(sim);
});

test('L’IA du sprint paye un Meeting proche et recherche la réserve du troisième', () => {
  const sim = quiet(); sim.state.ai_enabled = true; sim.state.npcs = [];
  const b = own(sim, 'meeting', 'melenchon'); sprint(sim);
  const c = sim.state.candidates[0]; const podium = sim.state.buildings.find(x => x.id === b.id); c.x = podium.x; c.money = 100;
  const ai = new AIController(config);
  for (let i = 0; i < 60; i++) sim.step(ai.commands(sim.state, c.id));
  assert.equal(c.spending.MEETING, 30); assert.equal(sim.state.telemetry.sprint_meetings, 1);
  const returnee = npc(sim, 'NEUTRE', null, 110); returnee.hidden_durability = 0; returnee.former_eliminated_faction = 'philippe';
  const cmds = ai.commands(sim.state, c.id); assert.equal(cmds.find(c => c.type === 'Move').axis, -1);
});

test('Rejouer : un nouveau GameSimulation efface élimination, IA, pouvoirs, unités et toute la télémétrie', () => {
  const sim = quiet(31415); npc(sim, 'MILITANT', 'philippe', 110); own(sim, 'meeting', 'philippe'); sprint(sim);
  sim.applyCommand({ type: 'DebugForceTie' });
  const fresh = new GameSimulation(sim.config, sim.state.seed, 'candidate:le_pen'); const expected = new GameSimulation(config, 31415, 'candidate:le_pen');
  assert.deepEqual(fresh.getState(), expected.getState()); assert.equal(fresh.state.phase, P.CAMPAIGN); assert.equal(fresh.state.eliminated_faction, null);
  assert.equal(fresh.state.npcs.length, 25); assert.equal(fresh.state.telemetry.sprint_meetings, 0); assert.equal(fresh.state.local_candidate_id, 'candidate:le_pen');
});

test('Partie déterministe à 20, 60 et 144 FPS jusque dans l’arène et le sprint', () => {
  const run = fps => {
    const cfg = structuredClone(config); cfg.balance.time.starting_days_before_first_round = 1; cfg.balance.time.real_seconds_per_game_day = 1;
    const sim = new GameSimulation(cfg, 73); const clock = new FixedClock(sim.hz); const ai = new AIController(cfg);
    for (let i = 0; i < fps * 25; i++) clock.advance(1 / fps, () => sim.step(sim.state.candidates.filter(c => !c.eliminated).flatMap(c => ai.commands(sim.state, c.id))));
    return sim.getState();
  };
  const reference = run(20); assert.deepEqual(run(60), reference); assert.deepEqual(run(144), reference);
});

test('IA d’arène indépendante du joueur humain : cibles variées, combos et survie possible du troisième à J0', () => {
  const eliminated = new Set(); let weakestSurvives = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const sim = quiet(seed); actual(sim, { melenchon: 34, le_pen: 30, philippe: 26, neutral: 10 }); startArena(sim); sim.state.ai_enabled = true;
    const ai = new AIController(config);
    for (let i = 0; i < 90 * sim.hz && sim.state.phase === P.FIRST_ROUND_ARENA; i++) {
      const s = sim.state;
      const before = ai.commands(s, 'candidate:le_pen'); s.local_candidate_id = 'candidate:philippe'; assert.deepEqual(ai.commands(s, 'candidate:le_pen'), before);
      sim.step(s.candidates.flatMap(c => ai.commands(s, c.id)));
    }
    assert.equal(sim.state.phase, P.SECOND_ROUND_SPRINT, `arène passive ${seed}`);
    eliminated.add(sim.state.eliminated_faction); if (sim.state.eliminated_faction !== 'philippe') weakestSurvives++;
    assert.ok(sim.state.telemetry.arena_candidate_hits > 5);
  }
  assert.ok(eliminated.size > 1); assert.ok(weakestSurvives > 0 && weakestSurvives < 12, weakestSurvives);
});

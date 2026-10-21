import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { ALL_FACTIONS, FACTIONS } from '../src/simulation/world.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { completePopulation } from '../src/simulation/spawns.js';
import { incomePerSecond, incomeBreakdown, stableIdOrder } from '../src/simulation/territory.js';
import { formatNumber } from '../src/presentation/interface/number-format.js';
import { combatActors, findCombatActor, nearestEnemy, enemies, combatState } from '../src/simulation/combat-state.js';
import { updateCombat } from '../src/simulation/combat.js';
import { verticalHit } from '../src/simulation/combat-actions.js';
import { AIController, collectCommands, prepareAICommands } from '../src/simulation/controllers.js';
import { warmUpSimulation } from '../src/simulation/warm-up.js';
import { chooseAIObjective } from '../src/simulation/ai-strategy.js';
import { withAIObservation, aiObservation } from '../src/simulation/ai-observation.js';
import { combatDelta } from '../src/simulation/combat-geometry.js';
import { withNpcProximity, nearbyNpcs, updateNpcProximity } from '../src/simulation/npc-proximity.js';
import { CrowdSpacing, crowdTargets } from '../src/presentation/rendu/crowd-spacing.js';

test('Les voix restent celles des PNJ après mutations au même tick', () => {
  const config = campaignConfig(), sim = new GameSimulation(config);
  completePopulation(sim);
  const { state } = sim;
  for (let variant = 0; variant < 36; variant++) {
    // Même tick : le recomptage ne doit dépendre d'aucun cache temporel.
    state.npcs.forEach((npc, index) => {
      npc.x = (index * 67 + variant * 11) % state.world.length;
      npc.role = ['NEUTRE', 'SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'][index % 4];
      npc.faction_id = npc.role === 'NEUTRE' ? null : FACTIONS[(index + variant) % 3];
    });
    refreshElectoralState(state);
    const expected = { ...Object.fromEntries(ALL_FACTIONS.map(f => [f, 0])), neutral: 0, pending: 0 };
    for (const npc of state.npcs) expected[npc.role === 'NEUTRE' ? 'neutral' : npc.faction_id]++;
    assert.deepEqual(state.actualGameState.national_counts, expected);
    assert.equal(Object.values(expected).reduce((sum, count) => sum + count, 0), 200);
    for (const faction of FACTIONS) {
      assert.equal(state.actualGameState.national_support[faction], expected[faction] / 2);
      assert.equal(incomePerSecond(state, config, faction), 0);
      assert.equal(Object.values(incomeBreakdown(state, config, faction).byBiome).reduce((sum, biome) => sum + biome.count, 0),
        state.npcs.filter(npc => npc.role === 'SYMPATHISANT' && npc.faction_id === faction).length);
    }
  }
});

test('La partie d’essai du chargement ne change rien à la vraie partie', async () => {
  const play = () => {
    const config = campaignConfig(), sim = new GameSimulation(config, 2027, 'candidate:le_pen'), ai = new AIController(config);
    const idle = { commands: () => [] };
    for (let i = 0; i < 400; i++) sim.step(collectCommands(sim.state, idle, ai));
    return sim.exportSnapshot();
  };
  const before = play();
  // La partie d'essai passe bien par les « premières fois » qu'elle doit préparer.
  const seen = new Set();
  await warmUpSimulation(campaignConfig(), { pause: async () => {}, onEvent: type => seen.add(type) });
  for (const type of ['NpcConverted', 'HeadquartersEstablished', 'CampaignStyleChanged', 'StartCampaignEvent', 'HitResolved', 'CandidateKnockedDown'])
    assert.ok(seen.has(type), `partie d’essai sans ${type}`);
  assert.equal(play(), before);
});

test('Les décisions de l’ordinateur préparées à l’avance sont celles du pas et ne changent pas la partie', () => {
  const config = campaignConfig(), ai = new AIController(config), idle = { commands: () => [] };
  const direct = new GameSimulation(config, 2027, 'candidate:le_pen'), ahead = new GameSimulation(campaignConfig(), 2027, 'candidate:le_pen');
  for (let i = 0; i < 900; i++) {
    // Comme le jeu : préparées sur la vue d'affichage, une image avant le pas.
    const view = ahead.presentationView(), before = JSON.stringify(ahead.state);
    const prepared = prepareAICommands(view, ai);
    assert.equal(JSON.stringify(ahead.state), before, `préparation sans effet sur l’état, pas ${i}`);
    const expected = collectCommands(direct.presentationView(), idle, ai);
    const commands = collectCommands(view, idle, ai, prepared);
    assert.deepEqual(commands, expected, `mêmes commandes, pas ${i}`);
    direct.step(expected); ahead.step(commands);
  }
  assert.equal(ahead.exportSnapshot(), direct.exportSnapshot());
});

test('Les formatages réutilisés conservent tous les nombres français affichés', () => {
  for (const precision of [0, 1, 2, 3]) for (const value of [0, -0, .049, .05, .099, 3.14159, 1234567.895, -42.25]) {
    for (const minimum of [0, precision]) assert.equal(formatNumber(value, precision, minimum),
      value.toLocaleString('fr-FR', { maximumFractionDigits: precision, minimumFractionDigits: minimum }));
  }
});

test('L’affichage lit l’état vivant et ne garde que les positions du pas précédent', () => {
  const sim = new GameSimulation(campaignConfig());
  completePopulation(sim);
  for (let i = 0; i < 90; i++) sim.step([]);
  const before = sim.motionSnapshot();
  const xs = new Map([...sim.state.npcs, ...sim.state.candidates].map(entity => [entity.id, entity.x]));
  assert.equal(before.tick, sim.state.tick);
  assert.equal(before.npcs.length, sim.state.npcs.length);
  for (const entity of [...before.npcs, ...before.candidates]) assert.deepEqual(Object.keys(entity), ['id', 'x']);
  for (let i = 0; i < 30; i++) sim.step([]);
  // La copie des positions ne bouge plus quand la simulation avance.
  for (const entity of [...before.npcs, ...before.candidates]) assert.equal(entity.x, xs.get(entity.id));
  assert.ok(sim.state.tick > before.tick);
  const view = sim.presentationView();
  // Vue sans copie : mêmes objets que l'état vivant, haut de l'état et événements figés.
  assert.equal(view.npcs, sim.state.npcs);
  assert.equal(view.tick, sim.state.tick);
  assert.notEqual(view.events, sim.state.events);
  assert.deepEqual(view.events, sim.state.events);
  assert.equal(view.campaign_snapshot, null);
  assert.ok(Object.isFrozen(view.world));
});

test('La recherche directe d’un combattant respecte les exclusions et les mutations au même tick', () => {
  const sim = new GameSimulation(campaignConfig());
  completePopulation(sim);
  const state = sim.state, candidate = state.candidates[0];
  state.temporary_units.push({ id: 'temporary:performance', role: 'HOLOGRAMME' });
  const ids = [...combatActors(state).map(a => a.id), 'absent'];
  const check = () => {
    for (const id of ids) assert.equal(findCombatActor(state, id), combatActors(state).find(a => a.id === id));
  };
  check(); candidate.eliminated = true; check();
  candidate.eliminated = false; candidate.campaign_debate_id = 'debate:test'; check();
  candidate.campaign_debate_id = null; state.npcs.shift(); state.temporary_units.pop(); check();
});

test('Les recherches par secteur gardent les cibles, les égalités et le raccord circulaire', () => {
  const sim = new GameSimulation(campaignConfig()); completePopulation(sim);
  const state = sim.state, actor = state.candidates[0];
  state.npcs.forEach((npc, i) => {
    npc.x = i * state.world.length / state.npcs.length;
    npc.role = 'MILITANT'; npc.faction_id = i % 2 ? 'le_pen' : actor.faction_id;
  });
  const reference = (range, predicate) => combatActors(state)
    .filter(target => enemies(actor, target) && Math.abs(combatDelta(state, actor.x, target.x)) <= range && predicate(target))
    .sort((a, b) => Math.abs(combatDelta(state, actor.x, a.x)) - Math.abs(combatDelta(state, actor.x, b.x)) || stableIdOrder(a, b))[0] || null;
  for (const debate of [false, true]) {
    if (debate) state.debate_bounds = { min: 0, max: state.world.length };
    withNpcProximity(state, () => {
      for (const x of [0, .001, 8, state.world.length / 2, state.world.length - .001]) {
        actor.x = x;
        for (const range of [0, .5, 4, 17, state.world.length / 2, Infinity]) {
          const predicate = target => !target.id.endsWith('3');
          assert.equal(nearestEnemy(state, actor, range, predicate), reference(range, predicate));
        }
      }
    });
  }
});

test('Un déplacement suivi, une conversion et un nouveau traitement restent visibles au même tick', () => {
  const sim = new GameSimulation(campaignConfig()); completePopulation(sim);
  const state = sim.state, actor = state.candidates[0], npc = state.npcs[0];
  actor.x = 0; state.candidates.slice(1).forEach(candidate => { candidate.x = 100; });
  state.npcs.forEach((npc, i) => { npc.x = 100 + i; });
  npc.role = 'MILITANT'; npc.faction_id = 'le_pen';
  withNpcProximity(state, () => {
    for (let i = 0; i < 4; i++) nearestEnemy(state, actor, 2);
    assert.ok(nearbyNpcs(state, 0, 2).length < state.npcs.length / 2);
    npc.x = state.world.length - 1; updateNpcProximity(state, npc);
    assert.equal(nearestEnemy(state, actor, 2), npc);
    npc.faction_id = actor.faction_id;
    assert.equal(nearestEnemy(state, actor, 2), null);
    npc.faction_id = 'le_pen'; npc.x = 30; updateNpcProximity(state, npc);
    assert.equal(nearestEnemy(state, actor, 2), null);
  });
  npc.x = 1; // Hors du traitement indexé, les appels directs lisent immédiatement l'état vivant.
  assert.equal(nearestEnemy(state, actor, 2), npc);
  withNpcProximity(state, () => { for (let i = 0; i < 4; i++) assert.equal(nearestEnemy(state, actor, 2), npc); });
  const replacement = { ...npc, id: 'npc:replacement' }; state.npcs[0] = replacement;
  withNpcProximity(state, () => { for (let i = 0; i < 4; i++) assert.equal(nearestEnemy(state, actor, 2), replacement); });
  assert.throws(() => withNpcProximity(state, () => { nearbyNpcs(state, 0, 2); throw new Error('Interruption'); }));
  assert.equal(nearbyNpcs(state, 0, 2), state.npcs);
});

test('La foule réutilise son placement et garde les mêmes pas de côté à chaque image', () => {
  const crowd = new CrowdSpacing(), state = { npcs: Array.from({ length: 80 }, (_, i) => ({ id: `npc:${i}`, x: Math.floor(i / 4) * 2, moving: false })) };
  let expected = new Map(), lastTime = null;
  const target = crowd.targetsFor(state, .5);
  assert.equal(crowd.targetsFor(structuredClone(state), .5), target);
  for (let frame = 0; frame < 240; frame++) {
    if (frame === 60) state.npcs[0].x += .2;
    if (frame === 90) state.npcs[1].moving = true;
    if (frame === 120) state.npcs[2].meeting_target_id = 'meeting';
    if (frame === 150) state.npcs[3].rally_event_id = 'rally';
    if (frame === 180) state.npcs.splice(4, 1);
    const gap = frame < 210 ? .5 : .7, now = frame * 1000 / 60;
    const dt = lastTime === null ? 0 : Math.min(.1, (now - lastTime) / 1000); lastTime = now;
    const targets = crowdTargets(state, gap), offsets = new Map(), steps = new Map();
    for (const npc of state.npcs) {
      const current = expected.get(npc.id) || 0, goal = targets.get(npc.id) || 0;
      const limit = (npc.moving ? .35 : .9) * dt, change = Math.max(-limit, Math.min(limit, goal - current));
      const value = current + change;
      if (goal || Math.abs(value) > .001) offsets.set(npc.id, value);
      if (!npc.moving && dt > 0 && Math.abs(change) / dt > .12) steps.set(npc.id, Math.sign(change));
    }
    expected = offsets;
    crowd.update(state, gap, now);
    assert.deepEqual(crowd.offsets, expected);
    assert.deepEqual(crowd.steps, steps);
  }
});

test('Les observations partagées restent pures et se renouvellent après un déplacement ou une conversion au même tick', () => {
  const config = campaignConfig(), sim = new GameSimulation(config); completePopulation(sim);
  const { state } = sim, ai = new AIController(config);
  for (let variant = 0; variant < 8; variant++) {
    const npc = state.npcs[0];
    npc.x = state.world.subzones[variant].center;
    npc.role = variant % 2 ? 'MILITANT' : 'NEUTRE'; npc.faction_id = variant % 2 ? 'le_pen' : null;
    const snapshot = sim.exportSnapshot();
    const independent = state.candidates.filter(c => !c.eliminated).flatMap(c => ai.commands(state, c.id));
    assert.deepEqual(collectCommands(state, ai, ai), independent);
    withAIObservation(state, () => {
      const view = aiObservation(state);
      assert.equal(aiObservation(state), view);
      for (const group of view.zones.values()) {
        assert.deepEqual(group.units, state.npcs.filter(n => Math.floor(n.x / group.zone.width) === group.zone.index));
        assert.equal(group.readyNeutral, group.units.filter(n => n.role === 'NEUTRE' && !n.persuasion && !n.rally_event_id).length);
      }
    });
    assert.equal(sim.exportSnapshot(), snapshot, 'Les données de travail ne modifient pas la partie');
  }
  assert.throws(() => withAIObservation(state, () => { aiObservation(state); throw new Error('Interruption'); }));
  state.npcs = [state.npcs[0]]; state.npcs[0].x = state.world.length - .01;
  withAIObservation(state, () => assert.deepEqual(aiObservation(state).zones.get(state.world.subzones.at(-1).id).units, state.npcs));
});

test('Le choix du premier QG recalcule les soutiens et garde les égalités de distance', () => {
  const config = campaignConfig(), sim = new GameSimulation(config); completePopulation(sim);
  const { state } = sim, c = state.candidates[0], [left, right] = state.buildings.filter(b => b.type === 'permanence');
  state.buildings = [right, left]; left.owner_id = null; right.owner_id = null;
  c.headquarters_site_id = null; c.ai_objective = null; c.x = (left.x + right.x) / 2;
  for (const npc of state.npcs) { npc.role = 'DEMOBILISE'; npc.faction_id = null; npc.persuasion = null; }
  assert.equal(chooseAIObjective(state, config, c).subzone_id, [left, right].sort((a, b) => a.id.localeCompare(b.id))[0].subzone_id);
  for (const npc of state.npcs.slice(0, 2)) { npc.x = right.x; npc.role = 'SYMPATHISANT'; npc.faction_id = c.faction_id; }
  assert.equal(chooseAIObjective(state, config, c).subzone_id, right.subzone_id);
  for (const npc of state.npcs.slice(0, 2)) { npc.x = left.x; npc.role = 'NEUTRE'; }
  assert.equal(chooseAIObjective(state, config, c).subzone_id, left.subzone_id);
});

test('Les projectiles indexés gardent les touches exactes, la hauteur et l’ordre au raccord et en ligne droite', () => {
  for (const linear of [false, true]) for (const direction of [-1, 1]) for (const kind of ['VERBAL', 'BUBBLE', 'WAVE']) {
    const config = campaignConfig(), sim = new GameSimulation(config); completePopulation(sim);
    const { state } = sim, owner = state.candidates[0]; state.candidates = [owner];
    owner.x = linear ? 10 : .1;
    if (linear) state.debate_bounds = { min: 0, max: state.world.length };
    // Éviter les dégâts propres au débat : ce test isole ses coordonnées linéaires.
    for (const [i, npc] of state.npcs.entries()) {
      npc.x = i < 16 ? owner.x + direction * (i / 2 - 4) : 100 + i;
      if (!linear) npc.x = (npc.x + state.world.length) % state.world.length;
      npc.role = i % 4 === 0 ? 'SYMPATHISANT' : 'MILITANT'; npc.faction_id = i % 7 === 0 ? owner.faction_id : 'le_pen';
      npc.hidden_durability = 10000; npc.combat = combatState(); npc.combat.height = i % 3 === 0 ? 4 : 0;
    }
    const projectile = { id: 'projectile:index-test', kind, owner_id: owner.id, faction_id: owner.faction_id,
      x: owner.x, direction, launched: true, remaining_range: 20, speed: sim.hz * 3, damage: 1, knockback: 0, hit_ids: [] };
    // Trois recherches sans cibles précèdent le projectile afin d'activer les secteurs.
    state.projectiles = Array.from({ length: 3 }, (_, i) => ({ ...projectile, id: `projectile:empty:${i}`, x: 60, hit_ids: [] }));
    state.projectiles.push(projectile);
    const radius = kind === 'BUBBLE' ? config.balance.specials.zemmour.bubble_hit_radius : config.balance.candidate_combat.target_radius;
    const tail = kind === 'WAVE' ? config.balance.specials.le_pen_navy_wave.body_length_units : 0;
    const expected = combatActors(state).filter(t => {
      const along = combatDelta(state, projectile.x, t.x) * direction;
      return along >= -radius - tail && along <= 3 + radius && enemies(owner, t)
        && (kind !== 'VERBAL' || t.role !== 'SYMPATHISANT') && verticalHit(config, owner, t, projectile);
    }).sort((a, b) => Math.abs(combatDelta(state, projectile.x, a.x)) - Math.abs(combatDelta(state, projectile.x, b.x)) || stableIdOrder(a, b));
    updateCombat(sim);
    assert.deepEqual(projectile.hit_ids, (kind === 'WAVE' ? expected : expected.slice(0, 1)).map(t => t.id), `${kind}, sens ${direction}, linéaire ${linear}`);
  }
});

test('Les coups indexés gardent leurs cibles exactes et leur ordre après le raccord circulaire', () => {
  for (const direction of [-1, 1]) {
    const config = campaignConfig(), sim = new GameSimulation(config); completePopulation(sim);
    const { state } = sim, owner = state.candidates[0];
    const owners = [...state.candidates.slice(1, 4), owner]; state.candidates = owners;
    owners.forEach((actor, i) => { actor.x = i === 3 ? .1 : 80 + i * 30; });
    state.npcs.forEach(npc => {
      npc.x = state.world.length / 2; npc.role = 'MILITANT'; npc.faction_id = 'le_pen';
      npc.hidden_durability = 10000; npc.combat = combatState();
    });
    state.npcs[0].x = owner.x; state.npcs[0].combat.height = 4;
    state.npcs[1].x = state.world.length - .15; state.npcs[2].x = .35;
    state.attacks = owners.map((actor, i) => {
      const attack = { id: `attack:index:${i}`, owner_id: actor.id, kind: 'CANDIDATE', direction,
        range: 1, damage: 1, knockback: 0, elapsed_ticks: 0, windup_ticks: 0, active_ticks: 3, recovery_ticks: 3, hit_ids: [], charged: true };
      actor.combat.attack_id = attack.id; return attack;
    });
    const attack = state.attacks.at(-1), radius = config.balance.candidate_combat.target_radius;
    const expected = combatActors(state).filter(t => Math.abs(combatDelta(state, owner.x, t.x)) <= attack.range + radius
      && combatDelta(state, owner.x, t.x) * direction >= -radius && enemies(owner, t) && verticalHit(config, owner, t, attack))
      .sort((a, b) => Math.abs(combatDelta(state, owner.x, a.x)) - Math.abs(combatDelta(state, owner.x, b.x)) || stableIdOrder(a, b));
    assert.ok(expected.length > 0);
    updateCombat(sim);
    assert.deepEqual(attack.hit_ids, expected.map(t => t.id));
  }
});

test('Les offres restent à portée de leur bâtiment : nearestOffer ignore les bâtiments lointains sans changer son choix', async () => {
  const { buildingOffers, nearestOffer, offerReach } = await import('../src/simulation/economy.js');
  const { distance } = await import('../src/simulation/territory.js');
  const { candidateOnMeetingStage } = await import('../src/simulation/electoral-buildings.js');
  const config = campaignConfig(), sim = new GameSimulation(config, 7), ai = new AIController(config);
  completePopulation(sim);
  const { state } = sim, reach = offerReach(config);
  // Ancienne version : devis de tous les bâtiments, puis filtre par distance.
  const reference = candidate => state.buildings.filter(b => b.id !== candidate.purchase_latch_target_id).flatMap(b => buildingOffers(state, config, candidate, b))
    .filter(o => distance(state, candidate.x, o.x) <= o.radius && (o.kind !== 'MEETING' || candidateOnMeetingStage(state, config, candidate, state.buildings.find(b => b.id === o.target_id))))
    .sort((a, b) => distance(state, candidate.x, a.x) - distance(state, candidate.x, b.x) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))[0] || null;
  let offers = 0, compared = 0;
  for (let step = 0; step < 1800; step++) {
    sim.step(state.candidates.flatMap(c => ai.commands(state, c.id)));
    if (step % 150) continue;
    for (const candidate of state.candidates) {
      for (const building of state.buildings) for (const offer of buildingOffers(state, config, candidate, building)) {
        offers++;
        assert.ok(distance(state, building.x, offer.x) + offer.radius <= reach, `${offer.key} dépasse la portée`);
      }
      const x = candidate.x;
      for (const building of state.buildings) for (const shift of [-2.6, -2, -1, -0.4, 0, 0.5, 0.95, 1.9, 2.5]) {
        candidate.x = (building.x + shift + state.world.length) % state.world.length;
        assert.deepEqual(nearestOffer(state, config, candidate), reference(candidate));
        compared++;
      }
      candidate.x = x;
    }
  }
  assert.ok(offers > 100 && compared > 1000);
});

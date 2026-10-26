import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { AIController, LocalHumanController, collectCommands } from '../src/simulation/controllers.js';
import { ringDelta } from '../src/simulation/world.js';
import { objectiveProgress } from '../src/presentation/interface/campaign-objectives.js';
import { hit } from '../src/simulation/combat-state.js';
import { commitFactionAction } from '../src/simulation/faction-buildings.js';
import { updateStrategicSites } from '../src/simulation/strategic-sites.js';

function setup(candidateId = 'candidate:le_pen') {
  const config = campaignConfig();
  const sim = new GameSimulation(config, 42, candidateId, {}, { campaignIntro: true });
  const human = new LocalHumanController(), ai = new AIController(config);
  const run = n => { for (let i = 0; i < n; i++) sim.step(collectCommands(sim.state, human, ai)); };
  const me = () => sim.state.candidates.find(c => c.id === sim.state.local_candidate_id);
  return { config, sim, human, run, me };
}

test('sans la scène (outils, sauvegardes, tests), la partie démarre comme avant', () => {
  const sim = new GameSimulation(campaignConfig(), 42);
  assert.equal(sim.state.campaign_intro, undefined);
  assert.ok(sim.state.candidates.every(c => c.podium_site_id === null));
});

test('chaque candidat démarre sur l’estrade de sa sous-zone, le public du quartier autour', () => {
  const { sim, config } = setup();
  const { state } = sim, intro = state.campaign_intro;
  for (const candidate of state.candidates.filter(c => !c.minor)) {
    const stage = state.buildings.find(b => b.id === intro.stages[candidate.id]);
    assert.equal(stage.type, 'meeting');
    assert.equal(stage.subzone_id, config.layout.starting_positions[candidate.faction_id]);
    assert.equal(candidate.x, stage.x);
    assert.equal(candidate.podium_site_id, stage.id);
    assert.equal(candidate.combat.height, config.balance.buildings.meeting.podium_height);
  }
  assert.ok(intro.crowd_ids.length >= 9);
  for (const id of intro.crowd_ids) {
    const npc = state.npcs.find(n => n.id === id);
    const stage = Object.values(intro.stages).map(s => state.buildings.find(b => b.id === s))
      .sort((a, b) => Math.abs(ringDelta(npc.x, a.x, state.world.length)) - Math.abs(ringDelta(npc.x, b.x, state.world.length)))[0];
    const gap = ringDelta(stage.x, npc.x, state.world.length), settings = config.prototype.campaign_intro;
    // Juste derrière le dernier journaliste de son côté, tourné vers l'orateur.
    const press = Math.max(...settings.press_offsets_units.flat().filter(o => Math.sign(o) === Math.sign(gap)).map(Math.abs));
    assert.ok(Math.abs(gap) >= press + settings.crowd_gap_units - 1e-9);
    assert.ok(Math.abs(gap) <= press + settings.crowd_gap_units + 2 * settings.crowd_spacing_units + 1e-9);
    assert.equal(npc.facing, -Math.sign(gap));
  }
});

test('pendant la scène, aucun jour ne passe et seul le joueur marche, sans quitter l’estrade', () => {
  const { sim, human, run, me, config } = setup();
  const others = sim.state.candidates.filter(c => c.id !== me().id).map(c => [c.id, c.x]);
  const npcs = sim.state.npcs.map(n => n.x);
  human.setAxis(1); run(120);
  assert.equal(sim.state.tick, 0);
  assert.equal(sim.state.days_remaining, config.balance.time.starting_days_before_first_round);
  assert.equal(sim.state.campaign_intro.tick, 120);
  const stage = sim.state.buildings.find(b => b.id === me().podium_site_id);
  const half = config.balance.buildings.meeting.podium_half_width;
  assert.ok(me().x > stage.x && me().x < stage.x + half, 'le joueur s’arrête au bord de l’estrade');
  assert.deepEqual(sim.state.candidates.filter(c => c.id !== me().id).map(c => [c.id, c.x]), others);
  assert.deepEqual(sim.state.npcs.map(n => n.x), npcs);
});

test('le coup d’annonce va au bout, puis la campagne démarre et le public rentre chez lui', () => {
  const { sim, human, run, me } = setup();
  human.attack(); run(1);
  assert.equal(sim.state.campaign_intro.strikes[me().id], undefined, 'trop tôt : la scène vient de commencer');
  run(20); human.attack(); run(1);
  assert.ok(sim.state.campaign_intro.strikes[me().id] > 0);
  const punch = sim.state.attacks.find(a => a.owner_id === me().id);
  assert.ok(punch?.intro && punch.damage === 0);
  assert.equal(me().combat.attack_id, punch.id);
  run(punch.windup_ticks + punch.active_ticks + punch.recovery_ticks + 1);
  assert.equal(sim.state.campaign_intro, null);
  assert.ok(sim.state.events.some(e => e.type === 'CampaignIntroEnded'));
  assert.equal(sim.state.attacks.length, 0);
  assert.equal(me().combat.attack_id, null);
  assert.equal(me().special_charge, 0);
  const crowd = sim.state.npcs.filter(n => n.roam_target_x === n.home_x && n.x !== n.home_x);
  assert.ok(crowd.length > 0, 'le public repart vers sa place');
  run(300);
  assert.ok(sim.state.tick >= 300 && sim.state.days_remaining < 365, 'les jours défilent');
});

test('l’ordinateur redescend de l’estrade et part faire campagne comme sans la scène', () => {
  for (const player of ['candidate:melenchon', 'candidate:le_pen', 'candidate:philippe']) {
    const { sim, human, run } = setup(player);
    run(20); human.attack();
    for (let i = 0; i < 60 && sim.state.campaign_intro; i++) run(1);
    assert.equal(sim.state.campaign_intro, null);
    const rivals = sim.state.candidates.filter(c => !c.minor && c.id !== player);
    for (const c of rivals) assert.ok(c.podium_site_id === null && c.combat.height === 0, `${c.id} reste perché`);
    assert.equal(sim.state.candidates.find(c => c.id === player).podium_site_id !== null, true, 'le joueur reste sur son estrade');
    const before = rivals.map(c => c.x);
    let moved = rivals.map(() => 0);
    for (let i = 0; i < 40; i++) { run(30); moved = moved.map((m, k) => m + Math.abs(ringDelta(before[k], rivals[k].x, sim.state.world.length))); }
    rivals.forEach((c, k) => assert.ok(moved[k] > 5, `${c.id} ne bouge pas (${player})`));
  }
});

test('sauter depuis l’estrade part de sa hauteur, sans repasser par le sol', () => {
  const { sim, human, run, me, config } = setup();
  run(20); human.attack();
  for (let i = 0; i < 60 && sim.state.campaign_intro; i++) run(1);
  const podium = config.balance.buildings.meeting.podium_height;
  for (const axis of [0, 1]) {
    human.setAxis(axis); human.jump(); run(1);
    const heights = [me().combat.height];
    for (let i = 0; i < 45; i++) { run(1); heights.push(me().combat.height); }
    assert.ok(heights[0] > podium, `départ au-dessus de l’estrade (${heights[0]})`);
    for (let i = 1; i < heights.length; i++) assert.ok(Math.abs(heights[i] - heights[i - 1]) < 0.3, `saut de hauteur ${heights[i - 1]} → ${heights[i]}`);
    if (axis === 0) assert.equal(me().combat.height, podium, 'sur place : retour sur l’estrade');
    else assert.equal(me().combat.height, 0, 'de côté : descente jusqu’au sol');
  }
  human.setAxis(0);
});

test('multijoueur : la campagne attend tous les joueurs, au plus 5 s après le premier coup', () => {
  const { sim, human, run, config } = setup('candidate:melenchon');
  sim.state.human_candidate_ids = ['candidate:melenchon', 'candidate:philippe'];
  run(20); human.attack(); run(1);
  const wait = sim.secondsToTicks(config.prototype.campaign_intro.multiplayer_wait_seconds);
  run(wait - 5);
  assert.ok(sim.state.campaign_intro, 'Philippe n’a pas encore frappé');
  run(10);
  assert.equal(sim.state.campaign_intro, null);
});

test('l’ordinateur ne joue pas pendant la scène', () => {
  const { sim } = setup();
  const ai = new AIController(sim.config);
  assert.deepEqual(ai.commands(sim.state, 'candidate:philippe'), []);
});

test('objectifs : progrès lus dans l’état de la partie', () => {
  const { sim, me } = setup();
  const faction = me().faction_id;
  assert.deepEqual(objectiveProgress(sim.state, faction, 2), { billets: 2, habitants: 0, permanence: 0, militant: 0, ko: 0, local: 0, sympathisants: 0, fermeture: 0, permanence2: 0, meeting: 0, garage: 0, sondage: 0 });
  const [a, b] = sim.state.npcs;
  Object.assign(a, { role: 'SYMPATHISANT', faction_id: faction }); Object.assign(b, { role: 'MILITANT', faction_id: faction });
  me().headquarters_site_id = 'site:x';
  sim.state.knockouts = [{ tick: 1, by_faction: faction, candidate_id: 'candidate:philippe' }];
  Object.assign(sim.state.buildings.find(x => x.type === 'faction'), { owner_id: faction, state: 'ACTIVE' });
  sim.state.campaign_feats = { [faction]: { supporters_ko: 3, buildings_closed: 1 } };
  assert.equal(objectiveProgress(sim.state, faction).permanence2, 0);
  const take = b => Object.assign(b, { owner_id: faction, state: 'ACTIVE' });
  sim.state.buildings.filter(b => b.type === 'permanence').slice(0, 2).forEach(take);
  take(sim.state.buildings.find(b => b.type === 'garage_velo'));
  sim.state.buildings.find(b => b.type === 'meeting').meeting_faction_id = faction;
  sim.state.polls[faction].lastPollSnapshot = { measured_tick: 1 };
  assert.deepEqual(objectiveProgress(sim.state, faction), { billets: 0, habitants: 2, permanence: 1, militant: 1, ko: 1, local: 1, sympathisants: 3, fermeture: 1, permanence2: 1, meeting: 1, garage: 1, sondage: 1 });
});

test('objectifs : sympathisant adverse mis K.-O. par le candidat, pas par ses militants', () => {
  const { sim, me } = setup();
  const faction = me().faction_id, rival = 'philippe';
  const [target, other, militant] = sim.state.npcs;
  for (const npc of [target, other]) Object.assign(npc, { role: 'SYMPATHISANT', faction_id: rival, hidden_durability: 1, x: me().x });
  Object.assign(militant, { role: 'MILITANT', faction_id: faction, x: me().x });
  assert.ok(hit(sim, me(), target, { damage: 50, knockback: 0 }, 'test:1'));
  assert.equal(target.role, 'DEMOBILISE');
  assert.equal(sim.state.campaign_feats[faction].supporters_ko, 1);
  assert.ok(hit(sim, militant, other, { damage: 50, knockback: 0 }, 'test:2'));
  assert.equal(other.role, 'DEMOBILISE');
  assert.equal(sim.state.campaign_feats[faction].supporters_ko, 1);
});

test('objectifs : bâtiment adverse fermé par un cabinet administratif ou par un raid', () => {
  const { sim, me } = setup('candidate:philippe');
  const faction = me().faction_id;
  const [first, second] = sim.state.buildings.filter(b => b.type === 'permanence');
  for (const b of [first, second]) Object.assign(b, { owner_id: 'le_pen', state: 'ACTIVE', active: true, neutral: false, level: 1, headquarters: false });
  const cabinet = sim.state.buildings.find(b => b.type === 'faction');
  assert.ok(commitFactionAction(sim, me(), cabinet, { kind: 'CLOSE', victim_id: first.id }));
  assert.equal(first.owner_id, null);
  assert.equal(sim.state.campaign_feats[faction].buildings_closed, 1);
  // Raid : deux gardes de Mélenchon pressent la seconde permanence, que personne ne défend.
  const raiders = sim.state.npcs.slice(0, 2);
  for (const npc of raiders) Object.assign(npc, { role: 'SERVICE_D_ORDRE', faction_id: 'melenchon', raid: { id: 'raid:0' }, pressure_target_id: second.id, x: second.x });
  for (const npc of sim.state.npcs) if (npc.faction_id === 'le_pen' && npc.role !== 'CANDIDAT') Object.assign(npc, { role: 'NEUTRE', faction_id: null });
  for (let i = 0; i < 100 * 60 && second.owner_id; i++) { sim.state.tick++; updateStrategicSites(sim); }
  assert.equal(second.owner_id, null);
  assert.equal(sim.state.campaign_feats.melenchon.buildings_closed, 1);
  assert.equal(sim.state.campaign_feats[faction].buildings_closed, 1);
});

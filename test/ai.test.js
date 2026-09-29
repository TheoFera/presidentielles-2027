import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { AIController } from '../src/simulation/controllers.js';
import { AI_DIFFICULTIES, aiSettings, aiNoise } from '../src/simulation/ai-settings.js';
import { chooseAIObjective, strategicAICommands } from '../src/simulation/ai-strategy.js';
import { aiCombatCommands } from '../src/simulation/ai-combat.js';
import { aiEconomicTarget } from '../src/simulation/economy.js';
import { CAMPAIGN_STYLES, CampaignStyleSystem, chooseAICampaignStyle } from '../src/simulation/campaign-styles.js';
import { captureSite, neutralizeSite } from '../src/simulation/strategic-sites.js';
import { ArenaSimulation, arenaAICommands } from '../src/simulation/arena-simulation.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { zoneAt } from '../src/simulation/world.js';
import { aiAdaptation, aiPersuasionMultiplier } from '../src/simulation/ai-balance.js';
import { assessDuel, reflectOnRival } from '../src/simulation/ai-mind.js';

function make(difficulty = 'normal', seed = 42) {
  // Duels et scénarios précis entre les trois candidats principaux : sans candidats mineurs.
  const config = campaignConfig(); config.balance.campaign_events.event_enabled = false; config.balance.minor_candidates.enabled = false;
  const sim = new GameSimulation(config, seed, 'candidate:melenchon', {}, { aiDifficulty: difficulty });
  return { sim, ai: new AIController(config), config };
}
function isolate(sim, faction = 'le_pen') {
  sim.state.npcs = [];
  const c = sim.state.candidates.find(c => c.faction_id === faction);
  c.x = 100; c.facing = 1;
  for (const other of sim.state.candidates) if (other !== c) other.x = 250 + sim.state.candidates.indexOf(other) * 40;
  return c;
}
function supporter(sim, faction, x) {
  const n = sim.spawn(zoneAt(sim.state.world, x), x) || sim.state.npcs.find(n => n.role === 'NEUTRE');
  if (!n) throw new Error('Ce scénario requiert un PNJ physique disponible.');
  n.x = x;
  n.role = 'SYMPATHISANT'; n.faction_id = faction; n.hidden_durability = 30;
  n.next_donation_tick = sim.state.tick + sim.secondsToTicks(30);
  return n;
}

test('Trois difficultés configurables, sauvegardées et validées sans bonus économiques', () => {
  const states = Object.keys(AI_DIFFICULTIES).map(level => make(level).sim.state);
  assert.deepEqual(states.map(s => s.ai_difficulty), ['facile', 'normal', 'difficile']);
  assert.deepEqual(states[0].candidates, states[2].candidates);
  const { sim, config } = make('difficile');
  const restored = new GameSimulation(config); restored.importSnapshot(sim.exportSnapshot());
  assert.equal(restored.state.ai_difficulty, 'difficile');
  assert.throws(() => new GameSimulation(config, 42, undefined, {}, { aiDifficulty: 'impossible' }), /Difficulté/);
  const invalid = sim.getState(); invalid.ai_difficulty = 'impossible';
  const before = sim.exportSnapshot(); assert.throws(() => sim.importSnapshot(invalid), /difficulté/);
  assert.equal(sim.exportSnapshot(), before);
  const legacy = sim.getState(); delete legacy.ai_difficulty;
  legacy.candidates.forEach(c => delete c.ai_objective); restored.importSnapshot(legacy);
  assert.equal(aiSettings(restored.state, config).label, 'Normal');
});

test('Chaque IA peut tirer chacun des trois styles de son candidat malgré les cadenas du joueur', () => {
  const { sim, config } = make();
  for (const c of sim.state.candidates) {
    const seen = new Set();
    for (let seed = 1; seed <= 100; seed++) {
      sim.state.seed = seed;
      const id = chooseAICampaignStyle(sim.state, config, c);
      assert.equal(id, chooseAICampaignStyle(sim.state, config, c));
      assert.equal(CampaignStyleSystem.select(sim, c, id, true), true); seen.add(c.current_campaign_style);
    }
    assert.deepEqual([...seen].sort(), CAMPAIGN_STYLES[c.faction_id].map(s => s.id).sort());
    assert.equal(sim.profile.unlocked_campaign_styles[c.faction_id].length, 1);
  }
});

for (const [faction, styles] of Object.entries(CAMPAIGN_STYLES)) for (const style of styles) {
  test(`L’IA joue réellement l’ultime ${style.ultimate.name}`, () => {
    const { sim, config } = make(); const c = isolate(sim, faction);
    const target = sim.state.candidates.find(n => n !== c); target.x = c.x + 1;
    CampaignStyleSystem.select(sim, c, style.id, true);
    c.special_charge = config.balance.special_charge.required_points;
    for (const command of aiCombatCommands(sim.state, config, c, target)) sim.applyCommand(command);
    assert.equal(c.special_charge, 0);
    assert.equal(c.active_ultimate_id, style.ultimate.kind);
  });
}

test('Après sa relève, Bardella continue à frapper au lieu de demander un ultime refusé', () => {
  const { sim, config } = make(); const c = isolate(sim);
  CampaignStyleSystem.select(sim, c, 'le_pen_gouvernement', true);
  c.bardellisation_used = true; c.special_charge = config.balance.special_charge.required_points;
  const target = supporter(sim, 'melenchon', c.x + 1);
  const commands = aiCombatCommands(sim.state, config, c, target);
  assert.ok(commands.some(c => c.type === 'Attack'));
  assert.ok(!commands.some(c => c.type === 'ActivateUltimate'));
});

test('Conquête : territoire du joueur ou d’une IA, mêmes décisions et trajet circulaire', () => {
  const { sim, config, ai } = make(); const c = isolate(sim); config.balance.ai_economy.enabled = false;
  c.x = 0.5;
  for (const e of sim.state.electorate) e.support = { melenchon: 10, le_pen: 70, philippe: 10, neutral: 10 };
  const target = sim.state.electorate.at(-1); target.support = { melenchon: 70, le_pen: 10, philippe: 10, neutral: 10 };
  refreshElectoralState(sim.state, config);
  assert.equal(chooseAIObjective(sim.state, config, c).subzone_id, target.subzone_id);
  const commands = ai.commands(sim.state, c.id);
  assert.equal(commands.find(c => c.type === 'Move').axis, -1);
  sim.state.local_candidate_id = 'candidate:philippe';
  assert.deepEqual(ai.commands(sim.state, c.id), commands);
});

test('Un objectif de conquête persiste, puis est remplacé après sa capture', () => {
  const { sim, config } = make(); const c = isolate(sim); config.balance.ai_economy.enabled = false;
  const e = sim.state.electorate[0];
  c.ai_objective = { subzone_id: e.subzone_id, purpose: 'CONQUER', expires_tick: 1000 };
  assert.equal(chooseAIObjective(sim.state, config, c), c.ai_objective);
  supporter(sim, c.faction_id, sim.state.world.subzones.find(z => z.id === e.subzone_id).center);
  captureSite(sim, sim.state.buildings.find(b => b.subzone_id === e.subzone_id && b.controls_zone), c);
  refreshElectoralState(sim.state, config);
  assert.notEqual(chooseAIObjective(sim.state, config, c).subzone_id, e.subzone_id);
});

for (const phase of ['CAMPAIGN', 'SECOND_ROUND_SPRINT']) test(`${phase} : attaque et démobilise les soutiens adverses`, () => {
  const { sim, config, ai } = make(); const c = isolate(sim); config.balance.ai_economy.enabled = false;
  const enemy = supporter(sim, 'melenchon', c.x + 1); enemy.hidden_durability = 1;
  sim.state.phase = phase;
  assert.ok(ai.commands(sim.state, c.id).some(c => c.type === 'Attack'));
  // Éviter la transition de phase de ce scénario isolé.
  sim.state.phase = 'CAMPAIGN';
  for (let i = 0; i < 10; i++) sim.step(ai.commands(sim.state, c.id));
  assert.equal(enemy.role, 'DEMOBILISE'); assert.equal(enemy.faction_id, null);
});

test('L’IA capture son QG par maintien et paie le prix normal dès qu’elle a deux soutiens', () => {
  const { sim, ai } = make(); const c = isolate(sim);
  const hq = sim.state.buildings.find(b => b.type === 'permanence'); c.x = hq.x; c.money = 40;
  supporter(sim, c.faction_id, c.x); supporter(sim, c.faction_id, c.x + 0.1);
  for (let i = 0; i < sim.secondsToTicks(3); i++) sim.step(ai.commands(sim.state, c.id));
  assert.equal(hq.owner_id, c.faction_id); assert.equal(c.headquarters_site_id, hq.id);
  assert.equal(c.spending.CAPTURE, sim.config.balance.buildings.permanence.first_headquarters_capture_cost);
  assert.ok(c.current_campaign_style);
});

test('Offensive complète : affaiblir les soutiens, puis reprendre un site du joueur neutralisé', () => {
  const { sim, ai } = make(); const c = isolate(sim); c.money = 200;
  const player = sim.state.candidates.find(c => c.faction_id === 'melenchon');
  const site = sim.state.buildings.find(b => b.type === 'tour_communication');
  captureSite(sim, sim.state.buildings.find(b => b.type === 'permanence'), c);
  captureSite(sim, site, player); c.x = site.x - 3;
  // Ce scénario commence après l’installation du QG pour tester l’offensive seule.
  sim.state.tick = sim.secondsToTicks(80);
  c.ai_objective = { subzone_id: site.subzone_id, purpose: 'CONQUER', expires_tick: sim.state.tick + sim.secondsToTicks(100) };
  const defenders = [supporter(sim, player.faction_id, site.x), supporter(sim, player.faction_id, site.x + 0.2)];
  supporter(sim, c.faction_id, site.x - 0.2); supporter(sim, c.faction_id, site.x - 0.3);
  for (const n of defenders) n.hidden_durability = 8;
  // Un bâtiment de contrôle ne ferme plus faute de soutiens : un raid le neutralise une fois les défenseurs retournés.
  let neutralized = false;
  for (let i = 0; i < sim.secondsToTicks(90) && site.owner_id !== c.faction_id; i++) {
    sim.step(ai.commands(sim.state, c.id));
    if (!neutralized && defenders.every(n => n.faction_id !== player.faction_id)) { neutralizeSite(sim, site, 'TEST'); neutralized = true; }
  }
  assert.ok(neutralized, 'Les soutiens du joueur doivent être retournés ou neutralisés.');
  assert.ok(defenders.some(n => n.faction_id === c.faction_id), 'Les anciens soutiens sont recrutés après leur retour.');
  assert.equal(site.owner_id, c.faction_id);
  assert.ok(c.spending.CAPTURE >= sim.config.balance.buildings.tour_communication.capture_cost);
});

test('Le cabinet administratif de Philippe cible une fermeture adverse', () => {
  const { sim, config } = make(); const c = isolate(sim, 'philippe');
  c.money = config.balance.buildings.faction_slot_philippe_cabinet_administratif.close_enemy_building_cost_by_level[0];
  const cabinet = sim.state.buildings.find(b => b.fixed_variant === 'cabinet_administratif'); captureSite(sim, cabinet, c); c.x = cabinet.x;
  const rival = sim.state.candidates.find(c => c.faction_id === 'le_pen');
  const victim = sim.state.buildings.find(b => b.type === 'tour_communication'); captureSite(sim, victim, rival);
  const target = aiEconomicTarget(sim.state, config, c, { subzone_id: cabinet.subzone_id, purpose: 'CONQUER' });
  assert.equal(target.offer.kind, 'CLOSE'); assert.equal(target.offer.victim_id, victim.id);
});

test('L’IA déclenche un raid disponible dans la direction des bâtiments ennemis', () => {
  const { sim, config } = make(); const c = isolate(sim); c.money = 1000;
  const site = sim.state.buildings.find(b => b.type === 'faction'); captureSite(sim, site, c); site.level = 3; c.x = site.x;
  const guard = supporter(sim, c.faction_id, c.x); guard.role = 'SERVICE_D_ORDRE'; guard.guard_biome_id = site.biome_id;
  const rival = sim.state.candidates.find(c => c.faction_id === 'philippe');
  captureSite(sim, sim.state.buildings.find(b => b.type === 'tour_communication'), rival);
  assert.equal(aiEconomicTarget(sim.state, config, c, { subzone_id: site.subzone_id, purpose: 'CONQUER' }).offer.kind, 'RAID');
});

test('Difficulté : cadence de combat distincte, dash offensif et repli après blessure', () => {
  const counts = Object.keys(AI_DIFFICULTIES).map(level => {
    const { sim, config } = make(level); const c = isolate(sim); const n = supporter(sim, 'melenchon', c.x + 1);
    let count = 0;
    for (let tick = 0; tick < 300; tick++) { sim.state.tick = tick; count += aiCombatCommands(sim.state, config, c, n).some(c => c.type === 'Attack'); }
    return count;
  });
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
  const { sim, config, ai } = make('difficile'); const c = isolate(sim); const n = supporter(sim, 'melenchon', c.x + 8);
  assert.ok(aiCombatCommands(sim.state, config, c, n).some(c => c.type === 'Dash'));
  c.resistance = 10; n.x = c.x + 1;
  for(let seed=1;seed<1000;seed++){if(aiNoise(seed,`${c.id}:retreat:${c.ko_started_tick}`)<AI_DIFFICULTIES.difficile.retreat_chance){sim.state.seed=seed;break;}}
  const commands = ai.commands(sim.state, c.id);
  assert.equal(commands.find(c => c.type === 'Move').axis, -1);
  assert.equal(commands.find(c => c.type === 'SetAIObjective').objective.purpose, 'RECOVER');
});

for(const difficulty of ['facile','normal','difficile'])test(`Combat ${difficulty} : la majorité reste au contact à faible résistance, choix stable et sauvegardable`,()=>{
  const {sim,config}=make(difficulty),c=isolate(sim);supporter(sim,'melenchon',c.x+1);c.resistance=5;
  let retreats=0;const rng=sim.state.rng_state;
  for(let seed=1;seed<=200;seed++){
    sim.state.seed=seed;c.ai_objective=null;
    const a=strategicAICommands(sim.state,config,c);
    assert.deepEqual(a,strategicAICommands(sim.state,config,c));
    const retreatsNow=a.some(a=>a.type==='SetAIObjective'&&a.objective.purpose==='RECOVER');
    retreats+=retreatsNow?1:0;
    if(!retreatsNow)assert.equal(a.find(a=>a.type==='Move').axis,0);
  }
  assert.ok(retreats>5&&retreats<65,`${retreats}/200 replis`);assert.equal(sim.state.rng_state,rng);
  sim.state.seed=42;
  const restored=new GameSimulation(config);restored.importSnapshot(sim.exportSnapshot());
  assert.deepEqual(strategicAICommands(restored.state,config,restored.state.candidates.find(a=>a.id===c.id)),strategicAICommands(sim.state,config,c));
});

test('Repli : délai non renouvelé, puis combat si l’adversaire reste au contact',()=>{
  const {sim,config}=make(),c=isolate(sim);supporter(sim,'melenchon',c.x+1);c.resistance=5;
  for(let seed=1;seed<1000;seed++){if(aiNoise(seed,`${c.id}:retreat:${c.ko_started_tick}`)<AI_DIFFICULTIES.normal.retreat_chance){sim.state.seed=seed;break;}}
  c.ai_objective=strategicAICommands(sim.state,config,c).find(a=>a.type==='SetAIObjective').objective;
  const deadline=c.ai_objective.expires_tick;
  sim.state.tick+=10;
  assert.equal(strategicAICommands(sim.state,config,c).find(a=>a.type==='SetAIObjective').objective.expires_tick,deadline);
  for(const tick of [deadline,deadline+30]){
    sim.state.tick=tick;const a=strategicAICommands(sim.state,config,c);
    assert.equal(a.find(a=>a.type==='Move').axis,0);assert.ok(!a.some(a=>a.type==='SetAIObjective'&&a.objective.purpose==='RECOVER'));
  }
});

test('Combat : poursuivre brièvement un candidat repoussé pour finir l’échange',()=>{
  const {sim,config}=make(),c=isolate(sim),enemy=sim.state.candidates.find(a=>a.faction_id==='melenchon');
  enemy.x=c.x+3;c.combat.target_id=enemy.id;c.combat.last_hit={tick:0,target_id:enemy.id};sim.state.tick=30;
  const a=strategicAICommands(sim.state,config,c);
  assert.equal(a.find(a=>a.type==='Move').axis,1);assert.equal(a.find(a=>a.type==='InteractionPresence').active,false);
});

test('La difficulté reste appliquée dans l’arène et l’IA désactivée reste immobile', () => {
  const { sim, config, ai } = make('difficile');
  const arena = ArenaSimulation.create(config, sim.state); assert.equal(arena.ai_difficulty, 'difficile');
  assert.ok(arenaAICommands(arena, config, arena.candidates[0].id, false).every(c => c.type !== 'Attack' && c.type !== 'Dash'));
  sim.state.ai_enabled = false;
  for (const c of sim.state.candidates) {
    const commands = ai.commands(sim.state, c.id);
    assert.equal(commands.find(c => c.type === 'Move').axis, 0);
    assert.equal(commands.find(c => c.type === 'InteractionPresence').active, false);
  }
});

test('Reprise déterministe : objectifs, styles, RNG et décisions ne dépendent pas du contrôleur en mémoire', () => {
  const { sim, ai, config } = make('difficile');
  for (let i = 0; i < 400; i++) sim.step(sim.state.candidates.flatMap(c => ai.commands(sim.state, c.id)));
  const saved = sim.exportSnapshot(); const restored = new GameSimulation(config); restored.importSnapshot(saved);
  const otherAI = new AIController(config);
  for (let i = 0; i < 200; i++) {
    const before = sim.exportSnapshot(); const commands = sim.state.candidates.flatMap(c => ai.commands(sim.state, c.id));
    assert.equal(sim.exportSnapshot(), before);
    sim.step(commands); restored.step(restored.state.candidates.flatMap(c => otherAI.commands(restored.state, c.id)));
  }
  assert.equal(restored.exportSnapshot(), sim.exportSnapshot());
  const broken = sim.getState(); broken.candidates[1].ai_objective = { subzone_id: 'inconnu', purpose: 'CONQUER', expires_tick: 9999 };
  assert.throws(() => restored.importSnapshot(broken), /objectif/);
});

/** Répartit les électeurs physiques : shares indique, sur 10 électeurs, combien votent pour chaque camp. */
function dominate(sim, shares) {
  const slots = Object.entries(shares).flatMap(([faction, n]) => Array(n).fill(faction));
  sim.state.npcs.forEach((n, i) => {
    const faction = slots[i % 10];
    if (faction) { n.role = 'SYMPATHISANT'; n.faction_id = faction; } else { n.role = 'NEUTRE'; n.faction_id = null; }
  });
  refreshElectoralState(sim.state, sim.config);
}

test('Partie à trois : face à un humain dominant, les deux IA le ciblent et convainquent plus vite', () => {
  const { sim, config } = make(); dominate(sim, { melenchon: 7, le_pen: 1, philippe: 1 });
  for (const faction of ['le_pen', 'philippe']) {
    const c = sim.state.candidates.find(c => c.faction_id === faction), a = aiAdaptation(sim.state, config, c);
    assert.ok(a.boost > 0.5, `${faction} : ${a.boost}`); assert.equal(a.focus, 'melenchon'); assert.equal(a.spared.size, 0);
    assert.ok(aiPersuasionMultiplier(sim.state, config, c) < 1);
  }
  assert.equal(aiPersuasionMultiplier(sim.state, config, sim.state.candidates.find(c => c.faction_id === 'melenchon')), 1);
});

test('Humain distancé : les IA le laissent respirer et se disputent entre elles', () => {
  const { sim, config } = make(); dominate(sim, { le_pen: 6, philippe: 3 });
  const [player, lePen, philippe] = ['melenchon', 'le_pen', 'philippe'].map(f => sim.state.candidates.find(c => c.faction_id === f));
  const a = aiAdaptation(sim.state, config, lePen), b = aiAdaptation(sim.state, config, philippe);
  assert.ok(a.boost < 0); assert.ok(a.spared.has('melenchon')); assert.equal(a.focus, 'philippe'); assert.equal(b.focus, 'le_pen');
  assert.ok(aiPersuasionMultiplier(sim.state, config, lePen) > 1);
  assert.ok(assessDuel(sim.state, config, lePen, player, a).fight < assessDuel(sim.state, config, lePen, philippe, a).fight);
});

test('Multijoueur : l’adaptation compte tous les humains et ne ralentit jamais un joueur', () => {
  const { sim, config } = make(); dominate(sim, { melenchon: 7, le_pen: 1, philippe: 1 });
  sim.state.human_candidate_ids = ['candidate:melenchon', 'candidate:le_pen'];
  const bot = sim.state.candidates.find(c => c.faction_id === 'philippe'), human = sim.state.candidates.find(c => c.faction_id === 'le_pen');
  const a = aiAdaptation(sim.state, config, bot);
  assert.ok(a.boost > 0); assert.equal(a.focus, 'melenchon');
  assert.equal(aiPersuasionMultiplier(sim.state, config, human), 1);
});

test('Face à un rival, l’IA observe d’abord sans frapper, puis tranche', () => {
  const { sim, ai } = make(); const c = isolate(sim);
  const rival = sim.state.candidates.find(o => o.faction_id === 'philippe'); rival.x = c.x + 6;
  // À distance, observer n’empêche pas de continuer sa route.
  const far = ai.commands(sim.state, c.id);
  assert.equal(far.find(a => a.type === 'SetAIMind').mind.stance, 'OBSERVE');
  assert.notEqual(far.find(a => a.type === 'Move').axis, 0);
  rival.x = c.x + 3;
  const first = ai.commands(sim.state, c.id);
  assert.equal(first.find(a => a.type === 'SetAIMind').mind.stance, 'OBSERVE');
  assert.ok(!first.some(a => a.type === 'Attack'));
  const stances = [];
  for (let i = 0; i < sim.secondsToTicks(8); i++) { sim.step(ai.commands(sim.state, c.id)); stances.push(c.ai_mind?.stance); }
  assert.ok(stances.some(s => s && s !== 'OBSERVE'), 'L’observation doit déboucher sur une décision.');
});

test('Combattre ou fuir : l’argent transporté et la résistance pèsent sur la décision', () => {
  const { sim, config } = make(); const c = isolate(sim);
  const rival = sim.state.candidates.find(o => o.faction_id === 'philippe'); rival.x = c.x + 2;
  const a = aiAdaptation(sim.state, config, c);
  c.money = 0; const poor = assessDuel(sim.state, config, c, rival, a).fight;
  c.money = 80; const rich = assessDuel(sim.state, config, c, rival, a).fight;
  assert.ok(rich < poor);
  const watching = () => ({ stance: 'OBSERVE', opponent_id: rival.id, since_tick: 0, review_tick: 0, hits: c.hits_received });
  c.resistance = 25; c.ai_mind = watching();
  assert.equal(reflectOnRival(sim.state, config, c, rival, a).stance, 'FLEE');
  c.money = 0; c.resistance = 100; rival.resistance = 25; rival.money = 60; c.ai_mind = watching();
  assert.equal(reflectOnRival(sim.state, config, c, rival, a).stance, 'FIGHT');
});

test('Un événement n’attire plus l’IA à travers un rival sans réagir', () => {
  const { sim, ai } = make(); const c = isolate(sim);
  sim.state.campaign_events.push({ id: 'campaign:test', family: 'RASSEMBLEMENT', status: 'ACTIVE', start_tick: -10000,
    target_candidate_ids: [], march: { center_x: c.x + 6 }, parameters: {} });
  assert.equal(ai.commands(sim.state, c.id).find(a => a.type === 'Move').axis, 1);
  const rival = sim.state.candidates.find(o => o.faction_id === 'philippe'); rival.x = c.x + 3;
  const commands = ai.commands(sim.state, c.id);
  assert.equal(commands.find(a => a.type === 'SetAIMind').mind.stance, 'OBSERVE');
  assert.ok(commands.find(a => a.type === 'Move').axis !== 1 || Math.abs(rival.x - c.x) > 3.5);
});

test('Billets de départ : l’IA revient les chercher en sautant après avoir pris son QG', () => {
  const { sim, ai, config } = make(); const c = sim.state.candidates.find(c => c.faction_id === 'le_pen');
  const home = zoneAt(sim.state.world, c.start_x).biome_id;
  const pickup = sim.state.money_pickups.find(p => p.height_ratio > 0 && zoneAt(sim.state.world, p.x).biome_id === home);
  captureSite(sim, sim.state.buildings.find(b => b.type === 'permanence'), c);
  c.money = 50; c.x = pickup.x - 2; sim.state.npcs = [];
  for (const other of sim.state.candidates) if (other !== c) other.x = c.x + 200 + sim.state.candidates.indexOf(other) * 30;
  sim.state.money_pickups = [pickup];
  for (let i = 0; i < sim.secondsToTicks(6) && sim.state.money_pickups.length; i++) sim.step(ai.commands(sim.state, c.id));
  assert.equal(sim.state.money_pickups.length, 0);
  assert.ok(c.money > 50);
  assert.ok(config.balance.buildings.permanence.first_headquarters_capture_cost <= 50);
});

test('La réflexion de l’IA est sauvegardée et une réflexion invalide est refusée', () => {
  const { sim, config } = make(); const c = isolate(sim);
  sim.applyCommand({ type: 'SetAIMind', candidateId: c.id, mind: { stance: 'OBSERVE', opponent_id: 'candidate:philippe', since_tick: 0, review_tick: 20, hits: 0 } });
  assert.equal(c.ai_mind.stance, 'OBSERVE');
  const restored = new GameSimulation(config); restored.importSnapshot(sim.exportSnapshot());
  assert.deepEqual(restored.state.candidates.find(o => o.id === c.id).ai_mind, c.ai_mind);
  sim.applyCommand({ type: 'SetAIMind', candidateId: c.id, mind: { stance: 'RÊVER', opponent_id: null, since_tick: 0, review_tick: 1, hits: 0 } });
  assert.equal(c.ai_mind.stance, 'OBSERVE');
  const broken = sim.getState(); broken.candidates.find(o => o.id === c.id).ai_mind.stance = 'RÊVER';
  assert.throws(() => restored.importSnapshot(broken), /réflexion/);
});

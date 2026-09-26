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
import { captureSite } from '../src/simulation/strategic-sites.js';
import { ArenaSimulation, arenaAICommands } from '../src/simulation/arena-simulation.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { zoneAt } from '../src/simulation/world.js';

function make(difficulty = 'normal', seed = 42) {
  const config = campaignConfig(); config.balance.campaign_events.event_enabled = false;
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

test('Offensive complète : affaiblir les soutiens, neutraliser puis reprendre un site du joueur', () => {
  const { sim, ai } = make(); const c = isolate(sim); c.money = 200;
  const player = sim.state.candidates.find(c => c.faction_id === 'melenchon');
  const site = sim.state.buildings.find(b => b.type === 'financement');
  captureSite(sim, sim.state.buildings.find(b => b.type === 'permanence'), c);
  captureSite(sim, site, player); c.x = site.x - 3;
  // Ce scénario commence après l’installation du QG pour tester l’offensive seule.
  sim.state.tick = sim.secondsToTicks(80);
  c.ai_objective = { subzone_id: site.subzone_id, purpose: 'CONQUER', expires_tick: sim.state.tick + sim.secondsToTicks(100) };
  const defenders = [supporter(sim, player.faction_id, site.x), supporter(sim, player.faction_id, site.x + 0.2)];
  supporter(sim, c.faction_id, site.x - 0.2); supporter(sim, c.faction_id, site.x - 0.3);
  for (const n of defenders) n.hidden_durability = 8;
  let neutralized = false;
  for (let i = 0; i < sim.secondsToTicks(90) && site.owner_id !== c.faction_id; i++) {
    sim.step(ai.commands(sim.state, c.id)); neutralized ||= site.owner_id === null;
  }
  assert.ok(neutralized, 'La disparition des soutiens doit provoquer la fermeture du site.');
  assert.ok(defenders.some(n => n.faction_id === c.faction_id), 'Les anciens soutiens sont recrutés après leur retour.');
  assert.equal(site.owner_id, c.faction_id);
  assert.ok(c.spending.CAPTURE >= sim.config.balance.buildings.financement.capture_cost);
});

test('Le cabinet administratif de Philippe cible une fermeture adverse', () => {
  const { sim, config } = make(); const c = isolate(sim, 'philippe'); c.money = 1000;
  const cabinet = sim.state.buildings.find(b => b.type === 'faction'); captureSite(sim, cabinet, c); c.x = cabinet.x;
  const rival = sim.state.candidates.find(c => c.faction_id === 'le_pen');
  const victim = sim.state.buildings.find(b => b.type === 'financement'); captureSite(sim, victim, rival);
  const target = aiEconomicTarget(sim.state, config, c, { subzone_id: cabinet.subzone_id, purpose: 'CONQUER' });
  assert.equal(target.offer.kind, 'CLOSE'); assert.equal(target.offer.victim_id, victim.id);
});

test('L’IA déclenche un raid disponible dans la direction des bâtiments ennemis', () => {
  const { sim, config } = make(); const c = isolate(sim); c.money = 1000;
  const site = sim.state.buildings.find(b => b.type === 'faction'); captureSite(sim, site, c); site.level = 3; c.x = site.x;
  const guard = supporter(sim, c.faction_id, c.x); guard.role = 'SERVICE_D_ORDRE'; guard.guard_biome_id = site.biome_id;
  const rival = sim.state.candidates.find(c => c.faction_id === 'philippe');
  captureSite(sim, sim.state.buildings.find(b => b.type === 'financement'), rival);
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

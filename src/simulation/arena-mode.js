import { ArenaSimulation } from './arena-simulation.js';
import { aiCombatCommands } from './ai-combat.js';
import { aiNoise } from './ai-settings.js';
import { airborne, startPlatformFall } from './combat-actions.js';
import { campaignStyles, isCampaignStyleUnlocked } from './campaign-styles.js';
import { combatState } from './combat-state.js';
import { initializeMobileCombat } from './mobile-combat.js';
import { FACTIONS } from './world.js';

const clone = value => JSON.parse(JSON.stringify(value));

/** Formats proposés dans le menu : nombre de combattants dans l’arène. */
export const ARENA_FORMATS = Object.freeze({ '1v1': 2, '1v1v1': 3 });
export { BETATEST_NICKNAME, isBetatestProfile } from './campaign-styles.js';

/** Styles jouables en Arène par ce profil : ceux débloqués, ou tous pour « betatest ». */
export function arenaStyleAvailable(config, profile, faction, styleId) {
  return campaignStyles(config, faction).some(s => s.id === styleId) && isCampaignStyleUnlocked(profile, faction, styleId);
}

/** Renvoie un message d’erreur lisible, ou null si le combat peut commencer. */
export function arenaSetupError(config, setup, profile = null) {
  const count = ARENA_FORMATS[setup?.format];
  if (!count) return 'Choisissez 1 contre 1 ou 1 contre 1 contre 1.';
  if (!config.balance.arena_mode.maps[setup.map]) return 'Choisissez une carte.';
  if (!Array.isArray(setup.fighters) || setup.fighters.length !== count) return `Il faut ${count} combattants.`;
  const seen = new Set();
  for (const [index, fighter] of setup.fighters.entries()) {
    if (!FACTIONS.includes(fighter?.faction)) return 'Candidat inconnu.';
    if (!campaignStyles(config, fighter.faction).some(s => s.id === fighter.style)) return 'Choisissez un style pour chaque combattant.';
    // Seul le style du joueur dépend de son profil ; l’IA peut tout utiliser.
    if (index === 0 && profile && !arenaStyleAvailable(config, profile, fighter.faction, fighter.style)) return 'Ce style n’est pas encore débloqué.';
    const key = `${fighter.faction}:${fighter.style}`;
    if (seen.has(key)) return 'Un même candidat peut revenir, mais avec un autre style.';
    seen.add(key);
  }
  return null;
}

/** Identifiants des combattants, dans l’ordre : le deuxième Mélenchon devient « candidate:melenchon:2 ». */
export function arenaFighterIds(fighters) {
  const counts = {};
  return fighters.map(f => {
    counts[f.faction] = (counts[f.faction] || 0) + 1;
    return counts[f.faction] === 1 ? `candidate:${f.faction}` : `candidate:${f.faction}:${counts[f.faction]}`;
  });
}

/**
 * Arène multijoueur : un combattant par joueur (ordre des places), plus une IA
 * quand deux joueurs choisissent le 1 contre 1 contre 1. L’IA prend de préférence
 * un candidat absent, avec un style libre.
 */
export function multiplayerArenaSetup(config, room, { format = '1v1', map = config.balance.arena_mode.default_map } = {}) {
  const fighters = [...room.players].sort((a, b) => a.slot - b.slot).map(p => ({ faction: p.faction, style: p.style, player: p.id }));
  const count = Math.max(fighters.length, ARENA_FORMATS[format] ?? 2);
  while (fighters.length < count) {
    const free = faction => campaignStyles(config, faction).find(s => !fighters.some(f => f.faction === faction && f.style === s.id));
    const faction = [...FACTIONS].sort((a, b) => fighters.filter(f => f.faction === a).length - fighters.filter(f => f.faction === b).length).find(free);
    fighters.push({ faction, style: free(faction).id, player: null });
  }
  return { format: count === 3 ? '1v1v1' : '1v1', map, fighters };
}

/** Réglages du combat d’arène : ceux de la campagne, avec un dash plus long.
 * La caméra fixe de l’arène rend le dash de campagne visuellement trop court. */
const arenaConfigs = new WeakMap();
export function arenaConfig(config) {
  if (!arenaConfigs.has(config)) arenaConfigs.set(config, { ...config, balance: { ...config.balance,
    dash: { ...config.balance.dash, distance: config.balance.arena_mode.dash_distance } } });
  return arenaConfigs.get(config);
}

function createFighter(config, fighter, id, x, width) {
  // Même réserve de vie qu’en campagne.
  const hp = config.balance.candidate_combat.resistance_max;
  const c = {
    id, team_id: id, role: 'CANDIDAT', faction_id: fighter.faction, current_campaign_style: fighter.style, eliminated: false,
    x, axis: 0, facing: x > width / 2 ? -1 : 1, moving: false, campaign_active: true, interaction_active: false,
    persuasion_target_ids: [], special_charge: 0, podium_site_id: null, platform_id: null, vehicle: null,
    combat: combatState(), electoral_damage_received: 0, hits_received: 0, resistance: config.balance.candidate_combat.resistance_max,
    is_ko: false, disappeared: false, ko_started_tick: -1, purchase_hold: null, money: 0,
    style_hold: null, style_interaction_held: false, ultimate_effect: null, bardella_form: false, bardellisation_used: false,
    arena_hp: hp, arena_initial_hp: hp, damage_dealt: 0,
    // Arène multijoueur : combattant piloté par un autre joueur humain.
    remote_player: !!fighter.player,
  };
  initializeMobileCombat({ config }, c);
  return c;
}

/**
 * Combat d’arène autonome : pas de monde de campagne, pas d’électeurs.
 * Réutilise tel quel le moteur de combat de la campagne (ArenaSimulation).
 */
export class ArenaMatch {
  constructor(config, setup, profile = null) {
    const error = arenaSetupError(config, setup, profile);
    if (error) throw new Error(error);
    this.config = arenaConfig(config); this.setup = clone(setup);
    this.hz = config.balance.simulation_architecture.fixed_tick_hz;
    const b = config.balance.first_round_arena, mode = config.balance.arena_mode, map = mode.maps[setup.map];
    const seed = Number(setup.seed) >>> 0 || 1;
    const places = setup.fighters.length === 2 ? [0.25, 0.75] : [0.18, 0.5, 0.82];
    const ids = arenaFighterIds(setup.fighters);
    const candidates = setup.fighters.map((fighter, i) => createFighter(config, fighter, ids[i], places[i] * b.width_units, b.width_units));
    this.state = {
      mode: 'ARENA', phase: 'COUNTDOWN', format: setup.format, map_id: setup.map, map_name: map.name,
      tick: 0, seed, rng_state: seed, world: { length: b.width_units }, ai_enabled: true,
      ai_difficulty: setup.difficulty ?? config.balance.ai?.difficulty ?? 'normal',
      arena_bounds: { min: b.edge_margin, max: b.width_units - b.edge_margin },
      platforms: clone(map.platforms),
      platform_jump: map.platforms.length ? { height: map.jump_height, duration_seconds: map.jump_duration_seconds } : null,
      candidates, npcs: [], buildings: [], electorate: [], campaign_events: [],
      attacks: [], projectiles: [], powers: [], temporary_units: [], hit_results: [], events: [],
      next_attack_id: 1, next_projectile_id: 1, next_power_id: 1, next_temporary_id: 1, next_hit_id: 1, next_event_id: 1, next_raid_id: 1,
      eliminated_faction: null, hit_count: 0, candidate_hit_count: 0,
      campaign_hit_damage: true,
      countdown_ticks: this.secondsToTicks(mode.countdown_seconds), fight_started_tick: null,
      winner_id: null, finished_tick: null, ko_order: [],
      local_candidate_id: candidates[0].id,
    };
  }
  secondsToTicks(s) { return Math.ceil(s * this.hz - 1e-9); }
  emit(type, data) {
    this.state.events.push({ ...data, type, id: `event:${this.state.next_event_id++}`, tick: this.state.tick });
    if (this.state.events.length > this.config.prototype.debug.event_history_limit) this.state.events.shift();
  }
  getState() { return clone(this.state); }
  applyCommand(command, arena = new ArenaSimulation(this.config, this.state)) {
    const s = this.state;
    if (s.phase !== 'FIGHT') return;
    const c = s.candidates.find(c => c.id === command?.candidateId);
    if (!c || c.is_ko) return;
    if (command.type === 'DropDown') {
      // ↓ sur un pupitre : on se laisse tomber à travers.
      if (c.platform_id && !airborne(c) && !c.combat.stun_ticks && !c.combat.attack_id && !c.dash_active) startPlatformFall(arena, c, c.platform_id);
      return;
    }
    if (['Move', 'Attack', 'SetCampaignActive', 'PressAttack', 'ReleaseAttack', 'CancelAttack', 'Jump', 'Dash', 'ActivateUltimate'].includes(command.type)) arena.applyCommand(command);
  }
  step(commands = []) {
    const s = this.state;
    if (s.phase === 'OVER') {
      // Quelques secondes de plus, sans commandes : les coups en cours et la chute du KO se terminent.
      if (s.tick - s.finished_tick < this.secondsToTicks(6)) new ArenaSimulation(this.config, s).step();
      return;
    }
    if (s.phase === 'COUNTDOWN') {
      s.tick++;
      if (--s.countdown_ticks <= 0) { s.phase = 'FIGHT'; s.fight_started_tick = s.tick; this.emit('ArenaFightStarted', {}); }
      return;
    }
    const arena = new ArenaSimulation(this.config, s);
    for (const command of commands) this.applyCommand(command, arena);
    arena.step();
    this.resolveKnockouts();
  }
  resolveKnockouts() {
    const s = this.state;
    for (const hit of s.hit_results) if (hit.tick === s.tick && hit.score_damage) {
      const source = s.candidates.find(c => c.id === hit.source_id) || s.candidates.find(c => c.id === s.temporary_units.find(t => t.id === hit.source_id)?.owner_id);
      if (source) source.damage_dealt += hit.score_damage;
    }
    for (const c of s.candidates) if (!c.is_ko && c.arena_hp <= 0) {
      Object.assign(c, { is_ko: true, axis: 0, moving: false, campaign_active: false, ko_started_tick: s.tick, platform_id: null });
      s.ko_order.push(c.id);
      this.emit('ArenaKnockout', { candidate_id: c.id });
    }
    // Le moteur s’arrête au premier KO (règle du premier tour) : ici le combat continue.
    s.eliminated_faction = null;
    const alive = s.candidates.filter(c => !c.is_ko);
    if (alive.length <= 1) {
      s.phase = 'OVER'; s.winner_id = alive[0]?.id ?? null; s.finished_tick = s.tick;
      for (const c of alive) { c.axis = 0; c.moving = false; }
      this.emit('ArenaFinished', { winner_id: s.winner_id });
    }
  }
}

// ——— IA du mode Arène ———

const standingHeight = actor => airborne(actor) ? Math.max(0, actor.combat.jump_base ?? 0) : actor.combat.height;

/** Adversaire visé : proche, à portée de hauteur, affaibli, avec une variation stable par période. */
export function arenaModeTarget(state, config, c) {
  const period = Math.floor(state.tick / Math.max(1, Math.round(config.balance.arena_mode.ai_retarget_seconds * config.balance.simulation_architecture.fixed_tick_hz)));
  const options = state.candidates.filter(t => t.id !== c.id && !t.is_ko && (t.team_id ?? t.faction_id) !== (c.team_id ?? c.faction_id));
  // En 1 contre 1 contre 1, une cible déjà assaillie par un autre attire moins : pas d’acharnement à deux.
  const pressure = t => state.candidates.filter(o => o.id !== c.id && o.id !== t.id && !o.is_ko && o.combat.target_id === t.id).length * 2.5;
  return options.map(t => ({ t, rank: Math.abs(t.x - c.x) * 0.65 + Math.abs(standingHeight(t) - standingHeight(c)) * 3 + t.arena_hp * 0.04 + pressure(t)
    - (t.combat.target_id === c.id ? 0.8 : 0) + aiNoise(state.seed, `${c.id}:${t.id}:${period}`) * config.balance.first_round_arena.ai_variation_units }))
    .sort((a, b) => a.rank - b.rank || a.t.id.localeCompare(b.t.id))[0]?.t || null;
}

/** Monter vers un adversaire perché, ou redescendre vers lui. null : même niveau, combat normal. */
function platformCommands(state, config, c, target) {
  if (!state.platforms?.length) return null;
  const base = [{ type: 'SetCampaignActive', candidateId: c.id, active: true }];
  const move = goal => ({ type: 'Move', candidateId: c.id, axis: Math.abs(goal - c.x) < 0.25 ? 0 : Math.sign(goal - c.x) });
  const reach = state.platform_jump.height * 0.92;
  const mine = standingHeight(c), theirs = standingHeight(target);
  const targetPlatform = state.platforms.find(p => p.id === target.platform_id);
  // Pupitre à viser pour monter : celui de l’adversaire, ou un pupitre intermédiaire.
  const step = targetPlatform && targetPlatform.height > mine + 0.01 && (targetPlatform.height - mine <= reach ? targetPlatform
    : state.platforms.filter(p => p.height > mine + 0.01 && p.height - mine <= reach)
      .sort((a, b) => Math.abs(a.x - targetPlatform.x) - Math.abs(b.x - targetPlatform.x))[0]);
  if (airborne(c)) {
    // En l’air : viser le pupitre choisi, et frapper si l’adversaire passe à portée.
    const commands = [...base, move(step ? step.x : target.x)];
    if (Math.abs(target.x - c.x) <= config.balance.candidate_combat.light_range && Math.abs(target.combat.height - c.combat.height) < 0.7) commands.push({ type: 'Attack', candidateId: c.id, direction: Math.sign(target.x - c.x) || c.facing });
    return commands;
  }
  if (Math.abs(theirs - mine) < 0.5) return null;
  if (c.combat.stun_ticks || c.combat.attack_id || c.combat.press_tick != null || c.dash_active) return [...base, { type: 'Move', candidateId: c.id, axis: 0 }];
  if (theirs < mine) {
    // Adversaire plus bas : se laisser tomber s’il est juste dessous, sinon marcher dans le vide vers lui.
    const own = state.platforms.find(p => p.id === c.platform_id);
    if (own && Math.abs(target.x - own.x) <= own.half_width + 0.6) return [...base, { type: 'Move', candidateId: c.id, axis: 0 }, { type: 'DropDown', candidateId: c.id }];
    return [...base, move(target.x)];
  }
  if (!step) return null;
  // Sauter à proximité du pupitre visé, ou depuis le bord de son propre pupitre.
  const own = state.platforms.find(p => p.id === c.platform_id);
  const direction = Math.sign(step.x - c.x);
  const atEdge = own && direction && Math.abs(own.x + direction * own.half_width - c.x) < 0.4;
  const close = Math.abs(step.x - c.x) <= step.half_width + 1.1;
  return close || atEdge ? [...base, move(step.x), { type: 'Jump', candidateId: c.id }] : [...base, move(step.x)];
}

export function arenaModeAICommands(state, baseConfig, candidateId) {
  const config = arenaConfig(baseConfig);
  const c = state.candidates.find(c => c.id === candidateId);
  if (!c || c.is_ko || state.phase !== 'FIGHT') return [];
  const target = arenaModeTarget(state, config, c);
  if (!target) return [{ type: 'Move', candidateId, axis: 0 }];
  return platformCommands(state, config, c, target) || aiCombatCommands(state, config, c, target);
}

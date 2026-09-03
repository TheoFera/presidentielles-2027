import { random } from './world.js';
import { combatState, interrupted } from './combat-state.js';
import { beginCombatTick, requestAttack, updateCombat, wallBlockedPosition } from './combat.js';
import { combatPosition } from './combat-geometry.js';

const clone = value => JSON.parse(JSON.stringify(value));

/** Independent authoritative combat state: the campaign's tick never advances here. */
export class ArenaSimulation {
  constructor(config, state) { this.config = config; this.hz = config.balance.simulation_architecture.fixed_tick_hz; this.state = state; }
  static create(config, worldState) {
    const b = config.balance.first_round_arena;
    const state = {
      tick: 0, rng_state: worldState.rng_state, world: clone(worldState.world),
      arena_bounds: { min: b.edge_margin, max: b.width_units - b.edge_margin },
      candidates: clone(worldState.candidates), npcs: [], buildings: [], electorate: [],
      attacks: [], projectiles: [], powers: [], temporary_units: [], hit_results: [], events: [],
      next_attack_id: 1, next_projectile_id: 1, next_power_id: 1, next_temporary_id: 1, next_hit_id: 1, next_event_id: 1, next_raid_id: 1,
      eliminated_faction: null, hit_count: 0, candidate_hit_count: 0,
    };
    const places = [0.23, 0.5, 0.77];
    for (let i = places.length - 1; i > 0; i--) { const j = Math.floor(random(state) * (i + 1)); [places[i], places[j]] = [places[j], places[i]]; }
    state.candidates.forEach((c, i) => {
      c.x = places[i] * b.width_units; c.axis = 0; c.facing = c.x > b.width_units / 2 ? -1 : 1; c.moving = false;
      c.combat = combatState(); c.campaign_active = true; c.interaction_active = false; c.purchase_hold = null; c.persuasion_target_ids = [];
      c.arena_initial_hp = worldState.actualGameState.national_support[c.faction_id]; c.arena_hp = c.arena_initial_hp;
    });
    state.eliminated_faction = state.candidates.find(c => c.arena_hp <= 0)?.faction_id || null;
    return state;
  }
  secondsToTicks(s) { return Math.ceil(s * this.hz - 1e-9); }
  emit(type, data) {
    this.state.events.push({ ...data, type, id: `event:${this.state.next_event_id++}`, tick: this.state.tick });
    if (this.state.events.length > this.config.prototype.debug.event_history_limit) this.state.events.shift();
  }
  applyCommand(command) {
    const c = this.state.candidates.find(c => c.id === command.candidateId);
    if (!c || this.state.eliminated_faction) return;
    if (command.type === 'Move' && [-1, 0, 1].includes(command.axis)) c.axis = command.axis;
    if (command.type === 'SetCampaignActive' && typeof command.active === 'boolean') c.campaign_active = command.active;
    if (command.type === 'Attack') requestAttack(this, c, command.direction);
    if (command.type === 'DebugFillSpecial') c.special_charge = this.config.balance.special_charge.required_points;
  }
  step() {
    if (this.state.eliminated_faction) return;
    this.state.tick++;
    beginCombatTick(this);
    for (const c of this.state.candidates) {
      if (interrupted(c)) continue;
      c.x = wallBlockedPosition(this, c, combatPosition(this.state, c.x + c.axis * this.config.prototype.movement.candidate_speed_units_per_second / this.hz));
      c.moving = c.axis !== 0; if (c.axis) c.facing = c.axis;
    }
    updateCombat(this);
  }
}

/** Pure seeded variation, identical after snapshot load and unrelated to local ownership. */
export function arenaAICommands(state, config, candidateId, enabled) {
  const c = state.candidates.find(c => c.id === candidateId);
  if (!c || state.eliminated_faction) return [];
  const commands = axis => [{ type: 'SetCampaignActive', candidateId, active: enabled }, { type: 'Move', candidateId, axis }];
  if (!enabled) return commands(0);
  const period = Math.floor(state.tick / (config.balance.first_round_arena.ai_retarget_seconds * config.balance.simulation_architecture.fixed_tick_hz));
  const index = state.candidates.indexOf(c);
  const noise = i => { let n = (state.rng_state ^ Math.imul(period + 1, 374761393) ^ Math.imul(index + 1, 668265263) ^ Math.imul(i + 1, 1274126177)) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0; return (n ^ (n >>> 16)) >>> 0; };
  const options = state.candidates.filter(t => t.id !== c.id).map(t => ({ t, rank: Math.abs(t.x - c.x) * 0.65 + t.arena_hp * 0.06
    - (t.combat.target_id === c.id ? 0.8 : 0) + noise(state.candidates.indexOf(t)) / 0xffffffff * config.balance.first_round_arena.ai_variation_units }));
  options.sort((a, b) => a.rank - b.rank || a.t.id.localeCompare(b.t.id));
  const target = options[0].t; const d = target.x - c.x;
  const close = Math.abs(d) <= config.balance.candidate_combat.light_range;
  const result = commands(close ? 0 : Math.sign(d));
  if (close && !c.combat.attack_id && !c.combat.stun_ticks) result.push({ type: 'Attack', candidateId, direction: Math.sign(d) || c.facing });
  return result;
}

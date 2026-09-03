import { move, setCampaignActive, interactionPresence, attack } from './commands.js';
import { ringDelta, zoneAt } from './world.js';
import { aiDevelopmentZone, aiEconomicTarget } from './economy.js';
import { nearestEnemy } from './combat-state.js';
import { GamePhase } from './phases.js';
import { arenaAICommands } from './arena-simulation.js';
import { sprintAICommands } from './sprint-ai.js';

export class Controller {
  commands(_state, _candidateId) { throw new Error('Le contrôleur doit produire des commandes.'); }
}

export class LocalHumanController extends Controller {
  constructor() { super(); this.axis = 0; this.pendingTap = 0; }
  setAxis(axis) { this.axis = Math.sign(axis); if (this.axis) this.pendingTap = this.axis; }
  reset() { this.axis = 0; this.pendingTap = 0; this.attackPending = false; }
  attack() { this.attackPending = true; }
  commands(_state, candidateId) {
    // Preserve a key press released between two simulation ticks.
    const axis = this.axis || this.pendingTap;
    this.pendingTap = 0;
    const commands = [setCampaignActive(candidateId, true), interactionPresence(candidateId), move(candidateId, axis)];
    if (this.attackPending) { commands.push(attack(candidateId)); this.attackPending = false; }
    return commands;
  }
}

/** Stateless decisions keep replay/snapshot resumption exact. Full strategy is a later milestone. */
export class AIController extends Controller {
  constructor(config) { super(); this.config = config; }
  commands(state, candidateId) {
    if (state.phase === GamePhase.RESULTS) return [];
    if (state.phase === GamePhase.FIRST_ROUND_ARENA) return arenaAICommands(state.arena, this.config, candidateId, state.ai_enabled);
    const candidate = state.candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.eliminated) return [];
    if (state.phase === GamePhase.SECOND_ROUND_SPRINT) return sprintAICommands(state, this.config, candidate);
    const commands = (axis, purchase = false) => [setCampaignActive(candidateId, state.ai_enabled), interactionPresence(candidateId, state.ai_enabled && purchase), move(candidateId, axis)];
    if (!state.ai_enabled) return commands(0);
    const opponent = nearestEnemy(state, candidate, this.config.balance.candidate_combat.ai_detection_range, t => t.role !== 'SYMPATHISANT');
    if (opponent) {
      const d = ringDelta(candidate.x, opponent.x, state.world.length);
      const close = Math.abs(d) <= this.config.balance.candidate_combat.light_range;
      const result = commands(close ? 0 : Math.sign(d));
      if (close && !candidate.combat.attack_id && !candidate.combat.stun_ticks) result.push(attack(candidateId, Math.sign(d) || candidate.facing));
      return result;
    }
    const retained = state.npcs.find(n => n.role === 'NEUTRE' && n.persuasion?.actor_id === candidateId);
    if (retained) return commands(0);
    const economic = aiEconomicTarget(state, this.config, candidate);
    if (economic) {
      const delta = ringDelta(candidate.x, economic.x, state.world.length);
      const stop = (economic.interaction_radius ?? this.config.balance.interaction.radius_units) * this.config.prototype.ai.stop_distance_radius_ratio;
      return commands(Math.abs(delta) <= stop ? 0 : Math.sign(delta), Math.abs(delta) <= stop);
    }
    const development = this.config.balance.ai_economy.enabled ? aiDevelopmentZone(state, this.config, candidate) : null;
    const targets = state.npcs.filter(n => n.role === 'NEUTRE' && (!n.persuasion || n.persuasion.actor_id === candidateId)
      && (!development || zoneAt(state.world, n.x).id === development.zone.id));
    targets.sort((a, b) => Math.abs(ringDelta(candidate.x, a.x, state.world.length)) - Math.abs(ringDelta(candidate.x, b.x, state.world.length)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const target = retained || targets[0];
    if (!target) {
      if (development) { const d = ringDelta(candidate.x, development.zone.center, state.world.length); return commands(Math.abs(d) > this.config.prototype.persuasion.radius_units ? Math.sign(d) : 0); }
      return commands(this.config.prototype.ai.patrol_direction);
    }
    const delta = ringDelta(candidate.x, target.x, state.world.length);
    const stopDistance = this.config.prototype.persuasion.radius_units * this.config.prototype.ai.stop_distance_radius_ratio;
    return commands(Math.abs(delta) <= stopDistance ? 0 : Math.sign(delta));
  }
}

export function collectCommands(state, human, ai) {
  if (state.phase === GamePhase.RESULTS) return [];
  return state.candidates.filter(c => !c.eliminated).flatMap(candidate => (candidate.id === state.local_candidate_id ? human : ai).commands(state, candidate.id));
}

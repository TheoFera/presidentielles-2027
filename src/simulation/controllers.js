import { DEFAULT_UNLOCKS } from './campaign-styles.js';
import { campaignCommittedAICommands } from './ai-events.js';
import { move, setCampaignActive, interactionPresence, attack } from './commands.js';
import { strategicAICommands } from './ai-strategy.js';
import { GamePhase } from './phases.js';
import { debateAICommands } from './debate-simulation.js';
import { sprintAICommands } from './sprint-ai.js';
import { minorAICommands } from './minor-candidates.js';

export class Controller {
  commands(_state, _candidateId) { throw new Error('Le contrôleur doit produire des commandes.'); }
}

export class LocalHumanController extends Controller {
  constructor() { super(); this.axis = 0; this.pendingTap = 0; this.attackEvents = []; }
  setAxis(axis) { this.axis = Math.sign(axis); if (this.axis) this.pendingTap = this.axis; }
  dash(direction) { this.dashPending = direction; }
  ultimate() { this.ultimatePending = true; this.attackEvents = []; this.attackPending = false; this.dashPending = 0; this.jumpPending = false; }
  pressAttack() { this.attackEvents.push('PressAttack'); }
  releaseAttack() { this.attackEvents.push('ReleaseAttack'); }
  cancelAttack() { this.attackEvents = ['CancelAttack']; }
  jump() { this.jumpPending = true; }
  reset() { this.cancelAttack(); this.jumpPending = false; this.dashPending = 0; this.ultimatePending = false; this.axis = 0; this.pendingTap = 0; this.attackPending = false; }
  attack() { this.attackPending = true; }
  commands(_state, candidateId) {
    // Preserve a key press released between two simulation ticks.
    const axis = this.axis || this.pendingTap;
    this.pendingTap = 0;
    const commands = [setCampaignActive(candidateId, true), interactionPresence(candidateId), move(candidateId, axis)];
    if (this.ultimatePending) { this.ultimatePending = false; this.attackEvents = []; this.attackPending = false; this.dashPending = 0; this.jumpPending = false; return [...commands, { type: 'ActivateUltimate', candidateId }]; }
    if (this.jumpPending) { commands.push({ type: 'Jump', candidateId }); this.jumpPending = false; }
    if (this.dashPending) { commands.push({ type: 'Dash', candidateId, direction: this.dashPending }); this.dashPending = 0; }
    for (const type of this.attackEvents.splice(0)) commands.push({ type, candidateId });
    if (this.attackPending) { commands.push(attack(candidateId)); this.attackPending = false; }
    return commands;
  }
}

/** Décisions pures ; les objectifs sont enregistrés par la simulation pour les sauvegardes. */
export class AIController extends Controller {
  constructor(config) { super(); this.config = config; }
  commands(state, candidateId) {
    if (state.campaign_style_selection?.candidate_id === candidateId) return state.ai_enabled
      ? [{ type: 'SelectCampaignStyle', candidateId, styleId: DEFAULT_UNLOCKS[state.candidates.find(c => c.id === candidateId).faction_id][0] }] : [];
    if ([GamePhase.FIRST_ROUND_RESULTS, GamePhase.RESULTS].includes(state.phase)) return [];
    if (state.phase === GamePhase.FIRST_ROUND_DEBATE) return debateAICommands(state.debate, this.config, candidateId, state.ai_enabled);
    const candidate = state.candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.eliminated) return [];
    if (candidate.combat.press_tick != null && !candidate.campaign_debate_id) {
      if (!state.ai_enabled) return [{ type: 'CancelAttack', candidateId }];
      const readyTicks = Math.ceil(this.config.balance.candidate_combat.charge_ready_seconds * this.config.balance.simulation_architecture.fixed_tick_hz);
      return state.tick - candidate.combat.press_tick >= readyTicks
        ? [{ type: 'ReleaseAttack', candidateId }] : [{ type: 'Move', candidateId, axis: 0 }];
    }
    if (candidate.minor) return minorAICommands(state, this.config, candidate);
    if (state.phase === GamePhase.SECOND_ROUND_SPRINT) return sprintAICommands(state, this.config, candidate);
    // Débat médiatique ou meeting de crise en cours : l’engagement prime.
    // Les autres événements sont pesés dans la stratégie, après les rivaux proches.
    const committed = campaignCommittedAICommands(state, this.config, candidate);
    if (committed) return committed;
    return strategicAICommands(state, this.config, candidate);
  }
}

export function collectCommands(state, human, ai) {
  if ([GamePhase.FIRST_ROUND_RESULTS, GamePhase.RESULTS].includes(state.phase)) return [];
  return state.candidates.filter(c => !c.eliminated).flatMap(candidate =>
    (candidate.id === state.local_candidate_id ? human : ai).commands(state, candidate.id));
}

import { DEFAULT_UNLOCKS } from './campaign-styles.js';
import { campaignAICommands } from './campaign-events.js';
import { move, setCampaignActive, interactionPresence, attack } from './commands.js';
import { strategicAICommands } from './ai-strategy.js';
import { GamePhase } from './phases.js';
import { arenaAICommands } from './arena-simulation.js';
import { sprintAICommands } from './sprint-ai.js';

export class Controller {
  commands(_state, _candidateId) { throw new Error('Le contrôleur doit produire des commandes.'); }
}

export class LocalHumanController extends Controller {
  constructor() { super(); this.axis = 0; this.pendingTap = 0; }
  setAxis(axis) { this.axis = Math.sign(axis); if (this.axis) this.pendingTap = this.axis; }
  dash(direction) { this.dashPending = direction; }
  ultimate() { this.ultimatePending = true; }
  reset() { this.dashPending = 0; this.ultimatePending = false; this.axis = 0; this.pendingTap = 0; this.attackPending = false; }
  attack() { this.attackPending = true; }
  commands(_state, candidateId) {
    // Preserve a key press released between two simulation ticks.
    const axis = this.axis || this.pendingTap;
    this.pendingTap = 0;
    const commands = [setCampaignActive(candidateId, true), interactionPresence(candidateId), move(candidateId, axis)];
    if (this.dashPending) { commands.push({ type: 'Dash', candidateId, direction: this.dashPending }); this.dashPending = 0; }
    if (this.ultimatePending) { commands.push({ type: 'ActivateUltimate', candidateId }); this.ultimatePending = false; }
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
    if (state.phase === GamePhase.RESULTS) return [];
    if (state.phase === GamePhase.FIRST_ROUND_ARENA) return arenaAICommands(state.arena, this.config, candidateId, state.ai_enabled);
    const candidate = state.candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.eliminated) return [];
    if (state.phase === GamePhase.SECOND_ROUND_SPRINT) return sprintAICommands(state, this.config, candidate);
    if (state.ai_enabled && !candidate.is_ko) {
      const eventCommands = campaignAICommands(state, this.config, candidate);
      if (eventCommands) return eventCommands;
    }
    return strategicAICommands(state, this.config, candidate);
  }
}

export function collectCommands(state, human, ai) {
  if (state.phase === GamePhase.RESULTS) return [];
  return state.candidates.filter(c => !c.eliminated).flatMap(candidate =>
    (candidate.id === state.local_candidate_id ? human : ai).commands(state, candidate.id));
}

import { DEFAULT_UNLOCKS } from './campaign-styles.js';
import { campaignCommittedAICommands } from './ai-events.js';
import { move, setCampaignActive, interactionPresence, attack } from './commands.js';
import { strategicAICommands } from './ai-strategy.js';
import { GamePhase } from './phases.js';
import { debateAICommands } from './debate-simulation.js';
import { sprintAICommands } from './sprint-ai.js';
import { minorAICommands } from './minor-candidates.js';
import { tactics } from './ai-moments.js';
import { aiSettings } from './ai-settings.js';
import { nearestEnemy } from './combat-state.js';
import { withAIObservation } from './ai-observation.js';

export class Controller {
  commands(_state, _candidateId) { throw new Error('Le contrôleur doit produire des commandes.'); }
}

export class LocalHumanController extends Controller {
  constructor() { super(); this.axis = 0; this.pendingTap = 0; this.attackEvents = []; }
  // `onInput` : appelé à chaque nouvelle action du joueur (en multijoueur, le pas part aussitôt).
  setAxis(axis) { const old = this.axis; this.axis = Math.sign(axis); if (this.axis) this.pendingTap = this.axis; if (this.axis !== old) this.onInput?.(); }
  dash(direction) { this.dashPending = direction; this.onInput?.(); }
  ultimate() { this.ultimatePending = true; this.attackEvents = []; this.attackPending = false; this.dashPending = 0; this.jumpPending = false; this.onInput?.(); }
  pressAttack() { this.attackEvents.push('PressAttack'); this.onInput?.(); }
  releaseAttack() { this.attackEvents.push('ReleaseAttack'); this.onInput?.(); }
  cancelAttack() { this.attackEvents = ['CancelAttack']; this.onInput?.(); }
  jump() { this.jumpPending = true; this.onInput?.(); }
  reset() { this.attackEvents = ['CancelAttack']; this.jumpPending = false; this.dashPending = 0; this.ultimatePending = false; this.axis = 0; this.pendingTap = 0; this.attackPending = false; }
  attack() { this.attackPending = true; this.onInput?.(); }
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
    return withAIObservation(state, () => this.decide(state, candidateId));
  }
  decide(state, candidateId) {
    // Scène d'ouverture : l'ordinateur attend le début de la campagne (rien à décider).
    if (state.campaign_intro) return [];
    if (state.campaign_style_selection?.candidate_id === candidateId) return state.ai_enabled
      ? [{ type: 'SelectCampaignStyle', candidateId, styleId: DEFAULT_UNLOCKS[state.candidates.find(c => c.id === candidateId).faction_id][0] }] : [];
    if ([GamePhase.FIRST_ROUND_RESULTS, GamePhase.RESULTS].includes(state.phase)) return [];
    if (state.phase === GamePhase.FIRST_ROUND_DEBATE) return debateAICommands(state.debate, this.config, candidateId, state.ai_enabled);
    const candidate = state.candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.eliminated) return [];
    if (candidate.combat.press_tick != null && !candidate.campaign_debate_id) {
      if (!state.ai_enabled) return [{ type: 'CancelAttack', candidateId }];
      const readyTicks = Math.ceil(this.config.balance.candidate_combat.charge_ready_seconds * this.config.balance.simulation_architecture.fixed_tick_hz);
      return state.tick - candidate.combat.press_tick - (candidate.combat.press_delay_ticks || 0) >= readyTicks
        ? [{ type: 'ReleaseAttack', candidateId }] : [{ type: 'Move', candidateId, axis: 0 }];
    }
    // Hors combat, l’IA peut réfléchir moins souvent : entre deux réflexions, elle n’envoie rien et garde sa direction.
    if (state.phase === GamePhase.CAMPAIGN && enPause(state, this.config, candidate)) return [];
    if (candidate.minor) return steadyTurns(state, this.config, candidate, minorAICommands(state, this.config, candidate));
    if (state.phase === GamePhase.SECOND_ROUND_SPRINT) return steadyTurns(state, this.config, candidate, sprintAICommands(state, this.config, candidate));
    // Débat médiatique ou meeting de crise en cours : l’engagement prime.
    // Les autres événements sont pesés dans la stratégie, après les rivaux proches.
    const committed = campaignCommittedAICommands(state, this.config, candidate);
    if (committed) return committed;
    return steadyTurns(state, this.config, candidate, strategicAICommands(state, this.config, candidate));
  }
}

/**
 * Image sans réflexion ? Les IA réfléchissent à tour de rôle (décalées d’une image), mais gardent tous leurs
 * réflexes à chaque image en combat, face à un rival, juste après un coup, pendant un achat ou un événement,
 * et dès qu’un adversaire est en vue (le rythme des frappes est calé sur le numéro de l’image : une IA qui
 * ne réfléchirait pas à chaque image pourrait ne jamais tomber sur une image de frappe).
 * Ne dépend que de l’état de la partie : sauvegardes et multijoueur restent identiques.
 */
function enPause(state, config, c) {
  const toutes = tactics(config).think_every_ticks;
  if (!(toutes > 1) || !state.ai_enabled || c.is_ko) return false;
  if ((state.tick + state.candidates.indexOf(c)) % toutes === 0) return false;
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  return !(c.combat.attack_id || c.combat.charge_active || c.combat.stun_ticks || c.dash_active || c.combat.jump_tick != null
    || c.ai_mind?.opponent_id || state.press_team?.target_id === c.id || c.purchase_hold || c.campaign_debate_id || c.crisis_meeting_id || c.ai_objective?.purpose === 'RECOVER'
    || state.tick - (c.combat.last_hit?.tick ?? -Infinity) < 2 * hz
    || nearestEnemy(state, c, aiSettings(state, config).detection_range));
}

/**
 * Évite les volte-face frénétiques : juste après un demi-tour, l’IA attend un instant avant de repartir
 * dans l’autre sens (elle reste sur place). Esquive, attaque, saut ou ruée gardent leur réactivité.
 */
function steadyTurns(state, config, candidate, result) {
  const move = result.find(r => r.type === 'Move');
  if (!move || move.axis !== -candidate.facing || result.some(r => ['Attack', 'Dash', 'Jump'].includes(r.type))) return result;
  const pause = Math.ceil(0.6 * config.balance.simulation_architecture.fixed_tick_hz);
  if (state.tick - (candidate.turn_tick ?? -pause) < pause) move.axis = 0;
  return result;
}

/**
 * `prepared` : décisions de l'ordinateur déjà calculées sur ce même état (prepareAICommands), sinon calculées ici.
 * Les décisions ne dépendent que de l'état : préparées à l'avance, elles sont identiques.
 */
export function collectCommands(state, human, ai, prepared = null) {
  if ([GamePhase.FIRST_ROUND_RESULTS, GamePhase.RESULTS].includes(state.phase)) return [];
  return withAIObservation(state, () => {
    const commands = [];
    for (const candidate of state.candidates) if (!candidate.eliminated)
      commands.push(...(candidate.id === state.local_candidate_id ? human.commands(state, candidate.id)
        : prepared?.get(candidate.id) ?? ai.commands(state, candidate.id)));
    return commands;
  });
}

/**
 * Décisions de l'ordinateur pour le prochain pas, calculées pendant une image sans pas de simulation :
 * l'image qui joue le pas n'a plus à les faire (moins d'à-coups). L'état ne doit pas changer entre les deux.
 */
export function prepareAICommands(state, ai) {
  const prepared = new Map();
  if ([GamePhase.FIRST_ROUND_RESULTS, GamePhase.RESULTS].includes(state.phase)) return prepared;
  withAIObservation(state, () => {
    for (const candidate of state.candidates) if (!candidate.eliminated && candidate.id !== state.local_candidate_id)
      prepared.set(candidate.id, ai.commands(state, candidate.id));
  });
  return prepared;
}

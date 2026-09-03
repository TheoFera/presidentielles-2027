/** Shared protocol values. No scene, DOM or input-device dependency. */
export const GamePhase = Object.freeze({ CAMPAIGN: 'CAMPAIGN', FIRST_ROUND_ARENA: 'FIRST_ROUND_ARENA', SECOND_ROUND_SPRINT: 'SECOND_ROUND_SPRINT', RESULTS: 'RESULTS' });
export const isWorldPhase = state => [GamePhase.CAMPAIGN, GamePhase.SECOND_ROUND_SPRINT].includes(state.phase);
export const influenceMultiplier = (state, config) => state.phase === GamePhase.SECOND_ROUND_SPRINT ? config.balance.time.second_round_influence_multiplier : 1;

export function commandAllowed(state, command, debugEnabled) {
  if (!command || typeof command.type !== 'string' || state.phase === GamePhase.RESULTS) return false;
  const debug = command.type.startsWith('Debug');
  if (debug && !debugEnabled) return false;
  if (['DebugForceJ0', 'DebugStartArena'].includes(command.type)) return state.phase === GamePhase.CAMPAIGN;
  if (command.type === 'DebugFinishArena') return state.phase === GamePhase.FIRST_ROUND_ARENA;
  if (command.type === 'DebugStartSprint') return [GamePhase.CAMPAIGN, GamePhase.FIRST_ROUND_ARENA].includes(state.phase);
  if (['DebugSprint10', 'DebugForceTie'].includes(command.type)) return state.phase === GamePhase.SECOND_ROUND_SPRINT;
  if (state.phase === GamePhase.FIRST_ROUND_ARENA) return ['Move', 'Attack', 'SetCampaignActive', 'DebugFillSpecial', 'DebugSetAIEnabled', 'DebugSelectCandidate'].includes(command.type);
  return isWorldPhase(state);
}

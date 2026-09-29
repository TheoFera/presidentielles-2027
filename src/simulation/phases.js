/** Shared protocol values. No scene, DOM or input-device dependency. */
export const GamePhase = Object.freeze({ CAMPAIGN: 'CAMPAIGN', FIRST_ROUND_RESULTS: 'FIRST_ROUND_RESULTS', FIRST_ROUND_DEBATE: 'FIRST_ROUND_DEBATE', SECOND_ROUND_SPRINT: 'SECOND_ROUND_SPRINT', RESULTS: 'RESULTS' });
export const isWorldPhase = state => [GamePhase.CAMPAIGN, GamePhase.SECOND_ROUND_SPRINT].includes(state.phase);

export function commandAllowed(state, command, debugEnabled) {
  if (!command || typeof command.type !== 'string' || state.phase === GamePhase.RESULTS) return false;
  if (state.phase === GamePhase.FIRST_ROUND_RESULTS) return ['ContinueToSecondRound', 'DebugFinishDebate', 'DebugStartSprint'].includes(command.type) && (!command.type.startsWith('Debug') || debugEnabled);
  if (command.type === 'ContinueToSecondRound') return false;
  const debug = command.type.startsWith('Debug');
  if (debug && !debugEnabled) return false;
  if (['DebugForceJ0', 'DebugStartDebate'].includes(command.type)) return state.phase === GamePhase.CAMPAIGN;
  if (command.type === 'DebugFinishDebate') return state.phase === GamePhase.FIRST_ROUND_DEBATE;
  if (command.type === 'DebugStartSprint') return [GamePhase.CAMPAIGN, GamePhase.FIRST_ROUND_DEBATE].includes(state.phase);
  if (['DebugSprint10', 'DebugForceTie'].includes(command.type)) return state.phase === GamePhase.SECOND_ROUND_SPRINT;
  if (state.phase === GamePhase.FIRST_ROUND_DEBATE) return ['PressAttack', 'ReleaseAttack', 'CancelAttack', 'Jump', 'Dash', 'ActivateUltimate', 'DebugSetDashCharges', 'DebugRefillDashCharges', 'DebugDisableDashRecharge', 'DebugSetUltimateCharge', 'DebugEmptyUltimateCharge', 'DebugForceUltimateDecay', 'DebugArmBardella', 'DebugDisarmBardella', 'Move', 'Attack', 'SetCampaignActive', 'DebugFillSpecial', 'DebugSetAIEnabled', 'DebugSelectCandidate'].includes(command.type);
  return isWorldPhase(state);
}

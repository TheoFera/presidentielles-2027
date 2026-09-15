export function isHumanCandidate(state, candidateId) {
  return state.human_candidate_ids ? state.human_candidate_ids.includes(candidateId) : candidateId === state.local_candidate_id;
}

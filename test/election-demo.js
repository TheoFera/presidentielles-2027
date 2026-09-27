// Données fictives pour les tests et les captures de développement : jamais chargées par le jeu.
const FACTIONS = ['melenchon', 'le_pen', 'philippe'];
export const DEMO_SCENARIOS = ['qualification', 'elimination', 'victoire', 'defaite'];

export function demoElectionState(local = 'melenchon', scenario = 'qualification') {
  const others = FACTIONS.filter(f => f !== local);
  const ranking = scenario === 'elimination' ? [...others, local]
    : scenario === 'defaite' ? [others[0], local, others[1]] : [local, ...others];
  const first_round_result = { ranking, tie_break: false,
    scores: { neutral: 12, pending: 0, ...Object.fromEntries(ranking.map((f, i) => [f, [39, 31, 18][i]])) } };
  const base = { local_candidate_id: `candidate:${local}`, first_round_result };
  if (['qualification', 'elimination'].includes(scenario)) return { ...base, phase: 'FIRST_ROUND_RESULTS', result: null, eliminated_faction: null };
  const [winner, second, eliminated] = ranking;
  return { ...base, phase: 'RESULTS', eliminated_faction: eliminated,
    result: { winner, second, tie_break: false, scores: { neutral: 12, pending: 0, [winner]: 50.688, [second]: 37.312, [eliminated]: 0 } } };
}

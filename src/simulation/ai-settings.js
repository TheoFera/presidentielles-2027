/**
 * La difficulté change les décisions, jamais les dégâts, les revenus ou les prix.
 * reaction_seconds : temps d’observation face à un rival ; review_seconds : fréquence de réévaluation ;
 * hesitation : probabilité de marquer une pause de réflexion ; courage : goût du combat ;
 * adaptive_scale / mercy_scale : force de l’adaptation au niveau des humains.
 */
export const AI_DIFFICULTIES = Object.freeze({
  facile: Object.freeze({ label: 'Facile', opening_seconds: 65, commitment_seconds: 25, enemy_priority: 16,
    detection_range: 5, attack_interval_seconds: 0.72, attack_chance: 0.8, retreat_ratio: 0.16, retreat_chance: 0.22, dash: false, event_reaction_multiplier: 1.8, event_interest: 0.6,
    reaction_seconds: 1.1, review_seconds: 2.4, hesitation: 0.45, courage: -0.05, reconsider_seconds: 12, adaptive_scale: 0.6, mercy_scale: 1 }),
  normal: Object.freeze({ label: 'Normal', opening_seconds: 35, commitment_seconds: 40, enemy_priority: 36,
    detection_range: 8, attack_interval_seconds: 0.28, attack_chance: 0.92, retreat_ratio: 0.2, retreat_chance: 0.18, dash: true, event_reaction_multiplier: 1, event_interest: 0.85,
    reaction_seconds: 0.7, review_seconds: 1.8, hesitation: 0.3, courage: 0, reconsider_seconds: 9, adaptive_scale: 0.85, mercy_scale: 0.8 }),
  difficile: Object.freeze({ label: 'Difficile', opening_seconds: 22, commitment_seconds: 55, enemy_priority: 44,
    detection_range: 12, attack_interval_seconds: 0.14, attack_chance: 0.96, retreat_ratio: 0.24, retreat_chance: 0.12, dash: true, event_reaction_multiplier: 0.5, event_interest: 1,
    reaction_seconds: 0.4, review_seconds: 1.2, hesitation: 0.18, courage: 0.04, reconsider_seconds: 7, adaptive_scale: 1, mercy_scale: 0.5 }),
});

export const validAIDifficulty = value => Object.hasOwn(AI_DIFFICULTIES, value);
export function aiSettings(state, config) {
  return AI_DIFFICULTIES[state.ai_difficulty ?? config.balance.ai?.difficulty ?? 'normal'] ?? AI_DIFFICULTIES.normal;
}

/** Variation pure : consulter l’IA ne consomme pas la RNG de la simulation. */
export function aiNoise(seed, key) {
  let n = seed >>> 0;
  for (const character of key) n = Math.imul(n ^ character.charCodeAt(0), 16777619) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 2246822507) >>> 0;
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}

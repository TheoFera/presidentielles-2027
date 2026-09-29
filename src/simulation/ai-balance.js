import { aggregateNational } from './electoral-state.js';
import { isHumanCandidate } from './human-candidates.js';
import { aiSettings } from './ai-settings.js';

/** Valeurs par défaut si le fichier d’équilibrage ne précise pas la section. */
const DEFAULTS = Object.freeze({
  enabled: true, dominance_gap: 14, mercy_gap: 12, mercy_threshold: 0.3,
  territory_weight: 30, building_weight: 1.5, money_weight: 0.05,
  max_persuasion_speed_bonus: 0.25, max_persuasion_slowdown: 0.15,
  focus_zone_bonus: 18, spared_zone_penalty: 24, money_risk_reference_k: 20,
});
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const adaptationSettings = config => ({ ...DEFAULTS, ...config.balance.ai_adaptation });

/**
 * Rapport de force entre les trois camps : opinion nationale, territoire tenu,
 * bâtiments actifs et un peu d’argent. Lecture pure, sans aléa.
 */
export function powerBalance(state, config) {
  const s = adaptationSettings(config);
  const national = aggregateNational(state.electorate);
  const zones = state.electorate.length || 1;
  const strength = {};
  const alive = state.candidates.filter(c => !c.eliminated && !c.minor);
  for (const c of alive) {
    const f = c.faction_id;
    const territory = state.electorate.filter(e => e.controller === f).length / zones;
    const sites = state.buildings.filter(b => b.owner_id === f && b.state === 'ACTIVE').length;
    strength[f] = national[f] + territory * s.territory_weight + sites * s.building_weight + Math.min(100, Math.max(0, c.money)) * s.money_weight;
  }
  const ranking = alive.map(c => c.faction_id).sort((a, b) => strength[b] - strength[a] || a.localeCompare(b));
  return { strength, ranking, leader: ranking[0] };
}

/**
 * Comment une IA se positionne dans la partie à trois :
 * - boost > 0 : le meilleur humain devance cette IA, elle joue plus vite et plus juste ;
 * - boost < 0 : cette IA devance nettement les humains, elle relâche la pression ;
 * - focus : le camp à contenir (le plus fort, hors soi) ;
 * - spared : les humains trop faibles que l’IA laisse respirer.
 * Fonctionne pareil en solo et en multijoueur (plusieurs humains possibles).
 */
export function aiAdaptation(state, config, c) {
  const s = adaptationSettings(config), level = aiSettings(state, config);
  const { strength, ranking } = powerBalance(state, config);
  const alive = state.candidates.filter(o => !o.eliminated && !o.minor);
  const humans = alive.filter(o => isHumanCandidate(state, o.id));
  const bots = alive.filter(o => !isHumanCandidate(state, o.id));
  let boost = 0;
  if (s.enabled && humans.length && bots.length && state.ai_enabled !== false && !isHumanCandidate(state, c.id)) {
    // Comparaison propre à chaque IA : la plus distancée par un humain dominant accélère le plus,
    // la plus en avance sur un humain distancé lève le plus le pied.
    const best = Math.max(...humans.map(h => strength[h.faction_id]));
    const gap = best - (strength[c.faction_id] ?? 0);
    boost = gap >= 0 ? clamp(gap / s.dominance_gap, 0, 1) * (level.adaptive_scale ?? 1)
      : -clamp(-gap / s.mercy_gap, 0, 1) * (level.mercy_scale ?? 1);
  }
  const top = strength[ranking[0]] ?? 0;
  // Épargner un humain distancé : les IA s’affrontent alors entre elles.
  const spared = new Set(boost <= -s.mercy_threshold ? humans
    .filter(h => h.faction_id !== c.faction_id && top - strength[h.faction_id] >= s.mercy_gap * 0.5)
    .map(h => h.faction_id) : []);
  const focus = ranking.find(f => f !== c.faction_id && !spared.has(f)) ?? null;
  return { boost, focus, spared, strength, ranking, leader: ranking[0] ?? null };
}

/** +1 pour le camp à contenir, -1 pour un camp épargné, 0 sinon. */
export function factionPressure(adaptation, faction) {
  if (!faction) return 0;
  return faction === adaptation.focus ? 1 : adaptation.spared.has(faction) ? -1 : 0;
}

/**
 * Seul avantage « physique » de l’adaptation : une IA qui court après un humain dominant
 * convainc un peu plus vite ; elle ralentit légèrement quand elle le laisse revenir.
 */
export function aiPersuasionMultiplier(state, config, actor) {
  if (actor?.role !== 'CANDIDAT' || actor.minor || isHumanCandidate(state, actor.id) || !state.electorate) return 1;
  const s = adaptationSettings(config);
  if (!s.enabled) return 1;
  const { boost } = aiAdaptation(state, config, actor);
  return boost >= 0 ? 1 / (1 + s.max_persuasion_speed_bonus * boost) : 1 + s.max_persuasion_slowdown * -boost;
}

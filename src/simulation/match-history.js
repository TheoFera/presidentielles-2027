import { FACTIONS } from './world.js';
import { GamePhase } from './phases.js';

/* Historique de la partie pour le bilan final : environ 80 relevés sur toute la campagne, quelle que soit
   sa durée, puis un toutes les 3 secondes pendant le sprint. Chaque relevé garde, pour chaque camp, son score
   national réel (% de l'électorat) et son nombre d'électeurs. Déterministe : il ne dépend que de la simulation. */
const CAMPAIGN_SAMPLES = 80;
const SPRINT_SAMPLE_SECONDS = 3;

export function recordMatchHistory(sim, force = false) {
  const s = sim.state;
  if (!Array.isArray(s.match_history)) s.match_history = [];
  const sprint = s.phase === GamePhase.SECOND_ROUND_SPRINT || s.phase === GamePhase.RESULTS;
  const time = sim.config.balance.time;
  const every = sim.secondsToTicks(sprint ? SPRINT_SAMPLE_SECONDS : time.starting_days_before_first_round * time.real_seconds_per_game_day / CAMPAIGN_SAMPLES);
  const last = s.match_history.at(-1);
  // Le début du sprint est toujours relevé : le camp éliminé y perd ses électeurs.
  if (last && (last.tick === s.tick || !force && last.sprint === sprint && s.tick - last.tick < every)) return;
  const { national_support: support = {}, national_counts: counts = {} } = s.actualGameState || {};
  s.match_history.push({
    tick: s.tick, sprint, days_remaining: s.days_remaining,
    support: Object.fromEntries(FACTIONS.map(f => [f, Math.round((support[f] || 0) * 10) / 10])),
    voters: Object.fromEntries(FACTIONS.map(f => [f, counts[f] || 0])),
  });
}

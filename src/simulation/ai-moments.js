import { ringDelta } from './world.js';
import { aiNoise } from './ai-settings.js';

/**
 * « Moments » de la campagne pour l’IA : chaque activité a une courbe de probabilité
 * selon l’avancement (0 = J-365, 1 = premier tour). Ce n’est pas une séquence figée :
 * pour chaque activité, chaque IA tire en début de partie un seuil personnel ; elle s’y met
 * quand la courbe dépasse ce seuil. Deux IA (ou deux parties) ne changent donc pas de rythme
 * au même instant, et les moments se chevauchent. Une décision prise ne clignote pas
 * (une épargne commencée n’est pas abandonnée). Tirage pur (aiNoise) : sauvegardes et multijoueur identiques.
 */
const DEFAULTS = Object.freeze({
  curves: {},
  militants: { first_goal: [1, 2], first_reserve: 1, group_goal: 6, group_reserve: 2 },
  vehicles: { spread_units: 96, ride_min_distance_units: 48, garage_detour_units: 8 },
});

export const momentSettings = config => ({ ...DEFAULTS, ...config.balance.ai_moments });

/** Probabilité d’une activité à cet avancement : interpolation linéaire entre les points [avancement, probabilité]. */
export function momentChance(state, config, key) {
  const points = momentSettings(config).curves[key];
  if (!points?.length) return 1;
  const p = Math.max(0, Math.min(1, state.campaign_progress_01 ?? 0));
  if (p <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i], [x0, y0] = points[i - 1];
    if (p <= x1) return y0 + (y1 - y0) * (p - x0) / Math.max(1e-9, x1 - x0);
  }
  return points.at(-1)[1];
}

/** L’IA est-elle, à cet instant de la partie, dans ce moment ? */
export function momentActive(state, config, c, key) {
  return aiNoise(state.seed, `${c.id}:moment:${key}`) < momentChance(state, config, key);
}

/**
 * Militants voulus par quartier et sympathisants gardés pour les dons.
 * Au début : 1 ou 2, jamais 3, pour qu’ils restent défendre et convaincre autour de la permanence
 * (un groupe de 3 part en expédition). Puis des vagues qui forment des groupes. À la toute fin,
 * l’argent ne sert plus : tous les sympathisants deviennent militants.
 */
export function militantPlan(state, config, c) {
  const s = momentSettings(config).militants;
  if (momentActive(state, config, c, 'mobilisation_generale')) return { goal: Infinity, reserve: 0, final: true };
  if (momentActive(state, config, c, 'groupes')) return { goal: s.group_goal, reserve: s.group_reserve, final: false };
  const [low, high] = s.first_goal;
  const goal = aiNoise(state.seed, `${c.id}:first-militants`) < 0.5 ? low : high;
  return { goal, reserve: s.first_reserve, final: false };
}

/** Étendue de ses sympathisants sur la carte circulaire : le plus petit arc qui les contient tous. */
export function supporterSpread(state, c) {
  const length = state.world.length;
  const xs = state.npcs.filter(n => n.faction_id === c.faction_id && ['SYMPATHISANT', 'MILITANT'].includes(n.role))
    .map(n => ((n.x % length) + length) % length).sort((a, b) => a - b);
  if (xs.length < 2) return 0;
  let largestGap = xs[0] + length - xs.at(-1);
  for (let i = 1; i < xs.length; i++) largestGap = Math.max(largestGap, xs[i] - xs[i - 1]);
  return length - largestGap;
}

/** Garage à soi, tout proche, qui vaut le détour avant un long trajet vers x. */
export function rideGarage(state, config, c, x) {
  const s = momentSettings(config).vehicles, length = state.world.length;
  if (c.vehicle || Math.abs(ringDelta(c.x, x, length)) < s.ride_min_distance_units) return null;
  return state.buildings.filter(b => ['garage_velo', 'garage_scooter'].includes(b.type) && b.state === 'ACTIVE' && b.owner_id === c.faction_id
    && Math.abs(ringDelta(c.x, b.x, length)) <= s.garage_detour_units)
    .sort((a, b) => Math.abs(ringDelta(c.x, a.x, length)) - Math.abs(ringDelta(c.x, b.x, length)) || a.id.localeCompare(b.id))[0] ?? null;
}

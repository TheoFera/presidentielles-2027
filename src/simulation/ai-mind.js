import { zoneAt } from './world.js';
import { aiNoise, aiSettings } from './ai-settings.js';
import { canBeHit } from './combat-state.js';
import { combatDelta } from './combat-geometry.js';
import { adaptationSettings, factionPressure } from './ai-balance.js';
import { aiAttackRange } from './ai-combat.js';
import { isHumanCandidate } from './human-candidates.js';

/**
 * « Réflexion » d’une IA face à un rival :
 * OBSERVE : jauge l’adversaire à distance, hésite ;
 * FIGHT : engage ; AVOID : poursuit sa route sans s’approcher ;
 * FLEE : s’éloigne pour protéger sa résistance et son argent ;
 * THINK : courte pause après un changement de plan.
 * L’état est stocké dans la simulation (ai_mind) : sauvegardes et multijoueur restent identiques.
 */
export const MIND_STANCES = Object.freeze(['OBSERVE', 'FIGHT', 'AVOID', 'FLEE', 'THINK']);

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const ticks = (config, seconds) => Math.max(1, Math.ceil(seconds * config.balance.simulation_architecture.fixed_tick_hz));
const gap = (state, a, b) => Math.abs(combatDelta(state, a, b));

export function validMind(state, mind) {
  return !!mind && MIND_STANCES.includes(mind.stance) && mind.since_tick <= state.tick;
}

/** Candidat adverse le plus proche, visible et attaquable. */
export function visibleRival(state, c, range) {
  return state.candidates.filter(o => o !== c && o.faction_id !== c.faction_id && canBeHit(o) && gap(state, c.x, o.x) <= range)
    .sort((a, b) => gap(state, c.x, a.x) - gap(state, c.x, b.x) || a.id.localeCompare(b.id))[0] ?? null;
}

/** Le rival s’éloigne-t-il de nous ? */
export const runningAway = (state, c, rival) => rival.axis !== 0 && rival.axis === Math.sign(combatDelta(state, c.x, rival.x));
/** Le rival vient-il vers nous ? */
export const approaching = (state, c, rival) => rival.axis !== 0 && rival.axis === Math.sign(combatDelta(state, rival.x, c.x));

/**
 * Estimation d’un duel : chances de victoire, argent en jeu, intérêt politique.
 * fight > 0 pousse au combat, fight < 0 à l’évitement.
 */
export function assessDuel(state, config, c, rival, adaptation) {
  const b = config.balance.candidate_combat, s = adaptationSettings(config), level = aiSettings(state, config);
  const ready = x => x.special_charge >= config.balance.special_charge.required_points && !x.ultimate_effect;
  let win = 0.5 + (c.resistance - rival.resistance) / b.resistance_max * 0.55;
  if (ready(c)) win += 0.1;
  if (ready(rival)) win -= 0.1;
  if (c.ultimate_effect) win += 0.08;
  if (rival.ultimate_effect) win -= 0.1;
  if (rival.combat.stun_ticks > 0) win += 0.05;
  // Les militants et le service d’ordre présents autour pèsent sur l’issue.
  const guards = [...state.npcs, ...(state.temporary_units || [])]
    .filter(n => canBeHit(n) && ['MILITANT', 'SERVICE_D_ORDRE'].includes(n.role) && gap(state, c.x, n.x) <= 6);
  win += clamp((guards.filter(n => n.faction_id === c.faction_id).length
    - guards.filter(n => n.faction_id === rival.faction_id).length) * 0.04, -0.15, 0.15);
  const record = state.electorate?.find(e => e.subzone_id === zoneAt(state.world, c.x).id);
  if (record?.controller === c.faction_id) win += 0.04;
  else if (record?.controller === rival.faction_id) win -= 0.04;
  win = clamp(win, 0.05, 0.95);
  // Un K.-O. fait tomber une part de l’argent transporté : plus on porte, plus on est prudent.
  const drop = b.ko_money_drop_ratio, reference = s.money_risk_reference_k;
  const risk = clamp(c.money * drop / reference, 0, 1), loot = clamp(rival.money * drop / reference, 0, 1);
  const pressure = factionPressure(adaptation, rival.faction_id);
  let fight = win - 0.5 + (level.courage ?? 0) + (aiNoise(state.seed, `${c.id}:temperament`) - 0.5) * 0.16
    + loot * 0.25 * win - risk * 0.4 * (1 - win)
    + (pressure > 0 ? 0.04 : pressure < 0 ? -0.3 : 0)
    + (isHumanCandidate(state, rival.id) ? adaptation.boost * 0.08 : 0);
  if (c.VULNERABLE_SCANDAL) fight -= 0.3;
  if (rival.VULNERABLE_SCANDAL) fight += 0.22;
  // Défendre un bâtiment attaqué vaut plus qu’un duel au hasard.
  if (state.buildings.some(site => site.owner_id === c.faction_id && site.state === 'ACTIVE' && gap(state, site.x, rival.x) <= 4)) fight += 0.1;
  return { win, risk, loot, fight };
}

/**
 * Met à jour la réflexion face au rival. Premier contact : observation.
 * Ensuite, réévaluation régulière (ou immédiate si l’IA est frappée) :
 * l’IA peut changer d’avis, s’enfuir puis revenir, ou céder au combat quand on la bloque.
 */
export function reflectOnRival(state, config, c, rival, adaptation) {
  const level = aiSettings(state, config);
  const previous = validMind(state, c.ai_mind) && c.ai_mind.opponent_id === rival.id ? c.ai_mind : null;
  const d = gap(state, c.x, rival.x), range = aiAttackRange(config, c);
  const hit = !!previous && c.hits_received > previous.hits;
  const strikeRange = d <= range + 0.3;
  const reviewTicks = ticks(config, level.review_seconds * (1 - 0.35 * Math.max(0, adaptation.boost)));
  const passive = previous && ['OBSERVE', 'AVOID', 'THINK'].includes(previous.stance);
  if (previous && state.tick < previous.review_tick && !hit && !(passive && strikeRange)) return previous;
  if (!previous) {
    // Réflexe : si l’échange est déjà lancé, pas le temps d’observer.
    const engaged = hit || strikeRange && (rival.combat.attack_id || rival.combat.charge_active)
      || c.combat.target_id === rival.id && state.tick - (c.combat.last_hit?.tick ?? -Infinity) <= ticks(config, 2);
    if (!engaged) {
      const pause = level.reaction_seconds * (0.6 + 0.8 * aiNoise(state.seed, `${c.id}:gaze:${rival.id}:${Math.floor(state.tick / reviewTicks)}`))
        * (1 - 0.4 * Math.max(0, adaptation.boost)) * (1 + 0.6 * Math.max(0, -adaptation.boost));
      return { stance: 'OBSERVE', opponent_id: rival.id, since_tick: state.tick, review_tick: state.tick + ticks(config, pause), hits: c.hits_received };
    }
  }
  const duel = assessDuel(state, config, c, rival, adaptation);
  const stance0 = previous?.stance ?? 'OBSERVE';
  // Doute stable sur une fenêtre de réévaluation : l’avis peut basculer d’une fenêtre à l’autre.
  // fear : le rival est-il vraiment dangereux ? score : envie d’en découdre maintenant.
  const fear = duel.fight + (aiNoise(state.seed, `${c.id}:doubt:${rival.id}:${Math.floor(state.tick / reviewTicks)}`) - 0.5) * 0.16;
  let score = fear;
  if (stance0 === 'FIGHT') score += 0.05;
  if (stance0 === 'FLEE') score -= 0.03;
  if (hit && stance0 !== 'FLEE') score += 0.05;
  // Un échange qu’on vient de lancer se termine : on ne lâche pas un rival qu’on vient de toucher.
  if (c.combat.target_id === rival.id && state.tick - (c.combat.last_hit?.tick ?? -Infinity) <= ticks(config, 2)) score += 0.1;
  // Acculé : fuir ne sert plus à rien si le rival colle, ou s’il nous talonne depuis longtemps.
  const fleeing = stance0 === 'FLEE' ? state.tick - previous.since_tick : 0;
  if (stance0 === 'FLEE' && approaching(state, c, rival) && (strikeRange || fleeing > ticks(config, 5))) score += 0.25;
  // Chasse stérile : un rival qui file depuis plusieurs secondes sans être touché, on le laisse.
  const lastStrike = c.combat.last_hit?.source_id === c.id ? c.combat.last_hit.tick : -Infinity;
  if (stance0 === 'FIGHT' && runningAway(state, c, rival) && state.tick - previous.since_tick > ticks(config, 3)
    && state.tick - lastStrike > ticks(config, 3)) score -= 0.45;
  // Bloqué depuis longtemps par un rival qui ne bouge pas : il faut bien passer.
  const stuck = previous && ['AVOID', 'OBSERVE'].includes(stance0) && d <= range + 3 ? (state.tick - previous.since_tick) / reviewTicks : 0;
  score += Math.min(0.2, stuck * 0.05);
  // Ne pas courir après un rival qui s’en va, sauf proie de valeur.
  if (runningAway(state, c, rival) && d > range + 1 && !rival.VULNERABLE_SCANDAL && duel.loot < 0.75) score -= 0.1;
  const long = previous && stance0 === 'OBSERVE' && state.tick - previous.since_tick >= reviewTicks * 2;
  let stance = score > 0.08 ? 'FIGHT'
    : score < -0.12 ? (fear < -0.12 && (d <= 3.5 || approaching(state, c, rival)) ? 'FLEE' : 'AVOID')
      : long ? (score >= -0.03 ? 'FIGHT' : 'AVOID') : 'OBSERVE';
  // À portée de coups, rester planté n’est pas une option.
  if (strikeRange && ['OBSERVE', 'AVOID'].includes(stance)) stance = fear < -0.12 && score < -0.05 ? 'FLEE' : 'FIGHT';
  const jitter = 0.7 + 0.6 * aiNoise(state.seed, `${c.id}:review:${state.tick}`);
  return { stance, opponent_id: rival.id, since_tick: stance === stance0 && previous ? previous.since_tick : state.tick,
    review_tick: state.tick + Math.max(1, Math.round(reviewTicks * jitter)), hits: c.hits_received };
}

/**
 * Décidée à se battre, l’IA ne quitte pas pour autant son travail : elle frappe un rival au contact
 * ou qui vient à elle, et ne se déplace pour lui que s’il vaut le détour (scandale, argent à ramasser, menace sur un bâtiment) : attaquer le camp
 * dominant, c’est surtout lui reprendre du terrain.
 */
export function worthChasing(state, config, c, rival, adaptation) {
  const d = gap(state, c.x, rival.x), range = aiAttackRange(config, c);
  if (d <= range + 1) return true;
  const prey = () => !!rival.VULNERABLE_SCANDAL || assessDuel(state, config, c, rival, adaptation).loot >= 0.75
    || state.buildings.some(site => site.owner_id === c.faction_id && site.state === 'ACTIVE' && gap(state, site.x, rival.x) <= 4);
  // Un rival qui détale n’est poursuivi que s’il en vaut la peine ; un rival qui vient à nous est accueilli.
  if (runningAway(state, c, rival)) return prey();
  return approaching(state, c, rival) && d <= range + 3 || prey();
}

/** Observer : garder ses distances, faire quelques pas, se tourner vers le rival. */
export function observeAxis(state, config, c, rival) {
  const d = combatDelta(state, c.x, rival.x), toward = Math.sign(d) || c.facing, distance = Math.abs(d);
  const keep = aiAttackRange(config, c) + 1.6;
  const roll = aiNoise(state.seed, `${c.id}:sway:${Math.floor(state.tick / ticks(config, 0.35))}`);
  if (distance < keep) return -toward;
  if (distance > keep + 2.5) return roll < 0.5 ? toward : 0;
  const axis = roll < 0.2 ? toward : roll < 0.36 ? -toward : 0;
  return axis === 0 && c.facing !== toward ? toward : axis;
}

/** Pause de réflexion après un nouveau plan : probabilité selon la difficulté et l’adaptation. */
export function thinkingPause(state, config, c, adaptation) {
  const level = aiSettings(state, config);
  const chance = (level.hesitation ?? 0) * (1 - 0.6 * Math.max(0, adaptation.boost)) * (1 + 0.8 * Math.max(0, -adaptation.boost));
  if (aiNoise(state.seed, `${c.id}:think:${state.tick}`) >= chance) return null;
  const seconds = (level.reaction_seconds ?? 0.7) * (0.6 + 0.8 * aiNoise(state.seed, `${c.id}:think-length:${state.tick}`));
  return { stance: 'THINK', opponent_id: null, since_tick: state.tick, review_tick: state.tick + ticks(config, seconds), hits: c.hits_received };
}

import { activeCampaignStyle } from './campaign-styles.js';
import { airborne, diving } from './combat-actions.js';
import { aiSettings, aiNoise } from './ai-settings.js';
import { combatDelta } from './combat-geometry.js';

/** Lecture du combat, dosée selon la difficulté : l’IA n’exploite jamais tout. */
const READING = {
  Facile: { combo: 0.25, punish: 0.1, dive: 0.3, avoid: 0.1 },
  Normal: { combo: 0.6, punish: 0.35, dive: 0.5, avoid: 0.3 },
  Difficile: { combo: 0.85, punish: 0.6, dive: 0.7, avoid: 0.5 },
};

export function aiAttackRange(config,c) {
  const range=c.ultimate_effect?.kind==='SCARF'?config.balance.specials.scarf.range:config.balance.candidate_combat.light_range;
  return range+config.balance.candidate_combat.target_radius*0.5;
}

/**
 * Combat commun à la campagne, au sprint et aux arènes.
 * tempo > 1 : frappe plus souvent (humain dominant) ; tempo < 1 : retenue (humain épargné).
 */
export function aiCombatCommands(state, config, c, target, tempo = 1) {
  const settings = aiSettings(state, config), d = combatDelta(state, c.x, target.x);
  const direction = Math.sign(d) || c.facing;
  const range = c.ultimate_effect?.kind === 'SCARF' ? config.balance.specials.scarf.range : config.balance.candidate_combat.light_range;
  // Viser à l’intérieur de la portée réelle, avec une marge pour ne pas frapper au pixel près.
  const close = Math.abs(d) <= aiAttackRange(config,c);
  const result = [{ type: 'SetCampaignActive', candidateId: c.id, active: true },
    { type: 'InteractionPresence', candidateId: c.id, active: false },
    { type: 'Move', candidateId: c.id, axis: close ? 0 : direction }];
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  const reading = READING[settings.label] ?? READING.Normal;
  const chance = (key, value) => aiNoise(state.seed, `${c.id}:${key}`) < value;
  // Adversaire au sol ou en train de se relever : intouchable, on attend à bonne distance.
  if (target.role === 'CANDIDAT' && state.tick < (target.combat.invulnerable_until_tick ?? -1)) {
    result[2].axis = Math.abs(d) < range + 0.4 ? -direction : Math.abs(d) > range + 1.2 ? direction : 0;
    return result;
  }
  // Plongeon adverse qui arrive : parfois, on recule pour le laisser tomber dans le vide.
  if (diving(target) && Math.sign(-d) === target.facing && Math.abs(d) < 2.5 && !airborne(c)
    && chance(`avoid:${target.id}:${target.combat.dive_tick}`, reading.avoid)) { result[2].axis = -direction; return result; }
  // Coup léger qui a touché : enchaîner le combo (l’appui est gardé en mémoire).
  const own = state.attacks.find(a => a.id === c.combat.attack_id);
  if (own?.kind === 'CANDIDATE' && own.step < 3 && own.hit_ids.length && chance(`combo:${own.id}`, reading.combo)) {
    result.push({ type: 'Attack', candidateId: c.id, direction }); return result;
  }
  // En l’air au-dessus d’un adversaire proche : coup plongeant.
  if (airborne(c) && !diving(c) && !c.combat.attack_id && Math.abs(d) <= 2.2 && (target.combat.height || 0) <= (c.combat.height || 0)) {
    result[2].axis = direction;
    if (chance(`dive:${c.combat.jump_tick}`, reading.dive)) result.push({ type: 'Attack', candidateId: c.id, direction });
    return result;
  }
  if (c.combat.press_tick != null) {
    if (state.tick - c.combat.press_tick >= Math.ceil(config.balance.candidate_combat.charge_ready_seconds * hz)) result.push({ type: 'ReleaseAttack', candidateId: c.id });
    return result;
  }
  if (c.is_ko || c.combat.attack_id || c.combat.stun_ticks || c.combat.hitstop_ticks || c.dash_active) return result;
  // Coup raté ou réception de plongeon adverse : punir, parfois.
  const theirs = state.attacks.find(a => a.id === target.combat?.attack_id);
  if (theirs && ['CANDIDATE', 'CHARGED', 'DIVE'].includes(theirs.kind) && !theirs.hit_ids.length && theirs.elapsed_ticks >= theirs.windup_ticks + theirs.active_ticks
    && Math.abs(d) <= range + 0.6 && chance(`punish:${theirs.id}`, reading.punish)) {
    result[2].axis = close ? 0 : direction; result.push({ type: 'Attack', candidateId: c.id, direction }); return result;
  }
  const interval = Math.max(1, Math.ceil(settings.attack_interval_seconds / tempo * config.balance.simulation_architecture.fixed_tick_hz));
  if (state.tick % interval !== 0) return result;
  const kind = activeCampaignStyle(config, c)?.ultimate.kind;
  const ready = kind && c.special_charge >= config.balance.special_charge.required_points && !c.ultimate_effect
    && !c.bardella_guardian_armed && !(kind === 'BARDELLA' && c.bardellisation_used)
    && !c.purchase_hold && Math.abs(c.combat.knockback_velocity) <= 0.02;
  if (ready && (close || Math.abs(d) <= settings.detection_range && ['WAVE', 'HOLOGRAMS', 'SURGE', 'ZEMMOUR', 'BARDELLA', 'FIRE'].includes(kind))) {
    // Une vague ou une invocation doit partir du bon côté, même à l’arrêt.
    if (c.facing !== direction) result[2].axis = direction;
    else result.push({ type: 'ActivateUltimate', candidateId: c.id });
  } else if (close) {
    if (aiNoise(state.seed, `${c.id}:opportunity:${state.tick}`) > settings.attack_chance * Math.min(1, tempo)) return result;
    const roll = aiNoise(state.rng_state, `${c.id}:combat:${state.tick}`);
    const frequency = settings.label === 'Facile' ? 0.015 : settings.label === 'Difficile' ? 0.07 : 0.04;
    if (!airborne(c) && !target.combat.charge_active && c.combat.combo_step === 0 && roll < frequency) result.push({ type: 'PressAttack', candidateId: c.id });
    else {
      if (!airborne(c) && target.combat.attack_id && roll > 1 - frequency) result.push({ type: 'Jump', candidateId: c.id });
      result.push({ type: 'Attack', candidateId: c.id, direction });
    }
  }
  else if (!airborne(c) && settings.dash && c.dash_charges > 1 && Math.abs(d) > config.balance.dash.distance + range
    && Math.abs(c.combat.knockback_velocity) <= 0.02) result.push({ type: 'Dash', candidateId: c.id, direction });
  return result;
}

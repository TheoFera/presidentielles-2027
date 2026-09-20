import { activeCampaignStyle } from './campaign-styles.js';
import { airborne } from './combat-actions.js';
import { aiSettings, aiNoise } from './ai-settings.js';
import { combatDelta } from './combat-geometry.js';

/** Combat commun à la campagne, au sprint et aux arènes. */
export function aiCombatCommands(state, config, c, target) {
  const settings = aiSettings(state, config), d = combatDelta(state, c.x, target.x);
  const direction = Math.sign(d) || c.facing;
  const range = c.ultimate_effect?.kind === 'SCARF' ? config.balance.specials.scarf.range : config.balance.candidate_combat.light_range;
  const close = Math.abs(d) <= range;
  const result = [{ type: 'SetCampaignActive', candidateId: c.id, active: true },
    { type: 'InteractionPresence', candidateId: c.id, active: false },
    { type: 'Move', candidateId: c.id, axis: close ? 0 : direction }];
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  if (c.combat.press_tick != null) {
    if (state.tick - c.combat.press_tick >= Math.ceil(config.balance.candidate_combat.charge_ready_seconds * hz)) result.push({ type: 'ReleaseAttack', candidateId: c.id });
    return result;
  }
  if (c.is_ko || c.combat.attack_id || c.combat.stun_ticks || c.combat.hitstop_ticks || c.dash_active) return result;
  const interval = Math.max(1, Math.ceil(settings.attack_interval_seconds * config.balance.simulation_architecture.fixed_tick_hz));
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

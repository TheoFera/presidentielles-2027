import { interrupted } from './combat-state.js';
import { activeCampaignStyle } from './campaign-styles.js';
import { combatDelta, combatPosition } from './combat-geometry.js';
import { wallBlockedPosition } from './combat.js';

export function initializeMobileCombat(sim, c) {
  Object.assign(c, { dash_charges: sim.config.balance.dash.max_charges, dash_max_charges: sim.config.balance.dash.max_charges,
    dash_recharge_progress: 0, dash_recharge_disabled: false, dash_active: false, dash_direction: 1, dash_until_tick: 0, dash_invulnerable_until_tick: 0,
    special_threshold: sim.config.balance.special_charge.required_points, last_successful_hit_tick: 0, special_decay_started: false,
    special_decay_origin: 0, active_ultimate_id: null, bardella_guardian_armed: false });
}
export function actionAllowed(sim, c) {
  return !!c && !c.eliminated && !c.is_ko && c.campaign_active && !c.campaign_arena_id && !c.crisis_meeting_id
    && !sim.state.campaign_style_selection && !c.style_hold && !c.style_interaction_held && !c.purchase_hold && !c.interaction_locked
    && !interrupted(c) && Math.abs(c.combat.knockback_velocity) <= 0.02;
}
export function requestDash(sim, c, direction) {
  const d = sim.config.balance.dash;
  if (![-1, 1].includes(direction) || !actionAllowed(sim, c) || c.dash_charges <= 0 || sim.state.arena_bounds && !d.allowed_in_arena) return;
  const meeting = sim.state.buildings.find(b => b.id === c.interaction_chain_site_id && b.type === 'meeting' && b.meeting_faction_id === c.faction_id && b.meeting_until_tick > sim.state.tick);
  if (meeting && Math.abs(combatDelta(sim.state, c.x, meeting.x)) <= sim.config.balance.buildings.meeting.interaction_radius) return;
  c.dash_charges--; c.dash_active = true; c.dash_direction = direction; c.facing = direction;
  c.dash_until_tick = sim.state.tick + sim.secondsToTicks(d.duration_seconds);
  c.dash_invulnerable_until_tick = sim.state.tick + sim.secondsToTicks(d.invulnerability_seconds);
  c.combat.buffer_until_tick = -1;
  sim.emit('DashStarted', { candidate_id: c.id, direction });
  sim.emit('DashChargeConsumed', { candidate_id: c.id, charges: c.dash_charges });
}
export function changeCharge(sim, c, value) {
  const before = c.special_charge, threshold = sim.config.balance.special_charge.required_points;
  c.special_charge = Math.max(0, Math.min(threshold, value));
  if (before !== c.special_charge) sim.emit('UltimateChargeChanged', { candidate_id: c.id, charge: c.special_charge });
  if (before < threshold && c.special_charge >= threshold) sim.emit('UltimateReady', { candidate_id: c.id });
  if (before > 0 && c.special_charge === 0) sim.emit('UltimateChargeLost', { candidate_id: c.id });
  if (!c.special_charge) { c.special_decay_started = false; c.special_decay_origin = 0; }
}
export function successfulNormalHit(sim, c, target, attack) {
  const b = sim.config.balance.special_charge;
  // Victims may already be demobilized by hit(); allegiance was validated before damage.
  if (c.is_ko || c.eliminated || !activeCampaignStyle(sim.config, c) || c.bardella_form || c.bardella_guardian_armed
    || target.temporary && !b.enemy_summons_charge) return;
  c.last_successful_hit_tick = sim.state.tick; c.special_decay_started = false;
  changeCharge(sim, c, c.special_charge + (attack.strong ? b.points_per_finisher_hit : attack.step === 2 ? b.points_per_second_hit : b.points_per_light_hit));
  c.special_decay_origin = c.special_charge;
  sim.emit('SuccessfulCombatHit', { candidate_id: c.id, target_id: target.id, combo_step: attack.step });
}
export function updateMobileCombat(sim) {
  const d = sim.config.balance.dash, b = sim.config.balance.special_charge, tick = sim.state.tick;
  for (const c of sim.state.candidates) {
    if (c.dash_active) {
      if (c.is_ko || c.eliminated || c.combat.stun_ticks || tick > c.dash_until_tick) {
        c.dash_active = false; c.dash_invulnerable_until_tick = 0; sim.emit('DashEnded', { candidate_id: c.id });
      } else {
        c.x = wallBlockedPosition(sim, c, combatPosition(sim.state, c.x + c.dash_direction * d.distance / sim.secondsToTicks(d.duration_seconds)));
        c.moving = true;
      }
    }
    if (!c.dash_recharge_disabled && c.dash_charges < c.dash_max_charges && ++c.dash_recharge_progress >= sim.secondsToTicks(d.recharge_seconds)) {
      c.dash_charges++; c.dash_recharge_progress = 0; sim.emit('DashChargeRecovered', { candidate_id: c.id, charges: c.dash_charges });
    }
    if (c.special_charge > 0) {
      const elapsed = tick - c.last_successful_hit_tick - sim.secondsToTicks(b.decay_delay_seconds);
      if (elapsed > 0) {
        if (!c.special_decay_started) { c.special_decay_started = true; c.special_decay_origin = c.special_charge; sim.emit('UltimateDecayStarted', { candidate_id: c.id }); }
        changeCharge(sim, c, c.special_decay_origin * Math.max(0, 1 - elapsed / sim.secondsToTicks(b.decay_duration_seconds)));
      }
    }
    if (c.active_ultimate_id && !c.bardella_guardian_armed && !c.ultimate_effect && !sim.state.powers.some(p => p.owner_id === c.id && p.expires_tick > tick)) c.active_ultimate_id = null;
  }
}
export function mobileCommand(sim, c, command, activate) {
  if (!c) return false;
  if (command.type === 'Dash') { requestDash(sim, c, command.direction); return true; }
  if (command.type === 'ActivateUltimate') { activate(sim, c); return true; }
  if (!sim.config.prototype.debug.commands_enabled) return false;
  switch (command.type) {
    case 'DebugSetDashCharges': if (Number.isInteger(command.value)) { c.dash_charges = Math.max(0, Math.min(c.dash_max_charges, command.value)); c.dash_recharge_progress = 0; } break;
    case 'DebugRefillDashCharges': c.dash_charges = c.dash_max_charges; c.dash_recharge_progress = 0; break;
    case 'DebugDisableDashRecharge': c.dash_recharge_disabled = command.disabled !== false; break;
    case 'DebugFillSpecial': case 'DebugSetUltimateCharge': case 'DebugEmptyUltimateCharge':
      if (command.type === 'DebugSetUltimateCharge' && !Number.isFinite(command.value)) break;
      changeCharge(sim, c, command.type === 'DebugFillSpecial' ? c.special_threshold : command.type === 'DebugEmptyUltimateCharge' ? 0 : command.value);
      c.last_successful_hit_tick = sim.state.tick; c.special_decay_started = false; c.special_decay_origin = c.special_charge; break;
    case 'DebugForceUltimateDecay': c.last_successful_hit_tick = sim.state.tick - sim.secondsToTicks(sim.config.balance.special_charge.decay_delay_seconds); c.special_decay_started = false; break;
    case 'DebugArmBardella': if (activeCampaignStyle(sim.config, c)?.ultimate.kind === 'BARDELLA') { changeCharge(sim, c, c.special_threshold); activate(sim, c); } break;
    case 'DebugDisarmBardella': c.bardella_guardian_armed = false; c.active_ultimate_id = null; break;
    default: return false;
  }
  return true;
}

const clamp = value => Math.max(0, Math.min(1, value));

/** Read-only feedback: only damage received by the controlled candidate counts. */
export function damageFeedbackState(state, candidate, config, alpha = 1, reducedMotion = false) {
  if (!candidate || candidate.eliminated) return { opacity: 0, clearRadius: 55, impact: 0 };
  const settings = config.balance.damage_feedback;
  const maximum = state.arena_bounds ? candidate.arena_initial_hp : config.balance.candidate_combat.resistance_max;
  const health = state.arena_bounds ? candidate.arena_hp : candidate.resistance;
  const ratio = maximum > 0 ? clamp(health / maximum) : 1;
  const injury = 1 - ratio;
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  const tick = Math.max(0, state.tick - 1 + clamp(alpha));
  let impact = 0;
  // Respawn / Bardella immediately clears feedback; avoided hits have no HitResolved.
  if (!reducedMotion && injury > 0) for (const hit of state.hit_results) {
    if (hit.target_id !== candidate.id || hit.damage <= 0) continue;
    const age = Math.max(0, (tick - hit.tick) / hz);
    if (age >= settings.impact_seconds) continue;
    const strength = Math.min(1, .3 + hit.damage / maximum * 4);
    impact += strength * (1 - age / settings.impact_seconds) ** 2;
  }
  impact = Math.min(settings.impact_opacity, impact * settings.impact_opacity);
  const critical = !reducedMotion && !candidate.is_ko && ratio > 0 && ratio < settings.critical_health_ratio
    ? settings.critical_pulse_opacity * (1 - ratio / settings.critical_health_ratio)
      * (.5 + .5 * Math.sin(tick / hz * Math.PI * 2 * settings.critical_pulse_hz)) : 0;
  return {
    opacity: Math.min(.95, settings.max_injury_opacity * injury ** .75 + impact + critical),
    clearRadius: 55 - injury * 17 - impact * 12,
    impact,
  };
}

export class DamageFeedbackDisplay {
  constructor(config) {
    this.config = config;
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.element = document.createElement('div');
    this.element.id = 'damage-feedback'; this.element.setAttribute('aria-hidden', 'true');
    this.element.hidden = true; document.body.append(this.element);
  }
  update(state, candidate, alpha, hidden = false) {
    const feedback = damageFeedbackState(state, candidate, this.config, alpha, this.motionPreference.matches);
    this.element.hidden = hidden || feedback.opacity <= 0;
    this.element.style.setProperty('--damage-opacity', feedback.opacity.toFixed(4));
    this.element.style.setProperty('--damage-clear', `${feedback.clearRadius.toFixed(2)}%`);
  }
}

// All durations and heights belong to the authoritative simulation, never the browser.
export const actionState = () => ({ press_tick: null, charge_active: false, press_airborne: false, jump_tick: null, height: 0 });
export function cancelCharge(actor) {
  Object.assign(actor.combat, { press_tick: null, charge_active: false, press_airborne: false });
}
export const airborne = actor => actor.combat?.jump_tick != null;
export const charging = actor => !!actor.combat?.charge_active;
export function armored(state, actor) {
  if (charging(actor)) return true;
  const attack = state.attacks.find(a => a.id === actor.combat.attack_id);
  return attack?.kind === 'CHARGED' && attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks;
}
export function updateActions(sim, actor) {
  const c = actor.combat, b = sim.config.balance.candidate_combat;
  if (actor.is_ko || actor.eliminated || actor.campaign_arena_id) { Object.assign(c, actionState()); return; }
  if (c.press_tick != null && !c.press_airborne && !airborne(actor) && !c.attack_id && !c.stun_ticks && Math.abs(c.knockback_velocity) <= 0.02 && !actor.dash_active
    && sim.state.tick - c.press_tick >= sim.secondsToTicks(b.charge_activation_seconds)) {
    c.charge_active = true; actor.purchase_hold = null; actor.style_hold = null; actor.style_interaction_held = false;
  }
  if (airborne(actor)) {
    const previousHeight = c.height;
    const t = (sim.state.tick - c.jump_tick) / sim.secondsToTicks(b.jump_duration_seconds);
    c.height = b.jump_height_ratio * 4 * t * (1 - t);
    if (actor.role === 'CANDIDAT' && t >= 0.5 && sim.state.buildings?.length) {
      const platform = sim.state.buildings.find(site => site.type === 'meeting' && site.state === 'ACTIVE'
        && Math.abs(((actor.x - site.x + sim.state.world.length / 2 + sim.state.world.length) % sim.state.world.length) - sim.state.world.length / 2)
          <= sim.config.balance.buildings.meeting.podium_half_width
        && previousHeight >= sim.config.balance.buildings.meeting.podium_height
        && c.height <= sim.config.balance.buildings.meeting.podium_height);
      if (platform) {
        c.jump_tick = null;
        c.height = sim.config.balance.buildings.meeting.podium_height;
        actor.podium_site_id = platform.id;
        return;
      }
    }
    if (t >= 1) { c.jump_tick = null; c.height = 0; }
  }
}
export function verticalHit(config, source, target, spec) {
  if (spec.kind === 'BURN' || spec.retaliation) return true;
  const height = actor => actor.role === 'CANDIDAT' ? 1 : config.prototype.presentation.npc_height_multiplier ?? 0.8;
  const bottom = target.combat?.height || 0, top = bottom + height(target);
  let low, high;
  if (spec.kind === 'WAVE') { low = 0; high = 1.65; }
  else if (spec.kind === 'BUBBLE') { low = config.balance.specials.zemmour.bubble_bottom; high = low + config.balance.specials.zemmour.bubble_height; }
  else if (spec.kind === 'VERBAL') { low = 0.65; high = 0.9; }
  else if (spec.kind === 'SURGE') { low = 0; high = 1; }
  else { low = (source.combat?.height || 0) + height(source) * 0.3; high = low + height(source) * 0.65; }
  return bottom <= high && top >= low;
}

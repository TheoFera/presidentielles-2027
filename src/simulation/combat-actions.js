// All durations and heights belong to the authoritative simulation, never the browser.
export const actionState = () => ({ press_tick: null, charge_active: false, press_airborne: false, jump_tick: null, height: 0, dive_tick: null });
export function cancelCharge(actor) {
  Object.assign(actor.combat, { press_tick: null, charge_active: false, press_airborne: false });
}
export const airborne = actor => actor.combat?.jump_tick != null;
export const charging = actor => !!actor.combat?.charge_active;
export const diving = actor => actor.combat?.dive_tick != null;
export function armored(state, actor) {
  if (charging(actor)) return true;
  const attack = state.attacks.find(a => a.id === actor.combat.attack_id);
  return attack?.kind === 'CHARGED' && attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks;
}
export function updateActions(sim, actor) {
  const c = actor.combat, b = sim.config.balance.candidate_combat;
  if (actor.is_ko || actor.eliminated || actor.campaign_debate_id) { Object.assign(c, actionState()); return; }
  if (c.press_tick != null && !c.press_airborne && !airborne(actor) && !c.attack_id && !c.stun_ticks && Math.abs(c.knockback_velocity) <= 0.02 && !actor.dash_active
    && sim.state.tick - c.press_tick >= sim.secondsToTicks(b.charge_activation_seconds)) {
    c.charge_active = true; actor.purchase_hold = null; actor.style_hold = null; actor.style_interaction_held = false;
  }
  if (diving(actor)) { updateDive(sim, actor); return; }
  if (sim.state.platforms?.length) { updatePlatformHeight(sim, actor); return; }
  if (airborne(actor)) {
    const previousHeight = c.height;
    const t = (sim.state.tick - c.jump_tick) / sim.secondsToTicks(b.jump_duration_seconds);
    c.height = b.jump_height_ratio * 4 * t * (1 - t);
    if (t >= 0.5 && podiumLanding(sim, actor, previousHeight, c.height)) return;
    if (t >= 1) { c.jump_tick = null; c.height = 0; }
  }
}
/** Campagne : on se pose sur le promontoire d’un meeting actif en redescendant. */
function podiumLanding(sim, actor, previousHeight, height) {
  if (actor.role !== 'CANDIDAT' || !sim.state.buildings?.length) return false;
  const meeting = sim.config.balance.buildings.meeting, length = sim.state.world.length;
  const platform = sim.state.buildings.find(site => site.type === 'meeting' && site.state === 'ACTIVE'
    && Math.abs(((actor.x - site.x + length / 2 + length) % length) - length / 2) <= meeting.podium_half_width
    && previousHeight >= meeting.podium_height && height <= meeting.podium_height);
  if (!platform) return false;
  Object.assign(actor.combat, { jump_tick: null, dive_tick: null, height: meeting.podium_height });
  actor.podium_site_id = platform.id;
  return true;
}
/** Coup plongeant : Frapper en l’air. Descente en diagonale vers l’avant, sans contrôle,
 * jusqu’au sol, à un pupitre (débat) ou à un promontoire (campagne). */
export function startDive(sim, actor) {
  actor.combat.dive_tick = sim.state.tick;
}
function updateDive(sim, actor) {
  const c = actor.combat, b = sim.config.balance.candidate_combat, state = sim.state, hz = sim.config.balance.simulation_architecture.fixed_tick_hz;
  const previousHeight = c.height;
  c.height = Math.max(0, c.height - b.dive_vertical_speed / hz);
  const x = actor.x + actor.facing * b.dive_horizontal_speed / hz;
  actor.x = state.debate_bounds ? Math.max(state.debate_bounds.min, Math.min(state.debate_bounds.max, x)) : (x % state.world.length + state.world.length) % state.world.length;
  let landed = false;
  if (state.platforms?.length) {
    const landing = state.platforms.filter(p => p.id !== c.drop_through_id && Math.abs(actor.x - p.x) <= p.half_width
      && previousHeight >= p.height && c.height <= p.height).sort((a, b) => b.height - a.height)[0];
    if (landing) { c.height = landing.height; actor.platform_id = landing.id; landed = true; }
  } else landed = podiumLanding(sim, actor, previousHeight, c.height);
  if (!landed && c.height > 0) return;
  Object.assign(c, { jump_tick: null, dive_tick: null, drop_through_id: null });
  if (!state.platforms?.length && !actor.podium_site_id) c.height = 0;
  // À l’atterrissage, le coup s’arrête et laisse place au temps de récupération.
  const attack = state.attacks.find(a => a.id === c.attack_id && a.kind === 'DIVE');
  if (attack) attack.active_ticks = Math.max(0, attack.elapsed_ticks - attack.windup_ticks);
}
/** Mode Débat : pupitres traversables par le bas, où l’on reste debout.
 * Le saut suit une parabole qui part de la hauteur courante et continue sous
 * son point de départ jusqu’à retrouver un pupitre ou le sol. */
export const platformJump = state => state.platform_jump;
const platformJumpHeight = (sim, c) => {
  const t = (sim.state.tick - c.jump_tick) / sim.secondsToTicks(platformJump(sim.state).duration_seconds);
  return Math.max(0, c.jump_base + platformJump(sim.state).height * 4 * t * (1 - t));
};
export const platformUnder = (state, x, height, ignoreId = null) => state.platforms.find(p => p.id !== ignoreId
  && Math.abs(x - p.x) <= p.half_width && Math.abs(p.height - height) < 1e-6) || null;
/** Faire tomber depuis le haut de la parabole : marche dans le vide, ↓ ou coup reçu. */
export function startPlatformFall(sim, actor, ignoreId = null) {
  const c = actor.combat;
  c.jump_tick = sim.state.tick - Math.round(sim.secondsToTicks(platformJump(sim.state).duration_seconds) / 2);
  c.jump_base = c.height - platformJump(sim.state).height;
  c.drop_through_id = ignoreId; actor.platform_id = null;
}
function updatePlatformHeight(sim, actor) {
  const c = actor.combat;
  if (!airborne(actor)) {
    // Debout sur un pupitre : quitter son bord déclenche la chute.
    if (actor.platform_id && !platformUnder(sim.state, actor.x, c.height)) startPlatformFall(sim, actor);
    else { if (!actor.platform_id) c.height = 0; return; }
  }
  const previousHeight = c.height;
  c.height = platformJumpHeight(sim, c);
  if (c.height >= previousHeight) return;
  const landing = sim.state.platforms.filter(p => p.id !== c.drop_through_id && Math.abs(actor.x - p.x) <= p.half_width
    && previousHeight >= p.height && c.height <= p.height).sort((a, b) => b.height - a.height)[0];
  if (landing) { c.jump_tick = null; c.height = landing.height; c.drop_through_id = null; actor.platform_id = landing.id; return; }
  if (c.height <= 0) { c.jump_tick = null; c.height = 0; c.drop_through_id = null; actor.platform_id = null; }
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
  // Le plongeon frappe autour et sous les pieds.
  else if (spec.kind === 'DIVE') { low = Math.max(0, (source.combat?.height || 0) - 0.4); high = (source.combat?.height || 0) + 0.7; }
  else { low = (source.combat?.height || 0) + height(source) * 0.3; high = low + height(source) * 0.65; }
  return bottom <= high && top >= low;
}

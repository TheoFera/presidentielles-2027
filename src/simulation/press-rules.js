import { ringDelta } from './world.js';

export const isPress = actor => actor?.role === 'PRESS_CAMERA' || actor?.role === 'PRESS_REPORTER';
export const pressMember = (state, role) => state.temporary_units.find(u => u.role === role && !u.expired);

// Géométrie commune au dessin et à la simulation : un cône fixe, jamais une visée automatique.
export function pressCone(state, config, camera) {
  const s = config.balance.press_team;
  let range = s.camera_range;
  for (const wall of state.powers) {
    if (wall.kind !== 'BARRIER' || state.tick >= wall.fall_tick) continue;
    const d = ringDelta(camera.x, wall.x, state.world.length) * camera.facing;
    if (d > 0 && d < range && (wall.base_height || 0) <= s.camera_height
      && (wall.base_height || 0) + config.balance.minor_ultimates.barrier.height >= s.camera_height) range = d;
  }
  return range;
}

export function filmed(state, config, actor, position = actor.x) {
  const group = state.press_team, s = config.balance.press_team;
  if (!s || !group || group.phase !== 'ACTIVE' || state.phase !== 'CAMPAIGN' || group.target_id !== actor.id
    || actor.is_ko || actor.eliminated || actor.campaign_debate_id
    || actor.faction_id === 'philippe' && actor.ultimate_effect?.kind === 'EUROPE' && actor.ultimate_effect.expires_tick > state.tick) return false;
  const camera = pressMember(state, 'PRESS_CAMERA');
  if (!camera?.filming || camera.moving || camera.combat.stun_ticks || camera.hidden_durability <= 0) return false;
  const d = ringDelta(camera.x, position, state.world.length) * camera.facing;
  return d >= 0 && d <= pressCone(state, config, camera)
    && Math.abs((actor.combat.height || 0) + .5 - s.camera_height) <= s.cone_start_radius + d * s.cone_slope;
}
export const pressMoveFactor = (state, config, actor, position = actor.x) => filmed(state, config, actor, position) ? config.balance.press_team.movement_multiplier : 1;
export const pressAttackFactor = (state, config, actor) => filmed(state, config, actor) ? config.balance.press_team.attack_speed_multiplier : 1;

// Appelé depuis la résolution d'un coup : retrait des DEUX avant la prochaine attaque du même tick.
export function leavePressTeam(sim, reason) {
  const group = sim.state.press_team;
  if (!group || group.phase === 'LEAVING') return;
  group.phase = 'LEAVING'; group.leave_tick = sim.state.tick;
  for (const unit of sim.state.temporary_units) if (isPress(unit)) {
    unit.filming = false; unit.press_ready = false; unit.moving = true; unit.combat.attack_id = null;
    unit.combat.stun_ticks = 0; unit.combat.hitstop_ticks = 0; unit.combat.knockback_velocity = 0;
  }
  sim.state.attacks = sim.state.attacks.filter(a => a.owner_id !== group.camera_id && a.owner_id !== group.reporter_id);
  sim.emit('PressTeamLeaving', { candidate_id: group.target_id, reason });
}

export function pressHit(sim, target) {
  if (!isPress(target)) return;
  if (target.role === 'PRESS_CAMERA') { target.filming = false; target.aim_ticks = 0; }
  if (target.hidden_durability <= 0) leavePressTeam(sim, 'DEFEATED');
}

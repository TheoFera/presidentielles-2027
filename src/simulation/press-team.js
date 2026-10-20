import { combatState, interrupted } from './combat-state.js';
import { startNpcAttack, wallBlockedPosition } from './combat.js';
import { ringDelta, wrap } from './world.js';
import { NPC_ENTRY_SECONDS } from './npc-entry.js';
import { isPress, pressMember, leavePressTeam } from './press-rules.js';

function leader(state) {
  let first = null, top = -1, second = 0;
  const scores = state.actualGameState?.national_support || {};
  for (const c of state.candidates) {
    if (c.minor || c.eliminated) continue;
    const score = scores[c.faction_id] || 0;
    if (score > top) { second = Math.max(0, top); top = score; first = c; }
    else second = Math.max(second, score);
  }
  return { candidate: first, score: top, gap: top - second };
}

export function spawnPressTeam(sim, target) {
  const { state, config } = sim, s = config.balance.press_team;
  const director = state.press_director ||= { count: 0, by_candidate: {}, next_tick: 0, next_check_tick: 0, eligible_id: null, eligible_since: 0, warning: null };
  const direction = director.count % 2 ? -1 : 1;
  const base = wrap(target.x - direction * s.spawn_distance, state.world.length);
  const make = (role, offset, hp) => ({
    id: `temporary:${state.next_temporary_id++}`, role, faction_id: 'press', temporary: true, expired: false,
    owner_id: target.id, power_id: null, x: wrap(base + offset * direction, state.world.length), facing: direction,
    hidden_durability: hp, initial_durability: hp, follow_offset: offset,
    ready_tick: state.tick + sim.secondsToTicks(NPC_ENTRY_SECONDS), entry_tick: state.tick,
    expires_tick: state.tick + sim.secondsToTicks(NPC_ENTRY_SECONDS + s.duration_seconds + s.exit_seconds + 1),
    combat: combatState(), moving: true, filming: false, press_ready: false, aim_ticks: 0, variant: director.count % 3,
  });
  const camera = make('PRESS_CAMERA', 0, s.camera_hp), reporter = make('PRESS_REPORTER', s.spacing, s.reporter_hp);
  state.temporary_units.push(camera, reporter);
  state.press_team = { phase: 'ENTRY', target_id: target.id, camera_id: camera.id, reporter_id: reporter.id,
    started_tick: state.tick, direction, turn_since: null, lead_lost_tick: null };
  director.count++; director.by_candidate[target.id] = (director.by_candidate[target.id] || 0) + 1;
  director.warning = null; director.eligible_id = null;
  sim.emit('PressTeamArrived', { candidate_id: target.id });
}

function move(sim, actor, x, speed) {
  if (interrupted(actor)) return false;
  const d = ringDelta(actor.x, x, sim.state.world.length), step = speed / sim.hz;
  if (Math.abs(d) <= .08) return false;
  actor.facing = Math.sign(d); actor.moving = true;
  const before = actor.x;
  actor.x = wallBlockedPosition(sim, actor, wrap(actor.x + Math.sign(d) * Math.min(step, Math.abs(d)), sim.state.world.length));
  actor.moving = actor.x !== before;
  return actor.moving;
}

export function updatePressTeam(sim) {
  const { state, config } = sim, s = config.balance.press_team;
  if (!s?.enabled) return;
  const director = state.press_director ||= { count: 0, by_candidate: {}, next_tick: 0, next_check_tick: 0, eligible_id: null, eligible_since: 0, warning: null };
  const group = state.press_team;
  if (!group) {
    if (state.phase !== 'CAMPAIGN' || state.tick < director.next_check_tick) return;
    director.next_check_tick = state.tick + sim.secondsToTicks(s.check_seconds);
    if (state.tick < sim.secondsToTicks(s.grace_seconds) || state.tick < director.next_tick || director.count >= s.max_interventions) return;
    const result = leader(state), target = result.candidate;
    if (!target || target.is_ko || target.campaign_debate_id || result.score < s.minimum_score || result.gap < s.lead_points
      || (director.by_candidate[target.id] || 0) >= s.max_per_candidate) { director.eligible_id = null; director.warning = null; return; }
    if (director.eligible_id !== target.id) { director.eligible_id = target.id; director.eligible_since = state.tick; director.warning = null; }
    if (state.tick - director.eligible_since < sim.secondsToTicks(s.confirm_seconds)) return;
    if (!director.warning) {
      director.warning = { target_id: target.id, tick: state.tick, spawn_tick: state.tick + sim.secondsToTicks(s.warning_seconds) };
      sim.emit('PressTeamWarning', { candidate_id: target.id });
    } else if (state.tick >= director.warning.spawn_tick) spawnPressTeam(sim, target);
    return;
  }
  const target = state.candidates.find(c => c.id === group.target_id);
  const camera = pressMember(state, 'PRESS_CAMERA'), reporter = pressMember(state, 'PRESS_REPORTER');
  if (!camera || !reporter) { leavePressTeam(sim, 'DEFEATED'); }
  if (group.phase !== 'LEAVING' && (state.phase !== 'CAMPAIGN' || !target || target.eliminated || target.is_ko || target.campaign_debate_id)) leavePressTeam(sim, 'TARGET_UNAVAILABLE');
  if (group.phase === 'LEAVING') {
    if (state.tick - group.leave_tick >= sim.secondsToTicks(s.exit_seconds)) {
      state.temporary_units = state.temporary_units.filter(u => !isPress(u)); state.press_team = null;
      director.next_tick = state.tick + sim.secondsToTicks(s.cooldown_seconds);
    }
    return;
  }
  camera.moving = false; reporter.moving = false;
  if (group.phase === 'ENTRY') {
    if (state.tick < camera.ready_tick) return;
    group.phase = 'ACTIVE'; group.active_tick = state.tick; camera.press_ready = reporter.press_ready = true;
  }
  if (state.tick - group.active_tick >= sim.secondsToTicks(s.duration_seconds)) { leavePressTeam(sim, 'TIMEOUT'); return; }
  if (state.tick % sim.secondsToTicks(s.check_seconds) === 0) {
    const result = leader(state);
    if (result.candidate?.id !== target.id || result.gap <= s.release_lead_points) group.lead_lost_tick ??= state.tick;
    else group.lead_lost_tick = null;
  }
  if (group.lead_lost_tick != null && state.tick - group.lead_lost_tick >= sim.secondsToTicks(s.release_seconds)) { leavePressTeam(sim, 'LEAD_LOST'); return; }
  const delta = ringDelta(camera.x, target.x, state.world.length), sign = Math.sign(delta) || group.direction;
  if (sign !== group.direction && Math.abs(delta) > s.turn_deadzone) {
    group.turn_since ??= state.tick;
    if (state.tick - group.turn_since >= sim.secondsToTicks(s.turn_seconds)) { group.direction = sign; group.turn_since = null; }
  } else group.turn_since = null;
  const direction = group.direction;
  let reporterGoal = wrap(target.x - direction * s.micro_range, state.world.length);
  // Ne pas reculer à travers son propre cadreur quand le candidat se rapproche :
  // on conserve le passage libre pour un dash, puis on inverse réellement la formation.
  if (sign === direction && ringDelta(camera.x, reporterGoal, state.world.length) * direction < .55)
    reporterGoal = wrap(camera.x + direction * .55, state.world.length);
  let cameraGoal = wrap(reporterGoal - direction * s.spacing, state.world.length);
  const reporterAhead = ringDelta(camera.x, reporter.x, state.world.length) * direction;
  const regrouping = reporterAhead < .4 || sign !== direction || sign !== camera.facing;
  // La caméra s'arrête pour filmer. Elle ne pivote jamais instantanément sur une cible passée derrière.
  const distance = Math.abs(delta);
  const mustMove = regrouping || distance > s.camera_range;
  if (mustMove && sign === direction) {
    if (regrouping && Math.abs(ringDelta(camera.x, cameraGoal, state.world.length)) <= .08)
      cameraGoal = wrap(cameraGoal - direction * .12, state.world.length);
    if (move(sim, camera, cameraGoal, s.move_speed)) {
      // Il peut reculer en regardant la cible : le sens de marche ne doit pas bloquer le prochain cadrage.
      camera.facing = direction; camera.filming = false; camera.aim_ticks = 0;
    }
  }
  if (!camera.moving && !camera.combat.stun_ticks && !camera.combat.hitstop_ticks && !regrouping) {
    camera.facing = direction;
    if (!camera.filming && ++camera.aim_ticks >= sim.secondsToTicks(s.aim_seconds)) camera.filming = true;
  }
  const gap = Math.abs(ringDelta(camera.x, reporter.x, state.world.length));
  const catchingUp = reporterAhead < .4;
  if (catchingUp || gap <= s.max_spacing || gap > s.max_spacing && ringDelta(reporter.x, reporterGoal, state.world.length) * direction < 0)
    move(sim, reporter, reporterGoal, catchingUp ? s.reposition_speed : s.move_speed);
  reporter.facing = direction;
  if (Math.abs(ringDelta(reporter.x, target.x, state.world.length)) <= s.micro_range + .05 && reporterAhead >= .4) {
    startNpcAttack(sim, reporter, 'MICROPHONE', { target_id: target.id, range: s.micro_range,
      damage: s.micro_damage, knockback: 0, electoral_damage: 0, stun_seconds: s.micro_stun_seconds,
      windup_ticks: sim.secondsToTicks(s.micro_windup_seconds), active_ticks: sim.secondsToTicks(s.micro_active_seconds),
      recovery_ticks: sim.secondsToTicks(s.micro_recovery_seconds), cooldown_seconds: s.micro_cooldown_seconds });
  }
}

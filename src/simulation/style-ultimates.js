import { activeCampaignStyle, clearCampaignUltimate } from './campaign-styles.js';
import { combatActors, combatState, enemies, hit, nearestEnemy } from './combat-state.js';
import { combatDelta, combatPosition } from './combat-geometry.js';

export function tryBardellisation(sim, candidate) {
  if (activeCampaignStyle(sim.config, candidate)?.ultimate.kind !== 'BARDELLA' || candidate.bardellisation_used || !candidate.bardella_guardian_armed) return false;
  clearCampaignUltimate(sim, candidate);
  candidate.bardellisation_used = true; candidate.bardella_form = true;
  candidate.resistance = sim.config.balance.candidate_combat.resistance_max;
  if (sim.state.arena_bounds) candidate.arena_hp = candidate.arena_initial_hp;
  candidate.combat = combatState(); candidate.is_ko = false;
  candidate.bardella_transition_tick = sim.state.tick;
  sim.emit('BardellaGuardianTriggered', { candidate_id: candidate.id });
  sim.emit('BardellisationTriggered', { candidate_id: candidate.id });
  return true;
}

function temporary(sim, owner, power, role, x, durability, extra = {}) {
  const unit = { id: `temporary:${sim.state.next_temporary_id++}`, power_id: power.id, owner_id: owner.id,
    role, faction_id: owner.faction_id, temporary: true, expired: false, x: combatPosition(sim.state, x),
    follow_offset: 0, facing: owner.facing, moving: false, expires_tick: power.expires_tick,
    hidden_durability: durability, combat: combatState(), persuasion_target_ids: [], ...extra };
  sim.state.temporary_units.push(unit); return unit;
}
export function createStyleProjectile(sim, owner, power, kind, settings, extra = {}) {
  const p = { id: `projectile:${sim.state.next_projectile_id++}`, power_id: power.id, owner_id: owner.id,
    faction_id: owner.faction_id, kind, x: owner.x, direction: owner.facing,
    speed: settings.projectile_speed, remaining_range: settings.projectile_range ?? sim.state.world.length,
    hit_ids: [], damage: settings.damage ?? 0, knockback: settings.knockback ?? 0, electoral_damage: 0,
    ultimate: true, ranged: true, ...extra };
  sim.state.projectiles.push(p); return p;
}
export function startStyleUltimate(sim, actor, power) {
  const settings = sim.config.balance.specials;
  if (power.kind === 'SURGE') {
    const s = settings.surge;
    power.expires_tick += sim.secondsToTicks(s.duration_seconds + s.appearance_seconds);
    for (let i = 0; i < s.count; i++) temporary(sim, actor, power, 'ENCAPUCHONNE', actor.x + (i - 3) * 0.65, 9999,
      { spawn_tick: sim.state.tick, ready_tick: sim.state.tick + sim.secondsToTicks(s.appearance_seconds), contact_ticks: {}, sweep_origin: actor.x, sweep_direction: i % 2 ? -1 : 1 });
  } else if (power.kind === 'ZEMMOUR') {
    const s = settings.zemmour;
    power.expires_tick += sim.secondsToTicks(s.duration_seconds);
    temporary(sim, actor, power, 'ZEMMOUR', actor.x - actor.facing * 1.5, s.durability, { next_shot_tick: sim.state.tick, shot_count: 0 });
  } else if (power.kind === 'FIRE') {
    const target = nearestEnemy(sim.state, actor, sim.state.world.length, t => t.role === 'CANDIDAT');
    const targetX = target?.x ?? combatPosition(sim.state, actor.x + actor.facing * 6);
    const delta = combatDelta(sim.state, actor.x, targetX), travel = Math.max(0.1, Math.abs(delta));
    power.expires_tick += sim.secondsToTicks(travel / settings.fire.projectile_speed + settings.fire.duration_seconds + settings.fire.burn_seconds);
    createStyleProjectile(sim, actor, power, 'MOLOTOV', settings.fire, { target_x: targetX, direction: Math.sign(delta) || actor.facing, remaining_range: travel });
    actor.ultimate_effect = { kind: 'FIRE', expires_tick: sim.state.tick + sim.secondsToTicks(0.9) };
  } else if (['SCARF', 'EUROPE'].includes(power.kind)) {
    power.expires_tick += sim.secondsToTicks(settings[power.kind.toLowerCase()].duration_seconds);
    actor.ultimate_effect = { kind: power.kind, expires_tick: power.expires_tick };
  } else return false;
  return true;
}

export function updateStyleTemporary(sim, unit) {
  const { state, config } = sim;
  if (unit.role === 'ENCAPUCHONNE') {
    if (state.tick < unit.ready_tick) return true;
    const s = config.balance.specials.surge;
    unit.x = combatPosition(state, unit.x + unit.sweep_direction * s.speed / sim.hz); unit.moving = true;
    if (Math.abs(combatDelta(state, unit.sweep_origin, unit.x)) > 7) unit.sweep_direction *= -1;
    unit.facing = unit.sweep_direction;
    for (const target of combatActors(state)) {
      if (!enemies(unit, target) || Math.abs(combatDelta(state, unit.x, target.x)) > s.range || state.tick < (unit.contact_ticks[target.id] ?? 0)) continue;
      if (hit(sim, unit, target, { kind: 'SURGE', ultimate: true, damage: s.damage, knockback: s.knockback, stun_seconds: s.stun_seconds, direction: unit.facing }, unit.power_id)) unit.contact_ticks[target.id] = state.tick + sim.secondsToTicks(s.contact_cooldown_seconds);
    }
    return true;
  }
  if (unit.role === 'ZEMMOUR') {
    const s = config.balance.specials.zemmour;
    const target = nearestEnemy(state, unit, state.world.length, t => t.role === 'CANDIDAT') || nearestEnemy(state, unit, s.projectile_range);
    if (target && state.tick >= unit.next_shot_tick) {
      unit.facing = Math.sign(combatDelta(state, unit.x, target.x)) || unit.facing;
      createStyleProjectile(sim, unit, { id: unit.power_id }, 'BUBBLE', s, { target_id: target.id, label: s.bubble_labels[unit.shot_count++ % s.bubble_labels.length] });
      unit.next_shot_tick = state.tick + sim.secondsToTicks(1 / s.shots_per_second);
    }
    return true;
  }
  return false;
}

export function updateMolotov(sim, projectile, step) {
  if (projectile.kind !== 'MOLOTOV') return false;
  projectile.x = combatPosition(sim.state, projectile.x + projectile.direction * step);
  projectile.remaining_range -= step;
  if (projectile.remaining_range <= 0) {
    const power = sim.state.powers.find(p => p.id === projectile.power_id);
    if (power) { power.fire_zone = { x: projectile.x, expires_tick: sim.state.tick + sim.secondsToTicks(sim.config.balance.specials.fire.duration_seconds) }; power.burns = {}; }
  }
  return true;
}

export function updateStyleEffects(sim) {
  const { state, config } = sim;
  for (const c of state.candidates) {
    if (c.ultimate_effect?.expires_tick <= state.tick) c.ultimate_effect = null;
  }
  for (const power of [...state.powers]) {
    if (!power.fire_zone) continue;
    const owner = state.candidates.find(c => c.id === power.owner_id);
    if (!owner || owner.is_ko || owner.eliminated) continue;
    const s = config.balance.specials.fire;
    for (const target of combatActors(state)) {
      if (!enemies(owner, target)) continue;
      if ((!target.dash_active || state.tick > target.dash_invulnerable_until_tick) && state.tick < power.fire_zone.expires_tick && Math.abs(combatDelta(state, power.fire_zone.x, target.x)) <= s.radius) {
        power.burns[target.id] ??= { next_tick: state.tick, expires_tick: state.tick };
        power.burns[target.id].expires_tick = state.tick + sim.secondsToTicks(s.burn_seconds);
      }
      const burn = power.burns[target.id];
      if (burn && state.tick < burn.expires_tick && state.tick >= burn.next_tick) {
        hit(sim, owner, target, { kind: 'BURN', ultimate: true, ranged: true, damage: s.damage_per_second * s.tick_seconds, knockback: 0, stun_seconds: 0, no_hitstop: true }, power.id);
        burn.next_tick = state.tick + sim.secondsToTicks(s.tick_seconds);
      }
    }
  }
}

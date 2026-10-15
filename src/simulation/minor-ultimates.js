import { combatActors, findCombatActor, enemies, hit, nearestEnemy, canBeHit } from './combat-state.js';
import { combatDelta, combatPosition } from './combat-geometry.js';
import { MINOR_ULTIMATE_KINDS, pendingSatchel, invisibleToEnemies } from './minor-ultimate-catalog.js';

const settings = sim => sim.config.balance.minor_ultimates;
const seconds = (sim, value) => sim.secondsToTicks(value);
const delta = (sim, a, b) => combatDelta(sim.state, a, b);

// Même priorité que le cocktail : candidat visible, puis unité ennemie, sinon devant soi.
function aim(sim, owner, range) {
  const target = nearestEnemy(sim.state, owner, range, t => t.role === 'CANDIDAT') || nearestEnemy(sim.state, owner, range);
  return { target_id: target?.id ?? null, target_x: target?.x ?? combatPosition(sim.state, owner.x + owner.facing * range) };
}

export function revealCandidate(sim, actor) {
  if (!invisibleToEnemies(actor, sim.state.tick)) return;
  actor.ultimate_effect = null;
  actor.reveal_tick = sim.state.tick;
  for (const p of sim.state.powers) if (p.owner_id === actor.id && p.kind === 'INVISIBLE') p.expires_tick = sim.state.tick + seconds(sim, settings(sim).invisible.transition_seconds);
  sim.emit('CandidateRevealed', { candidate_id: actor.id });
}

export function startMinorUltimate(sim, owner, power) {
  if (!MINOR_ULTIMATE_KINDS.includes(power.kind)) return false;
  const b = settings(sim), tick = sim.state.tick;
  Object.assign(power, { x: owner.x, direction: owner.facing });
  switch (power.kind) {
    case 'SAUSAGE':
      Object.assign(power, { height: (owner.combat.height || 0) + b.sausage.height, returning: false,
        launch_tick: tick + seconds(sim, b.sausage.launch_seconds), launched: false,
        travelled: 0, hit_ids: [], return_hit_ids: [], carried_ids: [] });
      power.expires_tick = tick + seconds(sim, 6); break;
    case 'INVISIBLE':
      power.expires_tick = tick + seconds(sim, b.invisible.duration_seconds);
      owner.reveal_tick = null;
      owner.ultimate_effect = { kind: power.kind, started_tick: tick, expires_tick: power.expires_tick };
      // Une cible mémorisée avant la disparition ne permet pas de suivre l'invisible.
      for (const actor of combatActors(sim.state)) if (actor.combat.target_id === owner.id) actor.combat.target_id = null;
      break;
    case 'DELIVERY':
      power.impacts = [0, 1, 2].map(index => ({ x: combatPosition(sim.state, owner.x + owner.facing * b.delivery.spacing * (index + 1)),
        tick: tick + seconds(sim, b.delivery.call_seconds + b.delivery.warning_seconds + index * b.delivery.interval_seconds), done: false }));
      power.expires_tick = power.impacts.at(-1).tick + seconds(sim, .8); break;
    case 'TOOLS':
      power.expires_tick = tick + seconds(sim, b.tools.duration_seconds);
      owner.ultimate_effect = { kind: power.kind, expires_tick: power.expires_tick }; break;
    case 'BARRIER': {
      const target = aim(sim, owner, sim.config.prototype.world.units_per_screen / 2);
      const d = delta(sim, owner.x, target.target_x);
      power.direction = Math.sign(d) || owner.facing;
      power.x = combatPosition(sim.state, owner.x + power.direction * Math.min(b.barrier.max_distance, Math.max(.85, Math.abs(d) / 2)));
      power.base_height = Math.max(0, owner.combat.jump_tick != null ? owner.combat.jump_base || 0 : owner.combat.height || 0);
      power.fall_tick = tick + seconds(sim, b.barrier.duration_seconds);
      power.expires_tick = power.fall_tick + seconds(sim, b.barrier.fall_seconds + .6);
      power.hit_ids = []; break;
    }
    case 'SATCHEL':
      Object.assign(power, { ...aim(sim, owner, b.satchel.range), launch_tick: tick + seconds(sim, b.satchel.launch_seconds),
        launched: false, landed: false, remaining_range: b.satchel.range, initial_range: b.satchel.range, height: b.satchel.height });
      power.direction = Math.sign(delta(sim, owner.x, power.target_x)) || owner.facing;
      power.expires_tick = tick + seconds(sim, b.satchel.lifetime_seconds); break;
    default: return false;
  }
  return true;
}

function impact(sim, owner, target, power, damage, knockback, extra = {}) {
  return hit(sim, owner, target, { kind: power.kind, ultimate: true, ranged: true, exact_damage: true,
    damage, knockback, electoral_damage: 0, no_hitstop: true, ...extra }, power.id);
}

export function detonateSatchel(sim, owner) {
  const p = pendingSatchel(sim.state, owner);
  if (!p || !p.launched || sim.state.tick <= p.started_tick || owner.is_ko || owner.eliminated || !owner.campaign_active || owner.combat.stun_ticks) return false;
  const b = settings(sim).satchel;
  p.detonated_tick = sim.state.tick;
  p.expires_tick = sim.state.tick + seconds(sim, .7);
  for (const target of combatActors(sim.state)) if (enemies(owner, target) && Math.abs(delta(sim, p.x, target.x)) <= b.radius) {
    impact(sim, owner, target, p, b.damage, b.knockback, { area_height: p.height, area_radius: b.radius,
      direction: Math.sign(delta(sim, p.x, target.x)) || p.direction, strong: true });
  }
  sim.emit('SatchelDetonated', { candidate_id: owner.id, power_id: p.id });
  return true;
}

function updateSausage(sim, owner, p) {
  const b = settings(sim).sausage, radius = sim.config.balance.candidate_combat.target_radius;
  if (p.caught_tick != null) { p.x = owner.x; return; }
  if (sim.state.tick < (p.launch_tick ?? p.started_tick)) { p.x = owner.x; return; }
  const releasing = !p.launched;
  if (releasing) {
    p.launched = true; p.x = owner.x;
    p.height = (owner.combat.height || 0) + b.height;
  }
  const d = delta(sim, p.x, owner.x), step = Math.min(b.speed / sim.hz + (releasing ? b.release_offset : 0), p.returning ? Math.abs(d) : b.range - p.travelled);
  if (p.returning) p.catch_direction = Math.sign(delta(sim, owner.x, p.x)) || p.catch_direction || p.direction;
  const direction = p.returning ? Math.sign(d) || p.direction : p.direction;
  const hits = p.returning ? p.return_hit_ids : p.hit_ids;
  for (const target of combatActors(sim.state)) {
    const along = delta(sim, p.x, target.x) * direction;
    if (!enemies(owner, target) || hits.includes(target.id) || along < -radius || along > step + radius) continue;
    const result = impact(sim, owner, target, p, b.damage, p.returning ? b.pull : b.push,
      { area_height: p.height, area_radius: .4, direction: p.returning ? Math.sign(delta(sim, target.x, owner.x)) || direction : direction });
    if (result) { hits.push(target.id); if (p.returning) p.carried_ids.push(target.id); }
  }
  p.x = combatPosition(sim.state, p.x + direction * step);
  if (p.returning) {
    for (const id of p.carried_ids) {
      const target = findCombatActor(sim.state, id);
      if (canBeHit(target) && Math.abs(delta(sim, owner.x, target.x)) > sim.config.balance.candidate_combat.body_width) {
        const distance = Math.max(sim.config.balance.candidate_combat.body_width, Math.abs(delta(sim, owner.x, p.x)) + .25);
        target.x = barrierBlockedPosition(sim, target, combatPosition(sim.state, owner.x - direction * distance));
        target.combat.knockback_velocity = 0;
      }
    }
    if (Math.abs(delta(sim, p.x, owner.x)) < .3) {
      p.x = owner.x; p.caught_tick = sim.state.tick;
      p.expires_tick = sim.state.tick + seconds(sim, b.catch_seconds);
      sim.emit('SausageCaught', { candidate_id: owner.id, power_id: p.id });
    }
  } else {
    p.travelled += step;
    if (p.travelled >= b.range || sim.state.debate_bounds && (p.x <= sim.state.debate_bounds.min || p.x >= sim.state.debate_bounds.max)) p.returning = true;
  }
}

function updateSatchel(sim, owner, p) {
  if (p.detonated_tick || p.landed || sim.state.tick < p.launch_tick) return;
  const b = settings(sim).satchel;
  if (!p.launched) {
    // L'adversaire a pu bouger pendant l'animation de lancer.
    const target = findCombatActor(sim.state, p.target_id);
    if (target && enemies(owner, target) && !invisibleToEnemies(target, sim.state.tick) && Math.abs(delta(sim, owner.x, target.x)) <= b.range) p.target_x = target.x;
    const d = delta(sim, owner.x, p.target_x);
    p.direction = Math.sign(d) || owner.facing;
    const offset = Math.min(b.release_offset, Math.max(0, Math.abs(d) - .1));
    p.x = combatPosition(sim.state, owner.x + p.direction * offset);
    p.remaining_range = p.initial_range = Math.max(.1, Math.min(b.range, Math.abs(d)) - offset);
    p.launch_height = Math.max(0, owner.combat.height || 0); p.launched = true;
  }
  const step = Math.min(p.remaining_range, b.speed / sim.hz);
  p.x = combatPosition(sim.state, p.x + p.direction * step); p.remaining_range -= step;
  const progress = 1 - p.remaining_range / p.initial_range;
  p.height = (1 - progress) * (b.height + p.launch_height) + 4 * progress * (1 - progress) * .65;
  if (p.remaining_range <= 0) { p.landed = true; p.height = 0; }
}

export function updateMinorUltimates(sim) {
  const b = settings(sim), state = sim.state;
  for (const p of [...state.powers]) {
    if (!MINOR_ULTIMATE_KINDS.includes(p.kind)) continue;
    const owner = state.candidates.find(c => c.id === p.owner_id);
    if (!owner || owner.eliminated || owner.is_ko) { p.expires_tick = state.tick; continue; }
    if (p.kind === 'SAUSAGE') updateSausage(sim, owner, p);
    if (p.kind === 'SATCHEL') updateSatchel(sim, owner, p);
    if (p.kind === 'DELIVERY') for (const drop of p.impacts) {
      if (drop.done || state.tick < drop.tick) continue;
      drop.done = true;
      for (const target of combatActors(state)) if (enemies(owner, target) && Math.abs(delta(sim, drop.x, target.x)) <= b.delivery.radius) {
        impact(sim, owner, target, p, b.delivery.damage, b.delivery.knockback, { area_height: .5, area_radius: 1.2, direction: p.direction });
      }
    }
    if (p.kind === 'BARRIER' && state.tick >= p.fall_tick) {
      const progress = Math.min(1, (state.tick - p.fall_tick) / seconds(sim, b.barrier.fall_seconds));
      // La zone frappée suit la bascule : le mur ne touche pas toute sa longueur dès le départ.
      const reach = Math.sin(progress * Math.PI / 2) * b.barrier.fall_range;
      for (const target of combatActors(state)) {
        const along = delta(sim, p.x, target.x) * p.direction;
        if (!enemies(owner, target) || p.hit_ids.includes(target.id) || along < -.2 || along > reach || progress < .35) continue;
        if (impact(sim, owner, target, p, b.barrier.damage, b.barrier.knockback,
          { area_height: p.base_height, area_radius: b.barrier.height * (1 - progress) + .3, direction: p.direction, strong: true })) p.hit_ids.push(target.id);
      }
    }
  }
  for (const actor of combatActors(state)) {
    if (actor.ultimate_effect?.kind === 'INVISIBLE' && actor.ultimate_effect.expires_tick <= state.tick) revealCandidateAtExpiry(actor, state.tick);
  }
  state.powers = state.powers.filter(p => p.expires_tick > state.tick);
}

function revealCandidateAtExpiry(actor, tick) { actor.ultimate_effect = null; actor.reveal_tick = tick; }

/** Mur solide pour les deux camps, tant que les pieds n'ont pas dépassé le sommet. */
export function barrierBlockedPosition(sim, actor, desired, origin = actor.x) {
  const movement = delta(sim, origin, desired), b = settings(sim)?.barrier;
  if (!movement || !b) return desired;
  let allowed = Math.abs(movement);
  for (const p of sim.state.powers) {
    if (p.kind !== 'BARRIER' || sim.state.tick >= p.fall_tick || (actor.combat?.height || 0) >= p.base_height + b.height) continue;
    if ((actor.combat?.height || 0) + 1 < p.base_height) continue;
    const side = Math.sign(movement), ahead = delta(sim, origin, p.x) * side;
    const radius = b.half_width + sim.config.balance.candidate_combat.body_width / 2;
    if (ahead >= 0 && ahead <= allowed + radius) allowed = Math.max(0, ahead - radius);
  }
  return combatPosition(sim.state, origin + Math.sign(movement) * allowed);
}

export function toolsAttack(sim, actor, spec) {
  if (actor.ultimate_effect?.kind !== 'TOOLS' || actor.ultimate_effect.expires_tick <= sim.state.tick) return spec;
  const b = settings(sim).tools, hammer = spec.strong || spec.step === 2;
  return { ...spec, tool: hammer ? 'HAMMER' : 'SICKLE', range: b.range,
    damage: hammer ? b.hammer_damage : b.sickle_damage, knockback: hammer ? 0 : b.pull,
    strong: hammer, exact_damage: true };
}

export function applyToolHit(sim, actor, target, attack) {
  if (attack.tool === 'SICKLE') target.combat.knockback_velocity = -(attack.direction || actor.facing) * settings(sim).tools.pull;
  if (attack.tool === 'HAMMER') {
    target.combat.flatten_tick = sim.state.tick;
    target.combat.flatten_until_tick = sim.state.tick + seconds(sim, settings(sim).tools.flatten_seconds);
    target.combat.stun_ticks = Math.max(target.combat.stun_ticks, seconds(sim, .35));
  }
}

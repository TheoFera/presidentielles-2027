import { updateMobileCombat, successfulNormalHit, changeCharge, actionAllowed } from './mobile-combat.js';
import { activeCampaignStyle } from './campaign-styles.js';
import { startStyleUltimate, updateStyleTemporary, updateMolotov, updateStyleEffects } from './style-ultimates.js';
import { combatDelta, combatPosition } from './combat-geometry.js';
import { distance, stableIdOrder } from './territory.js';
import { moveNpcTowards } from './tasks.js';
import { combatActors, combatState, enemies, hit, interrupted, nearestEnemy } from './combat-state.js';

export function requestAttack(sim, actor, direction = null) {
  if (!actor || actor.eliminated || actor.role !== 'CANDIDAT' || !actor.campaign_active || actor.is_ko) return;
  actor.combat.buffer_until_tick = sim.state.tick + sim.secondsToTicks(sim.config.balance.candidate_combat.input_buffer_seconds);
  if ([-1, 1].includes(direction)) actor.combat.requested_direction = direction;
}

export function beginCombatTick(sim) {
  const { state, config, hz } = sim;
  updateMobileCombat(sim);
  for (const actor of combatActors(state)) {
    actor.moving = !!actor.dash_active;
    const c = actor.combat;
    if (sim.state.tick > c.combo_expires_tick) c.combo_step = 0;
    c.engaged = false;
    if (c.cooldown_ticks > 0) c.cooldown_ticks--;
    if (c.stun_ticks > 0) c.stun_ticks--;
    if (c.hitstop_ticks > 0) { c.hitstop_ticks--; continue; }
    if (Math.abs(c.knockback_velocity) > 0.02) {
      actor.x = combatPosition(state, actor.x + c.knockback_velocity / hz);
      c.knockback_velocity *= Math.max(0, 1 - config.balance.candidate_combat.knockback_decay_per_second / hz);
    } else c.knockback_velocity = 0;
  }
}

export function wallBlockedPosition(sim, actor, desired) {
  const d = combatDelta(sim.state, actor.x, desired);
  if (!d) return desired;
  const radius = sim.config.balance.specials.philippe_crs_wall.interception_radius;
  const guards = sim.state.temporary_units.filter(t => t.role === 'CRS' && enemies(actor, t));
  for (const guard of guards.sort((a, b) => distance(sim.state, actor.x, a.x) - distance(sim.state, actor.x, b.x))) {
    const ahead = combatDelta(sim.state, actor.x, guard.x) * Math.sign(d);
    if (ahead >= 0 && ahead <= Math.abs(d) + radius) return combatPosition(sim.state, actor.x + Math.sign(d) * Math.max(0, ahead - radius));
  }
  return desired;
}

function makeAttack(sim, actor, kind, spec) {
  const b = sim.config.balance.candidate_combat;
  const attack = { id: `attack:${sim.state.next_attack_id++}`, owner_id: actor.id, faction_id: actor.faction_id,
    kind, direction: actor.facing, elapsed_ticks: 0, hit_ids: [], launched: false, charged: false,
    windup_ticks: sim.secondsToTicks(spec.strong ? b.finisher_windup_seconds : b.light_windup_seconds),
    active_ticks: sim.secondsToTicks(b.active_seconds), recovery_ticks: sim.secondsToTicks(spec.strong ? b.finisher_recovery_seconds : b.light_recovery_seconds), ...spec };
  actor.combat.attack_id = attack.id;
  sim.state.attacks.push(attack);
  sim.emit('AttackStarted', { attack_id: attack.id, actor_id: actor.id, kind, combo_step: spec.step || 0 });
  return attack;
}

export function startNpcAttack(sim, actor, kind, settings) {
  if (interrupted(actor) || actor.combat.cooldown_ticks > 0) return;
  makeAttack(sim, actor, kind, settings);
  actor.combat.cooldown_ticks = sim.secondsToTicks(settings.cooldown_seconds);
}

function startCandidateAttack(sim, actor) {
  const c = actor.combat; const b = sim.config.balance;
  if (actor.campaign_arena_id || actor.crisis_meeting_id || actor.eliminated || c.buffer_until_tick < sim.state.tick || interrupted(actor) || !actor.campaign_active || actor.is_ko) return;
  c.buffer_until_tick = -1;
  if (c.requested_direction) actor.facing = c.requested_direction;
  c.requested_direction = null; actor.purchase_hold = null;
  c.combo_step = sim.state.tick > c.combo_expires_tick ? 1 : c.combo_step % 3 + 1;
  c.combo_expires_tick = sim.state.tick + sim.secondsToTicks(b.candidate_combat.combo_reset_seconds);
  const strong = c.combo_step === 3;
  const scarf = actor.ultimate_effect?.kind === 'SCARF' && actor.ultimate_effect.expires_tick > sim.state.tick;
  makeAttack(sim, actor, scarf ? 'SCARF' : 'CANDIDATE', { step: c.combo_step, strong,
    range: scarf ? b.specials.scarf.range : strong ? b.candidate_combat.finisher_range : b.candidate_combat.light_range,
    damage: scarf ? b.specials.scarf.damage : strong ? b.candidate_combat.finisher_hidden_damage : b.candidate_combat.light_hit_hidden_damage,
    knockback: scarf ? b.specials.scarf.knockback : strong ? b.candidate_combat.finisher_knockback : b.candidate_combat.light_knockback,
    electoral_damage: strong ? b.candidate_combat.electoral_damage_on_finisher_percent_points : b.candidate_combat.electoral_damage_on_light_hit_percent_points });
}

export function ultimateBlockedReason(sim, actor) {
  if (!actor || actor.eliminated || actor.is_ko || !actor.campaign_active) return 'Ultime indisponible : candidat hors combat.';
  if (!activeCampaignStyle(sim.config, actor)) return 'Choisis d’abord un style à ton QG.';
  if (actor.bardella_guardian_armed) return 'Bardellisation déjà armée : elle se déclenchera au prochain KO.';
  if (activeCampaignStyle(sim.config, actor).ultimate.kind === 'BARDELLA' && actor.bardellisation_used) return 'Bardellisation déjà utilisée pour cette vie.';
  if (actor.ultimate_effect) return 'Un effet d’ultime est encore actif.';
  if (actor.special_charge < sim.config.balance.special_charge.required_points) return `Ultime chargé à ${Math.floor(100 * actor.special_charge / sim.config.balance.special_charge.required_points)} % : touche des adversaires pour le recharger.`;
  if (actor.combat.attack_id) return 'Attaque en cours : appuie sur R après la fin du coup.';
  if (actor.dash_active) return 'Esquive en cours : appuie sur R après le dash.';
  if (actor.combat.stun_ticks > 0 || actor.combat.hitstop_ticks > 0 || Math.abs(actor.combat.knockback_velocity) > 0.02) return 'Impact ou étourdissement en cours : attends de reprendre le contrôle.';
  if (!actionAllowed(sim, actor)) return 'Interaction en cours : termine-la ou quitte la zone avant de lancer l’ultime.';
  return null;
}

export function activateUltimate(sim, actor) {
  if (ultimateBlockedReason(sim, actor)) return;
  const style = activeCampaignStyle(sim.config, actor);
  if (!style || style.ultimate.kind === 'BARDELLA' && actor.bardellisation_used) return;
  changeCharge(sim, actor, 0); actor.combat.combo_step = 0;
  actor.active_ultimate_id = style.ultimate.kind;
  sim.emit('UltimateActivated', { candidate_id: actor.id, kind: style.ultimate.kind });
  if (style.ultimate.kind === 'BARDELLA') { actor.bardella_guardian_armed = true; sim.emit('BardellaGuardianArmed', { candidate_id: actor.id }); return; }
  triggerSpecial(sim, actor);
}

function triggerSpecial(sim, actor) {
  const { state, config } = sim;
  const kind = activeCampaignStyle(config, actor)?.ultimate.kind;
  if (!kind) return;
  const power = { id: `power:${state.next_power_id++}`, owner_id: actor.id, faction_id: actor.faction_id, kind, started_tick: state.tick, expires_tick: state.tick };
  state.powers.push(power);
  if (startStyleUltimate(sim, actor, power)) {
    // New styles share the same authoritative power lifetime.
  } else if (kind === 'WAVE') {
    const s = config.balance.specials.le_pen_navy_wave;
    const range = s.range_screens * config.prototype.world.units_per_screen;
    power.expires_tick += sim.secondsToTicks(range / s.travel_speed);
    state.projectiles.push({ id: `projectile:${state.next_projectile_id++}`, power_id: power.id, owner_id: actor.id, faction_id: actor.faction_id,
      kind: 'WAVE', x: actor.x, direction: actor.facing, speed: s.travel_speed, remaining_range: range, hit_ids: [], damage: s.candidate_resistance_damage, knockback: s.knockback, electoral_damage: s.candidate_electoral_damage_percent_points });
  } else {
    const hologram = kind === 'HOLOGRAMS';
    const s = hologram ? config.balance.specials.melenchon_holograms : config.balance.specials.philippe_crs_wall;
    power.expires_tick += sim.secondsToTicks(s.duration_seconds + (hologram ? s.appearance_seconds : 0));
    const offsets = hologram ? Array.from({ length: s.count }, (_, i) => (i - (s.count - 1) / 2) * s.spawn_spacing)
      : [...Array.from({ length: s.guards_left }, (_, i) => -(i + 1) * s.follow_offset), ...Array.from({ length: s.guards_right }, (_, i) => (i + 1) * s.follow_offset)];
    for (const offset of offsets) state.temporary_units.push({ id: `temporary:${state.next_temporary_id++}`, power_id: power.id,
      owner_id: actor.id, role: hologram ? 'HOLOGRAMME' : 'CRS', faction_id: actor.faction_id, temporary: true, expired: false,
      x: combatPosition(state, actor.x + offset), follow_offset: offset, facing: Math.sign(offset) || actor.facing,
      moving: false, spawn_tick: state.tick, ready_tick: state.tick + sim.secondsToTicks(hologram ? s.appearance_seconds : 0), expires_tick: power.expires_tick, hidden_durability: hologram ? s.hidden_durability : s.guard_hidden_durability,
      combat: combatState(), persuasion_target_ids: [] });
  }
  // The same button consumes the power; a short recovery prevents double activation.
  makeAttack(sim, actor, 'SPECIAL', { strong: true, range: 0, damage: 0, knockback: 0, electoral_damage: 0 });
  sim.emit('SpecialTriggered', { power_id: power.id, candidate_id: actor.id, kind: power.kind });
}

function meleeTargets(sim, owner, attack) {
  const radius = sim.config.balance.candidate_combat.target_radius;
  return combatActors(sim.state).filter(t => enemies(owner, t) && !attack.hit_ids.includes(t.id)
    && combatDelta(sim.state, owner.x, t.x) * attack.direction >= -radius
    && distance(sim.state, owner.x, t.x) <= attack.range + radius)
    .sort((a, b) => distance(sim.state, owner.x, a.x) - distance(sim.state, owner.x, b.x) || stableIdOrder(a, b));
}

function updateAttacks(sim) {
  for (const attack of [...sim.state.attacks]) {
    if (sim.state.arena_bounds && sim.state.eliminated_faction) break;
    const actor = combatActors(sim.state).find(a => a.id === attack.owner_id);
    if (!actor || actor.combat.attack_id !== attack.id || !actor.faction_id || actor.expired) continue;
    if (actor.combat.hitstop_ticks > 0) continue;
    attack.elapsed_ticks++;
    if (attack.elapsed_ticks >= attack.windup_ticks && attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks) {
      if (attack.kind === 'VERBAL' && !attack.launched) {
        const s = sim.config.balance.physical_units.militant;
        sim.state.projectiles.push({ id: `projectile:${sim.state.next_projectile_id++}`, power_id: null, owner_id: actor.id, faction_id: actor.faction_id,
          kind: 'VERBAL', x: actor.x, direction: attack.direction, speed: s.projectile_speed, remaining_range: s.projectile_range,
          hit_ids: [], damage: s.verbal_damage, knockback: s.verbal_knockback, electoral_damage: s.verbal_attack_electoral_damage });
        attack.launched = true;
      } else if (!['VERBAL', 'SPECIAL'].includes(attack.kind) && (attack.kind === 'SCARF' || attack.hit_ids.length === 0)) {
        const targets = meleeTargets(sim, actor, attack);
        for (const target of (attack.kind === 'SCARF' ? targets : targets.slice(0, 1))) {
        if (target && hit(sim, actor, target, attack, attack.id)) {
          attack.hit_ids.push(target.id);
          if (attack.kind === 'CANDIDATE' && !attack.charged) { successfulNormalHit(sim, actor, target, attack); attack.charged = true; }
        }
        }
      }
    }
    if (attack.elapsed_ticks >= attack.windup_ticks + attack.active_ticks + attack.recovery_ticks) actor.combat.attack_id = null;
  }
  sim.state.attacks = sim.state.attacks.filter(a => combatActors(sim.state).some(t => t.id === a.owner_id && t.combat.attack_id === a.id && !t.expired));
}

function updateProjectiles(sim) {
  const { state, config } = sim;
  for (const p of state.projectiles) {
    if (state.arena_bounds && state.eliminated_faction) break;
    const owner = combatActors(state).find(a => a.id === p.owner_id);
    if (!owner || owner.faction_id !== p.faction_id || owner.expired) { p.remaining_range = 0; continue; }
    if (p.kind === 'BUBBLE') { const target = combatActors(state).find(t => t.id === p.target_id && enemies(owner,t)); if (target) p.direction = Math.sign(combatDelta(state,p.x,target.x)) || p.direction; }
    const step = Math.min(p.remaining_range, p.speed / sim.hz);
    if (updateMolotov(sim, p, step)) continue;
    const radius = config.balance.candidate_combat.target_radius;
    const targets = combatActors(state).filter(t => enemies(owner, t) && !p.hit_ids.includes(t.id)
      && (p.kind !== 'VERBAL' || t.role !== 'SYMPATHISANT')
      && combatDelta(state, p.x, t.x) * p.direction >= -radius
      && combatDelta(state, p.x, t.x) * p.direction <= step + radius)
      .sort((a, b) => distance(state, p.x, a.x) - distance(state, p.x, b.x) || stableIdOrder(a, b));
    for (const target of targets) {
      if (state.arena_bounds && state.eliminated_faction) break;
      let damage = p.damage;
      if (p.kind === 'WAVE') {
        const s = config.balance.specials.le_pen_navy_wave;
        if (target.role === 'SYMPATHISANT') damage = s.sympathisant_instant_demobilize ? target.hidden_durability : config.balance.physical_units.sympathisant.hidden_durability;
        else if (target.role === 'MILITANT') damage = config.balance.physical_units.militant.hidden_durability * s.militant_damage_fraction_of_full_durability;
        else if (target.role === 'SERVICE_D_ORDRE') damage = config.balance.physical_units.service_ordre.hidden_durability * s.service_ordre_damage_fraction_of_full_durability;
        else if (target.temporary) damage = config.balance.physical_units.service_ordre.hidden_durability * s.service_ordre_damage_fraction_of_full_durability;
      }
      hit(sim, owner, target, { ...p, damage, ranged: true, strong: p.kind === 'WAVE' }, p.id);
      p.hit_ids.push(target.id);
      if (['VERBAL', 'BUBBLE'].includes(p.kind)) { p.remaining_range = 0; break; }
    }
    const nextX = p.x + p.direction * step;
    p.x = combatPosition(state, nextX); p.remaining_range -= step;
    if (state.arena_bounds && p.x !== nextX) p.remaining_range = 0;
  }
  state.projectiles = state.projectiles.filter(p => p.remaining_range > 0);
}

function updateTemporaryUnits(sim) {
  const { state, config } = sim;
  for (const unit of state.temporary_units) {
    if (state.tick >= unit.expires_tick) unit.expired = true;
    const owner = state.candidates.find(c => c.id === unit.owner_id);
    if (!owner || owner.is_ko || owner.eliminated) { unit.expired = true; continue; }
    if (unit.expired || interrupted(unit) || state.tick < (unit.ready_tick || 0)) continue;
    if (updateStyleTemporary(sim, unit)) continue;
    const hologram = unit.role === 'HOLOGRAMME';
    const s = hologram ? config.balance.specials.melenchon_holograms : config.balance.specials.philippe_crs_wall;
    if (!hologram) moveNpcTowards(sim, unit, combatPosition(state, owner.x + unit.follow_offset), s.follow_speed);
    const target = nearestEnemy(state, unit, hologram ? s.detection_range : s.attack_range + config.balance.candidate_combat.target_radius);
    unit.combat.target_id = target?.id || null;
    if (!target) continue;
    const d = combatDelta(state, unit.x, target.x);
    unit.facing = Math.sign(d) || unit.facing;
    if (hologram && Math.abs(d) > s.attack_range) moveNpcTowards(sim, unit, target.x, s.move_speed);
    else if (Math.abs(d) <= s.attack_range + config.balance.candidate_combat.target_radius) startNpcAttack(sim, unit, hologram ? 'HOLOGRAM' : 'CRS', {
      range: s.attack_range, damage: hologram ? s.hidden_damage_per_hit : s.guard_hit_hidden_damage, knockback: hologram ? s.knockback : s.guard_knockback,
      electoral_damage: s.electoral_damage, cooldown_seconds: s.attack_cooldown_seconds });
  }
  const expiredOwners = new Set(state.temporary_units.filter(t => t.expired).map(t => t.id));
  state.projectiles = state.projectiles.filter(p => !expiredOwners.has(p.owner_id));
  state.temporary_units = state.temporary_units.filter(t => !t.expired);
  state.powers = state.powers.filter(p => p.expires_tick > state.tick);
}

export function updateMilitantCombat(sim, npc) {
  if (npc.task?.kind === 'COLLECT_EQUIPMENT') return false;
  const s = sim.config.balance.physical_units.militant;
  const target = nearestEnemy(sim.state, npc, s.detection_range, t => t.role !== 'SYMPATHISANT');
  npc.combat.target_id = target?.id || null;
  if (!target) return false;
  npc.combat.engaged = true;
  if (interrupted(npc)) return true;
  const d = combatDelta(sim.state, npc.x, target.x);
  npc.facing = Math.sign(d) || npc.facing;
  if (Math.abs(d) > s.verbal_range) moveNpcTowards(sim, npc, target.x, s.move_speed);
  else {
    if (Math.abs(d) < s.preferred_distance && !npc.combat.attack_id) moveNpcTowards(sim, npc, combatPosition(sim.state, npc.x - npc.facing * s.preferred_distance), s.move_speed);
    npc.facing = Math.sign(d) || npc.facing;
    startNpcAttack(sim, npc, 'VERBAL', { range: s.verbal_range, damage: s.verbal_damage, knockback: s.verbal_knockback,
      electoral_damage: s.verbal_attack_electoral_damage, cooldown_seconds: s.verbal_cooldown_seconds });
  }
  return true;
}

export function updateCombat(sim) {
  for (const c of [...sim.state.candidates].sort(stableIdOrder)) startCandidateAttack(sim, c);
  updateTemporaryUnits(sim);
  updateAttacks(sim);
  updateProjectiles(sim);
  updateStyleEffects(sim);
  const expiredIds = new Set(sim.state.temporary_units.filter(t => t.expired).map(t => t.id));
  sim.state.projectiles = sim.state.projectiles.filter(p => !expiredIds.has(p.owner_id));
  sim.state.temporary_units = sim.state.temporary_units.filter(t => !t.expired);
  sim.state.attacks = sim.state.attacks.filter(a => combatActors(sim.state).some(t => t.id === a.owner_id && t.combat.attack_id === a.id));
}

import { ALL_FACTIONS } from './world.js';
import { ULTIMATE_KINDS, MINOR_ULTIMATE_KINDS } from './minor-ultimate-catalog.js';
import { isPress } from './press-rules.js';

export function validateCombatSnapshot(state, sim, fail) {
  const integer = n => Number.isInteger(n) && n >= 0;
  const finite = n => Number.isFinite(n) && n >= 0;
  const position = x => finite(x) && x < state.world.length;
  const actors = [...state.candidates, ...state.npcs, ...state.temporary_units];
  const counterId = (id, prefix, counter) => typeof id === 'string' && new RegExp(`^${prefix}:[1-9]\\d*$`).test(id) && Number(id.split(':')[1]) < state[counter];
  for (const actor of actors) {
    const c = actor.combat;
    if (c?.raid_dash_ready_tick != null && !integer(c.raid_dash_ready_tick)) fail('rechargement de raid invalide');
    if (!c || ['stun_ticks', 'hitstop_ticks', 'cooldown_ticks', 'combo_expires_tick'].some(k => !integer(c[k]))
      || !Number.isInteger(c.combo_step) || c.combo_step < 0 || c.combo_step > 3 || !Number.isInteger(c.buffer_until_tick)
      || !Number.isFinite(c.knockback_velocity) || typeof c.engaged !== 'boolean' || ![null, -1, 1].includes(c.requested_direction)
      || (c.target_id !== null && typeof c.target_id !== 'string')) fail('état de combat invalide');
    if (![c.press_tick, c.jump_tick].every(v => v === null || integer(v) && v <= state.tick)
      || typeof c.charge_active !== 'boolean' || typeof c.press_airborne !== 'boolean'
      || !finite(c.height) || c.height > sim.config.balance.candidate_combat.jump_height_ratio
      || c.charge_active && (c.press_tick === null || c.jump_tick !== null)) fail('charge ou saut invalide');
    if (c.attack_id !== null && !state.attacks.some(a => a.id === c.attack_id && a.owner_id === actor.id)) fail('attaque d’unité incohérente');
    if (actor.role === 'CANDIDAT' && actor.special_charge > sim.config.balance.special_charge.required_points) fail('charge spéciale invalide');
    if (actor.role === 'CANDIDAT') {
      if (['dash_charges', 'dash_max_charges', 'dash_recharge_progress', 'dash_until_tick', 'dash_invulnerable_until_tick'].some(k => !integer(actor[k]))
        || actor.dash_max_charges !== sim.config.balance.dash.max_charges || actor.dash_charges > actor.dash_max_charges
        || actor.dash_recharge_progress >= sim.secondsToTicks(sim.config.balance.dash.recharge_seconds)
        || ![-1, 1].includes(actor.dash_direction) || ![undefined, -1, 0, 1].includes(actor.dash_buffer_direction) || actor.dash_buffer_until_tick !== undefined && !Number.isInteger(actor.dash_buffer_until_tick) || ['dash_active', 'dash_recharge_disabled', 'special_decay_started', 'bardella_guardian_armed'].some(k => typeof actor[k] !== 'boolean')
        || !Number.isInteger(actor.last_successful_hit_tick) || !finite(actor.special_decay_origin) || actor.special_decay_origin > sim.config.balance.special_charge.required_points
        || actor.special_threshold !== sim.config.balance.special_charge.required_points
        || actor.active_ultimate_id !== null && !ULTIMATE_KINDS.includes(actor.active_ultimate_id)) fail('dash ou momentum invalide');
      if (actor.reveal_tick != null && (!integer(actor.reveal_tick) || actor.reveal_tick > state.tick)
        || c.flatten_tick != null && (!integer(c.flatten_tick) || c.flatten_tick > state.tick || !integer(c.flatten_until_tick) || c.flatten_until_tick < c.flatten_tick)) fail('transition du candidat invalide');
    }
    if (actor.raid) {
      const raid = actor.raid;
      if (actor.role !== 'SERVICE_D_ORDRE' || !counterId(raid.id, 'raid', 'next_raid_id') || ![-1, 1].includes(raid.direction)
        || !integer(raid.started_tick) || raid.started_tick > state.tick || !['GATHER', 'OUTBOUND'].includes(raid.phase)
        // Le local d'origine peut avoir été perdu depuis : le raid, lui, continue.
        || raid.building_id !== null && !state.buildings.some(b => b.id === raid.building_id && b.type === 'faction')) fail('raid invalide');
    }
  }
  for (const unit of state.temporary_units) {
    if (isPress(unit)) {
      if (!state.press_team || !counterId(unit.id, 'temporary', 'next_temporary_id') || unit.faction_id !== 'press'
        || unit.temporary !== true || unit.expired !== false || !position(unit.x) || ![-1, 1].includes(unit.facing)
        || !finite(unit.hidden_durability) || !finite(unit.initial_durability) || unit.hidden_durability > unit.initial_durability
        || unit.initial_durability !== sim.config.balance.press_team[unit.role === 'PRESS_CAMERA' ? 'camera_hp' : 'reporter_hp']
        || !integer(unit.variant) || unit.variant > 2 || typeof unit.filming !== 'boolean' || typeof unit.press_ready !== 'boolean'
        || !integer(unit.aim_ticks) || !integer(unit.entry_tick) || unit.entry_tick > state.tick || !integer(unit.ready_tick)
        || unit.press_ready !== (state.press_team.phase === 'ACTIVE') || state.press_team.phase !== 'LEAVING' && unit.hidden_durability <= 0
        || !integer(unit.expires_tick) || unit.expires_tick <= state.tick || unit.owner_id !== state.press_team.target_id) fail('journaliste invalide');
      continue;
    }
    if (!counterId(unit.id, 'temporary', 'next_temporary_id') || !['HOLOGRAMME', 'CRS', 'ENCAPUCHONNE', 'ZEMMOUR'].includes(unit.role) || unit.temporary !== true || unit.expired !== false
      || !(unit.role === 'HOLOGRAMME' ? Number.isFinite(unit.x) : position(unit.x)) || ![-1, 1].includes(unit.facing) || !finite(unit.hidden_durability) || !Number.isFinite(unit.follow_offset)
      || !integer(unit.expires_tick) || unit.expires_tick <= state.tick || !state.powers.some(p => p.id === unit.power_id && p.owner_id === unit.owner_id)
      || unit.faction_id !== (unit.role === 'CRS' ? 'philippe' : unit.role === 'ZEMMOUR' ? 'le_pen' : 'melenchon')) fail('unité temporaire invalide');
  }
  for (const attack of state.attacks) {
    if (!counterId(attack.id, 'attack', 'next_attack_id') || !actors.some(a => a.id === attack.owner_id && a.faction_id === attack.faction_id && a.combat.attack_id === attack.id)
      || !['CANDIDATE', 'CHARGED', 'VERBAL', 'GUARD', 'RAID_DASH', 'HOLOGRAM', 'CRS', 'SPECIAL', 'SCARF', 'DIVE', 'MICROPHONE'].includes(attack.kind) || ![-1, 1].includes(attack.direction)
      || ['elapsed_ticks', 'windup_ticks', 'active_ticks', 'recovery_ticks'].some(k => !integer(attack[k]))
      || attack.elapsed_ticks >= attack.windup_ticks + attack.active_ticks + attack.recovery_ticks
      || ['range', 'damage', 'knockback', 'electoral_damage'].some(k => !finite(attack[k]))
      || !Array.isArray(attack.hit_ids) || new Set(attack.hit_ids).size !== attack.hit_ids.length) fail('attaque invalide');
  }
  const press = state.temporary_units.filter(isPress), group = state.press_team, director = state.press_director;
  if (group) {
    if (!director || press.length !== 2 || !['ENTRY', 'ACTIVE', 'LEAVING'].includes(group.phase)
      || !state.candidates.some(c => c.id === group.target_id && !c.minor)
      || !press.some(u => u.id === group.camera_id && u.role === 'PRESS_CAMERA')
      || !press.some(u => u.id === group.reporter_id && u.role === 'PRESS_REPORTER')
      || ![-1, 1].includes(group.direction) || !integer(group.started_tick) || group.started_tick > state.tick
      || group.phase === 'ACTIVE' && (!integer(group.active_tick) || group.active_tick > state.tick)
      || group.phase === 'LEAVING' && (!integer(group.leave_tick) || group.leave_tick > state.tick)) fail('groupe de reportage invalide');
  } else if (press.length) fail('journalistes sans groupe');
  if (director && (!integer(director.count) || director.count > sim.config.balance.press_team.max_interventions
    || !integer(director.next_tick) || !integer(director.next_check_tick) || !integer(director.eligible_since)
    || !director.by_candidate || Object.entries(director.by_candidate).some(([id,count]) => !state.candidates.some(c => c.id === id && !c.minor)
      || !integer(count) || count > sim.config.balance.press_team.max_per_candidate)
    || director.warning && (!state.candidates.some(c => c.id === director.warning.target_id) || !integer(director.warning.tick)
      || !integer(director.warning.spawn_tick) || director.warning.spawn_tick < director.warning.tick))) fail('calendrier des reportages invalide');
  for (const actor of actors) {
    for (const value of [actor.combat.jump_delay_ticks, actor.combat.press_delay_ticks, actor.dash_delay_fraction])
      if (value != null && !finite(value)) fail('horloge de ralentissement invalide');
  }
  for (const attack of state.attacks) if (attack.speed_fraction != null && (!finite(attack.speed_fraction) || attack.speed_fraction >= 1)) fail('cadence de frappe invalide');
  for (const attack of state.attacks) if (attack.micro_hold_until_tick != null
    && (attack.kind !== 'MICROPHONE' || !integer(attack.micro_hold_until_tick))) fail('maintien du micro invalide');
  for (const attack of state.attacks) if (attack.kind === 'RAID_DASH') {
    const owner = actors.find(a => a.id === attack.owner_id);
    if (owner.role !== 'SERVICE_D_ORDRE' || !owner.raid || typeof attack.target_id !== 'string'
      || !integer(attack.dash_ticks) || attack.dash_ticks < 1
      || !finite(attack.dash_distance) || attack.dash_distance <= 0 || !finite(attack.dash_remaining)
      || attack.dash_remaining > attack.dash_distance || !finite(attack.contact_range) || attack.contact_range <= 0) fail('dash de raid invalide');
  }
  for (const projectile of state.projectiles) {
    if (!counterId(projectile.id, 'projectile', 'next_projectile_id') || !['VERBAL', 'WAVE', 'BUBBLE', 'MOLOTOV'].includes(projectile.kind) || !ALL_FACTIONS.includes(projectile.faction_id)
      || !actors.some(a => a.id === projectile.owner_id) || !position(projectile.x) || ![-1, 1].includes(projectile.direction)
      || ['speed', 'remaining_range', 'damage', 'knockback', 'electoral_damage'].some(k => !finite(projectile[k])) || projectile.remaining_range <= 0
      || !Array.isArray(projectile.hit_ids) || new Set(projectile.hit_ids).size !== projectile.hit_ids.length) fail('projectile invalide');
  }
  for (const power of state.powers) {
    if (!counterId(power.id, 'power', 'next_power_id') || !ULTIMATE_KINDS.includes(power.kind)
      || !state.candidates.some(c => c.id === power.owner_id && c.faction_id === power.faction_id) || !integer(power.started_tick) || power.started_tick > state.tick
      || !integer(power.expires_tick) || power.expires_tick <= state.tick) fail('pouvoir invalide');
    if (MINOR_ULTIMATE_KINDS.includes(power.kind)) validateMinorPower(power, state, { integer, finite, position }, fail);
  }
  for (const result of state.hit_results) {
    if (!counterId(result.id, 'hit', 'next_hit_id') || !integer(result.tick) || result.tick > state.tick || !position(result.x)
      || ['damage', 'electoral_damage', 'knockback'].some(k => !finite(result[k])) || ![-1, 1].includes(result.direction)) fail('résultat de coup invalide');
  }
}

function validateMinorPower(p, state, check, fail) {
  const { integer, finite, position } = check;
  const ids = values => Array.isArray(values) && values.every(id => typeof id === 'string') && new Set(values).size === values.length;
  const owner = state.candidates.find(c => c.id === p.owner_id);
  const kinds = { roussel: 'SAUSAGE', dupont_aignan: 'INVISIBLE', glucksmann: 'DELIVERY', arthaud: 'TOOLS', retailleau: 'BARRIER', attal: 'SATCHEL' };
  if (kinds[owner?.faction_id] !== p.kind || !position(p.x) || ![-1, 1].includes(p.direction)) fail('ultime secondaire incohérent');
  if (p.kind === 'SAUSAGE' && (!finite(p.height) || !finite(p.travelled) || typeof p.returning !== 'boolean'
    || p.launch_tick != null && !integer(p.launch_tick) || p.launched != null && typeof p.launched !== 'boolean'
    || p.caught_tick != null && (!integer(p.caught_tick) || p.caught_tick > state.tick || !p.returning)
    || ['launch_x', 'turn_x'].some(key => p[key] != null && !position(p[key]))
    || ['turn_tick', 'catch_started_tick'].some(key => p[key] != null && (!integer(p[key]) || p[key] > state.tick))
    || ['launch_height', 'catch_start_distance'].some(key => p[key] != null && !finite(p[key]))
    || ![p.hit_ids, p.return_hit_ids, p.carried_ids].every(ids))) fail('saucisse invalide');
  if (p.kind === 'DELIVERY' && (!Array.isArray(p.impacts) || p.impacts.length !== 3 || p.impacts.some(drop => !position(drop.x) || !integer(drop.tick) || typeof drop.done !== 'boolean'
    || drop.launch_tick != null && (!integer(drop.launch_tick) || drop.launch_tick < p.started_tick || drop.launch_tick >= drop.tick)))) fail('livraison invalide');
  if (p.kind === 'BARRIER' && (!finite(p.base_height) || !integer(p.fall_tick) || !ids(p.hit_ids))) fail('mur invalide');
  if (p.kind === 'SATCHEL' && (!integer(p.launch_tick) || !position(p.target_x) || p.target_id !== null && typeof p.target_id !== 'string'
    || typeof p.launched !== 'boolean' || typeof p.landed !== 'boolean' || !finite(p.height) || !finite(p.initial_range) || !finite(p.remaining_range)
    || p.detonated_tick != null && (!integer(p.detonated_tick) || p.detonated_tick > state.tick))) fail('cartable invalide');
}

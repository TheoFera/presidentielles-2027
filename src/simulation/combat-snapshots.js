import { FACTIONS } from './world.js';

export function validateCombatSnapshot(state, sim, fail) {
  const integer = n => Number.isInteger(n) && n >= 0;
  const finite = n => Number.isFinite(n) && n >= 0;
  const position = x => finite(x) && x < state.world.length;
  const actors = [...state.candidates, ...state.npcs, ...state.temporary_units];
  const counterId = (id, prefix, counter) => typeof id === 'string' && new RegExp(`^${prefix}:[1-9]\\d*$`).test(id) && Number(id.split(':')[1]) < state[counter];
  for (const actor of actors) {
    const c = actor.combat;
    if (!c || ['stun_ticks', 'hitstop_ticks', 'cooldown_ticks', 'combo_expires_tick'].some(k => !integer(c[k]))
      || !Number.isInteger(c.combo_step) || c.combo_step < 0 || c.combo_step > 3 || !Number.isInteger(c.buffer_until_tick)
      || !Number.isFinite(c.knockback_velocity) || typeof c.engaged !== 'boolean' || ![null, -1, 1].includes(c.requested_direction)
      || (c.target_id !== null && typeof c.target_id !== 'string')) fail('état de combat invalide');
    if (c.attack_id !== null && !state.attacks.some(a => a.id === c.attack_id && a.owner_id === actor.id)) fail('attaque d’unité incohérente');
    if (actor.role === 'CANDIDAT' && actor.special_charge > sim.config.balance.special_charge.required_points) fail('charge spéciale invalide');
    if (actor.raid) {
      const raid = actor.raid;
      if (actor.role !== 'SERVICE_D_ORDRE' || !counterId(raid.id, 'raid', 'next_raid_id') || ![-1, 1].includes(raid.direction)
        || !integer(raid.started_tick) || !integer(raid.expires_tick) || raid.expires_tick < raid.started_tick || !['OUTBOUND', 'RETURN'].includes(raid.phase)
        || !state.buildings.some(b => b.id === raid.building_id && b.variant === 'service_ordre' && b.owner_id === actor.faction_id)) fail('raid invalide');
    }
  }
  for (const unit of state.temporary_units) {
    if (!counterId(unit.id, 'temporary', 'next_temporary_id') || !['HOLOGRAMME', 'CRS'].includes(unit.role) || unit.temporary !== true || unit.expired !== false
      || !position(unit.x) || ![-1, 1].includes(unit.facing) || !finite(unit.hidden_durability) || !Number.isFinite(unit.follow_offset)
      || !integer(unit.expires_tick) || unit.expires_tick <= state.tick || !state.powers.some(p => p.id === unit.power_id && p.owner_id === unit.owner_id)
      || unit.faction_id !== (unit.role === 'CRS' ? 'philippe' : 'melenchon')) fail('unité temporaire invalide');
  }
  for (const attack of state.attacks) {
    if (!counterId(attack.id, 'attack', 'next_attack_id') || !actors.some(a => a.id === attack.owner_id && a.faction_id === attack.faction_id && a.combat.attack_id === attack.id)
      || !['CANDIDATE', 'VERBAL', 'GUARD', 'HOLOGRAM', 'CRS', 'SPECIAL'].includes(attack.kind) || ![-1, 1].includes(attack.direction)
      || ['elapsed_ticks', 'windup_ticks', 'active_ticks', 'recovery_ticks'].some(k => !integer(attack[k]))
      || attack.elapsed_ticks >= attack.windup_ticks + attack.active_ticks + attack.recovery_ticks
      || ['range', 'damage', 'knockback', 'electoral_damage'].some(k => !finite(attack[k]))
      || !Array.isArray(attack.hit_ids) || new Set(attack.hit_ids).size !== attack.hit_ids.length) fail('attaque invalide');
  }
  for (const projectile of state.projectiles) {
    if (!counterId(projectile.id, 'projectile', 'next_projectile_id') || !['VERBAL', 'WAVE'].includes(projectile.kind) || !FACTIONS.includes(projectile.faction_id)
      || !actors.some(a => a.id === projectile.owner_id) || !position(projectile.x) || ![-1, 1].includes(projectile.direction)
      || ['speed', 'remaining_range', 'damage', 'knockback', 'electoral_damage'].some(k => !finite(projectile[k])) || projectile.remaining_range <= 0
      || !Array.isArray(projectile.hit_ids) || new Set(projectile.hit_ids).size !== projectile.hit_ids.length) fail('projectile invalide');
  }
  for (const power of state.powers) {
    if (!counterId(power.id, 'power', 'next_power_id') || !['HOLOGRAMS', 'WAVE', 'WALL'].includes(power.kind)
      || !state.candidates.some(c => c.id === power.owner_id && c.faction_id === power.faction_id) || !integer(power.started_tick) || power.started_tick > state.tick
      || !integer(power.expires_tick) || power.expires_tick <= state.tick) fail('pouvoir invalide');
  }
  for (const result of state.hit_results) {
    if (!counterId(result.id, 'hit', 'next_hit_id') || !integer(result.tick) || result.tick > state.tick || !position(result.x)
      || ['damage', 'electoral_damage', 'knockback'].some(k => !finite(result[k])) || ![-1, 1].includes(result.direction)) fail('résultat de coup invalide');
  }
}

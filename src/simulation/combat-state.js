import { actionState, armored, cancelCharge, charging, verticalHit } from './combat-actions.js';
import { clearCampaignUltimate } from './campaign-styles.js';
import { tryBardellisation } from './style-ultimates.js';
import { combatDelta, combatPosition } from './combat-geometry.js';
import { stableIdOrder } from './territory.js';
import { leadership, refreshElectoralState } from './electoral-state.js';
import { localUnitDamageMultiplier } from './strategic-sites.js';
import { random } from './world.js';

export const combatState = () => ({ ...actionState(), attack_id: null, stun_ticks: 0, hitstop_ticks: 0, cooldown_ticks: 0, knockback_velocity: 0,
  combo_step: 0, combo_expires_tick: 0, buffer_until_tick: -1, requested_direction: null, target_id: null, engaged: false, last_hit: null });
export const combatActors = state => [...state.candidates.filter(c => !c.eliminated && !c.campaign_arena_id), ...state.npcs, ...state.temporary_units];
export const canBeHit = actor => actor && actor.faction_id && !actor.eliminated && !actor.campaign_arena_id && !actor.is_ko && !['NEUTRE', 'DEMOBILISE'].includes(actor.role) && !actor.expired;
export const enemies = (a, b) => a.id !== b.id && canBeHit(a) && canBeHit(b) && a.faction_id !== b.faction_id;
export const interrupted = actor => actor.combat && (charging(actor) || actor.dash_active || actor.combat.stun_ticks > 0 || actor.combat.hitstop_ticks > 0 || !!actor.combat.attack_id);
export const movementBlocked = actor => actor.combat && (actor.combat.charge_active || actor.dash_active || actor.combat.stun_ticks > 0 || actor.combat.hitstop_ticks > 0 || !!actor.combat.attack_id && actor.combat.jump_tick == null);
export const canCampaign = actor => actor.combat?.jump_tick == null && !actor.style_hold && !actor.style_interaction_held && !actor.campaign_arena_id && !actor.crisis_meeting_id && !actor.is_ko && !interrupted(actor) && !actor.combat?.engaged && !['COLLECT_EQUIPMENT'].includes(actor.task?.kind);

export function controlledZones(state, config, faction) {
  return state.electorate.filter(e => leadership(e.support, config).controller === faction);
}

export function electoralDamage(sim, faction, amount) {
  const zones = controlledZones(sim.state, sim.config, faction);
  const total = zones.reduce((s, e) => s + e.support[faction], 0);
  let removed = 0;
  for (const zone of zones) {
    const loss = Math.min(zone.support[faction], amount * zone.support[faction] / total);
    zone.support[faction] -= loss; zone.support.neutral += loss; removed += loss;
  }
  refreshElectoralState(sim.state, sim.config);
  return removed;
}

export function demobilizeUnit(sim, npc) {
  if (!['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(npc.role)) return;
  const oldFaction = npc.faction_id;
  const velocity = npc.combat?.knockback_velocity || 0;
  npc.role = 'DEMOBILISE'; npc.faction_id = null; npc.hidden_durability = 0; npc.persuasion = null;
  npc.task = null; npc.raid = null; npc.persuasion_target_ids = []; npc.combat = combatState();
  npc.combat.knockback_velocity = velocity; npc.demobilized_tick = sim.state.tick;
  // Sample once, using the saved RNG, and keep the destination throughout the return.
  const point = sim.state.world.socialPoints.find(p => p.id === npc.origin_social_point_id);
  const zone = sim.state.world.subzones.find(z => z.id === npc.origin_subzone_id);
  const margin = sim.config.prototype.world.arrival_epsilon_units;
  const spread = sim.config.prototype.world.respawn_spread_units;
  const min = Math.max(zone.start + margin, point.x - spread), max = Math.min(zone.end - margin, point.x + spread);
  npc.roam_target_x = min + random(sim.state) * (max - min);
  for (const building of sim.state.buildings) for (const order of building.queue) if (order.assigned_npc_id === npc.id) order.assigned_npc_id = null;
  for (const neutral of sim.state.npcs) if (neutral.persuasion?.actor_id === npc.id) neutral.persuasion = null;
  for (const actor of combatActors(sim.state)) actor.persuasion_target_ids = actor.persuasion_target_ids?.filter(id => id !== npc.id) || [];
  sim.state.attacks = sim.state.attacks.filter(a => a.owner_id !== npc.id);
  sim.emit('NpcDemobilized', { npc_id: npc.id, previous_faction_id: oldFaction });
}

/** The simulation computes every hit; the renderer never chooses a victim. */
export function hit(sim, source, target, spec, attackId) {
  if (!enemies(source, target) || sim.state.arena_bounds && sim.state.eliminated_faction) return null;
  if (!verticalHit(sim.config, source, target, spec)) return null;
  const { state, config } = sim;
  if (target.dash_active && state.tick <= target.dash_invulnerable_until_tick) { sim.emit('DashEvadedHit', { candidate_id: target.id, attack_id: attackId }); return null; }
  const protectedHit = armored(state, target) && !(spec.step === 3 && ['CANDIDATE', 'SCARF'].includes(spec.kind));
  const retaliate = target.role === 'CANDIDAT' && target.ultimate_effect?.kind === 'EUROPE' && target.ultimate_effect.expires_tick > state.tick && !spec.ranged && !spec.retaliation;
  let revived = false;
  const direction = spec.direction || Math.sign(combatDelta(state, source.x, target.x)) || source.facing;
  const result = { id: `hit:${state.next_hit_id++}`, tick: state.tick, attack_id: attackId,
    source_id: source.id, target_id: target.id, damage: 0, electoral_damage: 0, knockback: spec.knockback, direction, x: target.x, height: target.combat.height || 0, strong: !!spec.strong };
  if (target.role === 'CANDIDAT' && state.arena_bounds) {
    const damage = config.balance.first_round_arena.damage;
    const key = spec.kind === 'CHARGED' ? 'charged' : spec.kind === 'WAVE' ? 'wave' : spec.kind === 'HOLOGRAM' ? 'hologram' : spec.kind === 'CRS' ? 'crs' : spec.strong ? 'heavy' : spec.step === 2 ? 'light_2' : 'light_1';
    const dealt = source.presentation_name === 'Journaliste' ? (source.journalist_damage ?? 1) : damage[key] * (state.campaign_damage_multiplier || 1);
    result.damage = Math.min(target.arena_hp, dealt);
    result.score_damage = result.damage; result.arena_hp_before = target.arena_hp;
    target.arena_hp = Math.max(0, target.arena_hp - dealt); result.arena_hp_after = target.arena_hp;
    target.hits_received++; state.candidate_hit_count++;
    if (target.arena_hp === 0) { revived = tryBardellisation(sim, target); if (!revived) { clearCampaignUltimate(sim,target,true); state.eliminated_faction = target.faction_id; } }
  } else if (target.role === 'CANDIDAT') {
    const before = controlledZones(state, config, target.faction_id).map(e => ({ subzone_id: e.subzone_id, support: { ...e.support }, controller: leadership(e.support, config).controller }));
    result.electoral_damage = electoralDamage(sim, target.faction_id, spec.electoral_damage || 0);
    result.electoral_changes = before.map(e => { const after = state.electorate.find(z => z.subzone_id === e.subzone_id);
      return { subzone_id: e.subzone_id, before: e.support, after: { ...after.support }, controller_before: e.controller, controller_after: after.controller }; });
    target.electoral_damage_received += result.electoral_damage;
    target.hits_received++;
    result.damage = Math.min(target.resistance, spec.damage || 0);
    target.resistance = Math.max(0, target.resistance - result.damage); target.last_damage_tick = state.tick;
    if (target.resistance === 0 && !target.is_ko) revived = tryBardellisation(sim, target);
    if (target.resistance === 0 && !target.is_ko && !revived) {
      clearCampaignUltimate(sim, target, true);
      const koLoss = electoralDamage(sim, target.faction_id, config.balance.candidate_combat.ko_electoral_damage_percent_points);
      result.electoral_damage += koLoss; target.electoral_damage_received += koLoss;
      target.is_ko = true; target.axis = 0; target.campaign_active = false; target.interaction_active = false; target.purchase_hold = null;
      target.ko_started_tick = state.tick; target.disappear_tick = state.tick + sim.secondsToTicks(config.balance.candidate_combat.ko_fall_seconds + config.balance.candidate_combat.ko_ground_seconds);
      target.respawn_tick = state.tick + sim.secondsToTicks(config.balance.candidate_combat.ko_respawn_seconds);
      sim.emit('CandidateKO', { candidate_id: target.id, electoral_damage: koLoss });
    }
  } else {
    const multiplier = localUnitDamageMultiplier(state, config, target);
    result.damage = Math.min(target.hidden_durability, spec.damage * multiplier);
    target.hidden_durability = Math.max(0, target.hidden_durability - result.damage);
  }
  if (!protectedHit && spec.knockback > 0) target.combat.knockback_velocity = direction * Math.max(Math.abs(target.combat.knockback_velocity), spec.knockback);
  if (!protectedHit) target.combat.stun_ticks = Math.max(target.combat.stun_ticks, sim.secondsToTicks(spec.stun_seconds ?? config.balance.candidate_combat.hit_stun_seconds));
  const stop = spec.no_hitstop ? 0 : sim.secondsToTicks(spec.strong ? config.balance.candidate_combat.finisher_hitstop_seconds : config.balance.candidate_combat.light_hitstop_seconds);
  if (!protectedHit) target.combat.hitstop_ticks = Math.max(target.combat.hitstop_ticks, stop);
  source.combat.hitstop_ticks = Math.max(source.combat.hitstop_ticks, stop);
  source.combat.last_hit = result; target.combat.last_hit = result;
  source.combat.target_id = target.id;
  if (!protectedHit && spec.kind !== 'BURN') { target.combat.attack_id = null; target.combat.buffer_until_tick = -1; cancelCharge(target); }
  if (protectedHit) result.knockback = 0;
  if (target.role === 'CANDIDAT') { target.purchase_hold = null; target.style_hold = null; target.style_interaction_held = false; }
  if (revived) { target.combat = combatState(); target.axis = 0; }
  if (target.role !== 'CANDIDAT' && target.hidden_durability <= 0) {
    if (target.temporary) { target.expired = true; target.combat.attack_id = null; }
    else demobilizeUnit(sim, target);
  }
  state.hit_results.push(result);
  if (state.arena_bounds) state.hit_count++;
  if (state.hit_results.length > config.balance.debug.combat_history_limit) state.hit_results.shift();
  sim.emit('HitResolved', result);
  if (retaliate && !target.is_ko && canBeHit(source)) {
    const s = config.balance.specials.europe;
    hit(sim, target, source, { kind: 'RETALIATION', retaliation: true, ultimate: true, ranged: true, damage: s.retaliation_damage, knockback: s.knockback, stun_seconds: s.stun_seconds }, `riposte:${result.id}`);
  }
  return result;
}

export function nearestEnemy(state, actor, range, predicate = () => true) {
  return combatActors(state).filter(target => enemies(actor, target) && predicate(target)
    && Math.abs(combatDelta(state, actor.x, target.x)) <= range)
    .sort((a, b) => Math.abs(combatDelta(state, actor.x, a.x)) - Math.abs(combatDelta(state, actor.x, b.x)) || stableIdOrder(a, b))[0] || null;
}

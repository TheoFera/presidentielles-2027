import { FACTIONS, ringDelta } from './world.js';
import { stableIdOrder } from './territory.js';

export const combatState = () => ({ attack_id: null, stun_ticks: 0, hitstop_ticks: 0, cooldown_ticks: 0, knockback_velocity: 0,
  combo_step: 0, combo_expires_tick: 0, buffer_until_tick: -1, requested_direction: null, target_id: null, engaged: false, last_hit: null });
export const combatActors = state => [...state.candidates, ...state.npcs, ...state.temporary_units];
export const canBeHit = actor => actor && actor.faction_id && !['NEUTRE', 'DEMOBILISE'].includes(actor.role) && !actor.expired;
export const enemies = (a, b) => a.id !== b.id && canBeHit(a) && canBeHit(b) && a.faction_id !== b.faction_id;
export const interrupted = actor => actor.combat && (actor.combat.stun_ticks > 0 || actor.combat.hitstop_ticks > 0 || !!actor.combat.attack_id);
export const canCampaign = actor => !interrupted(actor) && !actor.combat?.engaged && !['COLLECT_EQUIPMENT'].includes(actor.task?.kind);

export function controlledZones(state, config, faction) {
  return state.electorate.filter(e => e.support[faction] >= config.balance.influence.control_min_leader_percent
    && FACTIONS.filter(f => f !== faction).every(f => e.support[faction] - e.support[f] >= config.balance.influence.control_required_lead_points));
}

export function electoralDamage(sim, faction, amount) {
  const zones = controlledZones(sim.state, sim.config, faction);
  const total = zones.reduce((s, e) => s + e.support[faction], 0);
  let removed = 0;
  for (const zone of zones) {
    const loss = Math.min(zone.support[faction], amount * zone.support[faction] / total);
    zone.support[faction] -= loss; zone.support.neutral += loss; removed += loss;
  }
  return removed;
}

export function demobilizeUnit(sim, npc) {
  if (!['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(npc.role)) return;
  const oldFaction = npc.faction_id;
  const velocity = npc.combat?.knockback_velocity || 0;
  npc.role = 'DEMOBILISE'; npc.faction_id = null; npc.hidden_durability = 0; npc.persuasion = null;
  npc.task = null; npc.raid = null; npc.persuasion_target_ids = []; npc.combat = combatState();
  npc.combat.knockback_velocity = velocity; npc.demobilized_tick = sim.state.tick;
  for (const building of sim.state.buildings) for (const order of building.queue) if (order.assigned_npc_id === npc.id) order.assigned_npc_id = null;
  for (const neutral of sim.state.npcs) if (neutral.persuasion?.actor_id === npc.id) neutral.persuasion = null;
  for (const actor of combatActors(sim.state)) actor.persuasion_target_ids = actor.persuasion_target_ids?.filter(id => id !== npc.id) || [];
  sim.state.attacks = sim.state.attacks.filter(a => a.owner_id !== npc.id);
  sim.emit('NpcDemobilized', { npc_id: npc.id, previous_faction_id: oldFaction });
}

/** The simulation computes every hit; the renderer never chooses a victim. */
export function hit(sim, source, target, spec, attackId) {
  if (!enemies(source, target)) return null;
  const { state, config } = sim;
  const direction = spec.direction || Math.sign(ringDelta(source.x, target.x, state.world.length)) || source.facing;
  const result = { id: `hit:${state.next_hit_id++}`, tick: state.tick, attack_id: attackId,
    source_id: source.id, target_id: target.id, damage: 0, electoral_damage: 0, knockback: spec.knockback, direction, x: target.x, strong: !!spec.strong };
  if (target.role === 'CANDIDAT') {
    result.electoral_damage = electoralDamage(sim, target.faction_id, spec.electoral_damage || 0);
    target.electoral_damage_received += result.electoral_damage;
    target.hits_received++;
  } else {
    result.damage = Math.min(target.hidden_durability, spec.damage);
    target.hidden_durability = Math.max(0, target.hidden_durability - spec.damage);
  }
  target.combat.knockback_velocity = direction * Math.max(Math.abs(target.combat.knockback_velocity), spec.knockback);
  target.combat.stun_ticks = Math.max(target.combat.stun_ticks, sim.secondsToTicks(config.balance.candidate_combat.hit_stun_seconds));
  const stop = sim.secondsToTicks(spec.strong ? config.balance.candidate_combat.finisher_hitstop_seconds : config.balance.candidate_combat.light_hitstop_seconds);
  target.combat.hitstop_ticks = Math.max(target.combat.hitstop_ticks, stop);
  source.combat.hitstop_ticks = Math.max(source.combat.hitstop_ticks, stop);
  source.combat.last_hit = result; target.combat.last_hit = result;
  source.combat.target_id = target.id;
  target.combat.attack_id = null;
  if (target.role === 'CANDIDAT') target.purchase_hold = null;
  if (target.role !== 'CANDIDAT' && target.hidden_durability <= 0) {
    if (target.temporary) { target.expired = true; target.combat.attack_id = null; }
    else demobilizeUnit(sim, target);
  }
  state.hit_results.push(result);
  if (state.hit_results.length > config.balance.debug.combat_history_limit) state.hit_results.shift();
  sim.emit('HitResolved', result);
  return result;
}

export function nearestEnemy(state, actor, range, predicate = () => true) {
  return combatActors(state).filter(target => enemies(actor, target) && predicate(target)
    && Math.abs(ringDelta(actor.x, target.x, state.world.length)) <= range)
    .sort((a, b) => Math.abs(ringDelta(actor.x, a.x, state.world.length)) - Math.abs(ringDelta(actor.x, b.x, state.world.length)) || stableIdOrder(a, b))[0] || null;
}

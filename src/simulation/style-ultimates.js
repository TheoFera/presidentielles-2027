import { activeCampaignStyle, clearCampaignUltimate } from './campaign-styles.js';
import { combatActors, combatState, enemies, hit, nearestEnemy } from './combat-state.js';
import { combatDelta, combatPosition } from './combat-geometry.js';

// Independent, seeded choices: replaying a saved tick gives the same movement
// without adding fields to snapshots or consuming the global AI random stream.
export function surgeMotionPlan(state, unit, hz) {
  const salt=[...`${state.seed}:${unit.id}`].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
  const interval=Math.max(3,Math.round(hz*(.18+(salt%23)/100)));
  const age=Math.max(0,state.tick-unit.ready_tick);
  let value=(salt^Math.imul(Math.floor(age/interval)+1,0x9e3779b9))>>>0;
  value=Math.imul(value^(value>>>16),0x45d9f3b)>>>0;
  value=(value^(value>>>16))>>>0;
  return { direction:value&1?1:-1, speed:.6+((value>>>1)%71)/100, pause:(value>>>9)%9===0, pursue:(value>>>13)%3===0 };
}

function surgeTurns(seed, id, startTick, roamingTicks) {
  const index=Number(id.split(':').at(-1))||0,count=3+(index%2),ticks=[];
  for(let turn=1;turn<=count;turn++) {
    const salt=[...`${seed}:${id}:${turn}`].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
    const base=turn/(count+1),jitter=((salt%101)/100-.5)*.12;
    ticks.push(startTick+Math.round(roamingTicks*(base+jitter)));
  }
  return ticks.sort((a,b)=>a-b);
}

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
    const readyTick=sim.state.tick+sim.secondsToTicks(s.appearance_seconds);
    const returnTick=readyTick+sim.secondsToTicks(s.duration_seconds);
    power.return_tick=returnTick;
    power.expires_tick=returnTick+sim.secondsToTicks(s.return_seconds);
    for (let i = 0; i < s.count; i++) {
      const unit=temporary(sim,actor,power,'ENCAPUCHONNE',actor.x-actor.facing*.08,9999,
        { spawn_tick:sim.state.tick,ready_tick:readyTick,return_tick:returnTick,contact_ticks:{},sweep_origin:actor.x,
          sweep_direction:i%2?1:-1,surge_segment:0,surge_index:i });
      unit.surge_turn_ticks=surgeTurns(sim.state.seed,unit.id,readyTick,returnTick-readyTick);
    }
  } else if (power.kind === 'ZEMMOUR') {
    const s = settings.zemmour;
    power.expires_tick += sim.secondsToTicks(s.duration_seconds);
    temporary(sim, actor, power, 'ZEMMOUR', actor.x - actor.facing * 1.5, s.durability, { next_shot_tick: sim.state.tick, shot_count: 0 });
  } else if (power.kind === 'FIRE') {
    const target = nearestEnemy(sim.state,actor,sim.state.world.length,t=>t.role==='CANDIDAT')
      || nearestEnemy(sim.state,actor,sim.state.world.length);
    const targetX = target?.x ?? combatPosition(sim.state, actor.x + actor.facing * 6);
    const delta = combatDelta(sim.state, actor.x, targetX), travel = Math.max(0.1, Math.abs(delta));
    const launchTick=sim.state.tick+sim.secondsToTicks(settings.fire.launch_delay_seconds);
    power.expires_tick += sim.secondsToTicks(settings.fire.launch_delay_seconds+travel/settings.fire.projectile_speed+settings.fire.duration_seconds+settings.fire.burn_seconds);
    createStyleProjectile(sim,actor,power,'MOLOTOV',settings.fire,{target_id:target?.id??null,target_x:targetX,direction:Math.sign(delta)||actor.facing,
      remaining_range:travel,initial_range:travel,launch_tick:launchTick,launched:false});
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
    const s = config.balance.specials.surge;
    const owner=state.candidates.find(candidate=>candidate.id===unit.owner_id);
    if(!owner)return true;
    if(state.tick<unit.ready_tick){unit.x=combatPosition(state,owner.x-owner.facing*.08);unit.moving=false;return true;}
    if(state.tick>=unit.return_tick){
      const destination=combatPosition(state,owner.x-owner.facing*.08),delta=combatDelta(state,unit.x,destination);
      unit.facing=Math.sign(delta)||owner.facing;unit.moving=Math.abs(delta)>.08;
      const step=s.return_speed/sim.hz;
      unit.x=Math.abs(delta)<=step?destination:combatPosition(state,unit.x+Math.sign(delta)*step);
      return true;
    }
    while(unit.surge_segment<unit.surge_turn_ticks.length&&state.tick>=unit.surge_turn_ticks[unit.surge_segment]){
      unit.sweep_direction*=-1;unit.surge_segment++;
    }
    const plan=surgeMotionPlan(state,unit,sim.hz);
    let direction=unit.sweep_direction;
    const offset=combatDelta(state,unit.sweep_origin,unit.x);
    if(Math.abs(offset)>6.5)direction=-Math.sign(offset);
    unit.sweep_direction=direction;
    unit.moving=!plan.pause;
    if(unit.moving)unit.x=combatPosition(state,unit.x+direction*s.speed*plan.speed/sim.hz);
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
      if ((target.combat.height || 0) <= 0.15 && (!target.dash_active || state.tick > target.dash_invulnerable_until_tick) && state.tick < power.fire_zone.expires_tick && Math.abs(combatDelta(state, power.fire_zone.x, target.x)) <= s.radius) {
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

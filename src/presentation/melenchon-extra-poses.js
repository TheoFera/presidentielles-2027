// Presentation-only memory: landing must never impose a simulation recovery.
import { combatDelta } from '../simulation/combat-geometry.js';
import { melenchonExtraAtlases } from './melenchon-extra-atlases.js';
export const MELENCHON_LANDING_TICKS = 10;
export const GUARD_STEP_DISTANCE = 2;
export const GUARD_STEP_FRAME_COUNT = melenchonExtraAtlases.guardStep.frames.length;
export class MelenchonMotionTracker {
  constructor() { this.actors=new Map(); this.walkers=new Map(); }
  clear() { this.actors.clear(); this.walkers.clear(); }
  walk(actor,state,config,active) {
    const old=this.walkers.get(actor.id), tick=state.tick;
    const direction=actor.axis?Math.sign(actor.axis)*actor.facing:1;
    const valid=active && old?.active && old.phase===state.phase && tick>=old.tick && tick-old.tick<=30
      && old.facing===actor.facing && old.direction===direction;
    let distance=valid?old.distance:0;
    if(valid && tick>old.tick) {
      const traveled=Math.abs(combatDelta(state,old.x,actor.x));
      const maximum=config.prototype.movement.candidate_speed_units_per_second*(tick-old.tick)/config.balance.simulation_architecture.fixed_tick_hz*2;
      distance=traveled<=maximum+.001?(distance+traveled)%GUARD_STEP_DISTANCE:0;
    }
    this.walkers.set(actor.id,{x:actor.x,tick,phase:state.phase,active,distance,facing:actor.facing,direction});
    const count=GUARD_STEP_FRAME_COUNT, frame=Math.floor(distance/GUARD_STEP_DISTANCE*count+1e-8)%count;
    return direction<0?(count-frame)%count:frame;
  }
  landing(actor,state,config) {
    const old=this.actors.get(actor.id), tick=state.tick;
    const valid=old && old.tick<=tick && old.phase===state.phase;
    let landingTick=valid?old.landingTick:null;
    if (valid && old.jumpTick!=null && actor.combat.jump_tick==null && !actor.is_ko) {
      const end=old.jumpTick+Math.ceil(config.balance.candidate_combat.jump_duration_seconds*config.balance.simulation_architecture.fixed_tick_hz);
      if(tick>=end && tick-end<MELENCHON_LANDING_TICKS) landingTick=end;
    }
    if(actor.combat.jump_tick!=null || actor.is_ko || actor.combat.stun_ticks || actor.dash_active) landingTick=null;
    this.actors.set(actor.id,{tick,phase:state.phase,jumpTick:actor.combat.jump_tick,landingTick});
    return landingTick==null?null:tick-landingTick;
  }
}

export function melenchonExtraPose(actor,state,config,guard,landingAge=null,walkFrame=0) {
  const c=actor.combat, tick=state.tick, hz=config.balance.simulation_architecture.fixed_tick_hz;
  const pose=(sheet,frame,name)=>({sheet,frame,name,direction:actor.facing,extra:true});
  const cycle=(frames,seconds=.12)=>frames[Math.floor(tick/(hz*seconds))%frames.length];
  const incoming=c.last_hit?.target_id===actor.id?c.last_hit:null;
  if(actor.is_ko || actor.arena_hp<=0) {
    const age=tick-(actor.is_ko?actor.ko_started_tick:incoming?.tick);
    const duration=Math.max(1,Math.ceil(config.balance.candidate_combat.ko_fall_seconds*hz));
    const frame=Number.isFinite(age)?Math.min(3,Math.max(0,Math.floor(age/duration*4))):3;
    return pose('actions',[10,11,12,13][frame],frame===3?'ko_ground':'ko_fall');
  }
  if(c.stun_ticks>0 || Math.abs(c.knockback_velocity)>0.5) {
    const age=incoming?tick-incoming.tick:Infinity;
    if(incoming && !incoming.strong && Math.abs(c.knockback_velocity)<=0.02) return pose('fighter',age<4?6:7,'hit_light');
    if(Math.abs(c.knockback_velocity)>0.5 && age>=3) return pose('movement',11,'knockback');
    if(age<6) return pose('movement',incoming.strong?(age<3?9:10):(age<3?7:8),incoming.strong?'hit_heavy':'hit_light');
    return pose('movement',cycle([12,13],.2),'stun');
  }
  if(actor.dash_active) {
    const duration=Math.ceil(config.balance.dash.duration_seconds*hz);
    const age=tick-(actor.dash_until_tick-duration);
    return {...pose('movement',age<=0?4:age>=duration-1?6:5,'dash'),direction:actor.dash_direction};
  }
  const attack=state.attacks.find(a=>a.id===c.attack_id);
  if(attack?.kind==='SPECIAL') return pose('actions',attack.elapsed_ticks<attack.windup_ticks?14:15,'ultimate');
  if(attack || c.charge_active || c.jump_tick!=null) return null;
  if(!actor.moving && !actor.axis && (actor.purchase_hold || actor.style_hold || actor.style_interaction_held)) return pose('shuffle',cycle([4,5,6,7],.3),'interaction_hold');
  if(!actor.moving && !actor.axis && (actor.persuasion_target_ids?.length || actor.crisis_meeting_id)) return pose('actions',cycle([6,7],.35),'persuade');
  if(!actor.moving && !actor.axis && incoming && !incoming.strong && !incoming.knockback && tick-incoming.tick>=0 && tick-incoming.tick<8) return pose('fighter',tick-incoming.tick<4?6:7,'hit_light');
  const landingDuration=actor.moving?6:MELENCHON_LANDING_TICKS;
  if(landingAge!=null && landingAge>=0 && landingAge<landingDuration) return pose('movement',landingAge<4?14:15,'landing');
  if(actor.moving) {
    return guard?pose('guardStep',walkFrame,'combat_walk'):null;
  }
  // Keep the user's original idle sprite; no replacement of the base identity.
  return null;
}

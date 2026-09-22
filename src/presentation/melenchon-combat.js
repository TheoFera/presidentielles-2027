import { additionalCombatAtlases } from './candidate-combat-atlases.js';
import { candidateExtraAtlases, candidateExtraPose } from './candidate-extra-poses.js';
import { MelenchonMotionTracker } from './melenchon-extra-poses.js';
import { combatDelta } from '../simulation/combat-geometry.js';
import { enemies } from '../simulation/combat-state.js';

export const MELENCHON_SPRITE = 'character-melenchon-combat-v4';
// Source bounds and body pivots for independently drawn poses.
export const MELENCHON_FRAMES = [
 [49,7,213,301,159,306], [351,30,204,278,455,306],
 [658,10,221,297,770,305], [960,7,265,300,1065,305],
 [34,323,243,298,159,619], [340,322,278,299,456,619],
 [699,313,153,306,765,617], [964,321,270,300,1038,619],
 [29,675,233,256,150,929], [378,620,154,309,455,927],
 [647,633,266,297,742,928], [1013,625,155,305,1080,928],
 [41,1010,218,231,148,1239], [366,933,186,263,464,1194],
 [668,929,183,311,757,1238], [935,938,306,217,1058,1153],
];
// One anatomical scale for all poses: calibrate head size against the original,
// rather than stretching each bent silhouette to the standing character height.
export const MELENCHON_REFERENCE_HEIGHT = 340;
export const MELENCHON_HEIGHT_STRETCH = 1.1236;
export const MELENCHON_WIDTH_STRETCH = 1.06;
export const MELENCHON_JUMP_SCALE = 1.06;
export const MELENCHON_CHARGED_SCALE = 1.06;

export const combatAtlases = { melenchon: { sprite: MELENCHON_SPRITE, frames: MELENCHON_FRAMES, style: 'melenchon_universaliste' }, ...additionalCombatAtlases };
export function usesCandidateCombat(entity, state) {
  const atlas = combatAtlases[entity.faction_id];
  return !!atlas && (entity.role === 'CANDIDAT' || entity.role === 'HOLOGRAMME' && entity.faction_id === 'melenchon') && !entity.bardella_form && !entity.presentation_name
    && (!entity.current_campaign_style || entity.current_campaign_style === atlas.style)
    && !(entity.ultimate_effect && entity.ultimate_effect.expires_tick > state.tick);
}
export const usesMelenchonCombat = (entity,state) => entity.faction_id === 'melenchon' && usesCandidateCombat(entity,state);

// Visual memory only: does not block persuasion, change facing, or modify saved state.
export class CombatPoseTracker {
  constructor() { this.actors = new Map(); }
  clear() { this.actors.clear(); }
  active(entity, state, config) {
    const previous = this.actors.get(entity.id);
    const entry = previous && previous.tick <= state.tick ? previous : { until: -1, tick: state.tick };
    const active = state.tick <= entry.until;
    const radius = config.balance.candidate_combat.ai_detection_range * (active ? 1.3 : 1);
    const dangerous = new Set(['CANDIDAT', 'MILITANT', 'SERVICE_D_ORDRE', 'HOLOGRAMME', 'CRS', 'ENCAPUCHONNE', 'ZEMMOUR']);
    const threat = [...state.candidates, ...state.npcs, ...state.temporary_units].some(target =>
      dangerous.has(target.role) && enemies(entity, target)
      && Math.abs(combatDelta(state, entity.x, target.x)) <= radius);
    const attack = state.attacks.some(a => a.owner_id === entity.id);
    const recentHit = entity.combat?.last_hit?.tick === state.tick;
    if (threat || attack || recentHit || entity.combat?.charge_active) entry.until = state.tick + Math.ceil(2 * config.balance.simulation_architecture.fixed_tick_hz);
    entry.tick = state.tick; this.actors.set(entity.id, entry);
    return state.tick <= entry.until;
  }
}

export function melenchonPose(entity, state, config, guard = false) {
  if (!usesCandidateCombat(entity, state) || entity.is_ko || entity.arena_hp <= 0
    || entity.combat?.stun_ticks > 0 || entity.dash_active) return null;
  const c = entity.combat, hz = config.balance.simulation_architecture.fixed_tick_hz;
  const attack = state.attacks.find(a => a.id === c.attack_id);
  const inAir = c.jump_tick != null;
  const result = (frame, name, phase = null) => ({ frame, name, phase, direction: attack?.direction || entity.facing });
  if (attack) {
    if (!['CANDIDATE', 'CHARGED', 'HOLOGRAM'].includes(attack.kind)) return null;
    const phase = attack.elapsed_ticks < attack.windup_ticks ? 'windup'
      : attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks ? 'active' : 'recovery';
    const earlyRecovery = attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks + Math.ceil(attack.recovery_ticks * .35);
    if (inAir) return result(phase === 'recovery' && !earlyRecovery ? 14 : 15, 'jump_attack', phase);
    if (attack.kind === 'CHARGED') return result(phase === 'windup' ? 9 : phase === 'active' || earlyRecovery ? 10 : 11, 'charged_kick', phase);
    if (attack.kind === 'HOLOGRAM') {
      const second=Number(attack.id.split(':').at(-1))%2===0;
      return result(phase==='windup'?(second?4:2):phase==='active'||earlyRecovery?(second?5:3):0,second?'attack_2':'attack_1',phase);
    }
    const frames = attack.step === 3 ? [6,7] : attack.step === 2 ? [4,5] : [2,3];
    return result(phase === 'windup' ? frames[0] : phase === 'active' || earlyRecovery ? frames[1] : 0,
      attack.step === 3 ? 'attack_3_finisher' : `attack_${attack.step}`, phase);
  }
  if (c.charge_active) {
    const ready = state.tick - c.press_tick >= Math.ceil(config.balance.candidate_combat.charge_ready_seconds * hz - 1e-9);
    return result(ready ? 9 : 8, ready ? 'charge_ready' : 'charge_focus');
  }
  if (inAir) {
    const elapsed = state.tick - c.jump_tick;
    const duration = Math.ceil(config.balance.candidate_combat.jump_duration_seconds * hz - 1e-9);
    return result(elapsed <= 2 ? 12 : elapsed < duration / 2 ? 13 : 14, 'jump');
  }
  if (entity.purchase_hold || entity.style_hold || !entity.moving && !entity.axis && entity.persuasion_target_ids?.length) return null;
  if (guard) return result(Math.floor(state.tick / (hz * .35)) % 2, entity.moving ? 'combat_walk' : 'combat_idle');
  return null;
}

export function drawMelenchonCombat(renderer, entity, x, state) {
  if (!usesCandidateCombat(entity, state)) return false;
  if(entity.role==='HOLOGRAMME' && state.tick < (entity.ready_tick || 0)) return false;
  renderer.combatPoseTracker ??= new CombatPoseTracker();
  const guard = renderer.combatPoseTracker.active(entity, state, renderer.config);
  let extra=null;
  if(candidateExtraAtlases[entity.faction_id]) {
    renderer.melenchonMotionTracker ??= new MelenchonMotionTracker();
    const landing=renderer.melenchonMotionTracker.landing(entity,state,renderer.config);
    const c=entity.combat;
    const walking=guard && entity.moving && !entity.is_ko && !entity.dash_active && !c.attack_id && !c.charge_active && c.jump_tick==null && !c.stun_ticks && Math.abs(c.knockback_velocity)<=.02;
    const frame=renderer.melenchonMotionTracker.walk(entity,state,renderer.config,walking);
    extra=candidateExtraPose(entity,state,renderer.config,guard,landing,frame);
  }
  const pose = extra || melenchonPose(entity, state, renderer.config, guard);
  if (!pose) return false;
  const definition = extra ? candidateExtraAtlases[entity.faction_id][extra.sheet] : combatAtlases[entity.faction_id];
  const atlas = renderer.assets.get(definition.sprite);
  if (!atlas) { void renderer.assets.load(definition.sprite); return false; }
  const { ctx, metrics: m } = renderer;
  const floor = m.groundY + m.characterHeight * .06;
  const feet = floor - (entity.combat.height || 0) * m.characterHeight;
  const breathing = pose.name === 'combat_idle' ? Math.sin(state.tick / 6) * m.characterHeight * .006 : 0;
  const step = !extra && pose.name === 'combat_walk' ? Math.sin(state.tick * .65) * m.characterHeight * .02 : 0;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#26313230'; ctx.beginPath(); ctx.ellipse(x, floor, m.characterHeight * .24, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, feet + breathing + step); ctx.scale(pose.direction < 0 ? -1 : 1, 1);
  const [sx,sy,sw,sh,px,py] = definition.frames[pose.frame];
  const scale = m.characterHeight / (extra ? definition.referenceHeight || 360 : MELENCHON_REFERENCE_HEIGHT);
  const jumpScale = pose.name === 'jump' || pose.name === 'jump_attack' ? MELENCHON_JUMP_SCALE : 1;
  const chargedScale = !extra && (pose.frame === 9 || pose.frame === 10) ? MELENCHON_CHARGED_SCALE : 1;
  const actionScale = pose.name === 'ultimate' ? 1.06 * 1.06
    : ['attack_3_finisher','interaction_hold','ko_fall','ko_ground'].includes(pose.name) ? 1.06 : 1;
  const horizontalScale = scale * MELENCHON_WIDTH_STRETCH * jumpScale * chargedScale * actionScale;
  const verticalScale = scale * MELENCHON_HEIGHT_STRETCH * (!extra && pose.frame === 1 ? 1.055 : 1) * jumpScale * chargedScale * actionScale;
  if(entity.role==='HOLOGRAMME') { ctx.globalAlpha=.48; ctx.shadowColor='#6edbff';ctx.shadowBlur=8; }
  const clip=definition.clips?.[pose.frame];
  if(clip) {
    ctx.beginPath();
    clip.forEach(([cx,cy],index)=>ctx[index?'lineTo':'moveTo']((cx-px)*horizontalScale,(cy-py)*verticalScale));
    ctx.closePath();ctx.clip();
  }
  ctx.drawImage(atlas,sx,sy,sw,sh,(sx-px)*horizontalScale,(sy-py)*verticalScale,sw*horizontalScale,sh*verticalScale);
  if (pose.name === 'charge_ready') {
    ctx.strokeStyle = '#a9e9f0'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, -m.characterHeight*.4, m.characterHeight*.28, -.7, .7); ctx.stroke();
  }
  ctx.restore();
  return true;
}

// Generic names for the shared candidate renderer; legacy exports remain compatible.
export const candidateCombatPose = melenchonPose;
export const drawCandidateCombat = drawMelenchonCombat;

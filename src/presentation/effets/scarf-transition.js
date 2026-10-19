import { characterFrameScale, drawCharacterAtlasFrame } from '../personnages/character-scale.js';
import { scarfBody } from './scarf-character.js';

// Même durée que SPECIAL : arrondi séparé de ses trois phases, comme la simulation.
export function scarfTransitionTicks(config) {
  const b = config.balance.candidate_combat, hz = config.balance.simulation_architecture.fixed_tick_hz;
  return [b.finisher_windup_seconds, b.active_seconds, b.finisher_recovery_seconds]
    .reduce((sum, seconds) => sum + Math.ceil(seconds * hz - 1e-9), 0);
}

export class ScarfTransitionTracker {
  constructor() { this.actors = new Map(); }
  clear() { this.actors.clear(); }
  pose(entity, state, config) {
    if (entity.faction_id !== 'philippe') return null;
    const tick = state.tick, duration = scarfTransitionTicks(config);
    let entry = this.actors.get(entity.id);
    if (entry && tick < entry.tick) { this.actors.delete(entity.id); entry = null; }
    const effect = entity.ultimate_effect;
    if (effect && effect.kind !== 'SCARF') { this.actors.delete(entity.id); return null; }
    const power = state.powers.find(p => p.owner_id === entity.id && p.kind === 'SCARF' && p.expires_tick > tick);
    if (effect?.kind === 'SCARF' && effect.expires_tick > tick) {
      const start = power?.started_tick ?? effect.expires_tick - Math.ceil(config.balance.specials.scarf.duration_seconds * config.balance.simulation_architecture.fixed_tick_hz);
      if (!entry || entry.expires !== effect.expires_tick) entry = { start, expires: effect.expires_tick, returnTick: effect.expires_tick };
      this.actors.set(entity.id, entry);
    }
    if (!entry) return null;
    entry.tick = tick;
    const attack = state.attacks.find(a => a.owner_id === entity.id && a.id === entity.combat?.attack_id);
    if (!effect && tick < entry.expires && attack?.kind !== 'SCARF') { this.actors.delete(entity.id); return null; }
    const c = entity.combat || {};
    // Les gestes ne remplacent jamais un coup, une réaction, un saut ou une esquive.
    const interrupted = entity.is_ko || entity.debate_hp <= 0 || entity.eliminated || entity.disappeared
      || entity.dash_active || c.stun_ticks > 0 || Math.abs(c.knockback_velocity || 0) > .02 || c.jump_tick != null;
    if (interrupted) {
      if (tick >= entry.expires || !effect) this.actors.delete(entity.id);
      return null;
    }
    if (tick >= entry.expires && attack?.kind === 'SCARF') {
      entry.returnTick = tick + Math.max(0, attack.windup_ticks + attack.active_ticks + attack.recovery_ticks - attack.elapsed_ticks);
      return null;
    }
    if (attack && attack.kind !== 'SPECIAL') return null;
    const removing = tick >= entry.start && tick < entry.start + duration && tick < entry.expires;
    const replacing = tick >= entry.returnTick && tick < entry.returnTick + duration;
    if (!removing && !replacing) {
      if (tick >= entry.returnTick + duration || !effect && tick < entry.expires) this.actors.delete(entity.id);
      return null;
    }
    const progress = (tick - (removing ? entry.start : entry.returnTick)) / duration;
    const step = Math.min(2, Math.floor(progress * 3));
    return { frame: removing ? step : 2 - step, removing, progress, duration };
  }
}

export function scarfTransitionPose(renderer, entity, state) {
  renderer.scarfTransitionTracker ??= new ScarfTransitionTracker();
  return renderer.scarfTransitionTracker.pose(entity, state, renderer.config);
}

export const scarfTransitionAtlas = {
  sprite: 'ultimate-scarf-transition-v1', standingHeight: 626,
  // La planche générée est plus massive que la garde : réduire uniformément tête et épaules.
  anatomicalScales: [.9, .9],
  // Appuis et corps constants ; les mains et le tissu dépassent au-dessus de la tête.
  frames: [[181,63,525,638,444,693], [823,33,539,668,1091,693]],
};

export function drawScarfTransition(renderer, entity, x, state) {
  if (entity.role !== 'CANDIDAT' || entity.faction_id !== 'philippe') return false;
  const pose = scarfTransitionPose(renderer, entity, state);
  renderer.scarfTransitionBodies ??= new Map();
  renderer.scarfTransitionHeld ??= new Map();
  renderer.scarfTransitionBodies.delete(entity.id);
  renderer.scarfTransitionHeld.delete(entity.id);
  if (!pose) return false;
  // La dernière pose est la vraie garde, avec le tissu dans la même main que les frappes.
  const ready = pose.frame === 2 ? scarfBody(entity,0,renderer.metrics.characterHeight) : null;
  const atlas = ready?.atlas ?? scarfTransitionAtlas, frame = ready?.frame ?? pose.frame;
  const image = renderer.assets.get(atlas.sprite);
  if (!image) { void renderer.assets.load(atlas.sprite); return false; }
  const {ctx,metrics:m} = renderer, height = m.characterHeight;
  const ground = m.groundY + height * (m.groundOffsetRatio ?? .06);
  ctx.save();ctx.imageSmoothingEnabled = true;
  ctx.fillStyle='#26313230';ctx.beginPath();ctx.ellipse(x,ground,height*.24,3,0,0,Math.PI*2);ctx.fill();
  ctx.translate(x,ground);ctx.scale(entity.facing < 0 ? -1 : 1,1);
  const scale = ready?.scale ?? characterFrameScale(atlas,frame,height);
  drawCharacterAtlasFrame(ctx,image,atlas,frame,scale);
  ctx.restore();
  if (ready) {
    renderer.scarfHands ??= new Map();
    renderer.scarfHands.set(entity.id,{tick:state.tick,atlas,frame,scale,x,y:ground,direction:entity.facing});
    renderer.scarfTransitionHeld.set(entity.id,state.tick);
    return true;
  }
  // Le tissu est déjà dessiné dans ces poses : ne pas en ajouter un second dans les effets.
  renderer.scarfTransitionBodies.set(entity.id,state.tick);
  return true;
}

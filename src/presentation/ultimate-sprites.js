import { ultimateAtlases } from './ultimate-sprite-data.js';

const sheets = { WAVE:'wave', FIRE:'fire', SURGE:'surge', WALL:'wall', ZEMMOUR:'zemmour', SCARF:'scarf', BARDELLA:'bardella', EUROPE:'europe' };
const hzOf = config => config.balance.simulation_architecture.fixed_tick_hz;
const cycle = (tick, hz, count, fps = 10) => Math.floor(tick * fps / hz) % count;
export const SURGE_HEIGHT_RATIO=.84;
export function attackPhase(attack) {
  return attack.elapsed_ticks < attack.windup_ticks ? 'windup'
    : attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks ? 'active' : 'recovery';
}

// The same tick and attack object drive the body and its extended cloth.
export function scarfPose(attack) {
  const phase = attackPhase(attack);
  if (phase === 'active') return { frame:2, cloth:6, extension:1 };
  if (phase === 'windup') {
    const progress = attack.elapsed_ticks / Math.max(1, attack.windup_ticks);
    return { frame:progress < .5 ? 0 : 1, cloth:4, extension:0 };
  }
  const progress = (attack.elapsed_ticks - attack.windup_ticks - attack.active_ticks) / Math.max(1, attack.recovery_ticks);
  return { frame:progress < 1/3 ? 2 : 3, cloth:7, extension:Math.max(0, 1 - progress * 3) };
}

export function ultimateCharacterPose(entity, state, config) {
  if (entity.is_ko || entity.arena_hp <= 0 || entity.eliminated || entity.disappeared || entity.expired) return null;
  const hz = hzOf(config), c = entity.combat || {};
  const attack = state.attacks.find(a => a.owner_id === entity.id && a.id === c.attack_id);
  const phase = attack && attackPhase(attack);
  if (attack?.kind === 'SCARF') return { sheet:'scarf', ...scarfPose(attack), direction:attack.direction, attack };
  if (entity.role === 'ENCAPUCHONNE') {
    const cooldown = Math.ceil(config.balance.specials.surge.contact_cooldown_seconds * hz);
    const recent = Object.values(entity.contact_ticks || {}).some(t => state.tick >= t-cooldown && state.tick-(t-cooldown) < hz * .22);
    const strideTick=state.tick+(Number(entity.id.split(':').at(-1))||0)*2;
    return { sheet:'surge', frame:state.tick < entity.ready_tick ? 4 : recent ? 5 + cycle(strideTick,hz,3,12) : !entity.moving ? 7 : cycle(strideTick,hz,4,12) };
  }
  if (entity.role === 'CRS') return { sheet:'wall', frame:attack ? (phase === 'windup' ? 4 : phase === 'active' ? 5 : 7) : c.stun_ticks > 0 ? 3 : entity.moving ? 1 + cycle(state.tick,hz,2,8) : 0 };
  if (entity.role === 'ZEMMOUR') {
    const interval = Math.ceil(hz / config.balance.specials.zemmour.shots_per_second);
    const since = state.tick - (entity.next_shot_tick - interval);
    return { sheet:'zemmour', frame:entity.shot_count > 0 && since >= 0 && since < hz * .32 ? (since < hz * .16 ? 2 : 3) : entity.next_shot_tick - state.tick < hz * .2 ? 1 : 0 };
  }
  const effect = entity.ultimate_effect?.expires_tick > state.tick ? entity.ultimate_effect.kind : null;
  const transformed = entity.bardella_form ? 'bardella' : effect === 'EUROPE' ? 'europe' : null;
  if (transformed) {
    const bardella = transformed === 'bardella';
    let frame = 0;
    if (bardella && state.tick - entity.bardella_transition_tick < hz * .4) frame = 15;
    else if (c.stun_ticks > 0) frame = bardella ? 14 : 0;
    else if (entity.dash_active) frame = 3;
    else if (c.jump_tick != null) frame = bardella ? (attack ? 13 : 12) : (attack ? 11 : 10);
    else if (attack && attack.kind !== 'SPECIAL') {
      if (attack.kind === 'CHARGED') frame = bardella ? (phase === 'windup' ? 10 : 11) : (phase === 'windup' ? 8 : 9);
      else if (attack.step === 3) frame = bardella ? (phase === 'windup' ? 8 : 9) : (phase === 'windup' ? 6 : 7);
      else frame = bardella && attack.step === 2 ? (phase === 'windup' ? 6 : 7) : (phase === 'windup' ? 4 : 5);
      if (phase === 'recovery') frame = 0;
    } else if (c.charge_active) frame = bardella ? 10 : 8;
    else if (entity.moving) frame = 1 + cycle(state.tick,hz,2,8);
    return { sheet:transformed, frame, direction:attack?.direction };
  }
  if (attack?.kind === 'SPECIAL' || effect === 'FIRE') {
    const power = state.powers.findLast(p => p.owner_id === entity.id);
    if (power && ['WAVE','FIRE'].includes(power.kind)) {
      const age = state.tick - power.started_tick;
      const frameSeconds=power.kind==='WAVE' ? .14 : .11;
      return { sheet:sheets[power.kind], frame:Math.min(3,Math.floor(age / Math.max(1,hz*frameSeconds))) };
    }
  }
  return null;
}

function ready(renderer, sheet) {
  const atlas = ultimateAtlases[sheet];
  if (!atlas) return null;
  const image = renderer.assets.get(atlas.sprite);
  if (!image) { void renderer.assets.load(atlas.sprite); return null; }
  return { atlas, image };
}

export function drawUltimateCharacter(renderer, entity, x, state) {
  const pose = ultimateCharacterPose(entity,state,renderer.config);
  if (!pose) return false;
  const source = ready(renderer,pose.sheet);
  if (!source) return false;
  const { atlas,image } = source, {ctx,metrics:m} = renderer;
  const [sx,sy,sw,sh,px,py] = atlas.frames[pose.frame];
  let surgeScale=1,surgeAlpha=1;
  if(pose.sheet==='surge') {
    if(state.tick<entity.ready_tick) {
      const progress=Math.max(0,Math.min(1,(state.tick-entity.spawn_tick)/Math.max(1,entity.ready_tick-entity.spawn_tick)));
      surgeScale=.35+.65*progress;surgeAlpha=.25+.75*progress;
    } else if(state.tick>=entity.return_tick) {
      const progress=Math.max(0,Math.min(1,(state.tick-entity.return_tick)/Math.max(1,entity.expires_tick-entity.return_tick)));
      surgeScale=1-.65*progress;surgeAlpha=1-.75*progress;
    }
  }
  const baseHeight=pose.sheet==='surge'?m.characterHeight*SURGE_HEIGHT_RATIO:m.characterHeight*(entity.role==='CANDIDAT'?1:renderer.p.npc_height_multiplier);
  const height=baseHeight*surgeScale;
  const scale = height / atlas.referenceHeight * (pose.sheet === 'fire' ? 1.1236 : 1);
  const castScale=['scarf','wave'].includes(pose.sheet);
  const scaleX=scale*(castScale?1.12:1),scaleY=scale*(castScale?1.06:1);
  const ground = m.groundY + m.characterHeight * .06;
  ctx.save();
  ctx.globalAlpha*=surgeAlpha;
  ctx.fillStyle='#26313230';ctx.beginPath();ctx.ellipse(x,ground,height*.24,3,0,0,Math.PI*2);ctx.fill();
  ctx.translate(x,ground-(entity.combat?.height||0)*m.characterHeight);
  ctx.scale(pose.direction || entity.facing || 1,1);
  const clip=atlas.clips?.[pose.frame];
  if(clip){ctx.beginPath();clip.forEach(([cx,cy],i)=>ctx[i?'lineTo':'moveTo']((cx-px)*scaleX,(cy-py)*scaleY));ctx.closePath();ctx.clip();}
  ctx.drawImage(image,sx,sy,sw,sh,(sx-px)*scaleX,(sy-py)*scaleY,sw*scaleX,sh*scaleY);
  ctx.restore();
  return true;
}

// Effect bounds are explicit; the character is never stretched to the weapon range.
export function drawUltimateEffect(renderer,sheet,frame,x,y,width,height,direction=1) {
  const source=ready(renderer,sheet);
  if(!source)return false;
  const [sx,sy,sw,sh]=source.atlas.frames[frame],ctx=renderer.ctx;
  ctx.save();ctx.translate(x,y);ctx.scale(direction,1);
  const clip=source.atlas.clips?.[frame];
  if(clip){ctx.beginPath();clip.forEach(([cx,cy],i)=>ctx[i?'lineTo':'moveTo']((cx-sx)*width/sw,(cy-sy)*height/sh));ctx.closePath();ctx.clip();}
  ctx.drawImage(source.image,sx,sy,sw,sh,0,0,width,height);ctx.restore();return true;
}

export function drawUltimateProjectile(renderer,p,state) {
  const {metrics:m,config}=renderer,x=renderer.screenX(p.x),hz=hzOf(config);
  if(p.kind==='WAVE'&&p.launch_tick!=null&&state.tick<p.launch_tick)return true;
  if(p.kind==='WAVE') {
    const width=m.pixelsPerUnit*2.6;
    return drawUltimateEffect(renderer,'wave',4+cycle(state.tick-(p.launch_tick||0),hz,4,7),x-(p.direction||1)*width/2,m.groundY+m.characterHeight*.14-m.characterHeight*1.65,width,m.characterHeight*1.65,p.direction);
  }
  if(p.kind==='MOLOTOV') {
    if(p.launch_tick!=null&&state.tick<p.launch_tick)return true;
    const width=m.characterHeight*.14,height=m.characterHeight*.24,arc=molotovArcHeight(p);
    return drawUltimateEffect(renderer,'fire',4+cycle(state.tick-(p.launch_tick||0),hz,2,8),x-(p.direction||1)*width/2,m.groundY+m.characterHeight*.06-arc*m.characterHeight-height,width,height,p.direction);
  }
  if(p.kind==='BUBBLE') {
    const b=config.balance.specials.zemmour,w=m.pixelsPerUnit*b.bubble_width_units,h=m.characterHeight*b.bubble_height;
    const y=m.groundY-m.characterHeight*(b.bubble_bottom+b.bubble_height);
    if(!drawUltimateEffect(renderer,'zemmour',4+cycle(state.tick,hz,4,12),x-(p.direction||1)*w/2,y,w,h,p.direction))return false;
    const ctx=renderer.ctx;ctx.save();ctx.fillStyle='#24354d';ctx.font=`bold ${Math.max(7,Math.min(10,h*.7))}px monospace`;ctx.textAlign='center';ctx.fillText(p.label||'!?',x,y+h*.75,Math.max(1,w-4));ctx.restore();return true;
  }
  return false;
}

export function molotovArcHeight(projectile) {
  const total=Math.max(projectile.initial_range||projectile.remaining_range||1,1e-6);
  const progress=Math.max(0,Math.min(1,1-projectile.remaining_range/total));
  return (1-progress)*.72+4*progress*(1-progress)*.65;
}

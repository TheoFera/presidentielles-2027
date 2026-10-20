import { PRESS_ATLASES } from './press-atlases.js';
import { drawCharacterAtlasFrame } from './character-scale.js';
import { isPress, pressCone, pressMember } from '../../simulation/press-rules.js';
import { prepareAtlasFrames } from './minor-sprite-images.js';
import { drawStandingSprite, standingSpriteMotion, applyNpcStandingMotion } from './standing-sprite-motion.js';
import { entryPath } from './npc-entry.js';

export function pressWalking(entity, state) {
  return entity.leave_progress != null || state.press_team?.phase === 'LEAVING' || state.press_team?.phase === 'ENTRY'
    || entity.moving && !entity.combat.stun_ticks && !entity.combat.attack_id;
}

export function pressPose(entity, state, hz) {
  const base = entity.role === 'PRESS_REPORTER' ? 3 : 0;
  if (pressWalking(entity, state)) return base;
  const attack = entity.combat.attack_id && state.attacks.find(a => a.id === entity.combat.attack_id);
  if (attack) {
    const age = attack.elapsed_ticks, impact = attack.windup_ticks, recovery = impact + attack.active_ticks;
    if (attack.micro_hold_until_tick > state.tick) return base + 2;
    if (age < Math.max(1, Math.ceil(impact / 3))) return base;
    if (age < impact) return base + 1;
    if (age < recovery) return base + 2;
    return age < recovery + Math.floor(attack.recovery_ticks / 2) ? base + 1 : base;
  }
  if (entity.role === 'PRESS_REPORTER') return base;
  return entity.filming ? base + 2 : entity.aim_ticks > 0 ? base + 1 : base;
}

export function drawPressCharacter(renderer, entity, x, state) {
  if (!isPress(entity)) return false;
  const atlas = PRESS_ATLASES[entity.variant || 0], image = renderer.assets.get(atlas.sprite);
  if (!image) { void renderer.assets.load(atlas.sprite); return false; }
  const { ctx, metrics: m, p } = renderer, hz = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const height = m.characterHeight * p.npc_height_multiplier * (atlas.sizeScale || 1), scale = height / atlas.referenceHeight;
  let floor = m.groundY + m.characterHeight * (m.groundOffsetRatio ?? .06);
  if (entity.leave_progress != null) {
    // Journalistes de la scène d'ouverture : l'arrivée des habitants jouée à l'envers,
    // quelques pas de côté vers l'extérieur, puis la descente en diagonale vers le bas de l'écran.
    const path = entryPath(1 - entity.leave_progress, state.tick / hz), zoom = (renderer.config.balance.camera.framing_zoom ?? 1) * (renderer.zoomBoost || 1);
    floor += ((renderer.height - m.groundY) / zoom + height * 1.2) * path.lift - height * .035 * path.bob;
    x += (entity.facing < 0 ? -1 : 1) * height * 1.6 * path.side;
  } else if (state.press_team?.phase === 'LEAVING') {
    // Équipe de reportage qui s'en va : elle sort par le bas de l'écran.
    const t = Math.min(1, (state.tick + (renderer.pressAlpha || 0) - state.press_team.leave_tick) / (hz * renderer.config.balance.press_team.exit_seconds));
    floor += (renderer.height - m.groundY + height * 1.25) * t;
  }
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#26313230'; ctx.beginPath(); ctx.ellipse(x, floor, height * .24, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, floor - (entity.combat.height || 0) * m.characterHeight);
  ctx.scale((entity.facing < 0 ? -1 : 1) * (atlas.widthScale || 1), 1);
  if (entity.combat.stun_ticks > 0) ctx.rotate(-.08);
  const pose = pressPose(entity, state, hz);
  if (pressWalking(entity, state)) {
    // Même mouvement léger que les habitants : une silhouette entière, sans alterner
    // deux dessins presque identiques et sans déformer la caméra ou le micro.
    const sprite = prepareAtlasFrames(image, atlas)[pose];
    const [sx, , sw, , px] = atlas.frames[pose], width = sw * scale;
    const motion = standingSpriteMotion('walk', state.tick / hz);
    ctx.save(); applyNpcStandingMotion(ctx, motion);
    ctx.translate((sx - px) * scale + width / 2, 0);
    drawStandingSprite(ctx, sprite, { x: 0, y: 0, width: sprite.width, height: sprite.height }, height, width,
      motion);
    ctx.restore();
  } else drawCharacterAtlasFrame(ctx, image, atlas, pose, scale);
  ctx.restore();
  if (entity.press_ready) {
    const width = height * (entity.role === 'PRESS_CAMERA' ? .4 : .65), y = floor - height - 10;
    ctx.fillStyle = '#23343bd9'; ctx.fillRect(x-width/2, y, width, 4);
    ctx.fillStyle = '#d98662'; ctx.fillRect(x-width/2, y, width * entity.hidden_durability / entity.initial_durability, 4);
  }
  renderer.personMarks?.set(entity.id, { x, feetY: floor, height, facing: entity.facing });
  return true;
}

export function drawPressCone(renderer, state) {
  if (state.press_team?.phase !== 'ACTIVE') return;
  const camera = pressMember(state, 'PRESS_CAMERA');
  if (!camera?.filming || camera.moving) return;
  const { ctx, metrics: m } = renderer, s = renderer.config.balance.press_team;
  const x = renderer.screenX(camera.x), y = m.groundY + m.characterHeight * ((m.groundOffsetRatio ?? .06) - s.camera_height);
  const range = pressCone(state, renderer.config, camera), far = x + camera.facing * range * m.pixelsPerUnit;
  const half = (s.cone_start_radius + range*s.cone_slope) * m.characterHeight;
  ctx.save(); ctx.fillStyle = '#a8dceb24'; ctx.strokeStyle = '#b7e4ef70'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y-s.cone_start_radius*m.characterHeight); ctx.lineTo(far,y-half);
  ctx.lineTo(far,y+half); ctx.lineTo(x,y+s.cone_start_radius*m.characterHeight); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawPressWarning(renderer, state) {
  const { ctx, metrics: m } = renderer;
  const warning = state.press_director?.warning;
  if (!warning || warning.target_id !== state.local_candidate_id) return;
  ctx.save(); ctx.font='500 15px system-ui'; ctx.textAlign='center';
  ctx.fillStyle='#fff3d9'; ctx.strokeStyle='#29393c'; ctx.lineWidth=4;
  const text='Une équipe de reportage arrive !';
  ctx.strokeText(text,m.anchorX,m.groundY-m.characterHeight*1.65);ctx.fillText(text,m.anchorX,m.groundY-m.characterHeight*1.65);
  ctx.restore();
}

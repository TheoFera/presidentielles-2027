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
  let floor = m.groundY + m.characterHeight * (m.groundOffsetRatio ?? .06), facing = entity.facing;
  let leave = entity.leave_progress;
  if (leave == null && state.press_team?.phase === 'LEAVING') {
    // Équipe de reportage vaincue ou repartie : elle tourne le dos au candidat et sort comme celle de l'ouverture.
    leave = Math.min(1, (state.tick + (renderer.pressAlpha || 0) - state.press_team.leave_tick) / (hz * renderer.config.balance.press_team.exit_seconds));
    facing = -entity.facing;
  }
  if (leave != null) {
    // L'arrivée des habitants jouée à l'envers : quelques pas de côté vers l'extérieur,
    // puis la descente en diagonale vers le bas de l'écran.
    const path = entryPath(1 - leave, state.tick / hz), zoom = (renderer.config.balance.camera.framing_zoom ?? 1) * (renderer.zoomBoost || 1);
    floor += ((renderer.height - m.groundY) / zoom + height * 1.2) * path.lift - height * .035 * path.bob;
    x += (facing < 0 ? -1 : 1) * height * 1.6 * path.side;
  }
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#26313230'; ctx.beginPath(); ctx.ellipse(x, floor, height * .24, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, floor - (entity.combat.height || 0) * m.characterHeight);
  ctx.scale((facing < 0 ? -1 : 1) * (atlas.widthScale || 1), 1);
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
  renderer.personMarks?.set(entity.id, { x, feetY: floor, height, facing });
  return true;
}

// Avant de l'objectif sur l'image « filme » (pose 2) de chaque duo, en pixels de l'atlas
// depuis le point d'appui des pieds : [avance, hauteur, demi-hauteur de l'objectif].
const LENS = [[83.5, 142, 14], [79.5, 136, 13], [72.5, 132, 13.5]];

export function drawPressCone(renderer, state) {
  if (state.press_team?.phase !== 'ACTIVE') return;
  const camera = pressMember(state, 'PRESS_CAMERA');
  if (!camera?.filming || camera.moving) return;
  const { ctx, metrics: m, p } = renderer, s = renderer.config.balance.press_team;
  const atlas = PRESS_ATLASES[camera.variant || 0], [ahead, rise, aperture] = LENS[camera.variant || 0];
  const scale = m.characterHeight * p.npc_height_multiplier * (atlas.sizeScale || 1) / atlas.referenceHeight;
  const ground = m.groundY + m.characterHeight * (m.groundOffsetRatio ?? .06);
  // Le faisceau sort de l'objectif dessiné ; son extrémité reste la zone réellement filmée par la règle.
  const lensX = renderer.screenX(camera.x) + camera.facing * ahead * scale * (atlas.widthScale || 1);
  const lensY = ground - (camera.combat.height || 0) * m.characterHeight - rise * scale, open = aperture * scale;
  const range = pressCone(state, renderer.config, camera);
  const far = renderer.screenX(camera.x) + camera.facing * range * m.pixelsPerUnit;
  const farY = ground - s.camera_height * m.characterHeight, half = (s.cone_start_radius + range * s.cone_slope) * m.characterHeight;
  const light = ctx.createLinearGradient(lensX, 0, far, 0);
  light.addColorStop(0, '#fffbe8d0'); light.addColorStop(.3, '#fff4d078'); light.addColorStop(1, '#fff4d02a');
  const edge = ctx.createLinearGradient(lensX, 0, far, 0);
  edge.addColorStop(0, '#ffffffe0'); edge.addColorStop(1, '#ffffff40');
  ctx.save();
  ctx.beginPath(); ctx.moveTo(lensX, lensY - open); ctx.lineTo(far, farY - half);
  ctx.lineTo(far, farY + half); ctx.lineTo(lensX, lensY + open); ctx.closePath();
  ctx.fillStyle = light; ctx.fill();
  ctx.beginPath(); ctx.moveTo(lensX, lensY - open); ctx.lineTo(far, farY - half);
  ctx.moveTo(lensX, lensY + open); ctx.lineTo(far, farY + half);
  ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]); ctx.stroke();
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

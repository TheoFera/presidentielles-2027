import { minorUltimateAtlases } from './minor-ultimate-art.js';
import { prepareAtlasFrames } from '../personnages/minor-sprite-images.js';
import { minorCombatAtlases } from '../personnages/minor-animation-sprites.js';
import { characterFrameScale } from '../personnages/character-scale.js';
import { minorUltimateGesture, minorBarrierPose } from './minor-ultimate-gestures.js';
import { combatDelta } from '../../simulation/combat-geometry.js';

function frameImage(renderer, atlas, index) {
  const image = renderer.assets.get(atlas.sprite);
  if (!image) { void renderer.assets.load(atlas.sprite); return null; }
  return prepareAtlasFrames(image, atlas)[index];
}

function prop(renderer, index, x, y, width, angle = 0, direction = 1, atlas = minorUltimateAtlases.props, anchor = [.5, .5]) {
  const frame = frameImage(renderer, atlas, index);
  if (!frame) return;
  const { ctx } = renderer;
  const h = width * frame.height / frame.width;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(direction, 1);
  ctx.drawImage(frame, -width * anchor[0], -h * anchor[1], width, h); ctx.restore();
}

function handPoint(renderer, entity, x, atlas, index, direction) {
  const [hx, hy] = atlas.hands[index], [, , , , px, py] = atlas.frames[index], m = renderer.metrics;
  const k = characterFrameScale(atlas, index, m.characterHeight);
  return { x: x + (hx - px) * k * direction,
    y: m.groundY + m.characterHeight * (m.groundOffsetRatio ?? .06) - (entity.combat?.height || 0) * m.characterHeight + (hy - py) * k };
}

// Les doigts repassent devant l'objet tenu ; la prise reste lisible, même dans la foule.
function handGrip(renderer, atlas, index, hand, direction) {
  const image = frameImage(renderer, atlas, index);
  if (!image) return;
  const [hx, hy] = atlas.hands[index], [sx, sy, sw, sh] = atlas.frames[index];
  const k = characterFrameScale(atlas, index, renderer.metrics.characterHeight), radius = 18;
  const sourceX = image.width / sw, sourceY = image.height / sh, ctx = renderer.ctx;
  ctx.save(); ctx.translate(hand.x, hand.y); ctx.scale(direction, 1);
  ctx.drawImage(image, (hx - sx - radius) * sourceX, (hy - sy - radius) * sourceY,
    radius * 2 * sourceX, radius * 2 * sourceY, -radius * k, -radius * k, radius * 2 * k, radius * 2 * k);
  ctx.restore();
}

function body(renderer, entity, x, atlas, index) {
  const image = frameImage(renderer, atlas, index);
  if (!image) return false;
  const { ctx, metrics: m } = renderer;
  const [sx, sy, sw, sh, px, py] = atlas.frames[index];
  const k = characterFrameScale(atlas, index, m.characterHeight);
  const ground = m.groundY + m.characterHeight * (m.groundOffsetRatio ?? .06);
  ctx.save(); ctx.fillStyle = '#26313230'; ctx.beginPath(); ctx.ellipse(x, ground, m.characterHeight * .22, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, ground - (entity.combat?.height || 0) * m.characterHeight); ctx.scale(entity.facing < 0 ? -1 : 1, 1);
  ctx.drawImage(image, (sx - px) * k, (sy - py) * k, sw * k, sh * k); ctx.restore();
  return true;
}

/** Gestes propres aux ultimes ; les coups, sauts et esquives restent pilotés par la simulation. */
export function drawMinorUltimateCandidate(renderer, entity, x, state) {
  if (!entity.minor || entity.is_ko || entity.eliminated || entity.combat?.stun_ticks) return false;
  const hz = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const attack = state.attacks.find(a => a.id === entity.combat.attack_id);
  const power = state.powers.find(p => p.owner_id === entity.id && p.expires_tick > state.tick);
  const gesture = power && !entity.dash_active && (!attack || attack.kind === 'SPECIAL')
    ? minorUltimateGesture(power, state.tick, hz, renderer.config.balance.minor_ultimates, Math.abs(combatDelta(state, power.x, entity.x))) : null;
  if (gesture) {
    const atlas = minorUltimateAtlases[gesture.atlas], direction = power.kind === 'SAUSAGE' && power.returning
      ? (power.catch_direction || power.direction) : power.direction;
    return body(renderer, { ...entity, facing: direction }, x, atlas, gesture.index);
  }
  if (entity.ultimate_effect?.kind === 'TOOLS' && entity.ultimate_effect.expires_tick > state.tick) {
    let index = entity.moving ? Math.floor(state.tick / (hz * .18)) % 2 : 0;
    if (entity.dash_active) index = 6;
    else if (entity.combat.jump_tick != null) index = 7;
    if (attack?.tool) {
      const active = attack.elapsed_ticks >= attack.windup_ticks;
      index = attack.tool === 'HAMMER' ? active ? 5 : 4 : active ? 2 : 3;
    }
    return body(renderer, entity, x, minorUltimateAtlases.tools, index);
  }
  if (attack?.kind === 'SPECIAL' && power?.kind === 'BARRIER') {
    const atlas = minorCombatAtlases[entity.faction_id];
    return body(renderer, entity, x, atlas, attack.elapsed_ticks < attack.windup_ticks ? 2 : 3);
  }
  return false;
}

function confetti(renderer, x, y, progress, radius, count = 24) {
  const { ctx } = renderer;
  ctx.save(); ctx.globalAlpha *= Math.max(0, 1 - progress);
  const colors = ['#fff4ce', '#e65b65', '#7ebed8', '#f2d15f'];
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996, distance = radius * progress * (.4 + (i % 7) / 10);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance + radius * progress * progress * .4, 5, 3);
  }
  ctx.restore();
}

function label(ctx, text, x, y) {
  ctx.font = '700 13px system-ui'; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = '#192838e6'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 16, w, 23, 7); ctx.fill();
  ctx.fillStyle = '#fff0c9'; ctx.fillText(text, x, y);
}

export function drawMinorUltimateEffects(renderer, state) {
  const { ctx, config, metrics: m } = renderer, b = config.balance.minor_ultimates;
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  const ground = m.groundY + m.characterHeight * (m.groundOffsetRatio ?? .06);
  ctx.save();
  for (const p of state.powers) {
    const x = renderer.screenX(p.x), age = (state.tick - p.started_tick) / hz;
    if (p.kind === 'SAUSAGE' || p.kind === 'SATCHEL') {
      const owner = state.candidates.find(c => c.id === p.owner_id), attack = state.attacks.find(a => a.id === owner?.combat?.attack_id);
      const gesture = owner && !owner.is_ko && !owner.eliminated && !owner.combat?.stun_ticks && !owner.dash_active && (!attack || attack.kind === 'SPECIAL')
        ? minorUltimateGesture(p, state.tick, hz, b, Math.abs(combatDelta(state, p.x, owner.x))) : null;
      if (gesture?.held) {
        const direction = p.catch_direction || p.direction, sausage = p.kind === 'SAUSAGE';
        const atlas = minorUltimateAtlases[gesture.atlas];
        const hand = handPoint(renderer, owner, renderer.screenX(owner.x), atlas, gesture.index, direction);
        prop(renderer, sausage ? 0 : 3, hand.x, hand.y, m.characterHeight * (sausage ? .5 : .32),
          (sausage ? gesture.index === 1 ? -.6 : .1 : gesture.index === 1 ? -.35 : .1) * direction, direction,
          minorUltimateAtlases.props, sausage ? [.5, .5] : [.5, .05]);
        handGrip(renderer, atlas, gesture.index, hand, direction);
      }
    }
    if (p.kind === 'SAUSAGE') {
      if (!p.launched || p.caught_tick != null) continue;
      const owner = state.candidates.find(c => c.id === p.owner_id);
      let projectileX = x, y = ground - p.height * m.characterHeight;
      if (owner) {
        const atlas = minorUltimateAtlases.sausageThrow;
        const catching = p.returning && Math.abs(combatDelta(state, p.x, owner.x)) < b.sausage.speed * .2;
        const hand = handPoint(renderer, owner, renderer.screenX(owner.x), atlas, catching ? 5 : 3, p.catch_direction || p.direction);
        const blend = catching ? 1 - Math.min(1, Math.abs(combatDelta(state, p.x, owner.x)) / (b.sausage.speed * .2))
          : Math.max(0, 1 - (state.tick - p.launch_tick) / (hz * .12));
        projectileX += (hand.x - x) * blend; y += (hand.y - y) * blend;
      }
      ctx.strokeStyle = p.returning ? '#f5d582aa' : '#df9b5a88'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(projectileX, y, m.characterHeight * .2, age * 12, age * 12 + Math.PI * 1.25); ctx.stroke();
      const catchBlend = p.returning && owner ? Math.max(0, 1 - Math.abs(combatDelta(state, p.x, owner.x)) / (b.sausage.speed * .2)) : 0;
      const spin = age * (p.returning ? -12 : 12);
      prop(renderer, 0, projectileX, y, m.characterHeight * .5, catchBlend ? Math.atan2(Math.sin(spin), Math.cos(spin)) * (1 - catchBlend) : spin);
    } else if (p.kind === 'DELIVERY') {
      if (age < b.delivery.call_seconds) continue;
      const first = renderer.screenX(p.impacts[0].x);
      const planeX = first + p.direction * (age - b.delivery.call_seconds) / b.delivery.interval_seconds * b.delivery.spacing * m.pixelsPerUnit;
      const planeY = ground - m.characterHeight * 2.1;
      prop(renderer, 0, planeX, planeY, m.characterHeight * 2, 0, p.direction, minorUltimateAtlases.plane);
      label(ctx, 'Livraison express de démocratie', planeX, planeY - m.characterHeight * .5);
      for (const drop of p.impacts) {
        const dx = renderer.screenX(drop.x), remaining = (drop.tick - state.tick) / hz;
        if (remaining > 0 && remaining < b.delivery.warning_seconds) {
          ctx.strokeStyle = '#edcf6dbb'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
          ctx.beginPath(); ctx.ellipse(dx, ground, b.delivery.radius * m.pixelsPerUnit, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          const fall = 1 - remaining / b.delivery.warning_seconds, startY = planeY + m.characterHeight * .16;
          const y = startY + (ground - startY) * fall * fall;
          prop(renderer, 0, dx, y, m.characterHeight * .38, 0, 1, minorUltimateAtlases.bomb);
        } else if (remaining <= 0 && remaining > -.8) confetti(renderer, dx, ground - m.characterHeight * .45, -remaining / .8, b.delivery.radius * m.pixelsPerUnit);
      }
    } else if (p.kind === 'BARRIER') {
      const { progress, reveal, height } = minorBarrierPose(p, state.tick, hz, b.barrier, m.characterHeight);
      const atlas = minorUltimateAtlases.barrier, [, , sw, sh] = atlas.frames[0], width = height * sw / sh;
      const y = ground - p.base_height * m.characterHeight;
      // Bascule sur le bord du pied côté chute : le panneau ne traverse pas le sol.
      ctx.save(); ctx.translate(x + p.direction * width / 2, y); ctx.rotate(p.direction * progress * Math.PI / 2);
      ctx.beginPath(); ctx.rect(-width * 2, -height * reveal, width * 4, height * reveal + 2); ctx.clip();
      prop(renderer, 0, -p.direction * width / 2, -height / 2, width, 0, 1, atlas); ctx.restore();
      if (progress >= 1) confetti(renderer, x + p.direction * height / 2, y, (state.tick - p.fall_tick - hz * b.barrier.fall_seconds) / (hz * .6), height * .4, 10);
    } else if (p.kind === 'SATCHEL' && p.launched) {
      const y = ground - p.height * m.characterHeight - m.characterHeight * .13;
      if (p.detonated_tick != null) {
        const progress = (state.tick - p.detonated_tick) / (hz * .7);
        confetti(renderer, x, y, progress, b.satchel.radius * m.pixelsPerUnit, 42);
        label(ctx, 'Interro surprise !', x, y - 30);
      } else {
        const flightAge = (state.tick - p.launch_tick) / hz;
        let bagX = x, bagY = y;
        const owner = state.candidates.find(c => c.id === p.owner_id);
        if (owner && flightAge < .12 && !p.landed) {
          const hand = handPoint(renderer, owner, renderer.screenX(owner.x), minorUltimateAtlases.satchelThrow, 3, p.direction);
          const frame = minorUltimateAtlases.props.frames[3];
          const blend = Math.max(0, 1 - flightAge / .12), heldOffset = m.characterHeight * .32 * frame[3] / frame[2] * .45;
          bagX += (hand.x - x) * blend; bagY += (hand.y + heldOffset - y) * blend;
        }
        prop(renderer, 3, bagX, bagY, m.characterHeight * .32, (p.landed ? Math.sin(age * 3) * .035 : flightAge * 5) * p.direction, p.direction);
        ctx.fillStyle = Math.floor(age * 5) % 2 ? '#e35a4b' : '#ffe795'; ctx.beginPath(); ctx.arc(bagX, bagY - m.characterHeight * .18, 3, 0, Math.PI * 2); ctx.fill();
        if (p.owner_id === state.local_candidate_id) label(ctx, 'Ultime : faire éclater', bagX, bagY - m.characterHeight * .27);
      }
    }
  }
  ctx.restore();
}

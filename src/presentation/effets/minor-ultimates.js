import { minorUltimateAtlases } from './minor-ultimate-art.js';
import { prepareAtlasFrames } from '../personnages/minor-sprite-images.js';
import { minorCombatAtlases } from '../personnages/minor-animation-sprites.js';
import { characterFrameScale } from '../personnages/character-scale.js';

function frameImage(renderer, atlas, index) {
  const image = renderer.assets.get(atlas.sprite);
  if (!image) { void renderer.assets.load(atlas.sprite); return null; }
  return prepareAtlasFrames(image, atlas)[index];
}

function prop(renderer, index, x, y, width, angle = 0, direction = 1, height = null) {
  const frame = frameImage(renderer, minorUltimateAtlases.props, index);
  if (!frame) return;
  const { ctx } = renderer;
  const h = height ?? width * frame.height / frame.width;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(direction, 1);
  ctx.drawImage(frame, -width / 2, -h / 2, width, h); ctx.restore();
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
  if (power?.kind === 'DELIVERY' && state.tick - power.started_tick < hz * renderer.config.balance.minor_ultimates.delivery.call_seconds) {
    return body(renderer, entity, x, minorUltimateAtlases.phone, 1 + Math.floor((state.tick - power.started_tick) / (hz * .35)) % 2);
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
  if (attack?.kind === 'SPECIAL' && ['SAUSAGE', 'SATCHEL', 'BARRIER'].includes(power?.kind)) {
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
  ctx.save();
  for (const p of state.powers) {
    const x = renderer.screenX(p.x), age = (state.tick - p.started_tick) / hz;
    if (p.kind === 'SAUSAGE') {
      const y = m.groundY - p.height * m.characterHeight;
      ctx.strokeStyle = p.returning ? '#f5d582aa' : '#df9b5a88'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, m.characterHeight * .2, age * 12, age * 12 + Math.PI * 1.25); ctx.stroke();
      prop(renderer, 0, x, y, m.characterHeight * .5, age * (p.returning ? -12 : 12));
    } else if (p.kind === 'DELIVERY') {
      if (age < b.delivery.call_seconds) continue;
      const progress = Math.min(1, (age - b.delivery.call_seconds) / (b.delivery.warning_seconds + b.delivery.interval_seconds * 3));
      const first = renderer.screenX(p.impacts[0].x), last = renderer.screenX(p.impacts.at(-1).x);
      const planeX = first - p.direction * 150 + (last - first + p.direction * 300) * progress;
      const planeY = m.groundY - m.characterHeight * 2.1;
      prop(renderer, 1, planeX, planeY, m.characterHeight * 1.5, 0, p.direction);
      label(ctx, 'Livraison express de démocratie', planeX, planeY - m.characterHeight * .5);
      for (const drop of p.impacts) {
        const dx = renderer.screenX(drop.x), remaining = (drop.tick - state.tick) / hz;
        if (remaining > 0 && remaining < b.delivery.warning_seconds) {
          ctx.strokeStyle = '#edcf6dbb'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
          ctx.beginPath(); ctx.ellipse(dx, m.groundY, b.delivery.radius * m.pixelsPerUnit, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          const y = m.groundY - m.characterHeight * 1.8 * Math.min(1, remaining / b.delivery.warning_seconds);
          ctx.fillStyle = '#fff1cf'; ctx.strokeStyle = '#334f70'; ctx.fillRect(dx - 9, y - 6, 18, 12); ctx.strokeRect(dx - 9, y - 6, 18, 12);
          ctx.beginPath(); ctx.moveTo(dx - 9, y - 6); ctx.lineTo(dx, y + 1); ctx.lineTo(dx + 9, y - 6); ctx.stroke();
        } else if (remaining <= 0 && remaining > -.8) confetti(renderer, dx, m.groundY - m.characterHeight * .45, -remaining / .8, b.delivery.radius * m.pixelsPerUnit);
      }
    } else if (p.kind === 'BARRIER') {
      const progress = Math.min(1, Math.max(0, (state.tick - p.fall_tick) / (hz * b.barrier.fall_seconds)));
      const rise = Math.min(1, age / .2), width = b.barrier.half_width * 2 * m.pixelsPerUnit;
      const height = (b.barrier.height * m.characterHeight * (1 - progress) + b.barrier.fall_range * m.pixelsPerUnit * progress) * rise;
      const y = m.groundY - p.base_height * m.characterHeight;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.direction * progress * Math.PI / 2);
      prop(renderer, 2, 0, -height / 2, width, 0, 1, height); ctx.restore();
      if (progress >= 1) confetti(renderer, x + p.direction * height / 2, y, (state.tick - p.fall_tick - hz * b.barrier.fall_seconds) / (hz * .6), height * .4, 10);
    } else if (p.kind === 'SATCHEL' && p.launched) {
      const y = m.groundY - p.height * m.characterHeight - m.characterHeight * .13;
      if (p.detonated_tick != null) {
        const progress = (state.tick - p.detonated_tick) / (hz * .7);
        confetti(renderer, x, y, progress, b.satchel.radius * m.pixelsPerUnit, 42);
        label(ctx, 'Interro surprise !', x, y - 30);
      } else {
        prop(renderer, 3, x, y, m.characterHeight * .32, p.landed ? Math.sin(age * 3) * .035 : age * 5, p.direction);
        ctx.fillStyle = Math.floor(age * 5) % 2 ? '#e35a4b' : '#ffe795'; ctx.beginPath(); ctx.arc(x, y - m.characterHeight * .18, 3, 0, Math.PI * 2); ctx.fill();
        if (p.owner_id === state.local_candidate_id) label(ctx, 'Ultime : faire éclater', x, y - m.characterHeight * .27);
      }
    }
  }
  ctx.restore();
}

import { SERVICE_ORDER_ATLASES } from './service-order-atlases.js';
import { drawCharacterAtlasFrame } from './character-scale.js';
import { standingSpriteMotion, drawStandingSprite } from './standing-sprite-motion.js';
import { SERVICE_ORDER_STYLES } from '../../simulation/service-order-rules.js';
import { npcGender } from '../../simulation/npc-appearance.js';
import { serviceOrderKickCycle, serviceOrderSeed } from '../../simulation/service-order-formation.js';

export const SERVICE_ORDER_VARIANTS = {
  melenchon: ['melenchon-cgt-h', 'melenchon-cgt-f', 'melenchon-antifa-1-h', 'melenchon-antifa-1-f',
    'melenchon-antifa-2-h', 'melenchon-antifa-2-f', 'melenchon-cite-h', 'melenchon-cite-f',
    'melenchon-orange-1-h', 'melenchon-orange-1-f', 'melenchon-orange-2-h', 'melenchon-orange-2-f'],
  le_pen: ['le-pen-gud-1-h', 'le-pen-gud-1-f', 'le-pen-gud-2-h', 'le-pen-gud-2-f',
    'le-pen-rural-h', 'le-pen-rural-f', 'le-pen-veteran-h', 'le-pen-veteran-f',
    'le-pen-rural-2-h', 'le-pen-rural-2-f', 'le-pen-rural-3-h', 'le-pen-rural-3-f'],
};

function identitySeed(id) {
  let seed = 0;
  for (const letter of String(id)) seed = (Math.imul(seed, 31) + letter.charCodeAt(0)) >>> 0;
  return seed;
}

/** Le sexe d'origine et la tenue de l'escouade restent stables après l'équipement. */
export function serviceOrderVariant(entity, state) {
  if (entity.role !== 'SERVICE_D_ORDRE') return null;
  const duty = entity.raid ? 'RAID' : 'DEFENSE';
  const styles = SERVICE_ORDER_STYLES[entity.faction_id]?.[duty];
  if (!styles) return null;
  const assignment = entity.so_assignment;
  const gender = assignment?.gender ?? (state ? npcGender(entity, state) : identitySeed(entity.id) % 2 ? 'f' : 'h');
  return `${styles[assignment?.style ?? identitySeed(entity.id) % styles.length]}-${gender}`;
}

export function serviceOrderAssetId(entity, state) {
  const variant = serviceOrderVariant(entity, state);
  return variant ? `security-so-${variant}` : null;
}

/** Coups de poing en combat ; genou, coup de pied et retour d’appui contre une façade. */
export function serviceOrderPose(entity, state, hz) {
  const combat = entity.combat;
  if (entity.is_ko || (combat?.knockdown_tick != null && combat.stun_ticks > 0
    && state.tick < combat.invulnerable_until_tick)) return { frame: 0, mode: 'ko' };
  if (combat?.stun_ticks > 0) return { frame: 3, mode: 'hurt' };
  const attack = state.attacks?.find(a => a.owner_id === entity.id);
  if (attack) {
    const frame = attack.elapsed_ticks < attack.windup_ticks ? 1
      : attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks ? 2 : 3;
    return { frame, mode: 'punch' };
  }
  const building = entity.pressure_target_id && state.buildings?.find(b => b.id === entity.pressure_target_id);
  if (entity.raid && !entity.moving && !combat?.engaged && building?.state === 'ACTIVE'
    && building.owner_id && building.owner_id !== entity.faction_id) {
    // Décalage propre à chaque garde : le groupe ne frappe pas comme un seul personnage.
    const cycle = serviceOrderKickCycle(entity, state.tick, hz);
    return { frame: cycle < .2 ? 4 : cycle < .38 ? 5 : cycle < .58 ? 4 : 0,
      mode: 'building', impactAge: cycle - .2 };
  }
  if (!entity.moving && combat?.engaged) return { frame: 1, mode: 'ready' };
  return { frame: 0, mode: entity.moving ? 'walk' : 'idle' };
}

/** Poussière et éclats provisoires : aucune modification permanente de la façade. */
function drawFacadeImpact(ctx, height, contact, age) {
  if (age < 0 || age > .32) return;
  const progress = age / .32, x = height * contact.x, y = height * contact.y;
  ctx.save();
  ctx.globalAlpha *= 1 - progress;
  if (progress < .35) {
    ctx.strokeStyle = '#fff0ba'; ctx.lineWidth = Math.max(1, height * .012);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3, radius = height * (.04 + progress * .15);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * radius * .4, y + Math.sin(angle) * radius * .4);
      ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius); ctx.stroke();
    }
  }
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const dx = side * height * (.03 + i * .012) * progress;
    const dy = -height * (.08 + (i % 3) * .025) * Math.sin(progress * Math.PI) + height * .1 * progress;
    ctx.fillStyle = i % 2 ? '#a99982' : '#d9cab0';
    ctx.beginPath(); ctx.arc(x + dx, y + dy, height * (.014 + progress * .025), 0, Math.PI * 2); ctx.fill();
    const size = height * .018;
    ctx.fillStyle = '#716c62'; ctx.fillRect(x + dx * 1.6, y + dy * 1.4, size, size * .6);
  }
  ctx.restore();
}

export function drawServiceOrderCharacter(renderer, entity, x, state) {
  const variant = serviceOrderVariant(entity, state), atlas = SERVICE_ORDER_ATLASES[variant];
  if (!atlas) return false;
  const { ctx, metrics: m, p } = renderer;
  const hz = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const pose = serviceOrderPose(entity, state, hz);
  // Les syndicalistes et les ruraux gardent leurs dessins ordinaires ; seuls leurs coups de pied
  // utilisent une planche additionnelle avec la même silhouette et une pose debout d’étalonnage.
  const definition = pose.mode === 'building' && pose.frame >= 4 && atlas.building ? atlas.building : atlas;
  const frameIndex = definition === atlas ? pose.frame : pose.frame - 3;
  const image = renderer.assets.get(definition.sprite);
  if (!image) { void renderer.assets.load(definition.sprite); return false; }
  const height = m.characterHeight * p.npc_height_multiplier;
  const scale = height / definition.referenceHeight;
  const floor = m.groundY + m.characterHeight * (m.groundOffsetRatio ?? .06);
  const feet = floor - (entity.combat?.height || 0) * m.characterHeight;
  const frame = definition.frames[frameIndex], width = frame[2] * scale;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#26313230'; ctx.beginPath(); ctx.ellipse(x, floor, height * .24, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, feet); ctx.scale(entity.facing < 0 ? -1 : 1, 1);
  if (pose.mode === 'building' && pose.frame >= 4) ctx.translate(height * (definition.kickFootOffset || 0), 0);
  if (pose.mode === 'ko') { ctx.translate(0, -height * .2); ctx.rotate(-Math.PI / 2); }
  else if (pose.mode === 'hurt') ctx.rotate(-.12);
  else if (pose.mode === 'idle' || pose.mode === 'ready') {
    const time = state.tick / hz + serviceOrderSeed(entity.id) % 101;
    ctx.rotate(Math.sin(time * 1.3) * .012);
    const breath = 1 + Math.sin(time * 2.1) * .0015; ctx.scale(breath, breath);
  }
  if (pose.mode === 'walk') {
    const [sx, sy, sw, sh, px] = frame;
    ctx.save(); ctx.translate((sx - px) * scale + width / 2, 0);
    drawStandingSprite(ctx, image, { x: sx, y: sy, width: sw, height: sh }, sh * scale, width,
      standingSpriteMotion(entity.task?.phase === 'RAID' || entity.combat?.engaged ? 'run' : 'walk', state.tick / hz + serviceOrderSeed(entity.id) % 101 / 13));
    ctx.restore();
  } else drawCharacterAtlasFrame(ctx, image, definition, frameIndex, scale);
  const faction = p.factions[entity.faction_id];
  if (faction) {
    ctx.fillStyle = faction.color; ctx.strokeStyle = '#fff5df'; ctx.lineWidth = Math.max(1.5, height * .008);
    ctx.beginPath(); ctx.arc(height * .05, -height * .6, Math.max(3, height * .026), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  if (pose.mode === 'building') drawFacadeImpact(ctx, height, definition.kickImpact || { x: .5, y: -.34 }, pose.impactAge);
  ctx.restore();
  renderer.personMarks?.set(entity.id, { x, feetY: feet, height, facing: entity.facing < 0 ? -1 : 1 });
  return true;
}

import { characterAnimation } from './illustrated-characters.js';
import { MINOR_SHEET, minorSheetCell } from './minor-sprites.js';
import { cleanGeneratedImage } from './fixed-world.js';
import { MINOR_ATLASES } from './minor-sprite-atlases.js';
import { prepareMinorFrames, prepareAtlasFrames } from './minor-sprite-images.js';
import { minorExtraAtlases } from './minor-animation-sprites.js';
import { drawCandidateCombat } from './melenchon-combat.js';
import { drawStandingSprite, standingSpriteMotion } from './standing-sprite-motion.js';

/**
 * Dessin de secours des candidats secondaires si leur planche est indisponible.
 */
const INK = '#23201e';
const SKIN = '#f1c7a3';
export const MINOR_LOOKS = {
  glucksmann: { name: 'Glucksmann', fullName: 'Raphaël Glucksmann', suit: '#27344d', shirt: '#f4f1ea', accent: '#d9719f', hair: '#3a2b24', hairStyle: 'mop', build: 0.92, tall: 1.04, tie: false, pocket: true },
  roussel: { name: 'Roussel', fullName: 'Fabien Roussel', suit: '#5d5f63', shirt: '#f1ede4', accent: '#b8232f', hair: '#8c8a86', hairStyle: 'mop', build: 1.18, tall: 0.96, tie: false, cheeks: true },
  arthaud: { name: 'Arthaud', fullName: 'Nathalie Arthaud', suit: '#b3342c', shirt: '#2f2b2a', accent: '#d8312b', hair: '#302b27', hairStyle: 'short', build: 0.9, tall: 0.93, tie: false, woman: true, glasses: true, trousers: '#3b4a63' },
  dupont_aignan: { name: 'Dupont-Aignan', fullName: 'Nicolas Dupont-Aignan', suit: '#2c2c33', shirt: '#eef0f2', accent: '#6a4c93', hair: '#79736b', hairStyle: 'side', build: 1, tall: 1.06, tie: true, glasses: false },
  retailleau: { name: 'Retailleau', fullName: 'Bruno Retailleau', suit: '#1f2a3a', shirt: '#f0f2f4', accent: '#2d8fcf', hair: '#696763', hairStyle: 'receding', build: 0.95, tall: 1, tie: true, glasses: true },
  attal: { name: 'Attal', fullName: 'Gabriel Attal', suit: '#1d2f5a', shirt: '#f5f5f2', accent: '#ee9322', hair: '#2a211d', hairStyle: 'short', build: 0.9, tall: 0.98, tie: false, young: true },
};

const lerp = (a, b, t) => a + (b - a) * t;

function outlined(ctx, draw, fill, width = 2) {
  ctx.beginPath(); draw(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = width; ctx.strokeStyle = INK; ctx.stroke();
}

/** Membre à deux segments (épaule→coude→main), trait épais encré. */
function limb(ctx, x, y, a1, a2, l1, l2, width, color, end = null) {
  const ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
  const hx = ex + Math.sin(a1 + a2) * l2, hy = ey + Math.cos(a1 + a2) * l2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = width + 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  if (end) outlined(ctx, () => ctx.ellipse(hx + end.dx, hy, end.rx, end.ry, 0, 0, Math.PI * 2), end.color, 1.5);
  return { x: hx, y: hy };
}

/** Pose selon l'animation du jeu : angles des membres, inclinaison, accroupissement. */
export function minorPose(animation, time, progress = 0) {
  const pose = { lean: 0, crouch: 0, armF: [0.15, -0.2], armB: [-0.15, -0.2], legF: 0, legB: 0, mouth: 0, head: 0 };
  const swing = (speed, amount) => Math.sin(time * speed) * amount;
  switch (animation) {
    case 'walk': case 'demobilised_return': Object.assign(pose, { legF: swing(13, 0.45), legB: -swing(13, 0.45), armF: [-swing(13, 0.35), -0.3], armB: [swing(13, 0.35), -0.3] }); break;
    case 'run': Object.assign(pose, { lean: 0.12, legF: swing(20, 0.7), legB: -swing(20, 0.7), armF: [-swing(20, 0.6), -1.1], armB: [swing(20, 0.6), -1.1] }); break;
    case 'attack_light_1': Object.assign(pose, { lean: lerp(-0.05, 0.12, progress), armF: [lerp(0.4, 1.55, progress), lerp(-1.6, -0.05, progress)], armB: [-0.4, -1.3], legF: 0.25, legB: -0.2, mouth: 1 }); break;
    case 'attack_light_2': Object.assign(pose, { lean: lerp(0, 0.15, progress), armB: [lerp(-0.2, 1.5, progress), lerp(-1.5, -0.2, progress)], armF: [0.6, -1.4], legF: 0.3, legB: -0.25, mouth: 1 }); break;
    case 'attack_heavy': Object.assign(pose, { lean: lerp(-0.15, 0.25, progress), crouch: 0.05, armF: [lerp(-0.6, 1.9, progress), lerp(-0.4, -0.1, progress)], armB: [lerp(-0.4, 1.4, progress), -0.4], legF: 0.45, legB: -0.35, mouth: 1 }); break;
    case 'charged_attack': Object.assign(pose, { lean: -0.12, crouch: 0.08, armF: [-0.9, -1.2], armB: [-0.6, -1.4], legF: 0.35, legB: -0.3, mouth: 0.6 }); break;
    case 'hurt': Object.assign(pose, { lean: -0.18, armF: [2.4, 0.6], armB: [2.2, 0.5], legF: 0.1, legB: -0.1, mouth: 0.8, head: -0.15 }); break;
    case 'knockback': Object.assign(pose, { lean: -0.35, armF: [2.8, 0.3], armB: [2.6, 0.2], legF: 0.4, legB: 0.2, mouth: 1, head: -0.25 }); break;
    case 'persuade': Object.assign(pose, { armF: [1.2 + swing(4, 0.25), -1.3], armB: [-0.1, -0.2], mouth: 0.5 + swing(9, 0.5) }); break;
    case 'jump': Object.assign(pose, { crouch: -0.02, legF: 0.6, legB: -0.1, armF: [2.2, -0.4], armB: [2.4, -0.3] }); break;
    default: Object.assign(pose, { armF: [0.12 + swing(2, 0.03), -0.25], armB: [-0.12, -0.25] });
  }
  return pose;
}

function drawHead(ctx, look, cx, cy, r, pose) {
  outlined(ctx, () => ctx.ellipse(cx, cy, r * (look.woman ? 0.86 : 0.9), r, 0, 0, Math.PI * 2), SKIN, 2.2);
  // Cheveux selon le personnage.
  ctx.fillStyle = look.hair; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath();
  if (look.hairStyle === 'mop') { ctx.ellipse(cx - r * 0.05, cy - r * 0.55, r * 0.98, r * 0.62, -0.1, Math.PI, 2.2 * Math.PI); }
  else if (look.hairStyle === 'bob') { ctx.moveTo(cx - r * 0.95, cy + r * 0.45); ctx.quadraticCurveTo(cx - r * 1.05, cy - r * 1.2, cx, cy - r * 1.05); ctx.quadraticCurveTo(cx + r * 1.05, cy - r * 1.1, cx + r * 0.95, cy + r * 0.45); ctx.lineTo(cx + r * 0.7, cy + r * 0.4); ctx.quadraticCurveTo(cx + r * 0.7, cy - r * 0.55, cx, cy - r * 0.6); ctx.quadraticCurveTo(cx - r * 0.7, cy - r * 0.5, cx - r * 0.7, cy + r * 0.4); ctx.closePath(); }
  else if (look.hairStyle === 'bald') { ctx.ellipse(cx - r * 0.78, cy - r * 0.1, r * 0.2, r * 0.35, 0.3, 0, Math.PI * 2); ctx.moveTo(cx + r * 0.95, cy - r * 0.1); ctx.ellipse(cx + r * 0.78, cy - r * 0.1, r * 0.2, r * 0.35, -0.3, 0, Math.PI * 2); }
  else if (look.hairStyle === 'receding') { ctx.ellipse(cx - r * 0.35, cy - r * 0.72, r * 0.62, r * 0.32, -0.25, Math.PI * 0.95, 2.05 * Math.PI); }
  else if (look.hairStyle === 'side') { ctx.ellipse(cx, cy - r * 0.62, r * 0.92, r * 0.48, 0, Math.PI, 2 * Math.PI); ctx.moveTo(cx + r * 0.2, cy - r * 1.08); ctx.lineTo(cx + r * 0.1, cy - r * 0.62); }
  else { ctx.ellipse(cx, cy - r * 0.62, r * 0.9, r * 0.45, 0, Math.PI, 2 * Math.PI); }
  ctx.fill(); ctx.stroke();
  // Visage tourné vers la droite (le sens de marche) : yeux, nez, bouche.
  const ex = cx + r * 0.38, ey = cy - r * 0.08;
  ctx.fillStyle = INK;
  for (const dx of [-0.26, 0.12]) { ctx.beginPath(); ctx.ellipse(ex + dx * r, ey, r * 0.1, r * 0.14, 0, 0, Math.PI * 2); ctx.fill(); }
  if (look.glasses) { ctx.lineWidth = 1.6; ctx.strokeStyle = INK; for (const dx of [-0.26, 0.12]) { ctx.beginPath(); ctx.ellipse(ex + dx * r, ey, r * 0.17, r * 0.14, 0, 0, Math.PI * 2); ctx.stroke(); } }
  outlined(ctx, () => { ctx.moveTo(cx + r * 0.62, cy); ctx.quadraticCurveTo(cx + r * 1.02, cy + r * 0.18, cx + r * 0.62, cy + r * 0.3); }, '#e9aa86', 1.6);
  if (look.cheeks) { ctx.fillStyle = '#e58a7a88'; ctx.beginPath(); ctx.arc(cx + r * 0.2, cy + r * 0.3, r * 0.16, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath();
  if (pose.mouth > 0.3) ctx.ellipse(cx + r * 0.42, cy + r * 0.5, r * 0.16, r * 0.1 * (0.5 + pose.mouth), 0, 0, Math.PI * 2);
  else { ctx.moveTo(cx + r * 0.28, cy + r * 0.48); ctx.quadraticCurveTo(cx + r * 0.45, cy + r * (look.young ? 0.62 : 0.56), cx + r * 0.62, cy + r * 0.45); }
  ctx.stroke();
}

/** Dessine le pantin dans un repère local : pieds en (0, 0), hauteur totale h, regard vers la droite. */
export function drawMinorFigure(ctx, faction, h, animation, time, progress = 0, airborne = false) {
  const look = MINOR_LOOKS[faction];
  const pose = minorPose(airborne && !animation.startsWith('attack') ? 'jump' : animation, time, progress);
  const s = h / 100, w = look.build;
  ctx.save(); ctx.scale(s * look.tall * w, s * look.tall);
  ctx.scale(1 / w, 1);
  const hip = { x: 0, y: -40 + pose.crouch * 100 };
  // Jambes (celle de derrière d'abord), pantalon du costume, chaussures.
  const trousers = look.trousers || look.suit;
  limb(ctx, hip.x - 5, hip.y, pose.legB, -Math.max(0, pose.legB) * 0.6, 21, 20, 11 * w, trousers, { dx: 4, rx: 7, ry: 3.5, color: '#1b1817' });
  // Torse penché : veste, chemise, cravate ou foulard.
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(pose.lean);
  const shoulderY = -30, shoulderW = 15 * w;
  limb(ctx, -shoulderW * 0.55, shoulderY + 2, pose.armB[0], pose.armB[1], 14, 13, 8 * w, look.suit, { dx: 0, rx: 4.2, ry: 4.2, color: SKIN });
  outlined(ctx, () => { ctx.moveTo(-shoulderW, shoulderY); ctx.lineTo(shoulderW, shoulderY); ctx.lineTo(shoulderW * 0.82, 2); ctx.lineTo(-shoulderW * 0.82, 2); ctx.closePath(); }, look.suit, 2.2);
  outlined(ctx, () => { ctx.moveTo(-4, shoulderY); ctx.lineTo(4, shoulderY); ctx.lineTo(0, shoulderY + 13); ctx.closePath(); }, look.shirt, 1.4);
  if (look.tie) outlined(ctx, () => { ctx.moveTo(-1.8, shoulderY + 2); ctx.lineTo(1.8, shoulderY + 2); ctx.lineTo(2.6, shoulderY + 16); ctx.lineTo(0, shoulderY + 19); ctx.lineTo(-2.6, shoulderY + 16); ctx.closePath(); }, look.accent, 1.2);
  else outlined(ctx, () => ctx.arc(shoulderW * 0.45, shoulderY + 9, 2.6, 0, Math.PI * 2), look.accent, 1.2);
  if (look.pocket) outlined(ctx, () => { ctx.moveTo(shoulderW * 0.25, shoulderY + 6); ctx.lineTo(shoulderW * 0.6, shoulderY + 6); ctx.lineTo(shoulderW * 0.5, shoulderY + 10); ctx.closePath(); }, look.accent, 1);
  drawHead(ctx, look, 2, shoulderY - 17 + pose.head * 4, 17, pose);
  ctx.restore();
  // Jambe et bras de devant.
  limb(ctx, hip.x + 5, hip.y, pose.legF, -Math.max(0, pose.legF) * 0.6, 21, 20, 11 * w, trousers, { dx: 4, rx: 7, ry: 3.5, color: '#1b1817' });
  const sx = hip.x + Math.sin(pose.lean) * 30 + shoulderW * 0.55 * Math.cos(pose.lean), sy = hip.y - Math.cos(pose.lean) * 28;
  limb(ctx, sx, sy, pose.armF[0], pose.armF[1], 14, 13, 8 * w, look.suit, { dx: 0, rx: 4.6, ry: 4.6, color: SKIN });
  ctx.restore();
}

/** Point d'entrée du rendu : remplace le sprite pour un candidat mineur. */
export function drawMinorCandidate(renderer, entity, x, state) {
  if (!entity.minor || !MINOR_LOOKS[entity.faction_id]) return false;
  const { ctx, metrics: m } = renderer, hz = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const animation = characterAnimation(entity, state), time = state.tick / hz;
  const attack = state.attacks?.find(a => a.owner_id === entity.id);
  const progress = attack ? Math.min(1, attack.elapsed_ticks / Math.max(1, attack.windup_ticks + attack.active_ticks)) : 0;
  const height = m.characterHeight, groundY = m.groundY + height * (m.groundOffsetRatio ?? 0.06);
  const feetY = groundY - (entity.combat?.height || 0) * height;
  if (drawCandidateCombat(renderer, entity, x, state)) return true;
  ctx.save();
  ctx.fillStyle = '#26313230'; ctx.beginPath(); ctx.ellipse(x, groundY, height * 0.22, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, feetY); ctx.scale(entity.facing < 0 ? -1 : 1, 1);
  if (entity.combat?.charge_active) { ctx.shadowColor = renderer.p.factions[entity.faction_id].color; ctx.shadowBlur = 14; }
  const assetId = `minor-${entity.faction_id}`;
  const airborne = (entity.combat?.height || 0) > 0.02;
  const listening = animation === 'persuade_listen' ? minorExtraAtlases[entity.faction_id]?.actions : null;
  const listenSheet = listening ? renderer.assets.get(listening.sprite) : null;
  if (listening && !listenSheet) void renderer.assets.load(listening.sprite);
  const sheet = listenSheet || renderer.assets.get(assetId);
  if (!sheet) void renderer.assets.load(assetId);
  if (sheet) {
    // Les rectangles mesurés évitent de couper les cheveux, les coups et les chaussures.
    const image = cleanGeneratedImage(sheet);
    const motion = standingSpriteMotion(animation, time);
    const cell = listenSheet ? 6 + Math.floor(time / .35) % 2 : motion.walking ? 0 : minorSheetCell(animation, time, airborne);
    const atlas = listenSheet ? listening : MINOR_ATLASES[entity.faction_id];
    ctx.imageSmoothingEnabled = true;
    if (atlas) {
      const [sx, sy, sw, sh, px, py] = atlas.frames[cell];
      const standingScale = !listenSheet && entity.faction_id === 'roussel' ? .94 : 1;
      const k = height / atlas.referenceHeight * (atlas.frameScales?.[cell] ?? 1) * standingScale;
      // Même largeur de silhouette debout que Philippe (161 px pour 384 px),
      // sauf Dupont-Aignan, plus mince : sa largeur naturelle évite de l’écraser.
      const widthScale = listenSheet ? (atlas.widthScale || 1) : entity.faction_id === 'dupont_aignan' ? 1 : (161 / 384) * atlas.referenceHeight / atlas.frames[0][2];
      ctx.scale(widthScale, 1);
      const frame = (listenSheet ? prepareAtlasFrames(sheet, listening) : prepareMinorFrames(sheet, entity.faction_id))[cell];
      if (motion.walking) {
        ctx.rotate(motion.stride * .025); ctx.scale(1 / motion.breathing, motion.breathing);
        drawStandingSprite(ctx, frame, { x: 0, y: 0, width: sw, height: sh }, height * standingScale, sw * k, motion);
      } else ctx.drawImage(frame, (sx - px) * k, (sy - py) * k, sw * k, sh * k);
    } else {
      const cw = image.width / MINOR_SHEET.columns, ch = image.height / MINOR_SHEET.rows;
      const k = height / MINOR_SHEET.figure * MINOR_SHEET.width / image.width;
      ctx.drawImage(image, (cell % MINOR_SHEET.columns) * cw, Math.floor(cell / MINOR_SHEET.columns) * ch, cw, ch, -cw * k / 2, -MINOR_SHEET.feet * image.width / MINOR_SHEET.width * k, cw * k, ch * k);
    }
  } else {
    if (animation === 'ko') { ctx.translate(-height * 0.1, -height * 0.12); ctx.rotate(-Math.PI / 2); }
    drawMinorFigure(ctx, entity.faction_id, height, animation, time, progress, (entity.combat?.height || 0) > 0.02);
  }
  ctx.restore();
  return true;
}

import { prepareAtlasFrames } from './minor-sprite-images.js';

// Taille de la garde de Philippe, en unités de hauteur de personnage.
// Le même coefficient est appliqué aux deux axes : aucun étirement du dessin.
export const CHARACTER_HEIGHT_RATIO = 296 / 340 * 1.1236;

export function characterFrameScale(atlas, frame, height) {
  return height * CHARACTER_HEIGHT_RATIO / (atlas.standingHeight || atlas.frames[0][3]) * (atlas.anatomicalScales?.[frame] ?? 1);
}

/** Dessin commun au jeu et au contrôle des planches ; proportions natives par défaut. */
export function drawCharacterAtlasFrame(ctx, image, atlas, index, scale) {
  const [sx, sy, sw, sh, px, py] = atlas.frames[index];
  const clip = atlas.clips?.[index];
  const scaleX = scale * (atlas.frameWidthScales?.[index] ?? 1);
  ctx.save();
  if (clip) {
    ctx.beginPath();
    clip.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo']((x - px) * scaleX, (y - py) * scale));
    ctx.closePath(); ctx.clip();
  }
  if (atlas.isolated) ctx.drawImage(prepareAtlasFrames(image, atlas)[index], (sx-px)*scaleX, (sy-py)*scale, sw*scaleX, sh*scale);
  else ctx.drawImage(image, sx, sy, sw, sh, (sx-px)*scaleX, (sy-py)*scale, sw*scaleX, sh*scale);
  ctx.restore();
}

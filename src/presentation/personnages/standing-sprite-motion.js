/** Mouvement discret commun aux candidats principaux, secondaires et habitants. */
export function standingSpriteMotion(animation, time) {
  const walking = ['walk', 'run', 'demobilised_return'].includes(animation);
  return { walking, stride: walking ? Math.sin(time * (animation === 'run' ? 20 : 13)) : 0,
    breathing: walking ? 1 + Math.sin(time * 3) * .004 : 1 };
}

/** Balancement commun des PNJ, autour de la pose de base et de ses appuis. */
export function applyNpcStandingMotion(ctx, { stride, breathing }) {
  ctx.rotate(stride * .025);
  ctx.scale(1 / breathing, breathing);
}

/** kx, ky : pixels de `sprite` par unité de `frame` (découpe réduite) ; 1 pour une planche ordinaire. */
export function drawStandingSprite(ctx, sprite, frame, height, width, { walking, stride, rigid = false }, kx = 1, ky = 1) {
  const draw = (x, y, w, h, dx, dy, dw, dh) => ctx.drawImage(sprite, x * kx, y * ky, w * kx, h * ky, dx, dy, dw, dh);
  if (!walking || rigid) {
    draw(frame.x, frame.y, frame.width, frame.height, -width / 2, -height, width, height);
    return;
  }
  const split = Math.floor(frame.height * .75), upperHeight = height * split / frame.height, legHeight = height - upperHeight;
  // Les découpes se recouvrent sous le buste : leurs bords filtrés ne laissent plus
  // apparaître un trait transparent au genou, notamment à une échelle fractionnaire.
  const overlap = Math.min(2, split), overlapHeight = height * overlap / frame.height;
  for (const side of [0, 1]) draw(frame.x + side * frame.width / 2, frame.y + split - overlap, frame.width / 2, frame.height - split + overlap,
    -width / 2 + side * width / 2, -legHeight - overlapHeight, width / 2, legHeight + overlapHeight - Math.max(0, stride * (side ? -1 : 1)) * 3);
  draw(frame.x, frame.y, frame.width, split, -width / 2, -height, width, upperHeight);
}

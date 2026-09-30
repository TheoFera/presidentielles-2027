/** Mouvement discret commun aux candidats principaux, secondaires et habitants. */
export function standingSpriteMotion(animation, time) {
  const walking = ['walk', 'run', 'demobilised_return'].includes(animation);
  return { walking, stride: walking ? Math.sin(time * (animation === 'run' ? 20 : 13)) : 0,
    breathing: walking ? 1 + Math.sin(time * 3) * .004 : 1 };
}

export function drawStandingSprite(ctx, sprite, frame, height, width, { walking, stride }) {
  if (!walking) {
    ctx.drawImage(sprite, frame.x, frame.y, frame.width, frame.height, -width / 2, -height, width, height);
    return;
  }
  const split = Math.floor(frame.height * .75), upperHeight = height * split / frame.height, legHeight = height - upperHeight;
  ctx.drawImage(sprite, frame.x, frame.y, frame.width, split, -width / 2, -height, width, upperHeight);
  for (const side of [0, 1]) ctx.drawImage(sprite, frame.x + side * frame.width / 2, frame.y + split, frame.width / 2, frame.height - split,
    -width / 2 + side * width / 2, -legHeight, width / 2, legHeight - Math.max(0, stride * (side ? -1 : 1)) * 3);
}

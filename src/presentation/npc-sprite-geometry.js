const frames = new WeakMap();

// Les marges transparentes ne comptent pas dans la taille du personnage.
export function opaqueSpriteFrame(pixels, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] < 16) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right < left ? { x: 0, y: 0, width, height }
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function npcSpriteFrame(source) {
  if (frames.has(source)) return frames.get(source);
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  const fallback = { x: 0, y: 0, width, height };
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return fallback;
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return fallback;
  context.drawImage(source, 0, 0);
  const frame = opaqueSpriteFrame(context.getImageData(0, 0, width, height).data, width, height);
  frames.set(source, frame);
  return frame;
}

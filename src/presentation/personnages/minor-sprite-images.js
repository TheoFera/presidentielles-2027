import { cleanGeneratedImage } from '../carte/fixed-world.js';
import { MINOR_ATLASES } from './minor-sprite-atlases.js';

const cache = new WeakMap();

/** Isole la silhouette principale d'une découpe dont le rectangle croise une pose voisine. */
export function isolateMinorFigure(data, width, height) {
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let largest = new Int32Array();
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] === 0) continue;
    let head = 0, tail = 1; seen[start] = 1; queue[0] = start;
    while (head < tail) {
      const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!(dx || dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
        const next = pixel + dy * width + dx;
        if (!seen[next] && data[next * 4 + 3] > 0) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    if (tail > largest.length) largest = queue.slice(0, tail);
  }
  const keep = new Uint8Array(seen.length);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < keep.length; pixel++) if (!keep[pixel]) data[pixel * 4 + 3] = 0;
}

// Découpes déjà préparées (pendant l'écran de chargement) par candidat : les portraits les réutilisent.
const preparedByFaction = new Map();

/** Prépare les douze découpes une seule fois ; les PNG sources restent intacts. */
export function prepareMinorFrames(image, faction) {
  const frames = prepareAtlasFrames(image, MINOR_ATLASES[faction]);
  if (frames) preparedByFaction.set(faction, frames);
  return frames;
}

/** Découpes d'un candidat si le jeu les a déjà préparées, sinon null. */
export const preparedMinorFrames = faction => preparedByFaction.get(faction) || null;

export function prepareAtlasFrames(image, atlas) {
  if (cache.has(image)) return cache.get(image);
  if (!atlas) return null;
  const source = cleanGeneratedImage(image);
  const frames = atlas.frames.map(([sx, sy, sw, sh]) => {
    const canvas = document.createElement('canvas'); canvas.width = sw; canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    const pixels = ctx.getImageData(0, 0, sw, sh);
    isolateMinorFigure(pixels.data, sw, sh);
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  });
  cache.set(image, frames);
  return frames;
}

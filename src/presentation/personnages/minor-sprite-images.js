import { cleanGeneratedPixels } from '../carte/fixed-world.js';
import { MINOR_ATLASES } from './minor-sprite-atlases.js';

const cache = new WeakMap();
const bitmapJobs = new WeakMap();
const drawingSources = new WeakMap();

/** Textures réellement dessinées : les grandes planches découpées n'ont pas à partir aussi vers le GPU. */
export const preparedDrawingSources = image => drawingSources.get(image) || [image];

/** La planche complète n'est plus dessinée : garder ses découpes natives et ses repères suffit. */
export function releasePreparedAtlasSource(image) {
  if (!drawingSources.has(image) || typeof image.close !== 'function') return image;
  const atlas = { preparedOnly: true, width: 0, height: 0,
    naturalWidth: image.naturalWidth || image.width, naturalHeight: image.naturalHeight || image.height,
    spriteScaleX: image.spriteScaleX, spriteScaleY: image.spriteScaleY };
  cache.set(atlas, cache.get(image));
  drawingSources.set(atlas, drawingSources.get(image));
  image.close();
  return atlas;
}

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
  if (!atlas) return null;
  const byAtlas = cache.get(image);
  if (byAtlas?.has(atlas.frames)) return byAtlas.get(atlas.frames);
  // Nettoyer seulement les découpes utiles évite une copie persistante de toute la planche.
  const scaleX = image.spriteScaleX ?? 1, scaleY = image.spriteScaleY ?? 1;
  const frames = atlas.frames.map(([sx, sy, sw, sh]) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scaleX)); canvas.height = Math.max(1, Math.round(sh * scaleY));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    cleanGeneratedPixels(pixels.data);
    isolateMinorFigure(pixels.data, canvas.width, canvas.height);
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  });
  const entries = byAtlas || new WeakMap();
  entries.set(atlas.frames, frames);
  if (!byAtlas) cache.set(image, entries);
  let sources = drawingSources.get(image);
  if (!sources) { sources = new Set(); drawingSources.set(image, sources); }
  for (const frame of frames) sources.add(frame);
  return frames;
}

/** Convertit les découpes avant de jouer et libère immédiatement leurs canevas de travail. */
export function prepareAtlasBitmaps(image, atlas) {
  const frames = prepareAtlasFrames(image, atlas);
  if (!frames || typeof createImageBitmap !== 'function') return Promise.resolve(frames);
  if (bitmapJobs.has(frames)) return bitmapJobs.get(frames);
  const job = (async () => {
    // Une conversion à la fois : pas de pic de mémoire avec toutes les poses d'une planche.
    for (let i = 0; i < frames.length; i++) {
      const canvas = frames[i];
      try {
        frames[i] = await createImageBitmap(canvas);
        const sources = drawingSources.get(image);
        sources.delete(canvas); sources.add(frames[i]);
        canvas.width = 0; canvas.height = 0;
      } catch { /* Le canevas préparé reste utilisable sur les anciens navigateurs. */ }
    }
    return frames;
  })();
  bitmapJobs.set(frames, job);
  return job;
}

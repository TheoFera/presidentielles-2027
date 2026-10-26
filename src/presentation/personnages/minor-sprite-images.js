import { cutAtlasFrame, isolateMinorFigure } from './atlas-pixels.js';
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

export { isolateMinorFigure };

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
    // Coordonnées de la planche d'origine : le dessin des planches réduites les convertit (sprite-bitmaps.js).
    cutAtlasFrame(canvas.getContext('2d', { willReadFrequently: true }), image, [sx, sy, sw, sh], canvas.width, canvas.height);
    return canvas;
  });
  return keepPreparedFrames(image, atlas, frames);
}

function keepPreparedFrames(image, atlas, frames) {
  let entries = cache.get(image);
  if (!entries) { entries = new WeakMap(); cache.set(image, entries); }
  entries.set(atlas.frames, frames);
  let sources = drawingSources.get(image);
  if (!sources) { sources = new Set(); drawingSources.set(image, sources); }
  for (const frame of frames) sources.add(frame);
  return frames;
}

// Préparation hors du fil du jeu (atlas-worker.js) : découpes identiques, rendues en ImageBitmap.
let worker = null, workerJobs = null, nextJob = 0;
const backgroundJobs = new WeakMap();
function atlasWorker() {
  if (worker !== null) return worker;
  worker = false;
  if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function') return worker;
  try {
    worker = new Worker(new URL('./atlas-worker.js', import.meta.url), { type: 'module' });
    workerJobs = new Map();
    worker.onmessage = ({ data: { id, frames } }) => { workerJobs.get(id)?.(frames); workerJobs.delete(id); };
    worker.onerror = () => { for (const done of workerJobs.values()) done(null); workerJobs.clear(); worker.terminate(); worker = false; };
  } catch { worker = false; }
  return worker;
}

/**
 * Prépare les découpes d'une planche en arrière-plan. Si le jeu les dessine avant la fin, elles sont faites
 * sur place comme avant (prepareAtlasFrames) et le résultat de l'arrière-plan est abandonné.
 * Renvoie les découpes, ou null si ce navigateur ne sait pas les préparer en arrière-plan.
 */
export function prepareAtlasFramesInBackground(image, atlas) {
  if (!atlas) return Promise.resolve(null);
  const ready = cache.get(image)?.get(atlas.frames);
  if (ready) return Promise.resolve(ready);
  let jobs = backgroundJobs.get(image);
  if (jobs?.has(atlas.frames)) return jobs.get(atlas.frames);
  const target = atlasWorker();
  if (!target) return Promise.resolve(null);
  const scaleX = image.spriteScaleX ?? 1, scaleY = image.spriteScaleY ?? 1;
  // Mêmes tailles et mêmes coordonnées que prepareAtlasFrames (y compris la conversion des planches réduites).
  const frames = atlas.frames.map(([sx, sy, sw, sh]) => ({
    source: image.spriteScaleX === undefined ? [sx, sy, sw, sh] : [sx * scaleX, sy * scaleY, sw * scaleX, sh * scaleY],
    width: Math.max(1, Math.round(sw * scaleX)), height: Math.max(1, Math.round(sh * scaleY)) }));
  const job = createImageBitmap(image).then(copy => new Promise(resolve => {
    // Arrière-plan indisponible entre-temps (script refusé) : découpe au premier dessin, comme avant.
    if (worker !== target) { copy.close(); resolve(null); return; }
    const id = ++nextJob;
    workerJobs.set(id, resolve);
    target.postMessage({ id, image: copy, frames }, [copy]);
  })).then(bitmaps => {
    if (!bitmaps) return null;
    const existing = cache.get(image)?.get(atlas.frames);
    if (existing) { for (const bitmap of bitmaps) bitmap.close(); return existing; }
    return keepPreparedFrames(image, atlas, bitmaps);
  }, () => null);
  if (!jobs) { jobs = new Map(); backgroundJobs.set(image, jobs); }
  jobs.set(atlas.frames, job);
  return job;
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

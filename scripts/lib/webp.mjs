// Conversion PNG → WebP pour l'export du jeu. Utilise ffmpeg (libwebp).
// - Sans perte (version web) : chaque image est vérifiée pixel par pixel ; seules les couleurs
//   cachées sous des pixels totalement transparents peuvent différer, ce qui ne change rien à l'affichage.
// - Avec une qualité (application) : compression « quasi sans perte ». La transparence reste identique
//   au pixel près et l'écart de couleur des pixels visibles est plafonné (voir similarPixels).
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
// Changer ces valeurs invalide le cache si les réglages de compression changent.
const SETTINGS = 'webp-lossless-q100-m6-v1';
const lossySettings = quality => `webp-q${quality}-m6-v1`;
// Écart minimal accepté en compression avec perte (PSNR des pixels visibles, en dB).
// Mesuré le 05/10/2026 en qualité 90 : 33,5 dB en médiane, 25,8 dB au pire (étoiles jaunes sur fond bleu),
// sans différence visible à taille réelle. En dessous de ce seuil, la conversion a un défaut.
export const MIN_LOSSY_PSNR = 24;
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

export async function webpAvailable() {
  try {
    const { stdout } = await run(ffmpeg, ['-hide_banner', '-encoders'], { windowsHide: true, maxBuffer: 8 << 20 });
    return /libwebp\b/.test(stdout);
  } catch { return false; }
}

async function rgba(file) {
  const { stdout } = await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 30, windowsHide: true });
  return stdout;
}

/** Vrai si les deux images s'affichent à l'identique (RGB ignoré sous alpha = 0). */
export async function samePixels(original, converted) {
  const [a, b] = await Promise.all([rgba(original), rgba(converted)]);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] !== b[i + 3]) return false;
    if (a[i + 3] && (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2])) return false;
  }
  return true;
}

/** Écart de couleur des pixels visibles, en dB (Infinity si identiques), ou null si la transparence diffère. */
export async function visiblePsnr(original, converted) {
  const [a, b] = await Promise.all([rgba(original), rgba(converted)]);
  if (a.length !== b.length) return null;
  let error = 0, weight = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] !== b[i + 3]) return null;
    if (!a[i + 3]) continue;
    // Un pixel à demi transparent compte à proportion de son opacité.
    const alpha = a[i + 3] / 255;
    for (let c = 0; c < 3; c++) error += alpha * (a[i + c] - b[i + c]) ** 2;
    weight += 3 * alpha;
  }
  return error ? 10 * Math.log10(255 ** 2 / (error / weight)) : Infinity;
}

/** Vrai si la transparence est identique et les couleurs visibles assez proches (compression avec perte). */
export async function similarPixels(original, converted, minimum = MIN_LOSSY_PSNR) {
  const psnr = await visiblePsnr(original, converted);
  return psnr !== null && psnr >= minimum;
}

/**
 * Convertit une image et renvoie le chemin du WebP en cache (créé et vérifié une seule fois).
 * quality : absent = sans perte ; sinon qualité de la compression avec perte (90 pour l'application).
 */
export async function cachedWebp(source, cacheDirectory, { quality = null } = {}) {
  const lossless = quality === null;
  const hash = createHash('sha256').update(lossless ? SETTINGS : lossySettings(quality)).update(await readFile(source)).digest('hex');
  const target = resolve(cacheDirectory, `${hash}.webp`);
  if (await stat(target).then(info => info.size > 0, () => false)) return target;
  await mkdir(cacheDirectory, { recursive: true });
  const temporary = `${target}.${process.pid}.tmp.webp`;
  const mode = lossless ? ['-lossless', '1', '-quality', '100'] : ['-quality', String(quality)];
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libwebp', ...mode,
    '-compression_level', '6', '-frames:v', '1', temporary], { windowsHide: true });
  if (lossless ? !await samePixels(source, temporary) : !await similarPixels(source, temporary)) {
    throw new Error(`Conversion WebP ${lossless ? 'non identique' : 'trop éloignée de l’original'} : ${source}`);
  }
  await rename(temporary, target);
  return target;
}

/** Applique fn à chaque élément avec un nombre limité de tâches simultanées. */
export async function eachLimited(items, fn, limit = Math.max(1, availableParallelism() - 1)) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await fn(items[index], index); }
  }));
  return results;
}

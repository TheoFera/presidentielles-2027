// Conversion PNG → WebP sans perte pour l'export de l'application.
// Utilise ffmpeg (libwebp). Chaque image convertie est vérifiée pixel par pixel :
// seules les couleurs cachées sous des pixels totalement transparents peuvent
// différer, ce qui ne change rien à l'affichage.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
// Changer cette valeur invalide le cache si les réglages de compression changent.
const SETTINGS = 'webp-lossless-q100-m6-v1';
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

/** Convertit une image et renvoie le chemin du WebP en cache (créé et vérifié une seule fois). */
export async function cachedWebp(source, cacheDirectory) {
  const hash = createHash('sha256').update(SETTINGS).update(await readFile(source)).digest('hex');
  const target = resolve(cacheDirectory, `${hash}.webp`);
  if (await stat(target).then(info => info.size > 0, () => false)) return target;
  await mkdir(cacheDirectory, { recursive: true });
  const temporary = `${target}.${process.pid}.tmp.webp`;
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libwebp', '-lossless', '1',
    '-compression_level', '6', '-quality', '100', '-frames:v', '1', temporary], { windowsHide: true });
  if (!await samePixels(source, temporary)) throw new Error(`Conversion WebP non identique : ${source}`);
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

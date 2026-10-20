// Intègre les deux façades ImageGen ; tous les pixels extérieurs restent ceux de la tuile.
// Usage : node docs/retouches-carte/sources/retraites-b-facades-integrer.mjs
// SHARP_MODULE peut désigner le module sharp du runtime, sans installation dans le projet.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { readPng } from '../../../scripts/lib/png.mjs';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const before = readPng(new URL('./retraites-b-facades-avant.png', import.meta.url));
const { data } = await sharp(fileURLToPath(new URL('./retraites-b-facades-source.png', import.meta.url)))
  .resize(1920, 1080, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const regions = [{ x: 194, y: 690, w: 344, h: 318 }, { x: 1394, y: 704, w: 324, h: 304 }];
for (const { x, y, w, h } of regions) for (let row = y; row < y + h; row++) {
  const start = (row * 1920 + x) * 4;
  data.copy(before.data, start, start, start + w * 4);
}
const png = await sharp(before.data, { raw: { width: 1920, height: 1080, channels: 4 } })
  .png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
await writeFile(new URL('../../../assets/images/carte/tuile-14-retraites-b.png', import.meta.url), png);
console.log('Deux façades intégrées ; ciel, mer, étages, trottoir et bords de tuile conservés.');

// Outil de production : cadrage et mesure des sorties ImageGen, sans redessiner.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng } from '../../../scripts/lib/png.mjs';
import { measureMinorSprites } from '../../../scripts/measure-minor-sprites.mjs';
import { MINOR_ANIMATION_DATA } from '../../../src/presentation/minor-animation-data.js';
import { MINOR_ATLASES } from '../../../src/presentation/minor-sprite-atlases.js';

const require = createRequire(import.meta.url);
const sharp = require(process.env.MINOR_SHARP_PATH || 'sharp');
const { generations } = JSON.parse(readFileSync(new URL('./generations.json', import.meta.url)));
const results = [];
for (const job of generations) {
  const [faction, sheet] = job.key.split('-');
  const folder = 'assets/generated/minor-candidates/';
  const original = readPng(folder + job.file);
  // Le générateur peut livrer un format légèrement différent : retrouver le canevas source.
  await sharp(job.source).resize(original.width, original.height, { fit: 'fill' }).png().toFile(folder + job.out);
  if (sheet === 'idle') {
    const atlas = MINOR_ATLASES[faction];
    const measured = measureMinorSprites(readPng(folder + job.out));
    const oldFrames = atlas.frames;
    atlas.frames = measured.frames;
    results.push({ key: job.key, previousFrames: oldFrames, frames: measured.frames, referenceHeight: atlas.referenceHeight });
    continue;
  }
  const atlas = MINOR_ANIMATION_DATA[faction][sheet];
  const measured = measureMinorSprites(readPng(folder + job.out), { count: job.count, columns: 4, koFrames: sheet === 'actions' ? [8, 9, 10, 11] : [] });
  const oldFrames = atlas.frames;
  // Garder l'échelle des corps ; recalibrer sur la hauteur totale annulerait la réduction des têtes.
  atlas.frames = measured.frames;
  results.push({ key: job.key, previousFrames: oldFrames, frames: measured.frames, referenceHeight: atlas.referenceHeight });
}
writeFileSync('src/presentation/minor-animation-data.js', '// Silhouettes mesurées dans les PNG ; échelles des corps conservées lors des corrections de dessin.\nexport const MINOR_ANIMATION_DATA = ' + JSON.stringify(MINOR_ANIMATION_DATA, null, 2) + ';\n');
writeFileSync('src/presentation/minor-sprite-atlases.js', '// Rectangles et points d’appui mesurés dans les PNG ; échelles des corps conservées.\nexport const MINOR_ATLASES = ' + JSON.stringify(MINOR_ATLASES, null, 2) + ';\n');
writeFileSync(new URL('./measurements.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
console.log(`${results.length} planches mesurées.`);

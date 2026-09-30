import { writeFileSync } from 'node:fs';
import { readPng } from './lib/png.mjs';
import { measureMinorSprites } from './measure-minor-sprites.mjs';
import { MINOR_ANIMATION_FILES } from '../src/presentation/minor-animation-sprites.js';

const data = Object.fromEntries(Object.entries(MINOR_ANIMATION_FILES).map(([faction, files]) => [faction,
  Object.fromEntries(Object.entries(files).map(([sheet, file]) => {
    const atlas = measureMinorSprites(readPng(file), { count: sheet === 'actions' ? 12 : 16, columns: 4, koFrames: sheet === 'actions' ? [8,9,10,11] : [] });
    // Le moteur partagé applique l'étirement de 1,1236 utilisé par les principaux.
    atlas.referenceHeight = Math.round(atlas.referenceHeight * 1.1236);
    console.log(`${faction} · ${sheet} : ${atlas.frames.length} poses mesurées.`);
    return [sheet, atlas];
  }))]));
writeFileSync('src/presentation/minor-animation-data.js', '// Silhouettes mesurées, PNG sources conservés sans retouche.\nexport const MINOR_ANIMATION_DATA = '+JSON.stringify(data, null, 2)+';\n');

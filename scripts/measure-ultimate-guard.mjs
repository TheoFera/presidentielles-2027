import { writeFileSync } from 'node:fs';
import { readPng } from './lib/png.mjs';
import { measureMinorSprites } from './measure-minor-sprites.mjs';
import { ultimateAtlases } from '../src/presentation/ultimate-sprite-data.js';
import { ULTIMATE_GUARD_FILES } from '../src/presentation/ultimate-guard-sprites.js';
const data = Object.fromEntries(Object.entries(ULTIMATE_GUARD_FILES).map(([key,file]) => {
  const atlas = measureMinorSprites(readPng(file), { count: 8, columns: 4, koFrames: [] });
  atlas.referenceHeight = atlas.referenceHeight * ultimateAtlases[key].referenceHeight / ultimateAtlases[key].frames[0][3];
  return [key,atlas];
}));
writeFileSync('src/presentation/ultimate-guard-data.js','// Silhouettes et échelles mesurées ; PNG sources intacts.\nexport const ULTIMATE_GUARD_DATA = '+JSON.stringify(data,null,2)+';\n');

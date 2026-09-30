import { writeFileSync } from 'node:fs';
import { readPng } from './lib/png.mjs';
import { measureMinorSprites } from './measure-minor-sprites.mjs';
import { MINOR_ANIMATION_FILES } from '../src/presentation/minor-animation-sprites.js';
import { additionalExtraAtlases } from '../src/presentation/candidate-extra-atlases.js';
import { additionalCombatAtlases } from '../src/presentation/candidate-combat-atlases.js';

const data = Object.fromEntries(Object.entries(MINOR_ANIMATION_FILES).map(([faction, files]) => [faction,
  Object.fromEntries(Object.entries(files).map(([sheet, file]) => {
    const atlas = measureMinorSprites(readPng(file), { count: sheet === 'actions' ? 12 : 16, columns: 4, koFrames: sheet === 'actions' ? [8,9,10,11] : [] });
    // Comparer la même pose à Philippe, plutôt que remplir toute la hauteur.
    const reference = sheet === 'combat' ? additionalCombatAtlases.philippe : additionalExtraAtlases.philippe[sheet];
    const referenceHeight = reference.referenceHeight || 340;
    atlas.referenceHeight = atlas.frames[0][3] * referenceHeight / reference.frames[0][3];
    atlas.widthScale = reference.frames[0][2] / referenceHeight * atlas.referenceHeight / atlas.frames[0][2];
    if (faction === 'roussel') {
      // Échelle fixe : l'écartement des pieds ne doit pas réduire tout le corps.
      atlas.widthScale = 1.1236 / 1.06;
      atlas.frameScales = atlas.frames.map(() => .92);
    }
    console.log(`${faction} · ${sheet} : ${atlas.frames.length} poses mesurées.`);
    return [sheet, atlas];
  }))]));
writeFileSync('src/presentation/minor-animation-data.js', '// Silhouettes mesurées, PNG sources conservés sans retouche.\nexport const MINOR_ANIMATION_DATA = '+JSON.stringify(data, null, 2)+';\n');

// Mesure uniquement les sprites redessinés : aucun découpage ni collage de tête.
import { writeFileSync } from 'node:fs';
import { readPng } from '../lib/png.mjs';
import { measureMinorSprites } from './measure-minor-sprites.mjs';

const directory = 'assets/images/candidats/dupont-aignan';
// Hauteurs anatomiques cheveux–menton, indépendantes de la flexion des jambes.
const heads = {
  combat: [92,92,94,92,92,92,92,92,92,92,92,92,92,92,92,92],
  movement: [97,97,97,97,97,97,97,97,99,99,99,97,97,97,97,97],
  actions: [112,112,112,112,112,112,112,112,112,112,112,112],
  locomotion: [112,112,112,112,112,112,112,112,112,112,112,112],
  persuasion: [307,307],
};
const atlases = {};
for (const [sheet, headHeights] of Object.entries(heads)) {
  const file = `${directory}/dupont-aignan-${sheet}-raccords-${sheet==='persuasion'?'v3':'v2'}.png`;
  const atlas = measureMinorSprites(readPng(file), {
    count: headHeights.length, columns: sheet === 'persuasion' ? 2 : 4,
    koFrames: sheet === 'actions' ? [8,9,10,11] : [],
  });
  atlases[sheet] = {
    sprite: `character-minor-dupont_aignan-${sheet}`, isolated: true, uniformCharacter: true,
    standingHeight: headHeights[0] / .335 * (296 / 340 * 1.1236),
    anatomicalScales: headHeights.map(height => headHeights[0] / height),
    headHeights, frames: atlas.frames,
  };
}
function select(atlas, indices) {
  return { ...atlas, frames: indices.map(i => atlas.frames[i]),
    headHeights: indices.map(i => atlas.headHeights[i]),
    anatomicalScales: indices.map(i => atlas.anatomicalScales[i]) };
}
atlases.guardIdle = select(atlases.locomotion,[0,1,3]);
atlases.guardWalk = select(atlases.locomotion,[4,4,5,5,6,6,7,7]);
writeFileSync('src/presentation/personnages/dupont-aignan-raccords.js',
  '// Généré par preparer-dupont-aignan-raccords.mjs. Sprites entiers redessinés, sans tête rapportée.\nexport const DUPONT_AIGNAN_ATLASES = '
  + JSON.stringify(atlases,null,2) + ';\n');
console.log('58 sprites entiers mesurés et raccordés : aucune tête composée séparément.');

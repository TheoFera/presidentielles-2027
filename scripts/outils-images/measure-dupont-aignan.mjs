// Calage des planches issues du skin validé, sans retoucher leurs pixels.
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng } from '../lib/png.mjs';
import { measureMinorSprites } from './measure-minor-sprites.mjs';
import { MINOR_SPRITES } from '../../src/presentation/personnages/minor-sprites.js';
import { MINOR_ANIMATION_FILES } from '../../src/presentation/personnages/minor-animation-sprites.js';

const faction = process.argv[2] || 'dupont_aignan';
if (!['dupont_aignan', 'attal', 'glucksmann'].includes(faction)) throw new Error('Candidat non pris en charge.');
// Ne réécrire que le candidat demandé : les autres réglages sont conservés.
function writeCandidate(file, atlas) {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf(`  "${faction}": {`);
  const next = source.slice(start + 1).search(/\n  "[a-z_]+": \{/);
  const end = next < 0 ? source.lastIndexOf('\n};') : start + 1 + next + 1;
  if (start < 0 || end < 0) throw new Error('Entrée du candidat introuvable.');
  const entry = `  "${faction}": ` + JSON.stringify(atlas, null, 2).replaceAll('\n', '\n  ') + (next < 0 ? '' : ',\n');
  writeFileSync(file, source.slice(0, start) + entry + source.slice(end));
}

const actionCuts = faction === 'glucksmann' ? [{ x: 1040, minY: 800 }] : [];
let base = measureMinorSprites(readPng(MINOR_SPRITES[faction]), faction === 'glucksmann' ? { count: 12, columns: 4, koFrames: [8, 9, 10, 11], cuts: actionCuts } : { count: 1, columns: 1, koFrames: [] });
if (faction === 'glucksmann') base = { referenceHeight: base.frames[6][3], frames: [base.frames[6]] };
// La marche discrète est centrée sur la découpe : même axe à l'arrêt, sans saut horizontal.
base.frames[0][4] = base.frames[0][0] + base.frames[0][2] / 2;
writeCandidate('src/presentation/personnages/minor-sprite-atlases.js', base);
const data = {};
for (const [sheet, file] of Object.entries(MINOR_ANIMATION_FILES[faction])) {
  const image = readPng(file);
  const cuts = sheet === 'actions' ? actionCuts : faction === 'glucksmann' && sheet === 'combat' ? [{ y: 978, minX: 930 }] : [];
  const atlas = measureMinorSprites(image, { count: sheet === 'actions' ? 12 : 16, columns: 4, koFrames: sheet === 'actions' ? [8, 9, 10, 11] : [], cuts });
  // La deuxième garde générée baisse les bras : garder la vraie garde et la respiration du moteur.
  if (sheet === 'combat' && faction !== 'attal') atlas.frames[1] = [...atlas.frames[0]];
  if (sheet === 'movement' && faction !== 'attal') {
    // Le moteur attend 8 pas de garde, 3 esquives, puis 5 réactions aux coups.
    // Réutiliser les 4 pas dessinés, sans ajouter de cycle à la marche ordinaire.
    const sourceFrames = atlas.frames;
    atlas.frames = [0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14].map(index => [...sourceFrames[index]]);
  }
  atlas.referenceHeight = atlas.frames[0][3];
  data[sheet] = atlas;
  console.log(`${faction} · ${sheet} : ${atlas.frames.length} poses mesurées.`);
}
writeCandidate('src/presentation/personnages/minor-animation-data.js', data);

// Mesure les silhouettes générées sans modifier leurs pixels ni leur transparence.
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng } from '../lib/png.mjs';
import { measureMinorSprites } from './measure-minor-sprites.mjs';

const directory = 'assets/images/secondaires/so';
const { personnages } = JSON.parse(readFileSync(`${directory}/consignes-imagegen.json`, 'utf8'));
const masked = JSON.parse(readFileSync(`${directory}/consignes-masques-v2.json`, 'utf8')).personnages;
const kicks = JSON.parse(readFileSync(`${directory}/consignes-coups-pied-v1.json`, 'utf8')).personnages;
const extension = JSON.parse(readFileSync(`${directory}/consignes-extension-v1.json`, 'utf8')).personnages;
const atlases = {};
function kickAnchors(image, atlas, kickIndex) {
  const [x, y, w, h, px] = atlas.frames[0];
  const groups = [];
  for (let column = 0; column < w; column++) {
    let opaque = false;
    for (let row = Math.max(0, h - Math.ceil(h * .03)); row < h; row++) {
      if (image.data[((y + row) * image.width + x + column) * 4 + 3] >= 90) opaque = true;
    }
    if (!opaque) continue;
    const previous = groups.at(-1);
    if (previous && previous.end === column - 1) previous.end = column;
    else groups.push({ start: column, end: column });
  }
  // Le pied d’appui gauche reste à sa place quand l’autre quitte le sol.
  const foot = groups[0];
  const offset = groups.length > 1 ? (x + (foot.start + foot.end) / 2 - px) / atlas.referenceHeight : 0;
  const [kx, ky, kw, kh, pivotX, pivotY] = atlas.frames[kickIndex];
  let top = ky + kh, bottom = ky;
  for (let row = ky; row < ky + kh; row++) for (let column = kx + kw - 8; column < kx + kw; column++) {
    if (image.data[(row * image.width + column) * 4 + 3] >= 90) { top = Math.min(top, row); bottom = Math.max(bottom, row); }
  }
  return { kickFootOffset: offset, kickImpact: { x: (kx + kw - pivotX) / atlas.referenceHeight,
    y: ((top + bottom) / 2 - pivotY) / atlas.referenceHeight } };
}
for (const character of [...personnages, ...extension]) {
  const current = masked.find(p => p.id === character.id) || character;
  const image = readPng(`${directory}/${current.filename}`);
  const measured = measureMinorSprites(image, { count: 6, columns: 3, koFrames: [] });
  for (const [x, y, w, h] of measured.frames) {
    if (x <= 0 || y <= 0 || x + w >= image.width || y + h >= image.height) {
      throw Error(`${character.id} : une silhouette touche le bord de la planche.`);
    }
  }
  // Isoler chaque découpe empêche les marges d’emporter un fragment d’une pose voisine.
  const atlas = { sprite: `security-so-${character.id}`, isolated: true, buildingMotion: 'kick', ...measured };
  const extra = kicks.find(p => p.id === character.id);
  if (!extra) Object.assign(atlas, kickAnchors(image, measured, 5));
  if (extra) {
    const kickImage = readPng(`${directory}/${extra.filename}`);
    const kick = measureMinorSprites(kickImage, { count: 3, columns: 3, koFrames: [] });
    for (const [x, y, w, h] of kick.frames) {
      if (x <= 0 || y <= 0 || x + w >= kickImage.width || y + h >= kickImage.height) throw Error(`${character.id} : coup de pied tronqué.`);
    }
    atlas.building = { sprite: `security-so-${character.id}-coups-pied`, isolated: true, ...kick,
      ...kickAnchors(kickImage, kick, 2) };
  }
  atlases[character.id] = atlas;
  console.log(`${character.label} : six poses mesurées, hauteur ${measured.referenceHeight} px.`);
}
writeFileSync('src/presentation/personnages/service-order-atlases.js',
  '// Généré par scripts/outils-images/mesurer-so.mjs. Rectangles et appuis des PNG transparents.\n'
  + `export const SERVICE_ORDER_ATLASES = ${JSON.stringify(atlases, null, 2)};\n`);

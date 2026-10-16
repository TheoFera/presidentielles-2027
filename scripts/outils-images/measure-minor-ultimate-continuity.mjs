// Mesures et ancrages uniquement ; aucune modification des dessins générés.
import { readPng } from '../lib/png.mjs';
import { measureMinorSprites } from './measure-minor-sprites.mjs';

const definitions = {
  phone: ['glucksmann-appel-v4.png', 4, 4],
  satchelThrow: ['attal-lancer-cartable-v2.png', 6, 3],
  sausageThrow: ['roussel-lancer-rattraper-v3.png', 8, 4],
  sausage: ['roussel-saucisse-nature-v1.png', 1, 1],
};
for (const [key, [file, count, columns]] of Object.entries(definitions)) {
  const image = readPng(`assets/images/pouvoirs/${file}`);
  const atlas = measureMinorSprites(image, { count, columns, koFrames: [] });
  for (const frame of atlas.frames) {
    const [sx, sy, width, height] = frame; let left = image.width, right = 0;
    for (let y = sy + height - Math.ceil(height * .05); y < sy + height; y++) for (let x = sx; x < sx + width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] >= 90) { left = Math.min(left, x); right = Math.max(right, x); }
    }
    frame[4] = key === 'sausage' ? sx + width / 2 : (left + right) / 2;
  }
  // Ces poses gardent toutes les pieds au sol et la même flexion des genoux.
  // Corriger uniformément la petite variation native, jamais un axe isolé.
  if (key !== 'sausage') atlas.anatomicalScales = atlas.frames.map(frame => atlas.referenceHeight / frame[3]);
  console.log(key, JSON.stringify(atlas));
}

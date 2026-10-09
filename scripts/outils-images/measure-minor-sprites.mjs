// Mesure les silhouettes sans modifier les PNG générés.
import { writeFileSync } from 'node:fs';
import { readPng } from '../lib/png.mjs';
import { MINOR_FACTIONS } from '../../src/simulation/world.js';
import { MINOR_SPRITES } from '../../src/presentation/personnages/minor-sprites.js';

export function measureMinorSprites(image, { count = 12, columns = 4, koFrames = [10] } = {}) {
  const { width, height, data } = image;
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
  const figures = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] < 90) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    seen[start] = 1; queue[0] = start;
    while (head < tail) {
      const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!(dx || dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
        const next = pixel + dy * width + dx;
        if (!seen[next] && data[next * 4 + 3] >= 90) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    if (tail > 1000) figures.push({ left, top, right, bottom, pixels: tail });
  }
  if (figures.length !== count) throw new Error(`${count} silhouettes attendues, ${figures.length} mesurées.`);
  // Les poses ont une hauteur variable : regroupement par rang, puis par colonne.
  figures.sort((a, b) => a.top - b.top);
  const ordered = Array.from({ length: count / columns }, (_, row) => row * columns)
    .flatMap(start => figures.slice(start, start + columns).sort((a, b) => a.left - b.left));
  return {
    referenceHeight: ordered[0].bottom - ordered[0].top + 1,
    frames: ordered.map(({ left, top, right, bottom }, index) => {
      // Point d'appui : centre des chaussures basses ; KO centré sur le corps.
      let footLeft = width, footRight = 0;
      for (let y = Math.max(top, bottom - 10); y <= bottom; y++) for (let x = left; x <= right; x++) {
        if (data[(y * width + x) * 4 + 3] >= 90) { footLeft = Math.min(footLeft, x); footRight = Math.max(footRight, x); }
      }
      const pivot = koFrames.includes(index) ? (left + right) / 2 : (footLeft + footRight) / 2;
      return [left, top, right - left + 1, bottom - top + 1, pivot, bottom + 1];
    }),
  };
}

if (process.argv[1]?.endsWith('measure-minor-sprites.mjs')) {
  // Les hauteurs de référence règlent l'échelle des corps à l'écran : elles ont été ajustées à la main
  // et sont conservées. Seuls les rectangles et points d'appui sont remesurés.
  const { MINOR_ATLASES: current } = await import('../../src/presentation/personnages/minor-sprite-atlases.js');
  const atlases = Object.fromEntries(MINOR_FACTIONS.map(id => {
    const atlas = measureMinorSprites(readPng(MINOR_SPRITES[id]));
    if (current[id]) atlas.referenceHeight = current[id].referenceHeight;
    console.log(`${id} : ${atlas.frames.length} poses, hauteur de référence ${atlas.referenceHeight} px.`);
    return [id, atlas];
  }));
  writeFileSync('src/presentation/personnages/minor-sprite-atlases.js', `// Rectangles et points d’appui mesurés dans les PNG ; échelles des corps conservées.\nexport const MINOR_ATLASES = ${JSON.stringify(atlases, null, 2)};\n`);
}

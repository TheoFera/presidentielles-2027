import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { readPng } from '../../../scripts/lib/png.mjs';
import { MINOR_ANIMATION_DATA } from '../../../src/presentation/minor-animation-data.js';
import { MINOR_ATLASES } from '../../../src/presentation/minor-sprite-atlases.js';
import { combatAtlasFor } from '../../../src/presentation/melenchon-combat.js';
import { extraAtlasesFor } from '../../../src/presentation/candidate-extra-poses.js';
import { visualManifest } from '../../../src/presentation/visual-manifest.js';
import { correctedFrameScales } from '../../../src/presentation/minor-animation-sprites.js';
import { isolateMinorFigure } from '../../../src/presentation/minor-sprite-images.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url), sharp = require(process.env.MINOR_SHARP_PATH || 'sharp');
const originalData = path => JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' }).split(' = ')[1].trim().replace(/;$/, ''));
const previousAnimations = originalData('src/presentation/minor-animation-data.js');
const previousIdle = originalData('src/presentation/minor-sprite-atlases.js');
const { generations } = JSON.parse(readFileSync(new URL('./generations.json', import.meta.url)));
const HEIGHT = 110, results = [];
const sheetNames = { combat: 'combat', movement: 'déplacements', actions: 'actions', idle: 'repos' };
const atlasFor = (faction, sheet) => sheet === 'combat' ? combatAtlasFor({ faction_id: faction }) : extraAtlasesFor({ faction_id: faction })[sheet];
const poseIndex = (sheet, index) => sheet === 'actions' && index >= 8 ? index + 2 : index;
async function frame(file, atlas, index, sheet, faction, old = false) {
  const png = readPng(file), [x, y, w, h, px] = atlas.frames[index];
  const cropped = await sharp(png.data, { raw: { width: png.width, height: png.height, channels: 4 } }).extract({ left: x, top: y, width: w, height: h }).raw().toBuffer();
  const pixels = cropped.filter((_, i) => i % 4 === 3 && cropped[i] >= 90).length;
  for (let i = 3; i < cropped.length; i += 4) cropped[i] = cropped[i] < 90 ? 0 : cropped[i] > 200 ? 255 : Math.round((cropped[i] - 90) / 110 * 255);
  isolateMinorFigure(cropped, w, h);
  const scale = (atlas.frameScales?.[index] ?? 1) / (atlas.referenceHeight || (sheet === 'combat' ? 340 : 360));
  const actionScale = sheet === 'combat' && [7, 9, 10, 12, 13, 14, 15].includes(index) || sheet === 'actions' && index >= (atlas.minor ? 8 : 10) ? 1.06 : 1;
  const sy = scale * HEIGHT * (sheet === 'idle' ? (faction === 'roussel' ? .94 : 1) : 1.1236) * (sheet === 'combat' && !atlas.minor && index === 1 ? 1.055 : 1);
  const sx = sy * (sheet === 'idle' ? (161 / 384) * atlas.referenceHeight / atlas.frames[0][2] : (atlas.widthScale || 1) * 1.06 / 1.1236);
  const width = Math.round(w * sx * actionScale), height = Math.round(h * sy * actionScale);
  return { input: await sharp(cropped, { raw: { width: w, height: h, channels: 4 } }).resize(width, height).png().toBuffer(), width, height, pivot: (px - x) * sx * actionScale, size: Math.sqrt(pixels * sx * sy), old };
}
for (const job of generations) {
  const [faction, sheet] = job.key.split('-'), composites = [], stats = [];
  for (let index = 0; index < job.count; index++) {
    const row = Math.floor(index / 4), col = index % 4, left = col * 600, baseline = row * 180 + 158;
    const atlas = sheet === 'idle' ? MINOR_ATLASES[faction] : atlasFor(faction, sheet);
    const previous = sheet === 'idle' ? previousIdle[faction] : { ...previousAnimations[faction][sheet], minor: true, frameScales: correctedFrameScales(faction, sheet, previousAnimations[faction][sheet]) };
    const old = await frame('assets/generated/minor-candidates/' + job.file, previous, index, sheet, faction, true);
    const current = await frame('assets/generated/minor-candidates/' + job.out, atlas, index, sheet, faction);
    const poses = [];
    if (sheet !== 'idle') for (const ref of ['philippe', 'le_pen']) {
      const ra = atlasFor(ref, sheet);
      poses.push(await frame(new URL(visualManifest[ra.sprite].file), ra, poseIndex(sheet, index), sheet, ref));
    }
    poses.push(old, current);
    for (let p = 0; p < poses.length; p++) {
      const pose = poses[p], center = left + (sheet === 'idle' ? 160 + p * 260 : 75 + p * 150);
      composites.push({ input: pose.input, left: Math.round(center - pose.pivot), top: baseline - pose.height });
    }
    if (sheet !== 'idle') stats.push({ index, size: current.size, ratio: current.size / ((poses[0].size + poses[1].size) / 2), beforeAfter: current.size / old.size });
  }
  const median = stats.map(x => x.ratio).sort((a, b) => a - b)[stats.length >> 1];
  for (const s of stats) s.relative = s.ratio / median;
  results.push({ key: job.key, stats });
  const svg = `<svg width="2400" height="${job.count / 4 * 180}" xmlns="http://www.w3.org/2000/svg">${Array.from({ length: job.count }, (_, i) => `<text x="${i % 4 * 600 + 8}" y="${Math.floor(i / 4) * 180 + 20}" fill="#333" font-size="14">${faction} · ${sheetNames[sheet]} · ${i} ${sheet === 'idle' ? 'Avant / après' : 'Philippe / Le Pen / avant / après'}</text><path d="M${i % 4 * 600 + 4},${Math.floor(i / 4) * 180 + 158}h592" stroke="#999"/>`).join('')}</svg>`;
  composites.push({ input: Buffer.from(svg), left: 0, top: 0 });
  await sharp({ create: { width: 2400, height: job.count / 4 * 180, channels: 4, background: '#e8e4de' } }).composite(composites).png().toFile(fileURLToPath(new URL(`./${job.key}-comparaison.png`, import.meta.url)));
}
for (const faction of ['roussel', 'attal', 'arthaud']) {
  const stats = results.filter(r => r.key.startsWith(faction) && !r.key.endsWith('idle')).flatMap(r => r.stats);
  const median = stats.map(s => s.ratio).sort((a, b) => a - b)[stats.length >> 1];
  for (const s of stats) s.relative = s.ratio / median;
}
writeFileSync(new URL('./audit.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
for (const r of results) console.log(r.key, r.stats.filter(s => Math.abs(s.relative - 1) >= .08).map(s => `${s.index}: ${Math.round(s.relative * 100)} %`).join(', ') || 'OK');

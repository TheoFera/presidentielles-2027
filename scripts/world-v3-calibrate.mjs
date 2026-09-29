// Cale automatiquement les images finales du décor v3 déposées dans assets/generated/world-v3/.
// - retire un fond magenta (#FF00FF) et le halo sombre éventuel ;
// - mesure la ligne de sol et retrouve chaque enseigne crème attendue par la maquette ;
// - écrit src/presentation/world-v3/calibration.js et cale les portes dans world_layout.json ;
// - signale les images à refaire. Usage : node scripts/world-v3-calibrate.mjs [--essai] (--essai : rapport seul, rien n'est écrit)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng, writePng } from './lib/png.mjs';
import { cleanPixels, findCreamSigns, measureBaseline } from './world-v3-calibrate-lib.mjs';
import { CANVAS, LAYER_BASELINE, STREET_BASELINE, STREETS, allDecorImages, signRect } from '../src/presentation/world-v3/spec.js';
import { MINOR_SHEET } from '../src/presentation/minor-sprites.js';
import { MINOR_FACTIONS } from '../src/simulation/world.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const folder = process.env.WORLD_V3_DIR || path.join(root, 'assets/generated/world-v3');
const dryRun = process.argv.includes('--essai');
const layoutFile = path.join(root, 'Présidentielles 2027/world_layout.json');

function calibrateStreet(id, image, report) {
  const baseline = measureBaseline(image, 0.12);
  if (!baseline || baseline < 880 || baseline > 1020) return report.push(`✗ street-${id}.png : ligne de sol à y=${baseline} (attendu ≈ ${STREET_BASELINE}).`), null;
  const found = findCreamSigns(image), signs = {};
  for (const element of STREETS[id].elements.filter(e => e.t === 'site')) {
    const [tx, ty, tw, th] = signRect(element), target = [tx + tw / 2, ty + th / 2];
    const best = found.map(rect => ({ rect, d: Math.hypot(rect[0] + rect[2] / 2 - target[0], rect[1] + rect[3] / 2 - target[1]) })).sort((a, b) => a.d - b.d)[0];
    if (!best || best.d > 140) return report.push(`✗ street-${id}.png : enseigne crème de ${element.site} introuvable près de x=${Math.round(target[0])}.`), null;
    signs[element.site] = best.rect;
  }
  const scale = CANVAS.width / image.width;
  if (Math.abs(scale - 1) > 0.001) report.push(`! street-${id}.png : ${image.width}×${image.height} au lieu de ${CANVAS.width}×${CANVAS.height} (accepté, mis à l'échelle).`);
  return { file: `assets/generated/world-v3/street-${id}.png`, width: image.width, height: image.height, baseline, signs, top_band: STREETS[id].extendsAbove ? 120 : 0 };
}

const calibration = { street: {}, middle: {}, far: {} }, report = [];
for (const item of allDecorImages()) {
  const file = path.join(folder, item.file);
  if (!existsSync(file)) { report.push(`· ${item.file} : pas encore déposée.`); continue; }
  const image = readPng(file), { keyed } = cleanPixels(image);
  if (keyed && !dryRun) writePng(file, image);
  if (item.layer === 'street') {
    const entry = calibrateStreet(item.id, image, report);
    if (entry) { calibration.street[item.id] = entry; report.push(`✓ ${item.file} : sol y=${entry.baseline}, ${Object.keys(entry.signs).length} enseigne(s).`); }
  } else {
    const baseline = measureBaseline(image, 0.3);
    if (!baseline || Math.abs(baseline - LAYER_BASELINE) > 60) { report.push(`✗ ${item.file} : ligne de sol introuvable (y=${baseline}, attendu ≈ ${LAYER_BASELINE}).`); continue; }
    calibration[item.layer][item.id] = { file: `assets/generated/world-v3/${item.file}`, width: image.width, height: image.height, baseline };
    report.push(`✓ ${item.file} : sol y=${baseline}.`);
  }
}

// Les portes jouables suivent les enseignes mesurées (uniquement pour les biomes dont les 3 rues sont validées).
const layout = JSON.parse(readFileSync(layoutFile, 'utf8'));
const complete = new Set(Object.values(STREETS).map(s => s.biome).filter(biome => Object.entries(STREETS).filter(([, s]) => s.biome === biome).every(([id]) => calibration.street[id])));
for (const slot of layout.strategic_site_generation.slots) {
  const entry = calibration.street[slot.subzone_id];
  if (!entry || !complete.has(STREETS[slot.subzone_id].biome) || !entry.signs[slot.site_id]) continue;
  const [x, , w] = entry.signs[slot.site_id]; slot.x_ratio = Number(((x + w / 2) / entry.width).toFixed(5));
}
if (!dryRun) writeFileSync(layoutFile, JSON.stringify(layout, null, 2) + '\n');
if (!dryRun) writeFileSync(path.join(root, 'src/presentation/world-v3/calibration.js'),
  `// Généré par scripts/world-v3-calibrate.mjs : ne pas modifier à la main.\n// Images finales validées du décor v3 (ligne de sol et enseignes mesurées, en pixels d'image).\nexport const CALIBRATION = ${JSON.stringify(calibration, null, 2)};\n`);
console.log(report.join('\n'));
console.log(`\nBiomes passés au décor v3 : ${[...complete].join(', ') || 'aucun'}.`);

// Planches des candidats mineurs : fond magenta retiré, puis déclaration automatique dans minor-sprites.js.
const minorFolder = process.env.MINOR_SPRITES_DIR || path.join(root, 'assets/generated/minor-candidates');
const minorSprites = {};
for (const faction of MINOR_FACTIONS) {
  const file = path.join(minorFolder, `${faction}.png`);
  if (!existsSync(file)) { console.log(`· candidat mineur ${faction} : planche pas encore déposée (dessin par le code).`); continue; }
  const image = readPng(file), { keyed } = cleanPixels(image);
  if (keyed && !dryRun) writePng(file, image);
  if (Math.abs(image.width / image.height - MINOR_SHEET.width / MINOR_SHEET.height) > 0.02) { console.log(`✗ candidat mineur ${faction} : format ${image.width}×${image.height} au lieu de ${MINOR_SHEET.width}×${MINOR_SHEET.height}.`); continue; }
  minorSprites[faction] = `assets/generated/minor-candidates/${faction}.png`;
  console.log(`✓ candidat mineur ${faction} : planche validée.`);
}
const spritesFile = path.join(root, 'src/presentation/minor-sprites.js');
const sprites = readFileSync(spritesFile, 'utf8').replace(/export const MINOR_SPRITES = \{[^}]*\};/, `export const MINOR_SPRITES = ${JSON.stringify(minorSprites, null, 2).replace(/"([a-z_]+)":/g, '$1:').replace(/"/g, "'")};`);
if (!dryRun) writeFileSync(spritesFile, sprites);

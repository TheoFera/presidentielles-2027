// Découpe et contrôle des tuiles de la carte plate (sans parallaxe).
//   node scripts/fresque-plate-raccords.mjs decouper <fresque-maitre.png> [dossier des tuiles]
//   node scripts/fresque-plate-raccords.mjs verifier <dossier des tuiles> [fresque-maitre.png]
// La fresque maître peut être partielle (pilote) : n × 1 920 px à partir de la tuile 01.
// La vérification refuse toute transparence (signe d'un fondu), mesure chaque coupe (y compris 18 → 1),
// compare chaque tuile à la fresque maître si elle est fournie, et enregistre des vues rapprochées des coupes.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPng, writePng } from './lib/png.mjs';
import { TILE, plateTiles } from './fresque-plate-gabarits.mjs';

const MASTER_WIDTH = TILE.width * 18, VIEW = 400;

function crop(image, left, width) {
  const data = Buffer.alloc(width * image.height * 4);
  for (let y = 0; y < image.height; y++) image.data.copy(data, y * width * 4, (y * image.width + left) * 4, (y * image.width + left + width) * 4);
  return { width, height: image.height, data };
}

/** Différence moyenne (0 à 255) entre la colonne xa de a et la colonne xb de b. */
export function columnDistance(a, xa, b, xb) {
  let sum = 0;
  for (let y = 0; y < a.height; y++) {
    const i = (y * a.width + xa) * 4, j = (y * b.width + xb) * 4;
    sum += Math.abs(a.data[i] - b.data[j]) + Math.abs(a.data[i + 1] - b.data[j + 1]) + Math.abs(a.data[i + 2] - b.data[j + 2]);
  }
  return sum / (a.height * 3);
}

/** Compare la coupe entre deux tuiles aux écarts ordinaires entre colonnes voisines près des bords. */
export function seamScore(left, right, depth = 40) {
  const inner = [];
  for (let c = left.width - depth; c < left.width - 1; c++) inner.push(columnDistance(left, c, left, c + 1));
  for (let c = 0; c < depth - 1; c++) inner.push(columnDistance(right, c, right, c + 1));
  inner.sort((p, q) => p - q);
  const normal = inner[Math.floor(inner.length / 2)], seam = columnDistance(left, left.width - 1, right, 0);
  return { seam, normal, visible: seam > Math.max(3 * normal, normal + 12) };
}

/** Nombre de pixels qui ne sont pas parfaitement opaques. */
export function transparentPixels(image) {
  let n = 0;
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] !== 255) n++;
  return n;
}

function tiles() { return plateTiles(JSON.parse(readFileSync('Présidentielles 2027/world_layout.json', 'utf8'))); }

function cut(masterFile, out) {
  const master = readPng(masterFile);
  // Une fresque partielle (pilote) commence à la tuile 01 et compte un nombre entier de tuiles.
  const count = master.width / TILE.width;
  if (!Number.isInteger(count) || count < 1 || count > 18 || master.height !== TILE.height)
    throw new Error(`La fresque maître doit mesurer n × 1 920 px de large (n de 1 à 18, ${MASTER_WIDTH} px pour la carte entière) et ${TILE.height} px de haut (reçu ${master.width} × ${master.height}).`);
  const holes = transparentPixels(master);
  if (holes) throw new Error(`La fresque maître contient ${holes} pixels transparents : elle doit être entièrement opaque, sans fondu.`);
  mkdirSync(out, { recursive: true });
  for (const tile of tiles().slice(0, count)) writePng(path.join(out, tile.file), crop(master, tile.masterLeft, TILE.width));
  console.log(`${count} tuile(s) découpée(s) au pixel près dans ${out}${count < 18 ? ' (fresque partielle)' : ''}.`);
}

function check(dir, masterFile) {
  const list = tiles(), errors = [], report = { tuiles: [], coupes: [] };
  const images = list.map(tile => {
    const file = path.join(dir, tile.file);
    if (!existsSync(file)) { report.tuiles.push({ fichier: tile.file, absente: true }); return null; }
    const image = readPng(file);
    if (image.width !== TILE.width || image.height !== TILE.height) errors.push(`${tile.file} : ${image.width} × ${image.height} px au lieu de 1 920 × 1 080.`);
    const holes = transparentPixels(image);
    if (holes) errors.push(`${tile.file} : ${holes} pixels transparents (fondu ou trou interdit).`);
    report.tuiles.push({ fichier: tile.file, transparents: holes });
    return image;
  });
  if (!images.some(Boolean)) errors.push('Aucune tuile trouvée dans ce dossier.');
  const master = masterFile ? readPng(masterFile) : null;
  if (master) list.forEach((tile, i) => {
    if (images[i] && tile.masterLeft + TILE.width <= master.width && !crop(master, tile.masterLeft, TILE.width).data.equals(images[i].data)) errors.push(`${tile.file} : différente de la fresque maître (retouchée après découpe ?).`);
  });
  const views = path.join(dir, 'controle-raccords');
  mkdirSync(views, { recursive: true });
  list.forEach((tile, i) => {
    const next = list[(i + 1) % list.length], a = images[i], b = images[(i + 1) % list.length];
    if (!a || !b || a.width !== TILE.width || b.width !== TILE.width) return;
    const score = seamScore(a, b), name = `raccord-${tile.number}-${next.number}.png`;
    report.coupes.push({ coupe: `${tile.number} → ${next.number}`, ecart: +score.seam.toFixed(1), ecart_habituel: +score.normal.toFixed(1), visible: score.visible });
    if (score.visible) errors.push(`Coupe ${tile.number} → ${next.number} visible : écart ${score.seam.toFixed(1)} pour ${score.normal.toFixed(1)} d'habitude.`);
    const left = crop(a, TILE.width - VIEW, VIEW), right = crop(b, 0, VIEW), joined = Buffer.alloc(VIEW * 2 * TILE.height * 4);
    for (let y = 0; y < TILE.height; y++) {
      left.data.copy(joined, y * VIEW * 8, y * VIEW * 4, (y + 1) * VIEW * 4);
      right.data.copy(joined, y * VIEW * 8 + VIEW * 4, y * VIEW * 4, (y + 1) * VIEW * 4);
    }
    writePng(path.join(views, name), { width: VIEW * 2, height: TILE.height, data: joined });
  });
  writeFileSync(path.join(views, 'rapport.json'), JSON.stringify({ ...report, erreurs: errors }, null, 2));
  const missing = report.tuiles.filter(t => t.absente).length;
  if (missing) console.log(`${missing} tuile(s) pas encore peinte(s) : leurs coupes ne sont pas contrôlées.`);
  console.log(`${report.coupes.length} coupes mesurées. Vues rapprochées et rapport dans ${views}.`);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; } else console.log('Aucun défaut détecté. Regarder quand même chaque vue rapprochée à 100 %.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === 'decouper' && a) cut(a, b || 'docs/production/decor-v3/carte-plate/tuiles');
  else if (mode === 'verifier' && a) check(a, b);
  else { console.error('Usage : decouper <fresque-maitre.png> [dossier] | verifier <dossier> [fresque-maitre.png]'); process.exitCode = 1; }
}

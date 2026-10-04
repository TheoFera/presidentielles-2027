import { cp, mkdir, readFile, readdir, lstat, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { cachedWebp, eachLimited, webpAvailable } from './lib/webp.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaultTarget = resolve(root, 'dist');
const webpCache = resolve(root, '.cache/webp');
const configNames = ['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json', 'campaign_events.json'];

// Images jamais affichées par l'application : décors réservés au profil betatest
// (panoramas world-v2, France peinte, décor v3) et anciens fonds remplacés par les
// couches séparées des biomes. Elles restent dans le projet pour npm start.
export const APP_EXCLUDED_IMAGES = [
  /^assets\/generated\/(france-peinte|france-peinte-complete|world-v3)\//,
  /^assets\/generated\/world-v2\/(panorama-|expanded-|banlieue-b-(?:rue|fond)-v3)/,
  /^assets\/generated\/biomes\/background-(\d+|strip-[a-z]+)\.png$/,
  /^assets\/generated\/biomes\/distant-(rural|suburb|urban)\.png$/,
];
const excludedImage = path => APP_EXCLUDED_IMAGES.some(pattern => pattern.test(path));

// Fichiers réellement chargés par le jeu : on suit les <script>, <link>, import et @import
// depuis index.html. Les pages et modules d'outils (aperçus, maquettes) ne sont pas exportés.
const dependencyPatterns = [/\bfrom\s*['"]([^'"\n]+)['"]/g, /\bimport\s*\(?\s*['"]([^'"\n]+)['"]/g, /<script[^>\n]*\bsrc="([^"]+)"/g,
  /<link[^>\n]*rel="stylesheet"[^>\n]*href="([^"]+)"/g, /@import\s+(?:url\()?['"]([^'"\n]+)['"]/g];
async function reachableFiles(entry = 'index.html') {
  const seen = new Set();
  async function visit(path) {
    if (seen.has(path)) return;
    seen.add(path);
    const source = await readFile(resolve(root, path), 'utf8');
    for (const pattern of dependencyPatterns) for (const [, specifier] of source.matchAll(pattern)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('src/')) continue;
      const base = path.includes('/') ? dirname(path) : '.';
      const target = relative(root, resolve(root, specifier.startsWith('src/') ? '.' : base, specifier)).replaceAll('\\', '/');
      await visit(target);
    }
  }
  await visit(entry);
  return [...seen];
}

async function licenseFiles(directory = 'src/vendor') {
  return (await readdir(resolve(root, directory))).filter(name => name.endsWith('-LICENSE.txt')).map(name => `${directory}/${name}`);
}

async function generatedPngFiles(directory) {
  return (await readdir(resolve(root, directory), { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.png'))
    .map(entry => `${directory}/${entry.name}`);
}

const pngReference = /(assets\/generated\/[^'"`\s)?]*?)\.png/g;
/** Remplace les chemins d'images PNG du jeu par leur version WebP (littéraux et gabarits). */
export const useWebpPaths = source => source.replace(pngReference, '$1.webp');

// Prévisualisations, archives, documents et originaux restent dans le projet.
// app = true : version de l'application Android, sans les décors du profil betatest.
export async function buildPages(output = defaultTarget, { webp = true, app = false } = {}) {
  const target = resolve(output instanceof URL ? fileURLToPath(output) : output);
  const entries = await readdir(target).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  // Seul dist/ peut être effacé. Une autre destination doit être vide.
  if (target !== defaultTarget && entries.length) throw new Error('La destination personnalisée doit être vide.');
  const targetInfo = await lstat(target).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (targetInfo?.isSymbolicLink()) throw new Error('La destination ne doit pas être un lien symbolique.');

  const code = await reachableFiles();
  // La politique de confidentialité est publiée avec le jeu (adresse demandée par le Play Store).
  // ads.txt / app-ads.txt (régies publicitaires, voir docs/publicites.md) : publiés s'ils existent.
  const adsFiles = (await readdir(root)).filter(name => ['ads.txt', 'app-ads.txt'].includes(name));
  const files = [...code, 'confidentialite.html', 'conditions.html', ...adsFiles, ...await licenseFiles()];
  const images = new Set();
  for (const file of code) {
    const source = await readFile(resolve(root, file), 'utf8');
    // URL du manifeste, url() CSS et attributs HTML : chemins PNG littéraux.
    for (const [asset] of source.matchAll(/assets\/generated\/(?:[a-z0-9_-]+\/)+[a-z0-9_-]+\.png/g)) {
      if (asset.startsWith('assets/generated/masters/')) throw new Error('Un original ne doit pas être référencé par le jeu.');
      if (!app || !excludedImage(asset)) images.add(asset);
    }
  }
  // Les 120 PNJ sont déclarés par une boucle dans le manifeste afin d'éviter
  // 120 lignes répétitives ; l'export doit donc inclure explicitement ce dossier.
  for (const asset of await generatedPngFiles('assets/generated/npc-v2')) images.add(asset);
  for (const asset of await generatedPngFiles('assets/generated/npc-militants')) images.add(asset);
  // Vérifier les entrées avant de remplacer le dernier export.
  for (const file of [...files, ...images]) {
    if (!(await stat(resolve(root, file))).isFile()) throw new Error(`Fichier absent : ${file}`);
  }
  const useWebp = webp && await webpAvailable();
  const converted = new Map();
  if (useWebp) {
    const list = [...images];
    const outputs = await eachLimited(list, image => cachedWebp(resolve(root, image), webpCache));
    list.forEach((image, index) => converted.set(image, outputs[index]));
  }
  const exportedName = image => useWebp ? image.replace(/\.png$/, '.webp') : image;
  const configs = new Map(await Promise.all(configNames.map(async name => {
    const file = `Présidentielles 2027/${name}`;
    return [file, JSON.stringify(JSON.parse(await readFile(resolve(root, file), 'utf8'))) + '\n'];
  })));
  if (target === defaultTarget && targetInfo) {
    const actualRoot = await realpath(root);
    const actualTarget = await realpath(target);
    if (relative(actualRoot, actualTarget) !== 'dist') throw new Error('Nettoyage refusé hors du dossier dist du projet.');
    await rm(actualTarget, { recursive: true });
  }
  let bytes = 0;
  let imageBytes = 0;
  const written = [];
  async function write(file, contents) {
    const destination = resolve(target, file);
    await mkdir(dirname(destination), { recursive: true });
    if (typeof contents === 'string') await writeFile(destination, contents);
    else await cp(contents.from, destination);
    const size = (await stat(destination)).size;
    bytes += size;
    written.push(file);
    return size;
  }
  for (const file of files) {
    if (app && file === 'src/app-build.js') {
      await write(file, '// Généré par scripts/build-pages.mjs pour l\'application.\nexport const APP_BUILD = true;\n');
    } else if (/\.(html|js|css)$/.test(file)) {
      const source = await readFile(resolve(root, file), 'utf8');
      await write(file, useWebp ? useWebpPaths(source) : source);
    } else await write(file, { from: resolve(root, file) });
  }
  for (const [file, contents] of configs) await write(file, contents);
  for (const image of images) imageBytes += await write(exportedName(image), { from: converted.get(image) || resolve(root, image) });
  return { files: written.length, images: images.size, bytes, imageBytes, webp: useWebp, app };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const started = Date.now();
  const report = await buildPages(defaultTarget, { webp: !process.argv.includes('--png'), app: process.argv.includes('--app') });
  const mib = bytes => (bytes / 1024 ** 2).toFixed(2);
  if (!report.webp) console.warn('ffmpeg (avec libwebp) est introuvable : les images restent en PNG, plus lourdes.');
  console.log(`Jeu prêt dans dist/ : ${report.files} fichiers, ${mib(report.bytes)} Mio, dont ${mib(report.imageBytes)} Mio d'images${report.webp ? ' (WebP sans perte)' : ''}, en ${Math.round((Date.now() - started) / 1000)} s.`);
  console.log(report.app ? 'Version application : décors betatest exclus.' : 'Version web complète. L\'application Android se construit avec npm run android.');
}

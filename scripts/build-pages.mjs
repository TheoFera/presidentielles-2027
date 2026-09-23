import { cp, mkdir, readFile, readdir, lstat, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaultTarget = resolve(root, 'dist');
const configNames = ['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json', 'campaign_events.json'];

async function sourceFiles(directory = 'src') {
  const files = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.isFile() && (/\.(js|css)$/.test(path) || /-LICENSE\.txt$/.test(path))) files.push(path);
  }
  return files;
}

// Prévisualisations, archives, documents et originaux restent dans le projet.
export async function buildPages(output = defaultTarget) {
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

  const files = ['index.html', ...await sourceFiles()];
  const images = new Set();
  for (const file of files) {
    const source = await readFile(resolve(root, file), 'utf8');
    // URL du manifeste, url() CSS et attributs HTML : chemins PNG littéraux.
    for (const [asset] of source.matchAll(/assets\/generated\/(?:[a-z0-9_-]+\/)+[a-z0-9_-]+\.png/g)) {
      if (asset.startsWith('assets/generated/masters/')) throw new Error('Un original ne doit pas être référencé par le jeu.');
      images.add(asset);
    }
  }
  files.push(...images, ...configNames.map(name => `Présidentielles 2027/${name}`));
  // Vérifier les entrées avant de remplacer le dernier export.
  for (const file of files) {
    if (!(await stat(resolve(root, file))).isFile()) throw new Error(`Fichier absent : ${file}`);
  }
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
  for (const file of files) {
    const destination = resolve(target, file);
    await mkdir(resolve(destination, '..'), { recursive: true });
    if (configs.has(file)) await writeFile(destination, configs.get(file));
    else await cp(resolve(root, file), destination);
    const size = (await stat(destination)).size;
    bytes += size;
    if (images.has(file)) imageBytes += size;
  }
  return { files: files.length, images: images.size, bytes, imageBytes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await buildPages();
  const mib = bytes => (bytes / 1024 ** 2).toFixed(2);
  console.log(`Jeu prêt dans dist/ : ${report.files} fichiers, ${mib(report.bytes)} Mio, dont ${mib(report.imageBytes)} Mio d'images.`);
  console.log('Embarquer uniquement ce dossier dans la future application mobile.');
}

import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Liste explicite : les documents, sauvegardes et secrets ne sont jamais publiés.
export async function buildPages(output = new URL('../dist/', import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const target = output instanceof URL ? fileURLToPath(output) : output;
  await mkdir(resolve(target, 'Présidentielles 2027'), { recursive: true });
  await cp(new URL('index.html', root), resolve(target, 'index.html'));
  await cp(new URL('src/', root), resolve(target, 'src'), { recursive: true });
  for (const name of ['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json']) {
    await cp(new URL(`Présidentielles 2027/${name}`, root), resolve(target, 'Présidentielles 2027', name));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPages();
  console.log('Jeu prêt pour GitHub Pages dans dist/.');
}

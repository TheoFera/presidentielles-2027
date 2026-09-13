import { readFile, writeFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const registryFile = path.join(root, 'visual_codex/generated_asset_registry.json');
const registry = JSON.parse(await readFile(registryFile, 'utf8'));
const production = path.join(root, 'visual_codex/production');
for (const name of (await readdir(production)).filter(n => /^character-(style|ultimate)-.*\.json$/.test(n))) {
  const record = JSON.parse(await readFile(path.join(production, name), 'utf8'));
  if (registry.assets.some(a => a.asset_id === record.asset_id && a.source_file === record.source_file)) continue;
  const png = await readFile(record.source_file);
  if (![4, 6].includes(png[25])) throw new Error(`Sprite sans canal transparent : ${record.asset_id}`);
  record.master = `assets/generated/masters/${record.asset_id}.png`;
  record.file = `assets/generated/characters/${record.asset_id}.png`;
  await mkdir(path.join(root, 'assets/generated/masters'), { recursive: true });
  await copyFile(record.source_file, path.join(root, record.master));
  const result = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/optimize-visual.ps1'), '-Source', record.master,
    '-Destination', record.file, '-MaxHeight', String(record.max_height || 512)], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  const metadata = JSON.parse(result.stdout.trim());
  Object.assign(record, { dimensions: [metadata.width, metadata.height], source_crop: metadata.source_crop, status: 'generated_pending_qa', date: new Date().toISOString().slice(0,10) });
  registry.assets = registry.assets.filter(a => a.asset_id !== record.asset_id); registry.assets.push(record);
  console.log(`${record.asset_id} : ${metadata.width} × ${metadata.height}`);
}
await writeFile(registryFile, JSON.stringify(registry, null, 2) + '\n');
const lines = registry.assets.filter(a => a.file && a.status !== 'rejected').map(a => `  ${JSON.stringify(a.asset_id)}: { file: new URL(${JSON.stringify('../../' + a.file)}, import.meta.url).href },`);
await writeFile(path.join(root, 'src/presentation/visual-manifest.js'), '// Generated from visual_codex/generated_asset_registry.json.\nexport const visualManifest = {\n' + lines.join('\n') + '\n};\n');

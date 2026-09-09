import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const registryPath = path.join(root, 'visual_codex/generated_asset_registry.json');
const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const production = path.join(root, 'visual_codex/production');
await mkdir(production, { recursive: true });
const selected = new Map();
const names = (await readdir(production)).sort((a, b) => Number(a.includes('-corrected')) - Number(b.includes('-corrected')) || a.localeCompare(b));
for (const name of names) {
  if (!name.endsWith('.json')) continue;
  const record = JSON.parse(await readFile(path.join(production, name), 'utf8'));
  selected.set(record.asset_id, record);
}
for (const record of selected.values()) {
  if (registry.assets.some(a => a.asset_id === record.asset_id && a.source_file === record.source_file)) continue;
  const png = await readFile(record.source_file);
  if (record.transparent && png[25] !== 6 && png[25] !== 4) {
    console.log(`À corriger : ${record.asset_id} ne possède pas de canal alpha.`); continue;
  }
  const folder = /^(background-|distant-|street-|landscape-)/.test(record.asset_id) ? 'biomes' : record.asset_id.startsWith('building-') ? 'buildings' : /^(character-|npc-|security-|crs-|journalist-)/.test(record.asset_id) ? 'characters' : record.asset_id.startsWith('vegetation-') ? 'vegetation' : record.asset_id.startsWith('ui-') ? 'ui' : 'fx';
  record.master = `assets/generated/masters/${record.asset_id}.png`;
  record.file = `assets/generated/${folder}/${record.asset_id}.png`;
  await mkdir(path.dirname(path.join(root, record.master)), { recursive: true });
  await copyFile(record.source_file, path.join(root, record.master));
  const args = ['-NoProfile','-File',path.join(root,'scripts/optimize-visual.ps1'),'-Source',record.master,'-Destination',record.file,'-MaxHeight',String(record.max_height || (folder === 'biomes' ? 512 : folder === 'buildings' ? 640 : 384))];
  if (!record.transparent || record.preserve_canvas) args.push('-KeepCanvas');
  const result = spawnSync('pwsh', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`${record.asset_id}: ${result.stderr || result.stdout}`);
  const metadata = JSON.parse(result.stdout.trim());
  Object.assign(record, { dimensions: [metadata.width, metadata.height], source_crop: metadata.source_crop, status: 'generated_pending_qa', date: new Date().toISOString().slice(0,10) });
  registry.assets = registry.assets.filter(a => a.asset_id !== record.asset_id);
  registry.assets.push(record);
  console.log(`${record.asset_id} : ${metadata.width} × ${metadata.height}`);
}
await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');
const lines = registry.assets.filter(a => a.file && a.status !== 'rejected').map(a => `  ${JSON.stringify(a.asset_id)}: { file: new URL(${JSON.stringify('../../' + a.file)}, import.meta.url).href },`);
await writeFile(path.join(root, 'src/presentation/visual-manifest.js'), '// Generated from visual_codex/generated_asset_registry.json by scripts/register-visual.mjs.\nexport const visualManifest = {\n' + lines.join('\n') + '\n};\n');

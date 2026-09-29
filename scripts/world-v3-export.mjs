// Exporte les maquettes du décor v3 en PNG et régénère le document des prompts ChatGPT.
// Usage : node scripts/world-v3-export.mjs            → maquettes + prompts
//         node scripts/world-v3-export.mjs captures   → captures du jeu en mode maquette (artifacts/world-v3/captures)
//         node scripts/world-v3-export.mjs captures-final → captures avec les images finales
//         node scripts/world-v3-export.mjs fresque    → parcours complet de la fresque (artifacts/world-v3/fresque)
//         SET=periurbain node scripts/world-v3-export.mjs planche → planche d'essai d'éléments (artifacts/world-v3/planche)
//         node scripts/world-v3-export.mjs mineurs    → maquettes des planches des candidats mineurs
// Chrome ou Edge doit être installé (CHROME_PATH pour un autre chemin).
import http from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { allDecorImages } from '../src/presentation/world-v3/spec.js';
import { decorPromptsMarkdown } from '../src/presentation/world-v3/prompts.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] || 'maquettes';
const planche = mode === 'planche', fresque = mode === 'fresque', captures = mode.startsWith('captures') || fresque, minors = mode === 'mineurs';
const output = path.join(root, planche ? 'artifacts/world-v3/planche' : captures ? `artifacts/world-v3/${mode}` : minors ? 'docs/production/candidats-mineurs/maquettes' : 'docs/production/decor-v3/maquettes');
const expected = planche ? Infinity : fresque ? 36 : captures ? 18 * 2 + 4 : minors ? 6 : allDecorImages().length * 2;
await mkdir(output, { recursive: true });
if (!captures && !minors && !planche) await writeFile(path.join(root, 'docs/production/decor-v3/PROMPTS.md'), decorPromptsMarkdown());

const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
let chrome = null;
for (const file of candidates) { try { await access(file); chrome = file; break; } catch { /* suivant */ } }
if (!chrome) throw new Error('Chrome introuvable : définir CHROME_PATH.');

let saved = 0, finish;
const done = new Promise(resolve => { finish = resolve; });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/__export') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const name = path.basename(url.searchParams.get('name'));
    if (name === 'fin') { res.end('ok'); finish(); return; }
    await writeFile(path.join(output, name), Buffer.from(Buffer.concat(chunks).toString().split(',')[1], 'base64'));
    res.end('ok'); if (++saved === expected) finish();
    return;
  }
  const file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  let body;
  try { body = await readFile(file); } catch { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const page = `http://127.0.0.1:${server.address().port}/src/presentation/${minors ? 'minor-preview' : `world-v3/${planche ? 'planche' : captures ? 'captures' : 'apercu'}`}.html?export=1${planche ? '&set=' + (process.env.SET || 'periurbain') : ''}${mode === 'captures' ? '&decor=maquette' : ''}${fresque ? '&decor=' + (process.env.DECOR || 'fresque') + '&fresque' + (process.env.SAISON ? '&saison=' + process.env.SAISON : '') + (process.env.FORMAT ? '&format=' + process.env.FORMAT : '') : ''}`;
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,900', '--force-device-scale-factor=1', `--user-data-dir=${path.join(os.tmpdir(), 'presidentielles-decor-export')}`, page], { stdio: 'ignore' });
const timeout = setTimeout(() => finish('timeout'), 120000);
const result = await done;
clearTimeout(timeout); browser.kill(); server.close();
if (result === 'timeout') throw new Error(`Export incomplet : ${saved}/${expected} images.`);
console.log(captures || minors || planche ? `${saved} images écrites dans ${path.relative(root, output)}` : `${saved} maquettes écrites dans docs/production/decor-v3/maquettes/ ; prompts dans docs/production/decor-v3/PROMPTS.md`);

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 2027);
const url = `http://localhost:${port}`;
function openBrowser() {
  if (!process.argv.includes('--open')) return;
  const [program, args] = process.platform === 'win32'
    ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const child = spawn(program, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log(`Ouvre le jeu manuellement : ${url}`));
  child.unref();
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${urlPath === '/' ? '/index.html' : urlPath}`);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(p => p.startsWith('.'))) {
      res.writeHead(403).end('Accès refusé.'); return;
    }
    if (!(await stat(file)).isFile()) throw new Error('Fichier absent');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Fichier introuvable.');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Le port ${port} est déjà utilisé. Si le jeu tourne déjà, ouvre http://localhost:${port}. Sinon, choisis un autre port avec $env:PORT = 2028.`
    : `Impossible de démarrer : ${error.message}`);
  process.exitCode = 1;
  if (error.code === 'EADDRINUSE') openBrowser();
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Prototype prêt : ${url}\nLaisse ce terminal ouvert. Ctrl+C pour arrêter.`);
  openBrowser();
});

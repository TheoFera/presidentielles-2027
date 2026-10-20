import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CAMPAIGN_TEST_NODE_MODULES ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright') : 'playwright');
const root = process.cwd(), output = path.resolve('artifacts/services-ordre'), fps = 15;
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(404).end(); return; }
  try {
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : 'image/png');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], measurements = [], captures = [];
function ffmpeg(args) {
  const result = spawnSync(process.env.CAMPAIGN_FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
try {
  const page = await browser.newPage({ viewport: { width: 1250, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/src/presentation/debogage/apercu-so.html`);
  await page.waitForFunction(() => window.controleSO?.ready, { timeout: 90000 });
  await page.evaluate(() => {
    window.controleSO.pause();
    const ctx = document.querySelector('canvas').getContext('2d'), native = ctx.drawImage.bind(ctx);
    window.soDraws = [];
    ctx.drawImage = (image, ...args) => {
      const t = ctx.getTransform(), crop = args.length === 8;
      const sw = crop ? args[2] : image.width, sh = crop ? args[3] : image.height;
      const dw = args[crop ? 6 : 2], dh = args[crop ? 7 : 3];
      const ratio = Math.hypot(t.a, t.b) * dw / sw / (Math.hypot(t.c, t.d) * dh / sh);
      window.soDraws.push({ source: image.src, rect: crop ? args.slice(0, 4) : [0, 0, image.width, image.height], ratio });
      native(image, ...args);
    };
  });
  for (const camp of ['melenchon', 'le_pen'].filter(camp => !process.env.CAMPAIGN_PREVIEW_FACTION || camp === process.env.CAMPAIGN_PREVIEW_FACTION)) {
    if (!process.env.CAMPAIGN_PREVIEW_DEFENSE_ONLY) {
    const seen = new Map();
    for (const facing of [-1, 1]) for (const mode of ['idle', 'walk', 'punch', 'building']) for (let tick = 0; tick < 90; tick += 2) {
      const result = await page.evaluate(({ mode, tick, camp, facing }) => {
        window.soDraws = [];
        const poses = window.controleSO.render(mode, tick, camp, facing);
        return { poses, draws: window.soDraws };
      }, { mode, tick, camp, facing });
      assert.equal(result.poses.length, 12);
      assert.ok(result.draws.length >= 12, 'Les douze dessins doivent réellement être affichés.');
      for (const pose of result.poses) {
        if (!seen.has(pose.variant)) seen.set(pose.variant, new Set());
        seen.get(pose.variant).add(pose.frame);
      }
      for (const draw of result.draws) {
        if (mode !== 'walk') assert.ok(Math.abs(draw.ratio - 1) < 1e-8, 'Le dessin ne doit pas être étiré.');
      }
      measurements.push({ camp, facing, mode, tick, poses: result.poses });
    }
    for (const [variant, frames] of seen) {
      const masked = /antifa|cite|gud|veteran/.test(variant);
      assert.deepEqual([...frames].sort(), masked ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3], variant);
    }
    await page.evaluate(camp => window.controleSO.render('idle', 0, camp, 1), camp);
    await page.locator('canvas').screenshot({ path: path.join(output, `${camp}-douze-personnages.png`) });
    const framesDir = path.join(output, camp); await mkdir(framesDir, { recursive: true });
    for (let i = 0; i < fps * 6; i++) {
      const seconds = i / fps, mode = seconds < 1.2 ? 'idle' : seconds < 3 ? 'punch' : 'building';
      const image = await page.evaluate(({ mode, tick, camp }) => {
        window.controleSO.render(mode, tick, camp, 1);
        return document.querySelector('canvas').toDataURL('image/png').split(',')[1];
      }, { mode, tick: Math.floor(seconds * 30), camp });
      await writeFile(path.join(framesDir, `image-${String(i).padStart(4, '0')}.png`), Buffer.from(image, 'base64'));
    }
    const video = path.join(output, `${camp}-animations.mp4`);
    ffmpeg(['-framerate', String(fps), '-i', path.join(framesDir, 'image-%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', video]);
    ffmpeg(['-i', video, '-filter_complex', 'fps=15,scale=1000:-1,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer', '-loop', '0', path.join(output, `${camp}-animations.gif`)]);
    captures.push({ camp, video });
    }
    const defenseStates = await page.evaluate(camp => {
      const api = window.controleSO; api.render('defense', 0, camp, 1);
      return [0, 2, 6, 10, 18].map(t => {
        const state = api.sceneAt(t);
        return { seconds: t, guards: state.npcs.map(n => ({ role: n.role, raid: n.raid, task: n.task, assignment: n.so_assignment, pressure: n.pressure_target_id })) };
      });
    }, camp);
    assert.ok(defenseStates[0].guards.every(n => n.task.kind === 'JOIN_GUARD'));
    assert.ok(defenseStates[2].guards.every(n => n.role === 'SERVICE_D_ORDRE' && !n.raid));
    assert.ok(defenseStates[3].guards.some(n => n.task?.phase === 'DEFEND'));
    assert.ok(defenseStates.at(-1).guards.every(n => ['POST', 'RETURN'].includes(n.task?.phase) && !n.pressure));
    measurements.push({camp, defense: defenseStates});
    for (const mode of ['defense', 'raid']) for (const facing of [-1, 1]) for (const tick of [180, 300]) {
      const feet = await page.evaluate(({mode, camp, facing, tick}) => window.controleSO.render(mode, tick, camp, facing).map(p => p.feetY), {mode, camp, facing, tick});
      assert.equal(feet.length, 3);
      assert.ok(feet.every(Number.isFinite) && Math.max(...feet) - Math.min(...feet) < 1e-8, 'Tous les SO doivent garder la même ligne de marche.');
    }

    const defenseDir = path.join(output, camp + '-garde'); await mkdir(defenseDir, {recursive: true});
    for (let i = 0; i < 160; i++) {
      const image = await page.evaluate(({camp, tick}) => {
        window.controleSO.render('defense', tick, camp, 1);
        return document.querySelector('canvas').toDataURL('image/png').split(',')[1];
      }, {camp, tick: Math.floor(i * 30 / 8)});
      await writeFile(path.join(defenseDir, 'image-' + String(i).padStart(4, '0') + '.png'), Buffer.from(image, 'base64'));
      if ([0, 48, 80, 144].includes(i)) await page.locator('canvas').screenshot({path: path.join(output, camp + '-garde-' + i + '.png')});
    }
    ffmpeg(['-framerate', '8', '-i', path.join(defenseDir, 'image-%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', path.join(output, camp + '-garde.mp4')]);
    if (process.env.CAMPAIGN_PREVIEW_DEFENSE_ONLY) continue;
    for (const facing of [-1, 1]) {
      const states = await page.evaluate(({ camp, facing }) => {
        const api = window.controleSO; api.render('raid', 0, camp, facing);
        return [0, 2, 6, 10, 13].map(t => { const state = api.sceneAt(t); return { seconds: t, building: state.buildings[0].state, progress: state.buildings[0].closure_progress, guards: state.npcs.map(n => ({ x: n.x, pressure: n.pressure_target_id })) }; });
      }, { camp, facing });
      assert.ok(states.some(s => s.progress > 0));
      assert.notEqual(states.at(-1).building, 'ACTIVE', 'Le raid doit fermer le bâtiment.');
      measurements.push({ camp, facing, raid: states });
      await page.evaluate(({ camp, facing }) => window.controleSO.render('raid', 180, camp, facing), { camp, facing });
      await page.locator('canvas').screenshot({ path: path.join(output, `${camp}-facade-${facing}.png`) });
    }
    const raidDir = path.join(output, `${camp}-raid`); await mkdir(raidDir, { recursive: true });
    for (let i = 0; i < 140; i++) {
      const image = await page.evaluate(({ camp, tick }) => {
        window.controleSO.render('raid', tick, camp, 1);
        return document.querySelector('canvas').toDataURL('image/png').split(',')[1];
      }, { camp, tick: i * 3 });
      await writeFile(path.join(raidDir, `image-${String(i).padStart(4, '0')}.png`), Buffer.from(image, 'base64'));
    }
    ffmpeg(['-framerate', '10', '-i', path.join(raidDir, 'image-%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', path.join(output, `${camp}-raid.mp4`)]);
    ffmpeg(['-i', path.join(output, `${camp}-raid.mp4`), '-filter_complex', 'fps=10,scale=850:-1,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer', '-loop', '0', path.join(output, `${camp}-raid.gif`)]);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); server.close(); }
await writeFile(path.join(output, process.env.CAMPAIGN_PREVIEW_DEFENSE_ONLY ? 'verification-garde.json' : 'verification.json'), JSON.stringify({ errors, fps, measurements, captures }, null, 2));
console.log(JSON.stringify({ output, errors, captures }));

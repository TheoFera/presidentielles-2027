// Exporte les vrais rendus du jeu en GIF autonomes ; aucun dessin de remplacement.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from '../validate-campaign.mjs';
import { GameSimulation } from '../../src/simulation/game-simulation.js';
import { activateUltimate, beginCombatTick, updateCombat, cancelCurrentAttack, requestAttack } from '../../src/simulation/combat.js';
import { combatState } from '../../src/simulation/combat-state.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CAMPAIGN_TEST_NODE_MODULES ? path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright') : 'playwright');
const config = campaignConfig(), fps = Number(process.env.CAMPAIGN_PREVIEW_FPS || 15), output = path.resolve('artifacts/ultimes-mineurs/apercus');
await mkdir(output, { recursive: true });
const definitions = [
  { faction: 'roussel', seconds: 3.1, name: 'Fabien Roussel', description: 'Saucisse boomerang : aller puis retour' },
  { faction: 'dupont_aignan', seconds: 5, name: 'Nicolas Dupont-Aignan', description: 'Disparition, puis réapparition en attaquant' },
  { faction: 'glucksmann', seconds: 3.8, name: 'Raphaël Glucksmann', description: 'Appel, passage du Rafale et trois missiles rapides' },
  { faction: 'arthaud', seconds: 3.7, name: 'Nathalie Arthaud', description: 'Faucille, puis marteau qui aplatit' },
  { faction: 'retailleau', seconds: 5.3, name: 'Bruno Retailleau', description: 'Le mur se dresse, puis bascule' },
  { faction: 'attal', seconds: 3.8, name: 'Gabriel Attal', description: 'Lancer, attente, puis second appui' },
].filter(definition => !process.env.CAMPAIGN_PREVIEW_FACTION || process.env.CAMPAIGN_PREVIEW_FACTION.split(',').includes(definition.faction))
  .flatMap(definition => (process.env.CAMPAIGN_PREVIEW_BOTH_DIRECTIONS ? [1, -1] : [1]).map(direction => ({ ...definition, direction, solo: !!process.env.CAMPAIGN_PREVIEW_SOLO })));
function snapshots(definition) {
  const sim = new GameSimulation(config, 42), state = sim.state;
  const owner = state.candidates.find(c => c.faction_id === definition.faction), target = state.candidates.find(c => c.faction_id === 'philippe');
  state.tick = 120; state.npcs = []; state.temporary_units = []; state.candidates = [owner, target]; state.local_candidate_id = owner.id;
  Object.assign(owner, { x: 100, facing: definition.direction, moving: false, axis: 0, campaign_active: true, special_charge: 100, current_campaign_style: null, combat: combatState() });
  Object.assign(target, { x: 100 + definition.direction * (definition.faction === 'arthaud' ? 1.7 : 4), facing: -definition.direction, moving: false, axis: 0, resistance: 100, current_campaign_style: 'philippe_gestionnaire', combat: combatState() });
  if (definition.solo) state.candidates = [owner];
  const frames = [], start = state.tick, activation = Math.round(.55 * sim.hz);
  let eventIndex = 0;
  const events = definition.faction === 'arthaud' ? [[activation + Math.round(.65 * sim.hz), 'sickle'], [activation + Math.round(1.8 * sim.hz), 'hammer']]
    : definition.faction === 'attal' ? [[activation + Math.round(2.1 * sim.hz), 'detonate']]
    : definition.faction === 'dupont_aignan' ? [[activation + Math.round(2.7 * sim.hz), 'reveal']] : [];
  for (let frame = 0; frame < Math.ceil(definition.seconds * fps); frame++) {
    const until = Math.floor(frame / fps * sim.hz);
    while (state.tick - start < until) {
      state.tick++; beginCombatTick(sim);
      const elapsed = state.tick - start;
      if (elapsed === activation) activateUltimate(sim, owner);
      if (events[eventIndex]?.[0] === elapsed) {
        const event = events[eventIndex++][1];
        if (event === 'detonate') activateUltimate(sim, owner);
        else {
          cancelCurrentAttack(sim, owner);
          if (event === 'hammer') { owner.combat.combo_step = 1; owner.combat.combo_expires_tick = state.tick + sim.hz; }
          requestAttack(sim, owner);
        }
      }
      updateCombat(sim);
    }
    const s = Object.fromEntries(['tick', 'phase', 'candidates', 'powers', 'attacks', 'projectiles', 'hit_results', 'local_candidate_id', 'world', 'debate_bounds'].map(key => [key, state[key]]));
    s.npcs = []; s.temporary_units = []; s.buildings = [];
    frames.push(structuredClone(s));
  }
  return frames;
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' }), errors = [], report = [];
try {
  const page = await browser.newPage({ viewport: { width: 780, height: 460 } }); page.on('pageerror', e => errors.push(e.message));
  await page.route('**/minor-ultimate-preview', route => route.fulfill({ contentType: 'text/html', body: '<html lang="fr"><body style="margin:0"><canvas width="780" height="460"></canvas></body></html>' }));
  await page.goto((process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027') + '/minor-ultimate-preview');
  await page.evaluate(async config => {
    const { visualManifest } = await import('/src/presentation/rendu/visual-manifest.js');
    const { WorldRenderer } = await import('/src/presentation/rendu/renderer.js');
    const { drawCombatEffects } = await import('/src/presentation/effets/combat-effects.js');
    const { minorUltimateAtlases } = await import('/src/presentation/effets/minor-ultimate-art.js');
    const { prepareAtlasFrames } = await import('/src/presentation/personnages/minor-sprite-images.js');
    const loaded = new Map(await Promise.all(Object.entries(visualManifest).filter(([id]) => id.startsWith('minor-') || id.startsWith('character-minor-') || id.startsWith('ultimate-minor-') || id.startsWith('character-philippe') || id === 'character-style-philippe-gestionnaire').map(async ([id, entry]) => { const image = new Image(); image.src = entry.file; await image.decode(); return [id, image]; })));
    const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
    const identified = new WeakMap(); let draws = [], texts = [];
    const nativeText = ctx.fillText.bind(ctx);
    ctx.fillText = (text, ...args) => { texts.push(String(text)); nativeText(text, ...args); };
    for (const [name, atlas] of Object.entries(minorUltimateAtlases)) prepareAtlasFrames(loaded.get(atlas.sprite), atlas).forEach((frame, index) => identified.set(frame, { atlas: name, index }));
    const nativeDraw = ctx.drawImage.bind(ctx);
    ctx.drawImage = (image, ...args) => {
      const matrix = ctx.getTransform(), cropped = args.length === 8;
      const sourceWidth = cropped ? args[2] : image.width, sourceHeight = cropped ? args[3] : image.height;
      const width = args.length === 2 ? sourceWidth : args.at(-2), height = args.length === 2 ? sourceHeight : args.at(-1);
      draws.push({ ...(identified.get(image) || { atlas: 'autre' }), cropped, width: Math.hypot(matrix.a, matrix.b) * width, height: Math.hypot(matrix.c, matrix.d) * height,
        scaleX: Math.hypot(matrix.a, matrix.b) * width / sourceWidth, scaleY: Math.hypot(matrix.c, matrix.d) * height / sourceHeight });
      nativeDraw(image, ...args);
    };
    const renderer = { ctx, config, p: config.prototype.presentation, width: 780, height: 460, metrics: { groundY: 392, characterHeight: 145, pixelsPerUnit: 45, groundOffsetRatio: 0 }, assets: { get: id => loaded.get(id), load: async () => {} }, screenX: x => 155 + (x - 100) * 45, drawVisiblePerson: WorldRenderer.prototype.drawVisiblePerson };
    window.renderUltimatePreview = (states, definition) => states.map(state => {
      canvas.height = definition.faction === 'glucksmann' ? 460 : 320;
      renderer.height = canvas.height; renderer.metrics.groundY = canvas.height - 68;
      renderer.screenX = x => (definition.faction === 'glucksmann' ? definition.direction < 0 ? 500 : 280 : definition.direction < 0 ? 405 : 155) + (x - 100) * 45;
      draws = []; texts = [];
      ctx.reset(); ctx.fillStyle = '#e8dfca'; ctx.fillRect(0, 0, 780, canvas.height); ctx.fillStyle = '#cdb68f'; ctx.fillRect(0, canvas.height - 66, 780, 66);
      if (definition.faction === 'dupont_aignan') {
        renderer.metrics.characterHeight = 128; renderer.metrics.pixelsPerUnit = 35;
        for (let side = 0; side < 2; side++) {
          ctx.save(); ctx.beginPath(); ctx.rect(side * 390, 0, 390, canvas.height - 40); ctx.clip(); ctx.translate(side * 390, 0);
          state.local_candidate_id = state.candidates[side].id;
          for (const entity of state.candidates) WorldRenderer.prototype.drawPerson.call(renderer, entity, renderer.screenX(entity.x), state);
          drawCombatEffects(renderer, state, false);
          ctx.fillStyle = '#223440'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText(side ? 'Vue de l’adversaire' : 'Vue de NDA', 195, 46); ctx.restore();
        }
        ctx.strokeStyle = '#b7a58a'; ctx.beginPath(); ctx.moveTo(390, 20); ctx.lineTo(390, canvas.height - 50); ctx.stroke();
      } else {
        renderer.metrics.characterHeight = 145; renderer.metrics.pixelsPerUnit = 45;
        for (const entity of state.candidates) WorldRenderer.prototype.drawPerson.call(renderer, entity, renderer.screenX(entity.x), state);
        drawCombatEffects(renderer, state, false);
      }
      ctx.fillStyle = '#223440'; ctx.textAlign = 'center'; ctx.font = 'bold 21px system-ui'; ctx.fillText(definition.name, 390, canvas.height - 32);
      ctx.font = '16px system-ui'; ctx.fillText(definition.description, 390, canvas.height - 9);
      return { image: canvas.toDataURL('image/png').split(',')[1], draws, texts };
    });
  }, config);
  for (const definition of definitions) {
    const states = snapshots(definition), slug = definition.faction + (definition.solo ? '-seul' : '') + (definition.direction < 0 ? '-gauche' : '');
    const directory = path.join(output, slug); await mkdir(directory, { recursive: true });
    const inspected = [];
    for (let start = 0; start < states.length; start += 12) {
      const frames = await page.evaluate(({ states, definition }) => window.renderUltimatePreview(states, definition), { states: states.slice(start, start + 12), definition });
      for (const [i, frame] of frames.entries()) {
        assert.ok(frame.draws.length > 0);
        if (definition.faction !== 'arthaud') for (const draw of frame.draws) assert.ok(Math.abs(draw.scaleX / draw.scaleY - 1) < .01, `${slug}, image ${start+i} : étirement ${JSON.stringify(draw)}`);
        for (const draw of frame.draws) if (!draw.cropped && ['phone', 'satchelThrow', 'sausageThrow'].includes(draw.atlas)) {
          assert.ok(Math.abs(draw.height - 145 * 296 / 340 * 1.1236) < .001, `${slug}, image ${start+i} : changement de hauteur pendant l'ultime.`);
        }
        assert.ok(!frame.texts.some(text => /Interro surprise|Ultime : faire éclater/.test(text)), 'Aucun texte ne doit entourer le cartable.');
        inspected.push({ frame: start+i, tick: states[start+i].tick, draws: frame.draws, texts: frame.texts });
      }
      await Promise.all(frames.map((frame, i) => writeFile(path.join(directory, `frame-${String(start + i).padStart(4, '0')}.png`), Buffer.from(frame.image, 'base64'))));
    }
    await writeFile(path.join(directory, 'verification-dessins.json'), JSON.stringify(inspected, null, 2));
    const drawn = new Set(inspected.flatMap(frame => frame.draws.map(draw => `${draw.atlas}:${draw.index}`)));
    if (definition.faction === 'glucksmann') {
      const plane = inspected.flatMap(frame => frame.draws).find(draw => draw.atlas === 'plane');
      assert.ok(inspected.some(frame => frame.draws.filter(draw => draw.atlas === 'missile').length === 3), 'La salve doit dessiner trois missiles ensemble.');
      for (const frame of inspected) {
        const planeIndex = frame.draws.findIndex(draw => draw.atlas === 'plane');
        frame.draws.forEach((draw, index) => {
          if (draw.atlas !== 'missile') return;
          assert.ok(draw.width > plane.width * .19 && draw.width < plane.width * .24, 'Le missile doit être lisible sans dépasser environ un cinquième du Rafale.');
          if (planeIndex >= 0) assert.ok(index < planeIndex, 'Les missiles doivent sortir derrière le dessin du Rafale.');
        });
      }
    }
    for (const key of ({roussel:['sausageThrow:1','sausageThrow:2','sausageThrow:3','sausageThrow:5','sausageThrow:6','sausageThrow:7'],attal:['satchelThrow:1','satchelThrow:2','satchelThrow:3','satchelThrow:4','satchelThrow:5'],glucksmann:['phone:1','phone:2','phone:3','plane:0','missile:0'],retailleau:['barrier:0']}[definition.faction] || [])) assert.ok(drawn.has(key), `${slug} : pose absente ${key}`);
    const gif = path.join(output, slug + '.gif');
    const result = spawnSync(process.env.CAMPAIGN_FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(directory, 'frame-%04d.png'), '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-frames:v', String(states.length), '-loop', '0', gif], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); report.push({ ...definition, frames: states.length, gif }); console.log(`${definition.name} : ${states.length} images, GIF exporté.`);
  }
  assert.deepEqual(errors, []); await writeFile(path.join(output, 'verification.json'), JSON.stringify({ report, errors }, null, 2));
} finally { await browser.close(); }

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { campaignConfig } from '../validate-campaign.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve(process.env.CAMPAIGN_TEST_ARTIFACTS || 'artifacts/meeting-depth');
const base = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  // Page de contrôle : même simulation, mêmes images et même moteur de rendu que le jeu.
  await page.route('**/meeting-depth-check', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Vérification des scènes de meeting</title><style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas></html>' }));
  await page.goto(`${base}/meeting-depth-check`);
  const report = await page.evaluate(async config => {
    const { GameSimulation } = await import('/src/simulation/game-simulation.js');
    const { WorldRenderer } = await import('/src/presentation/rendu/renderer.js');
    const { drawMeetingStageSprite, meetingSpriteFrame } = await import('/src/presentation/carte/electoral.js');
    const { worldAssetIds } = await import('/src/presentation/carte/illustrated-world.js');
    config.balance.camera.framing_zoom = 1;
    const state = new GameSimulation(config, 42).state;
    state.npcs = [];
    state.candidates.slice(1).forEach(candidate => { candidate.disappeared = true; });
    const candidate = state.candidates[0];
    const canvas = document.querySelector('canvas');
    canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    const renderer = new WorldRenderer(canvas, config);
    await renderer.assets.keep(worldAssetIds(renderer.assets.manifest, state));
    const drawPerson = renderer.drawPerson;
    const reference = document.createElement('canvas'); reference.width = 960; reference.height = 540;
    const ref = reference.getContext('2d', { willReadFrequently: true }); ref.imageSmoothingEnabled = false;
    const results = [];
    for (const meeting of state.buildings.filter(building => building.type === 'meeting')) {
      candidate.x = meeting.x; renderer.cameraX = meeting.x;
      // Un acteur témoin opaque couvre volontairement les accessoires pour tester leur ordre réel.
      renderer.drawPerson = function () {
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.fillRect(350, 220, 260, 290);
      };
      for (const mode of ['sol', 'estrade', 'saut']) {
        candidate.podium_site_id = mode === 'estrade' ? meeting.id : null;
        candidate.combat.height = mode === 'sol' ? 0 : config.balance.buildings.meeting.podium_height + (mode === 'saut' ? 0.1 : 0);
        candidate.combat.jump_tick = mode === 'saut' ? 0 : null;
        renderer.draw(state, state, 1, 1 / 60);
        const frame = meetingSpriteFrame(renderer, state, meeting);
        ref.clearRect(0, 0, 960, 540);
        drawMeetingStageSprite(ref, frame);
        const expected = ref.getImageData(0, 0, 960, 540).data;
        const actual = renderer.ctx.getImageData(0, 0, 960, 540).data;
        for (const [accessory, bounds] of [['banderole', [.25, .10, .75, .45]], ['micro', [.60, .40, .80, .82]]]) {
          let checked = 0, mismatches = 0;
          for (let y = Math.ceil(frame.top + frame.height * bounds[1]); y < frame.top + frame.height * bounds[3]; y++) {
            for (let x = Math.ceil(frame.left + frame.width * bounds[0]); x < frame.left + frame.width * bounds[2]; x++) {
              const i = (y * 960 + x) * 4;
              if (expected[i + 3] < 200) continue;
              checked++;
              const magentaAt = index => actual[index] > 245 && actual[index + 1] < 10 && actual[index + 2] > 245;
              let actorVisible = magentaAt(i);
              // À cette échelle, le micro fait parfois un pixel : accepter un décalage de rastérisation d'un pixel.
              if (mode !== 'sol' && actorVisible) {
                for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
                  if (!magentaAt(((y + dy) * 960 + x + dx) * 4)) actorVisible = false;
                }
              }
              if (actorVisible !== (mode === 'sol')) mismatches++;
            }
          }
          results.push({ biome: meeting.biome_id, mode, accessory, checked, mismatches });
        }
      }
    }
    renderer.drawPerson = drawPerson;
    window.meetingCheck = { renderer, state, candidate };
    return results;
  }, campaignConfig());
  // Captures avec Mélenchon et les vrais décors, assez grandes pour inspecter le micro et les pieds.
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const mode of ['sol', 'centre', 'micro', 'bord-gauche', 'bord-droit']) {
    await page.evaluate(mode => {
      const { renderer, state, candidate } = window.meetingCheck;
      const meeting = state.buildings.find(building => building.type === 'meeting' && building.biome_id === 'banlieue');
      const halfWidth = renderer.config.balance.buildings.meeting.podium_half_width;
      candidate.x = meeting.x + (mode === 'micro' ? 0.55 : mode === 'bord-gauche' ? -halfWidth + 0.05 : mode === 'bord-droit' ? halfWidth - 0.05 : 0);
      candidate.podium_site_id = mode === 'sol' ? null : meeting.id;
      candidate.combat.height = mode === 'sol' ? 0 : renderer.config.balance.buildings.meeting.podium_height;
      candidate.combat.jump_tick = null;
      renderer.cameraX = meeting.x; renderer.resize();
      renderer.draw(state, state, 1, 0);
    }, mode);
    await page.screenshot({ path: path.join(output, `${mode}.png`), clip: { x: 690, y: 520, width: 540, height: 540 } });
    if (mode === 'centre') await page.screenshot({ path: path.join(output, 'centre-ensemble.png') });
  }
  for (const biome of ['paris_19e', 'banlieue', 'periurbain_usine', 'campagne', 'retraites', 'quartiers_riches']) {
    await page.evaluate(biome => {
      const { renderer, state, candidate } = window.meetingCheck;
      const meeting = state.buildings.find(building => building.type === 'meeting' && building.biome_id === biome);
      candidate.x = meeting.x; candidate.podium_site_id = meeting.id;
      candidate.combat.height = renderer.config.balance.buildings.meeting.podium_height;
      renderer.cameraX = meeting.x;
      renderer.draw(state, state, 1, 0);
    }, biome);
    await page.screenshot({ path: path.join(output, `biome-${biome}.png`), clip: { x: 690, y: 520, width: 540, height: 540 } });
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ checks: report, errors }, null, 2));
  for (const result of report) {
    assert.ok(result.checked > 5, `Accessoire visible : ${JSON.stringify(result)}`);
    assert.ok(result.mismatches <= 1, `Profondeur incorrecte : ${JSON.stringify(result)}`);
  }
  console.log(`${report.length} vérifications de profondeur réussies dans Chrome ; captures dans ${output}.`);
} finally {
  await browser.close();
}

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { campaignConfig } from './validate-campaign.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve(process.env.CAMPAIGN_TEST_ARTIFACTS || 'artifacts/npc-affiliation');
const base = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 1 });
  await page.route('**/npc-affiliation-check', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html lang="fr"><meta charset="utf-8"><canvas width="1000" height="400"></canvas></html>' }));
  await page.goto(`${base}/npc-affiliation-check`);
  const results = await page.evaluate(async config => {
    const { characterAssetId, drawIllustratedCharacter } = await import('/src/presentation/illustrated-characters.js');
    const { visualManifest } = await import('/src/presentation/visual-manifest.js');
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#eee2cc'; ctx.fillRect(0, 0, 1000, 400);
    const npcs = Array.from({ length: 20 }, (_, i) => ({ id: `npc:${i + 1}`, origin_subzone_id: 'zone',
      role: 'NEUTRE', faction_id: null, x: 4, facing: 1, combat: { height: 0 }, converted_tick: -1 }));
    const state = { tick: 100, npcs, attacks: [], buildings: [], candidates: [],
      world: { subzones: [{ id: 'zone', biome_id: 'banlieue', start: 0, end: 10 }] } };
    const baseNpc = npcs.find(npc => characterAssetId(npc, state) === 'npc-banlieue-9');
    if (!baseNpc) throw new Error('Portrait de contrôle introuvable');
    const cases = [
      { role: 'NEUTRE', faction_id: null },
      { role: 'SYMPATHISANT', faction_id: 'le_pen' },
      { role: 'MILITANT', faction_id: 'le_pen' },
      { role: 'MILITANT', faction_id: 'melenchon' },
      { role: 'MILITANT', faction_id: 'philippe' },
    ];
    const images = new Map();
    for (const item of cases) {
      const id = characterAssetId({ ...baseNpc, ...item }, state);
      if (images.has(id)) continue;
      const image = new Image(); image.src = visualManifest[id].file;
      try { await image.decode(); } catch { throw new Error(`Image illisible : ${id} (${image.src})`); }
      images.set(id, image);
    }
    const renderer = { ctx, metrics: { groundY: 352, characterHeight: 240 },
      p: config.prototype.presentation, config,
      assets: { get: id => images.get(id), load: async () => null } };
    const ids = [];
    for (let i = 0; i < cases.length; i++) {
      const npc = { ...baseNpc, ...cases[i] };
      ids.push(characterAssetId(npc, state));
      drawIllustratedCharacter(renderer, npc, 100 + i * 200, state);
      ctx.fillStyle = '#182a32'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${cases[i].role} ${cases[i].faction_id || ''}`, 100 + i * 200, 382);
    }
    return ids;
  }, campaignConfig());
  await page.screenshot({ path: path.join(output, 'banlieue-9-roles.png') });
  for (const biome of ['bobo', 'banlieue', 'periurbain', 'campagne', 'retraites', 'riches']) {
    await page.evaluate(async ({ biome, config }) => {
      const { drawIllustratedCharacter } = await import('/src/presentation/illustrated-characters.js');
      const { visualManifest } = await import('/src/presentation/visual-manifest.js');
      const canvas = document.querySelector('canvas'); canvas.width = 1000; canvas.height = 800;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eee2cc'; ctx.fillRect(0, 0, 1000, 800);
      const state = { tick: 100, npcs: [], attacks: [], buildings: [], candidates: [],
        world: { subzones: [{ id: 'zone', biome_id: biome, start: 0, end: 10 }] } };
      let activeImage = null;
      const renderer = { ctx, metrics: { groundY: 0, characterHeight: 155 }, p: config.prototype.presentation,
        config, assets: { get: () => activeImage, load: async () => null } };
      for (let i = 0; i < 20; i++) {
        const image = new Image(); image.src = visualManifest[`npc-${biome}-${i}`].file;
        await image.decode(); activeImage = image;
        const column = i % 5, row = Math.floor(i / 5);
        renderer.metrics.groundY = row * 200 + 170;
        const npc = { id: `npc:${i + 1}`, origin_subzone_id: 'zone', role: 'SYMPATHISANT',
          faction_id: 'le_pen', x: 4, facing: 1, combat: { height: 0 }, converted_tick: -1 };
        drawIllustratedCharacter(renderer, npc, column * 200 + 100, state);
        ctx.fillStyle = '#182a32'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${biome}-${i}`, column * 200 + 100, row * 200 + 195);
      }
    }, { biome, config: campaignConfig() });
    await page.screenshot({ path: path.join(output, `pins-${biome}.png`), fullPage: true });
  }
  console.log('Portraits vérifiés :', results.join(', '));
} finally { await browser.close(); }
